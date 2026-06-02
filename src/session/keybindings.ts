import readline from 'node:readline';
import { stdin, stdout as output } from 'node:process';
import type { Interface } from 'node:readline';
import type { InteractionMode } from '../plan/modes.js';
import { cycleMode, formatModeChange } from '../plan/modes.js';
import { refreshPromptPreservingInput } from './readline-utils.js';

export type ModeChangeHandler = (
  mode: InteractionMode,
  savedLine: string,
  savedCursor: number,
) => void;

const SHIFT_TAB_SEQUENCES = ['\x1b[Z', '\x1b[9\t'];

export function setupModeKeybindings(
  rl: Interface,
  getMode: () => InteractionMode,
  onModeChange: ModeChangeHandler,
): void {
  if (!stdin.isTTY) return;

  readline.emitKeypressEvents(stdin, rl);

  stdin.on('keypress', (_str: string, key: readline.Key) => {
    if (!key) return;

    const seq = key.sequence ?? '';
    const isShiftTab =
      SHIFT_TAB_SEQUENCES.includes(seq) ||
      (key.name === 'tab' && key.shift === true);

    if (!isShiftTab) return;

    const savedLine = rl.line ?? '';
    const savedCursor = rl.cursor ?? savedLine.length;

    const next = cycleMode(getMode());
    output.write(`\n${formatModeChange(next)}\n`);
    onModeChange(next, savedLine, savedCursor);
  });
}
