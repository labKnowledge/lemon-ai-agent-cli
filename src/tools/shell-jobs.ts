import { lemonTool, z } from 'lemon-ai-agent';
import type { ApprovalMode } from '../approval/modes.js';
import { requiresApproval } from '../approval/modes.js';
import { promptApproval } from '../approval/gate.js';
import {
  formatPollResult,
  formatShellList,
  registry,
  type PollOptions,
} from '../runtime/process-registry.js';

async function ensureKillApproval(
  shellId: string,
  approval: ApprovalMode,
  skipApproval: boolean,
): Promise<string | null> {
  if (skipApproval || !requiresApproval(approval, `kill ${shellId}`)) {
    return null;
  }
  const shell = registry.get(shellId);
  const approved = await promptApproval(
    `kill background shell ${shellId}`,
    shell?.cwd ?? process.cwd(),
  );
  if (!approved) return 'Kill denied by user.';
  return null;
}

export function createShellJobTools(approval: ApprovalMode) {
  const skipApproval = approval !== 'yolo';

  const pollCommand = lemonTool({
    name: 'poll_command',
    description:
      'Poll a background shell for new output and status. Each shell_id is independent — use list_commands to find all active shells.',
    schema: z.object({
      shell_id: z.string().describe('Background shell id returned by run_command'),
      block_until_ms: z
        .number()
        .optional()
        .describe('Wait up to this many ms for new output or exit (default 0)'),
      pattern: z
        .string()
        .optional()
        .describe('Optional regex; stop waiting early when output matches'),
    }),
    run: async ({ shell_id, block_until_ms, pattern }) => {
      const options: PollOptions = {
        blockUntilMs: block_until_ms,
        pattern,
      };
      const result = await registry.poll(shell_id, options);
      if (!result) return `Unknown shell_id: ${shell_id}`;
      return formatPollResult(result);
    },
  });

  const killCommand = lemonTool({
    name: 'kill_command',
    description: 'Stop a background shell started with run_command.',
    schema: z.object({
      shell_id: z.string().describe('Background shell id to stop'),
      signal: z
        .enum(['SIGTERM', 'SIGKILL'])
        .optional()
        .describe('Signal to send (default SIGTERM)'),
    }),
    irreversible: approval !== 'yolo',
    run: async ({ shell_id, signal }) => {
      const denied = await ensureKillApproval(shell_id, approval, skipApproval);
      if (denied) return denied;

      const result = await registry.kill(shell_id, signal ?? 'SIGTERM');
      if (!result) return `Unknown shell_id: ${shell_id}`;
      return formatPollResult(result);
    },
  });

  const listCommands = lemonTool({
    name: 'list_commands',
    description:
      'List all tracked background shells and their status. Use to recover shell_ids for parallel background processes.',
    schema: z.object({}),
    run: async () => formatShellList(registry.list()),
  });

  return [pollCommand, killCommand, listCommands];
}
