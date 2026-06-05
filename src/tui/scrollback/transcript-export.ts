import type { TranscriptChunk } from '../../ui/bridge.ts';

const LABELS: Record<string, string> = {
  user: 'You',
  assistant: 'Lemon',
  system: 'System',
  tool: 'Tool',
  plan: 'Plan',
  shell: 'Shell',
  wave: 'Wave',
  agent: 'Agent',
};

function chunkLabel(type: string): string {
  return LABELS[type] ?? `[${type}]`;
}

export function formatTranscriptForCopy(chunks: TranscriptChunk[]): string {
  return chunks
    .filter((c) => !c.streaming && c.text.trim())
    .map((c) => {
      const label = chunkLabel(c.type);
      const text = c.type === 'user' ? c.text.replace(/^>\s*/, '') : c.text;
      return `${label}:\n${text.trim()}`;
    })
    .join('\n\n');
}
