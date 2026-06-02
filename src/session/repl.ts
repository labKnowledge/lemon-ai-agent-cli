import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import pc from 'picocolors';
import type { LemonAgent } from 'lemon-ai-agent';
import type { LemonGrove } from 'lemon-ai-agent';
import type { CliConfig } from '../config.js';
import type { InteractionMode } from '../plan/modes.js';
import { parseSlashCommand, formatModeChange, modeLabel } from '../plan/modes.js';
import { routeInput } from '../plan/pipeline.js';
import { executeShell, printShellResult } from '../tools/shell.js';
import { appendTurn, buildInputWithHistory, loadSession, saveSession } from './memory.js';
import {
  applyModeToSession,
  applyPlanToSession,
  buildPrompt,
  getInteractionMode,
} from './mode-state.js';
import { setupModeKeybindings } from './keybindings.js';

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
      `Mode: ${modeLabel(interactionMode)} | Shift+Tab cycle | /p /py /pv /d | ! shell | /exit\n\n`,
  );

  const rl = createInterface({ input, output, prompt: buildPrompt(interactionMode) });

  setupModeKeybindings(
    rl,
    () => interactionMode,
    (mode) => {
      interactionMode = mode;
      session = applyModeToSession(session, mode);
      void saveSession(session);
      rl.setPrompt(buildPrompt(interactionMode));
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

    const agentInput = buildInputWithHistory(session.messages, userInput);
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
  output.write('\n');
}

function resolveBangCommand(line: string, lastCommand: string | null): string | null {
  if (line === '!!') {
    return lastCommand;
  }
  const withoutBang = line.slice(1).trim();
  return withoutBang || null;
}
