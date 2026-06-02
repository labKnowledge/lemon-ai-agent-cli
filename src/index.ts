import { readFile } from 'node:fs/promises';
import { Command } from 'commander';
import pc from 'picocolors';
import { resolveConfig, maskKey } from './config.js';
import { createAgent } from './agent/create-agent.js';
import { runRepl } from './session/repl.js';
import { appendTurn, buildInputWithHistory, loadSession } from './session/memory.js';
import { defaultStreamHandlers, streamAgentResponse } from './ui/stream.js';

export async function runCli(argv: string[]): Promise<void> {
  const program = new Command();

  program
    .name('lemon')
    .description('CLI agent powered by lemon-ai-agent and Google Gemini')
    .option('-p, --print <prompt>', 'Run a one-shot prompt and print the result')
    .option('-f, --file <path>', 'Read prompt from a file (use with -p/--print)')
    .option('--cwd <path>', 'Workspace directory for tools', process.cwd())
    .option(
      '--approval <mode>',
      'Shell approval mode: always, smart, or yolo',
      'always',
    )
    .option('--model <model>', 'Model id', 'gemini-2.5-flash')
    .option('--session <id>', 'Session id for conversation persistence', 'default')
    .hook('preAction', () => {
      // dotenv loaded in config.ts
    });

  program
    .command('config')
    .description('Show resolved configuration')
    .action(async (_, cmd) => {
      const opts = cmd.parent?.opts() ?? {};
      const config = resolveConfig(opts);
      console.log(JSON.stringify(
        {
          cwd: config.cwd,
          model: config.model,
          approval: config.approval,
          sessionId: config.sessionId,
          googleApiKey: maskKey(config.googleApiKey),
        },
        null,
        2,
      ));
    });

  program.action(async (opts) => {
    const config = resolveConfig(opts);

    if (!config.googleApiKey) {
      console.error(pc.red('Error: GOOGLE_API_KEY is not set. Add it to .env or your environment.'));
      process.exit(1);
    }

    let prompt = opts.print as string | undefined;

    if (opts.file) {
      prompt = await readFile(opts.file, 'utf-8');
    }

    const agent = await createAgent(config);

    if (prompt) {
      await runPrintMode(agent, config, prompt.trim());
      return;
    }

    await runRepl(agent, config);
  });

  await program.parseAsync(argv);
}

async function runPrintMode(
  agent: Awaited<ReturnType<typeof createAgent>>,
  config: ReturnType<typeof resolveConfig>,
  prompt: string,
): Promise<void> {
  const session = await loadSession(config.sessionId);
  const agentInput = buildInputWithHistory(session.messages, prompt);

  const output = await streamAgentResponse(agent, agentInput, defaultStreamHandlers());
  process.stdout.write('\n');

  if (config.sessionId) {
    await appendTurn(config.sessionId, prompt, output);
  }
}
