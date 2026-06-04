import { useCallback, useEffect, useMemo, useState } from 'react';
import { useKeyboard } from '@opentui/react';
import {
  filterPaletteActions,
  type PaletteAction,
} from '../commands/registry.ts';
import { LEMON_TOKENS } from '../theme/tokens.ts';

export const PALETTE_VISIBLE_ROWS = 12;

export function CommandPalette({
  actions,
  onClose,
  onHeightChange,
}: {
  actions: PaletteAction[];
  onClose: () => void;
  onHeightChange: (rows: number) => void;
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = useMemo(
    () => filterPaletteActions(actions, query).slice(0, PALETTE_VISIBLE_ROWS),
    [actions, query],
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    onHeightChange(PALETTE_VISIBLE_ROWS + 6);
  }, [onHeightChange]);

  const runSelected = useCallback(async () => {
    const action = filtered[selectedIndex];
    if (!action) return;
    onClose();
    await action.run();
  }, [filtered, selectedIndex, onClose]);

  useKeyboard((key) => {
    if (key.name === 'escape') {
      onClose();
      return;
    }

    if (key.name === 'up') {
      setSelectedIndex((i) => (filtered.length ? (i - 1 + filtered.length) % filtered.length : 0));
      return;
    }

    if (key.name === 'down') {
      setSelectedIndex((i) => (filtered.length ? (i + 1) % filtered.length : 0));
      return;
    }

    if (key.name === 'return') {
      void runSelected();
    }
  });

  return (
    <box
      style={{
        position: 'absolute',
        bottom: 2,
        left: 0,
        right: 0,
        border: true,
        borderStyle: 'double',
        flexDirection: 'column',
        padding: 1,
        backgroundColor: '#1a1b26',
        zIndex: 200,
      }}
    >
      <text content="Command palette" style={{ fg: LEMON_TOKENS.brand, marginBottom: 1 }} />
      <box style={{ border: true, height: 3, width: '100%', marginBottom: 1 }}>
        <input
          placeholder="Type to filter..."
          value={query}
          focused
          onInput={setQuery}
          onSubmit={() => void runSelected()}
        />
      </box>
      <box style={{ flexDirection: 'column', width: '100%' }}>
        {filtered.length === 0 ? (
          <text content="No matching commands" style={{ fg: LEMON_TOKENS.muted }} />
        ) : (
          filtered.map((action, index) => (
            <box
              key={action.id}
              style={{
                flexDirection: 'row',
                paddingLeft: 1,
                backgroundColor: index === selectedIndex ? '#3b4261' : undefined,
              }}
            >
              <text
                content={`${action.title.padEnd(20)}`}
                style={{ fg: index === selectedIndex ? LEMON_TOKENS.accent : LEMON_TOKENS.fg }}
              />
              <text content={action.description} style={{ fg: LEMON_TOKENS.muted }} />
            </box>
          ))
        )}
      </box>
      <text
        content="↑↓ navigate · Enter run · Esc close"
        style={{ fg: LEMON_TOKENS.muted, marginTop: 1 }}
      />
    </box>
  );
}
