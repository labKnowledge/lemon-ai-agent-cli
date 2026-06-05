export const THINKING_FRAMES = ['◐', '◓', '◑', '◒'] as const;

export const TOOL_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const;

export const PLAN_FRAMES = ['◴', '◷', '◶', '◵'] as const;

export const SCAN_FRAMES = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'] as const;

const BAR_CHARS = ['█', '▓', '▒', '░'] as const;

export function tickBar(frame: number, width = 16): string {
  const offset = frame % BAR_CHARS.length;
  let bar = '';
  for (let i = 0; i < width; i++) {
    bar += BAR_CHARS[(i + offset) % BAR_CHARS.length];
  }
  return bar;
}

export function frameForPhase(phase: string, frameIndex: number): string {
  switch (phase) {
    case 'tool':
      return TOOL_FRAMES[frameIndex % TOOL_FRAMES.length]!;
    case 'plan':
      return PLAN_FRAMES[frameIndex % PLAN_FRAMES.length]!;
    case 'scan':
      return SCAN_FRAMES[frameIndex % SCAN_FRAMES.length]!;
    case 'delegate':
      return TOOL_FRAMES[frameIndex % TOOL_FRAMES.length]!;
    case 'approval':
      return THINKING_FRAMES[frameIndex % THINKING_FRAMES.length]!;
    default:
      return THINKING_FRAMES[frameIndex % THINKING_FRAMES.length]!;
  }
}
