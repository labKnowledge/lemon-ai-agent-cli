import type { HumanGate, PendingAction } from 'lemon-ai-agent';
import type { ApprovalMode } from './modes.js';
import { requiresApproval } from './modes.js';
import { askUser } from '../session/prompt.js';
import { registry } from '../runtime/process-registry.js';

export function createShellGate(mode: ApprovalMode): HumanGate {
  return async (action: PendingAction) => {
    if (action.tool === 'run_command') {
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
    }

    if (action.tool === 'kill_command') {
      if (mode === 'yolo') {
        return { approved: true };
      }

      const killInput = action.input as { shell_id?: string };
      const shellId = killInput?.shell_id ?? 'unknown';
      const shell = registry.get(shellId);
      const approved = await promptApproval(
        `kill background shell ${shellId}`,
        shell?.cwd ?? process.cwd(),
      );
      if (!approved) {
        return { approved: false, reason: 'User denied killing background shell' };
      }
      return { approved: true };
    }

    return { approved: true };
  };
}

export async function promptApproval(command: string, cwd: string): Promise<boolean> {
  const answer = await askUser(`Command: ${command}\nCWD: ${cwd}\nApprove? [y/N]`);
  return answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes';
}
