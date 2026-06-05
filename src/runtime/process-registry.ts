import { spawn, type ChildProcess } from 'node:child_process';

export const MAX_OUTPUT = 32_768;
const CLEANUP_AFTER_MS = 30 * 60 * 1000;
const KILL_GRACE_MS = 5_000;

export type ShellStatus = 'running' | 'exited' | 'killed' | 'error';

export interface BackgroundShell {
  id: string;
  command: string;
  cwd: string;
  pid: number;
  status: ShellStatus;
  exitCode?: number;
  startedAt: number;
  exitedAt?: number;
  stdout: string;
  stderr: string;
  stdoutOffset: number;
  stderrOffset: number;
  child: ChildProcess;
}

export interface StartBackgroundResult {
  id: string;
  pid: number;
  status: ShellStatus;
}

export interface PollResult {
  id: string;
  status: ShellStatus;
  pid: number;
  exitCode?: number;
  stdout: string;
  stderr: string;
}

export interface ShellSummary {
  id: string;
  command: string;
  cwd: string;
  pid: number;
  status: ShellStatus;
  exitCode?: number;
  startedAt: number;
}

export interface PollOptions {
  blockUntilMs?: number;
  pattern?: string;
}

function truncate(text: string): string {
  if (text.length <= MAX_OUTPUT) return text;
  return `${text.slice(0, MAX_OUTPUT)}\n\n... [truncated ${text.length - MAX_OUTPUT} chars]`;
}

function readIncremental(buffer: string, offset: number): { text: string; newOffset: number } {
  if (offset >= buffer.length) return { text: '', newOffset: offset };
  const text = truncate(buffer.slice(offset));
  return { text, newOffset: buffer.length };
}

function combinedOutput(shell: BackgroundShell): string {
  return shell.stdout + shell.stderr;
}

function matchesPattern(shell: BackgroundShell, pattern?: string): boolean {
  if (!pattern) return false;
  try {
    const regex = new RegExp(pattern, 'm');
    return regex.test(combinedOutput(shell));
  } catch {
    return combinedOutput(shell).includes(pattern);
  }
}

function attachOutputHandlers(shell: BackgroundShell): void {
  const { child } = shell;

  child.stdout?.on('data', (chunk: Buffer) => {
    shell.stdout += chunk.toString();
    if (shell.stdout.length > MAX_OUTPUT * 2) {
      void registry.kill(shell.id, 'SIGTERM');
    }
  });

  child.stderr?.on('data', (chunk: Buffer) => {
    shell.stderr += chunk.toString();
    if (shell.stderr.length > MAX_OUTPUT * 2) {
      void registry.kill(shell.id, 'SIGTERM');
    }
  });

  child.on('error', () => {
    shell.status = 'error';
    shell.exitCode = 1;
    shell.exitedAt = Date.now();
  });

  child.on('close', (code) => {
    if (shell.status === 'killed') return;
    shell.status = 'exited';
    shell.exitCode = code ?? 1;
    shell.exitedAt = Date.now();
  });
}

function snapshotPoll(shell: BackgroundShell): PollResult {
  const stdout = readIncremental(shell.stdout, shell.stdoutOffset);
  const stderr = readIncremental(shell.stderr, shell.stderrOffset);
  shell.stdoutOffset = stdout.newOffset;
  shell.stderrOffset = stderr.newOffset;

  return {
    id: shell.id,
    status: shell.status,
    pid: shell.pid,
    exitCode: shell.exitCode,
    stdout: stdout.text,
    stderr: stderr.text,
  };
}

function waitForPoll(shell: BackgroundShell, options: PollOptions): Promise<PollResult> {
  const blockUntilMs = options.blockUntilMs ?? 0;
  if (blockUntilMs <= 0) {
    return Promise.resolve(snapshotPoll(shell));
  }

  return new Promise((resolve) => {
    const deadline = Date.now() + blockUntilMs;
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      clearInterval(interval);
      child.stdout?.off('data', onData);
      child.stderr?.off('data', onData);
      child.off('close', onClose);
      resolve(snapshotPoll(shell));
    };

    const shouldStop = () => {
      if (shell.status !== 'running') return true;
      if (matchesPattern(shell, options.pattern)) return true;
      return false;
    };

    const onData = () => {
      if (shouldStop()) finish();
    };

    const onClose = () => {
      finish();
    };

    const { child } = shell;
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.on('close', onClose);

    const interval = setInterval(() => {
      if (Date.now() >= deadline || shouldStop()) {
        finish();
      }
    }, 50);

    if (shouldStop()) {
      finish();
    }
  });
}

class ProcessRegistry {
  private shells = new Map<string, BackgroundShell>();
  private nextId = 1;

  startBackground(command: string, cwd: string): StartBackgroundResult {
    this.cleanupExited();

    const child = spawn(command, {
      cwd,
      shell: true,
      env: process.env,
    });

    const id = `shell-${this.nextId++}`;
    const shell: BackgroundShell = {
      id,
      command,
      cwd,
      pid: child.pid ?? 0,
      status: 'running',
      startedAt: Date.now(),
      stdout: '',
      stderr: '',
      stdoutOffset: 0,
      stderrOffset: 0,
      child,
    };

    attachOutputHandlers(shell);
    this.shells.set(id, shell);

    return { id, pid: shell.pid, status: shell.status };
  }

  get(id: string): BackgroundShell | undefined {
    return this.shells.get(id);
  }

  async poll(id: string, options: PollOptions = {}): Promise<PollResult | null> {
    const shell = this.shells.get(id);
    if (!shell) return null;
    return waitForPoll(shell, options);
  }

  async kill(id: string, signal: NodeJS.Signals = 'SIGTERM'): Promise<PollResult | null> {
    const shell = this.shells.get(id);
    if (!shell) return null;

    if (shell.status === 'running') {
      shell.status = 'killed';
      shell.child.kill(signal);

      if (signal !== 'SIGKILL') {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(() => {
            if (shell.status === 'killed' && shell.child.exitCode === null) {
              try {
                shell.child.kill('SIGKILL');
              } catch {
                // process may have exited between check and kill
              }
            }
            resolve();
          }, KILL_GRACE_MS);

          shell.child.once('close', () => {
            clearTimeout(timer);
            resolve();
          });
        });
      } else {
        await new Promise<void>((resolve) => {
          if (shell.child.exitCode !== null) {
            resolve();
            return;
          }
          shell.child.once('close', () => resolve());
        });
      }

      if (shell.exitCode === undefined) {
        shell.exitCode = signal === 'SIGKILL' ? 137 : 143;
        shell.exitedAt = Date.now();
      }
    }

    return snapshotPoll(shell);
  }

  list(): ShellSummary[] {
    return [...this.shells.values()].map((shell) => ({
      id: shell.id,
      command: shell.command,
      cwd: shell.cwd,
      pid: shell.pid,
      status: shell.status,
      exitCode: shell.exitCode,
      startedAt: shell.startedAt,
    }));
  }

  countRunning(): number {
    return [...this.shells.values()].filter((s) => s.status === 'running').length;
  }

  countAll(): number {
    return this.shells.size;
  }

  cleanupExited(): void {
    const cutoff = Date.now() - CLEANUP_AFTER_MS;
    for (const [id, shell] of this.shells) {
      if (shell.status !== 'running' && shell.exitedAt && shell.exitedAt < cutoff) {
        this.shells.delete(id);
      }
    }
  }

  killAll(): void {
    for (const shell of this.shells.values()) {
      if (shell.status === 'running') {
        try {
          shell.child.kill('SIGTERM');
        } catch {
          // ignore
        }
      }
    }
    this.shells.clear();
  }
}

export const registry = new ProcessRegistry();

function shellSummaryLine(): string {
  const running = registry.countRunning();
  const total = registry.countAll();
  const exited = total - running;
  if (total === 0) return 'Background shells: none';
  const exitedPart = exited > 0 ? `, ${exited} exited/killed` : '';
  return `Background shells: ${running} running${exitedPart}`;
}

export function formatStartResult(started: StartBackgroundResult): string {
  const parts: string[] = [
    shellSummaryLine(),
    `shell_id: ${started.id}`,
    `status: ${started.status}`,
    `pid: ${started.pid}`,
    `active_background_shells: ${registry.countRunning()}`,
    'note: This is a new independent shell. Prior shells keep running in parallel with no limit. Use list_commands to see all shell_ids. Kill each with kill_command when done.',
  ];
  return parts.join('\n\n');
}

export function formatPollResult(result: PollResult): string {
  const parts: string[] = [
    shellSummaryLine(),
    `shell_id: ${result.id}`,
    `status: ${result.status}`,
    `pid: ${result.pid}`,
  ];
  if (result.exitCode !== undefined) parts.push(`exit code: ${result.exitCode}`);
  if (result.stdout) parts.push(`stdout:\n${result.stdout}`);
  if (result.stderr) parts.push(`stderr:\n${result.stderr}`);
  if (!result.stdout && !result.stderr && result.status === 'running') {
    parts.push('(no new output)');
  }
  return parts.join('\n\n');
}

export function formatShellList(summaries: ShellSummary[]): string {
  if (summaries.length === 0) {
    return `${shellSummaryLine()}\n\nNo background shells. Start with run_command and block_until_ms: 0.`;
  }
  const lines = summaries.map((s) => {
    const exit = s.exitCode !== undefined ? ` exit=${s.exitCode}` : '';
    return `${s.id} [${s.status}] pid=${s.pid}${exit} cwd=${s.cwd} command=${s.command}`;
  });
  return `${shellSummaryLine()}\n\n${lines.join('\n')}`;
}
