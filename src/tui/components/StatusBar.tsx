import type { InteractionMode } from '../../plan/modes.ts';
import { modeLabel } from '../../plan/modes.ts';
import type { CliConfig } from '../../config.ts';

export function StatusBar({ config, mode }: { config: CliConfig; mode: InteractionMode }) {
  return (
    <box
      style={{
        width: '100%',
        height: 3,
        border: true,
        borderStyle: 'single',
        paddingLeft: 1,
        paddingRight: 1,
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <text content="Lemon Agent CLI" style={{ fg: '#c0caf5' }} />
      <text
        content={`model: ${config.model} | cwd: ${config.cwd} | approval: ${config.approval} | mode: ${modeLabel(mode)} | Shift+Tab cycle`}
        style={{ fg: '#565f89' }}
      />
    </box>
  );
}
