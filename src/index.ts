import { readFile } from 'node:fs/promises';
import { Command } from 'commander';
import { resolveConfig, maskKey } from './config.ts';
import { createAgent } from './agent/create-agent.ts';
import { createGrove } from './grove/create-grove.ts';
import { startTui } from './tui/bootstrap.tsx';

export async function runCli(argv: string[]): Promise<void> {
  const program = new Command();

  program
    .name('lemon')
    .description('Lemon Code — CLI agent powered by lemon-ai-agent and Google Gemini')
    .option('-p, --print <prompt>', 'Run a one-shot prompt and print the result')
    .option('-f, --file <path>', 'Read prompt from a file (use with -p/--print)')
    .option('--plan-yolo', 'One-shot: plan and auto-select best path (requires -p)')
    .option('--cwd <path>', 'Workspace directory for tools', process.cwd())
    .option('--approval <mode>', 'Shell approval mode: always, smart, or yolo', 'always')
    .option('--model <model>', 'Model id', 'gemini-2.5-flash')
    .option('--session <id>', 'Session id for conversation persistence', 'default');

  program
    .command('config')
    .description('Show resolved configuration')
    .action(async (_, cmd) => {
      const opts = cmd.parent?.opts() ?? {};
      const config = resolveConfig({
        ...opts,
        planYolo: opts.planYolo ?? false,
      });
      console.log(
        JSON.stringify(
          {
            cwd: config.cwd,
            model: config.model,
            approval: config.approval,
            sessionId: config.sessionId,
            planYolo: config.planYolo,
            googleApiKey: maskKey(config.googleApiKey),
          },
          null,
          2,
        ),
      );
    });

  program.action(async (opts) => {
    const config = resolveConfig({
      cwd: opts.cwd,
      model: opts.model,
      approval: opts.approval,
      session: opts.session,
      planYolo: opts.planYolo ?? false,
    });

    if (!config.googleApiKey) {
      console.error('Error: GOOGLE_API_KEY is not set. Add it to .env or your environment.');
      process.exit(1);
    }

    let prompt = opts.print as string | undefined;

    if (opts.file) {
      prompt = await readFile(opts.file, 'utf-8');
    }

    const trimmedPrompt = prompt?.trim();

    if (config.planYolo && !trimmedPrompt) {
      console.error('Note: --plan-yolo requires -p/--print.');
    }

    const [agent, grove] = await Promise.all([createAgent(config), createGrove(config)]);

    await startTui({
      config,
      agent,
      grove,
      initialPrompt: trimmedPrompt,
      autoRun: Boolean(trimmedPrompt),
      planYoloOneShot: config.planYolo && Boolean(trimmedPrompt),
    });
  });

  await program.parseAsync(argv);
}
