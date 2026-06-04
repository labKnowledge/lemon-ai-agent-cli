import type { AutocompleteItem } from '../commands/registry.ts';
import { LEMON_TOKENS } from '../theme/tokens.ts';

export function AutocompleteMenu({
  items,
  selectedIndex,
  emptyMessage = 'No matching items',
}: {
  items: AutocompleteItem[];
  selectedIndex: number;
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    return (
      <box
        style={{
          width: '100%',
          border: true,
          borderStyle: 'single',
          paddingLeft: 1,
          paddingRight: 1,
          marginBottom: 1,
        }}
      >
        <text content={emptyMessage} style={{ fg: LEMON_TOKENS.muted }} />
      </box>
    );
  }

  return (
    <box
      style={{
        width: '100%',
        flexDirection: 'column',
        border: true,
        borderStyle: 'single',
        marginBottom: 1,
        paddingTop: 0,
        paddingBottom: 0,
      }}
    >
      {items.map((item, index) => (
        <box
          key={item.id}
          style={{
            width: '100%',
            flexDirection: 'row',
            paddingLeft: 1,
            paddingRight: 1,
            backgroundColor: index === selectedIndex ? '#3b4261' : undefined,
          }}
        >
          <text
            content={`${item.display.padEnd(22)}`}
            style={{ fg: index === selectedIndex ? LEMON_TOKENS.accent : LEMON_TOKENS.brand }}
          />
          <text
            content={item.description}
            style={{ fg: LEMON_TOKENS.muted }}
          />
        </box>
      ))}
    </box>
  );
}
