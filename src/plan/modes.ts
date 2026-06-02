export type InteractionMode = 'direct' | 'plan' | 'plan-yolo' | 'plan-verbose';

export type PlanMode = Exclude<InteractionMode, 'direct'>;

const CYCLE: InteractionMode[] = ['direct', 'plan', 'plan-yolo', 'plan-verbose'];

const LABELS: Record<InteractionMode, string> = {
  direct: 'direct',
  plan: 'plan',
  'plan-yolo': 'plan-yolo',
  'plan-verbose': 'plan-verbose',
};

const DESCRIPTIONS: Record<InteractionMode, string> = {
  direct: 'Execute immediately without planning',
  plan: 'Plan first, ask critical questions, wait for approval',
  'plan-yolo': 'Plan first, auto-select highest-scored path',
  'plan-verbose': 'Plan first, verbose Q&A, then approval',
};

export function cycleMode(current: InteractionMode): InteractionMode {
  const idx = CYCLE.indexOf(current);
  return CYCLE[(idx + 1) % CYCLE.length]!;
}

export function modeLabel(mode: InteractionMode): string {
  return LABELS[mode];
}

export function modeDescription(mode: InteractionMode): string {
  return DESCRIPTIONS[mode];
}

export function isPlanMode(mode: InteractionMode): mode is PlanMode {
  return mode !== 'direct';
}

const SLASH_MAP: Record<string, InteractionMode> = {
  '/plan': 'plan',
  '/p': 'plan',
  '/plan-yolo': 'plan-yolo',
  '/py': 'plan-yolo',
  '/plan-verbose': 'plan-verbose',
  '/pv': 'plan-verbose',
  '/direct': 'direct',
  '/d': 'direct',
};

export function parseSlashCommand(line: string): {
  mode?: InteractionMode;
  prompt?: string;
} | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('/')) return null;

  const spaceIdx = trimmed.indexOf(' ');
  const command = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
  const rest = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1).trim();

  const mode = SLASH_MAP[command];
  if (!mode) return null;

  return { mode, prompt: rest || undefined };
}

export function formatModeChange(mode: InteractionMode): string {
  return `→ Mode: ${modeLabel(mode)} (${modeDescription(mode)})`;
}
