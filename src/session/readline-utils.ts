import readline from 'node:readline';
import { stdout as output } from 'node:process';
import type { Interface } from 'node:readline';

type ReadlineState = Interface & { line: string; cursor: number };

export function refreshPromptPreservingInput(
  rl: Interface,
  savedLine: string,
  savedCursor: number,
): void {
  readline.clearLine(output, 0);
  readline.cursorTo(output, 0);

  const state = rl as unknown as ReadlineState;
  state.line = savedLine;
  state.cursor = Math.min(savedCursor, savedLine.length);

  rl.prompt(true);

  if (savedLine.length > 0) {
    output.write(savedLine);
    const offset = savedLine.length - state.cursor;
    if (offset > 0) {
      readline.moveCursor(output, -offset, 0);
    }
  }
}
