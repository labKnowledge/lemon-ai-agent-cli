import type { InteractionMode } from '../../plan/modes.ts';
import { modeLabel } from '../../plan/modes.ts';
import type { SlashCommand } from '../commands/registry.ts';
import { InputAutocomplete } from './InputAutocomplete.tsx';

export function InputBar({
  mode,
  disabled,
  activityLabel,
  cwd,
  slashCommands,
  lastBangCommand,
  insertText,
  onInsertConsumed,
  onSubmit,
  onMenuHeightChange,
}: {
  mode: InteractionMode;
  disabled: boolean;
  activityLabel?: string;
  cwd: string;
  slashCommands: SlashCommand[];
  lastBangCommand: string | null;
  insertText?: string | null;
  onInsertConsumed?: () => void;
  onSubmit: (line: string) => void;
  onMenuHeightChange: (rows: number) => void;
}) {
  if (disabled) {
    const busyTitle = activityLabel
      ? `Lemon Code [${modeLabel(mode)}] — ${activityLabel}`
      : `Lemon Code [${modeLabel(mode)}] (busy)`;
    return (
      <box title={busyTitle} style={{ border: true, height: 3, width: '100%' }}>
        <text content={activityLabel ?? 'Processing...'} style={{ fg: '#565f89' }} />
      </box>
    );
  }

  return (
    <box style={{ width: '100%', flexDirection: 'column' }}>
      <InputAutocomplete
        mode={mode}
        cwd={cwd}
        slashCommands={slashCommands}
        lastBangCommand={lastBangCommand}
        insertText={insertText}
        onInsertConsumed={onInsertConsumed}
        placeholder="Message · PgUp/Dn scroll · Ctrl+Shift+C copy · /commands · ctrl+p"
        onSubmit={onSubmit}
        onMenuHeightChange={onMenuHeightChange}
      />
    </box>
  );
}
