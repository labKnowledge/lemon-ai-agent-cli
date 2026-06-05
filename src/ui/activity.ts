export type ActivityPhase = 'thinking' | 'tool' | 'plan' | 'scan' | 'delegate' | 'approval';

export interface ActivityState {
  phase: ActivityPhase;
  label: string;
  detail?: string;
  startedAt: number;
}

const TOOL_LABELS: Record<string, string> = {
  read_file: 'Reading file',
  write_file: 'Writing file',
  list_directory: 'Listing directory',
  glob_files: 'Searching files',
  run_command: 'Running shell',
  poll_command: 'Polling shell',
  kill_command: 'Stopping shell',
  list_commands: 'Listing shells',
  scan_codebase: 'Scanning codebase',
  pagespeed_insights: 'Running PageSpeed',
};

export function toolActivityLabel(toolName: string): string {
  return TOOL_LABELS[toolName] ?? `Running ${toolName}`;
}

export function thinkingActivity(): ActivityState {
  return {
    phase: 'thinking',
    label: 'Lemon is thinking...',
    startedAt: Date.now(),
  };
}

export function toolActivity(toolName: string, detail?: string): ActivityState {
  return {
    phase: 'tool',
    label: toolActivityLabel(toolName),
    detail,
    startedAt: Date.now(),
  };
}

export function planActivity(label = 'Building plan...'): ActivityState {
  return {
    phase: 'plan',
    label,
    startedAt: Date.now(),
  };
}

export function scanActivity(): ActivityState {
  return {
    phase: 'scan',
    label: 'Scanning codebase...',
    startedAt: Date.now(),
  };
}

export function delegateActivity(label = 'Coordinating specialists'): ActivityState {
  return {
    phase: 'delegate',
    label,
    startedAt: Date.now(),
  };
}

export function approvalActivity(toolName: string): ActivityState {
  return {
    phase: 'approval',
    label: `Approval needed: ${toolName}`,
    startedAt: Date.now(),
  };
}

export function formatToolDetail(input: unknown): string | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const entries = Object.entries(input as Record<string, unknown>)
    .filter(([, v]) => v != null)
    .map(([k, v]) => {
      const val = typeof v === 'string' && v.length > 60 ? `${v.slice(0, 57)}...` : String(v);
      return `${k}=${JSON.stringify(val)}`;
    });
  const joined = entries.join(' ');
  if (!joined) return undefined;
  return joined.length > 80 ? `${joined.slice(0, 77)}...` : joined;
}

export function activityUsesSecondLine(phase: ActivityPhase): boolean {
  return phase === 'tool' || phase === 'delegate';
}
