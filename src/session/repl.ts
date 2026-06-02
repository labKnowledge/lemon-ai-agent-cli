import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import pc from 'picocolors';
import type { LemonAgent } from 'lemon-ai-agent';
import type { CliConfig } from '../config.js';
import { executeShell, printShellResult } from '../tools/shell.js';
import { appendTurn, buildInputWithHistory, loadSession } from './memory.js';
import { defaultStreamHandlers, streamAgentResponse } from '../ui/stream.js';

export async function runRepl(agent: LemonAgent, config: CliConfig): Promise<void> {
  const session = await loadSession(config.sessionId);
  let lastBangCommand: string | null = null;

  output.write(
    pc.bold('Lemon Agent CLI') +
      ` | model: ${config.model} | cwd: ${config.cwd} | approval: ${config.approval}\n` +
      `Type ${pc.dim('!command')} for direct shell, ${pc.dim('!!')} to repeat, ${pc.dim('/exit')} to quit.\n\n`,
  );

  const rl = createInterface({ input, output, prompt: pc.green('lemon> ') });

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

    const agentInput = buildInputWithHistory(session.messages, trimmed);
    output.write('\n');

    const response = await streamAgentResponse(agent, agentInput, defaultStreamHandlers());
    output.write('\n');

    const updated = await appendTurn(config.sessionId, trimmed, response);
    session.messages = updated.messages;

    rl.prompt();
  }

  rl.close();
  output.write('\n');
}

function resolveBangCommand(input: string, lastCommand: string | null): string | null {
  if (input === '!!') {
    return lastCommand;
  }
  const withoutBang = input.slice(1).trim();
  return withoutBang || null;
}
