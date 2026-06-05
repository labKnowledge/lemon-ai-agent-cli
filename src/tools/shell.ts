import { spawn } from 'node:child_process';
import { lemonTool, z } from 'lemon-ai-agent';
import type { ApprovalMode } from '../approval/modes.js';
import { requiresApproval } from '../approval/modes.js';
import { promptApproval } from '../approval/gate.js';
import { resolveWithinCwd } from './path-utils.js';
import { bridgeAppend } from '../ui/bridge.js';
import {
  formatPollResult,
  formatStartResult,
  MAX_OUTPUT,
  registry,
} from '../runtime/process-registry.js';

export { MAX_OUTPUT };
export const DEFAULT_TIMEOUT = 120_000;

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ShellRunnerOptions {
  workspaceCwd: string;
  approval: ApprovalMode;
  skipApproval?: boolean;
}

function truncate(text: string): string {
  if (text.length <= MAX_OUTPUT) return text;
  return `${text.slice(0, MAX_OUTPUT)}\n\n... [truncated ${text.length - MAX_OUTPUT} chars]`;
}

export function spawnShellChild(command: string, cwd: string) {
  return spawn(command, {
    cwd,
    shell: true,
    env: process.env,
  });
}

export async function executeShell(
  command: string,
  cwd: string,
  options: ShellRunnerOptions,
  timeoutMs = DEFAULT_TIMEOUT,
): Promise<ShellResult> {
  if (!options.skipApproval && requiresApproval(options.approval, command)) {
    const approved = await promptApproval(command, cwd);
    if (!approved) {
      return {
        stdout: '',
        stderr: 'Command execution denied by user.',
        exitCode: 1,
      };
    }
  }

  try {
    const result = await runShellProcess(command, cwd, timeoutMs);
    return result;
  } catch (err: unknown) {
    return {
      stdout: '',
      stderr: String(err),
      exitCode: 1,
    };
  }
}

function runShellProcess(command: string, cwd: string, timeoutMs: number): Promise<ShellResult> {
  return new Promise((resolve) => {
    const child = spawnShellChild(command, cwd);

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      resolve({
        stdout: truncate(stdout),
        stderr: `Command timed out after ${timeoutMs}ms`,
        exitCode: 1,
      });
    }, timeoutMs);

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
      if (stdout.length > MAX_OUTPUT * 2) child.kill('SIGTERM');
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
      if (stderr.length > MAX_OUTPUT * 2) child.kill('SIGTERM');
    });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        stdout: truncate(stdout),
        stderr: truncate(stderr || String(err)),
        exitCode: 1,
      });
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        stdout: truncate(stdout),
        stderr: truncate(stderr),
        exitCode: code ?? 1,
      });
    });
  });
}

function formatShellResult(result: ShellResult): string {
  const parts: string[] = [`exit code: ${result.exitCode}`];
  if (result.stdout) parts.push(`stdout:\n${result.stdout}`);
  if (result.stderr) parts.push(`stderr:\n${result.stderr}`);
  return parts.join('\n\n');
}

export function createShellTool(workspaceCwd: string, approval: ApprovalMode) {
  return lemonTool({
    name: 'run_command',
    description:
      'Run a shell command in the workspace. Use block_until_ms: 0 to start a background process without blocking — each call creates a NEW independent shell with its own shell_id; prior shells keep running in parallel with no limit. Shells stay accessible until kill_command or CLI exit. Use list_commands to see all shells, poll_command for output, kill_command to stop one.',
    schema: z.object({
      command: z.string().describe('Shell command to execute'),
      cwd: z
        .string()
        .optional()
        .describe('Subdirectory within workspace (defaults to workspace root)'),
      timeout_ms: z
        .number()
        .optional()
        .describe('Foreground timeout in milliseconds (default 120000)'),
      block_until_ms: z
        .number()
        .optional()
        .describe(
          'How long to wait before returning. Omit to wait for completion. 0 starts in background immediately. Positive values return a snapshot after waiting.',
        ),
      pattern: z
        .string()
        .optional()
        .describe('When blocking, stop early if combined output matches this regex'),
    }),
    irreversible: approval !== 'yolo',
    run: async ({ command, cwd, timeout_ms, block_until_ms, pattern }) => {
      const runCwd = cwd ? resolveWithinCwd(workspaceCwd, cwd) : workspaceCwd;

      if (block_until_ms !== undefined) {
        const denied = await ensureShellApproval(command, runCwd, approval, approval !== 'yolo');
        if (denied) return denied;

        const started = registry.startBackground(command, runCwd);

        if (block_until_ms === 0) {
          return formatStartResult(started);
        }

        const polled = await registry.poll(started.id, {
          blockUntilMs: block_until_ms,
          pattern,
        });
        return polled ? formatPollResult(polled) : `Unknown shell_id: ${started.id}`;
      }

      const result = await executeShell(
        command,
        runCwd,
        { workspaceCwd, approval, skipApproval: approval !== 'yolo' },
        timeout_ms ?? DEFAULT_TIMEOUT,
      );
      return formatShellResult(result);
    },
  });
}

async function ensureShellApproval(
  command: string,
  cwd: string,
  approval: ApprovalMode,
  skipApproval: boolean,
): Promise<string | null> {
  if (skipApproval || !requiresApproval(approval, command)) {
    return null;
  }
  const approved = await promptApproval(command, cwd);
  if (!approved) return 'Command execution denied by user.';
  return null;
}

export function printShellResult(result: ShellResult): void {
  const parts: string[] = [];
  if (result.stdout) parts.push(result.stdout);
  if (result.stderr) parts.push(result.stderr);
  if (!result.stdout && !result.stderr) {
    parts.push(`(exit code ${result.exitCode})`);
  } else if (result.exitCode !== 0) {
    parts.push(`(exit code ${result.exitCode})`);
  }
  bridgeAppend({ type: 'shell', text: parts.join('\n'), fg: '#a9b1d6' });
}
