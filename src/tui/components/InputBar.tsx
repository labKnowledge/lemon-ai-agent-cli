import type { InteractionMode } from '../../plan/modes.ts';
import { modeLabel } from '../../plan/modes.ts';

export function InputBar({
  mode,
  disabled,
  onSubmit,
}: {
  mode: InteractionMode;
  disabled: boolean;
  onSubmit: (line: string) => void;
}) {
  if (disabled) {
    return (
      <box
        title={`lemon [${modeLabel(mode)}] (busy)`}
        style={{ border: true, height: 3, width: '100%' }}
      >
        <text content="Processing..." style={{ fg: '#565f89' }} />
      </box>
    );
  }

  return (
    <box title={`lemon [${modeLabel(mode)}]>`} style={{ border: true, height: 3, width: '100%' }}>
      <input
        placeholder="Message, /commands, or !shell..."
        focused
        onSubmit={(value) => {
          const text = typeof value === 'string' ? value : '';
          const trimmed = text.trim();
          if (trimmed) onSubmit(trimmed);
        }}
      />
    </box>
  );
}
