/** Compact ASCII wordmarks for the session header (wide vs narrow terminals). */

export const LEMON_CODE_VERSION = '0.2.0';

const WIDE = [
  '╭──────────────────────────────────────────────────────────╮',
  '│  ●  Lemon Code                                           │',
  '╰──────────────────────────────────────────────────────────╯',
];

const NARROW = ['┌──────────────┐', '│ Lemon Code   │', '└──────────────┘'];

export function lemonCodeWordmark(narrow: boolean): string[] {
  return narrow ? [...NARROW] : [...WIDE];
}
