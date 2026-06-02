import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import pc from 'picocolors';
import type { LemonAgent } from 'lemon-ai-agent';
import type { LemonGrove } from 'lemon-ai-agent';
import type { CliConfig } from '../config.js';
import type { InteractionMode } from '../plan/modes.js';
import { parseSlashCommand, formatModeChange, modeLabel } from '../plan/modes.js';
import { routeInput } from '../plan/pipeline.js';
import { scanCodebase } from '../codebase/scan.js';
import { executeShell, printShellResult } from '../tools/shell.js';
import {
  appendTurn,
  buildInputWithContext,
  loadSession,
  saveSession,
  saveCodebaseContext,
} from './memory.js';
import {
  applyModeToSession,
  applyPlanToSession,
  buildPrompt,
  getInteractionMode,
} from './mode-state.js';
import { setupModeKeybindings } from './keybindings.js';
import { refreshPromptPreservingInput } from './readline-utils.js';
import { setSharedPromptAsk } from './prompt.js';

export async function runRepl(
  agent: LemonAgent,
  grove: LemonGrove,
  config: CliConfig,
): Promise<void> {
  let session = await loadSession(config.sessionId);
  let interactionMode = getInteractionMode(session);
  let lastBangCommand: string | null = null;

  output.write(
    pc.bold('Lemon Agent CLI') +
      ` | model: ${config.model} | cwd: ${config.cwd} | approval: ${config.approval}\n` +
      `Mode: ${modeLabel(interactionMode)} | Shift+Tab cycle | /p /py /pv /d | /scan | ! shell | /exit\n\n`,
  );

  const rl = createInterface({ input, output, prompt: buildPrompt(interactionMode) });
  setSharedPromptAsk((p) => rl.question(p));

  setupModeKeybindings(
    rl,
    () => interactionMode,
    (mode, savedLine, savedCursor) => {
      interactionMode = mode;
      session = applyModeToSession(session, mode);
      void saveSession(session);
      rl.setPrompt(buildPrompt(interactionMode));
      refreshPromptPreservingInput(rl, savedLine, savedCursor);
    },
  );

  rl.prompt();

  for await (const line of rl) {
    const trimmed = line.trim();

    if (!trimmed) {
      rl.prompt();
      continue;
    }

    if (trimmed === '/exit' || trimmed === '/quit') {
      break;
    }

    if (trimmed === '/scan') {
      output.write(pc.cyan('\nScanning codebase...\n'));
      const result = await scanCodebase(config.cwd, { depth: 2 });
      session = await saveCodebaseContext(config.sessionId, result.summary, result.scannedAt);
      output.write(`\n${result.summary}\n\n`);
      rl.prompt();
      continue;
    }

    if (trimmed.startsWith('!')) {
      const command = resolveBangCommand(trimmed, lastBangCommand);
      if (!command) {
        output.write(pc.yellow('No previous bang command to repeat.\n'));
        rl.prompt();
        continue;
      }

      lastBangCommand = command;
      const result = await executeShell(command, config.cwd, {
        workspaceCwd: config.cwd,
        approval: config.approval,
      });
      printShellResult(result);
      output.write('\n');
      rl.prompt();
      continue;
    }

    const slash = parseSlashCommand(trimmed);
    if (slash?.mode && !slash.prompt) {
      interactionMode = slash.mode;
      session = applyModeToSession(session, interactionMode);
      await saveSession(session);
      output.write(`${formatModeChange(interactionMode)}\n`);
      rl.setPrompt(buildPrompt(interactionMode));
      rl.prompt();
      continue;
    }

    let userInput = trimmed;
    let modeForTurn: InteractionMode = interactionMode;

    if (slash?.mode) {
      modeForTurn = slash.mode;
      interactionMode = slash.mode;
      session = applyModeToSession(session, interactionMode);
      await saveSession(session);
      rl.setPrompt(buildPrompt(interactionMode));
      userInput = slash.prompt ?? trimmed;
    }

    const agentInput = buildInputWithContext(
      session.messages,
      userInput,
      session.codebaseContext,
    );
    output.write('\n');

    const result = await routeInput(modeForTurn, agentInput, agent, grove, config);
    output.write('\n');

    if (result.plan) {
      session = applyPlanToSession(session, result.plan);
      await saveSession(session);
    }

    if (!result.cancelled) {
      const updated = await appendTurn(config.sessionId, userInput, result.output);
      session.messages = updated.messages;
    }

    rl.prompt();
  }

  rl.close();
  setSharedPromptAsk(null);
  output.write('\n');
}

function resolveBangCommand(line: string, lastCommand: string | null): string | null {
  if (line === '!!') {
    return lastCommand;
  }
  const withoutBang = line.slice(1).trim();
  return withoutBang || null;
}
