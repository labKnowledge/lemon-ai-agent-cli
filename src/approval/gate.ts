import { stdout as output } from 'node:process';
import pc from 'picocolors';
import type { HumanGate, PendingAction } from 'lemon-ai-agent';
import type { ApprovalMode } from './modes.js';
import { requiresApproval } from './modes.js';
import { askUser } from '../session/prompt.js';

export function createShellGate(mode: ApprovalMode): HumanGate {
  return async (action: PendingAction) => {
    if (action.tool !== 'run_command') {
      return { approved: true };
    }

    const shellInput = action.input as { command?: string; cwd?: string };
    const command = shellInput?.command ?? '';
    const cwd = shellInput?.cwd ?? process.cwd();

    if (!requiresApproval(mode, command)) {
      return { approved: true };
    }

    const approved = await promptApproval(command, cwd);
    if (!approved) {
      return { approved: false, reason: 'User denied command execution' };
    }
    return { approved: true };
  };
}

export async function promptApproval(command: string, cwd: string): Promise<boolean> {
  const answer = await askUser(`\n  Command: ${command}\n  CWD: ${cwd}\n  Approve? [y/N] `);
  return answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes';
}
