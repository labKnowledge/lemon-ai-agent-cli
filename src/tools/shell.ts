import { spawn } from 'node:child_process';
import { lemonTool, z } from 'lemon-ai-agent';
import type { ApprovalMode } from '../approval/modes.js';
import { requiresApproval } from '../approval/modes.js';
import { promptApproval } from '../approval/gate.js';
import { resolveWithinCwd } from './path-utils.js';

const MAX_OUTPUT = 32_768;
const DEFAULT_TIMEOUT = 120_000;

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ShellRunnerOptions {
  workspaceCwd: string;
  approval: ApprovalMode;
  /** When true, skip interactive approval (used when gate already handled it). */
  skipApproval?: boolean;
}

function truncate(text: string): string {
  if (text.length <= MAX_OUTPUT) return text;
  return `${text.slice(0, MAX_OUTPUT)}\n\n... [truncated ${text.length - MAX_OUTPUT} chars]`;
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

function runShellProcess(
  command: string,
  cwd: string,
  timeoutMs: number,
): Promise<ShellResult> {
  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      env: process.env,
    });

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
      'Run a shell command in the workspace. Use for tests, builds, git, package managers, and other CLI tasks.',
    schema: z.object({
      command: z.string().describe('Shell command to execute'),
      cwd: z
        .string()
        .optional()
        .describe('Subdirectory within workspace (defaults to workspace root)'),
      timeout_ms: z
        .number()
        .optional()
        .describe('Timeout in milliseconds (default 120000)'),
    }),
    irreversible: approval !== 'yolo',
    run: async ({ command, cwd, timeout_ms }) => {
      const runCwd = cwd ? resolveWithinCwd(workspaceCwd, cwd) : workspaceCwd;
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

export function printShellResult(result: ShellResult): void {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (!result.stdout && !result.stderr) {
    process.stdout.write(`\n(exit code ${result.exitCode})\n`);
  } else if (result.exitCode !== 0) {
    process.stdout.write(`\n(exit code ${result.exitCode})\n`);
  }
}
