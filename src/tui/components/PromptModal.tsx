import { useState } from 'react';
import type { PendingAsk } from '../types.ts';

export function PromptModal({
  pendingAsk,
  onSubmit,
}: {
  pendingAsk: PendingAsk;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState('');

  return (
    <box
      style={{
        position: 'absolute',
        bottom: 5,
        left: 1,
        right: 1,
        border: true,
        borderStyle: 'double',
        padding: 1,
        flexDirection: 'column',
        backgroundColor: '#1a1b26',
      }}
    >
      <text content={pendingAsk.prompt} style={{ fg: '#e0af68', marginBottom: 1 }} />
      <box title="Response" style={{ border: true, height: 3, width: '100%' }}>
        <input
          placeholder={pendingAsk.placeholder ?? 'Type your answer...'}
          focused
          onInput={setValue}
          onSubmit={(v) => {
            const text = typeof v === 'string' ? v : value;
            onSubmit(text);
          }}
        />
      </box>
      <text content="Enter to submit · Esc to cancel" style={{ fg: '#565f89' }} />
    </box>
  );
}
