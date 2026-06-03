import type { TranscriptChunk } from '../../ui/bridge.ts';

const TYPE_COLORS: Record<string, string> = {
  system: '#565f89',
  user: '#7aa2f7',
  assistant: '#c0caf5',
  tool: '#7dcfff',
  plan: '#9ece6a',
  shell: '#a9b1d6',
  wave: '#bb9af7',
  agent: '#7dcfff',
};

export function Transcript({ chunks }: { chunks: TranscriptChunk[] }) {
  return (
    <>
      {chunks.map((chunk) => (
        <box
          key={chunk.id}
          style={{ width: '100%', paddingLeft: 1, paddingRight: 1, marginBottom: 0 }}
        >
          <text
            content={chunk.text}
            style={{ fg: chunk.fg ?? TYPE_COLORS[chunk.type] ?? '#c0caf5' }}
          />
        </box>
      ))}
    </>
  );
}
