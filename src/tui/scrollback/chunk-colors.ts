import type { TranscriptChunkType } from '../../ui/bridge.ts';

export const CHUNK_COLORS: Record<TranscriptChunkType, string> = {
  system: '#565f89',
  user: '#7aa2f7',
  assistant: '#c0caf5',
  tool: '#7dcfff',
  plan: '#9ece6a',
  shell: '#a9b1d6',
  wave: '#bb9af7',
  agent: '#7dcfff',
};

export function chunkFg(type: TranscriptChunkType, fg?: string): string {
  return fg ?? CHUNK_COLORS[type] ?? '#c0caf5';
}
