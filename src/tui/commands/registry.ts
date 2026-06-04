import type { InteractionMode } from '../../plan/modes.ts';
import {
  loadCustomCommands,
  type CustomCommand,
} from '../../project/custom-commands.ts';

export const AUTOCOMPLETE_MAX_ROWS = 8;

export type SlashCommandCategory = 'mode' | 'session' | 'workspace' | 'custom';

export interface SlashCommand {
  name: string;
  description: string;
  category: SlashCommandCategory;
  custom?: CustomCommand;
}

export type AutocompleteKind = 'slash' | 'file' | 'shell' | 'palette';

export interface AutocompleteItem {
  id: string;
  display: string;
  description: string;
  kind: AutocompleteKind;
  insertText: string;
}

export type InputTrigger = '/' | '@' | '!';

export const BUILTIN_SLASH_COMMANDS: SlashCommand[] = [
  { name: '/exit', description: 'Exit Lemon Code', category: 'session' },
  { name: '/quit', description: 'Exit Lemon Code', category: 'session' },
  { name: '/scan', description: 'Scan codebase and save project context', category: 'workspace' },
  { name: '/p', description: 'Plan mode — approval before execution', category: 'mode' },
  { name: '/plan', description: 'Plan mode — approval before execution', category: 'mode' },
  { name: '/py', description: 'Plan-yolo — auto-select best path', category: 'mode' },
  { name: '/plan-yolo', description: 'Plan-yolo — auto-select best path', category: 'mode' },
  { name: '/pv', description: 'Plan-verbose — detailed Q&A then approval', category: 'mode' },
  { name: '/plan-verbose', description: 'Plan-verbose — detailed Q&A then approval', category: 'mode' },
  { name: '/d', description: 'Direct mode — execute immediately', category: 'mode' },
  { name: '/direct', description: 'Direct mode — execute immediately', category: 'mode' },
];

export async function loadSlashCommands(cwd: string): Promise<SlashCommand[]> {
  const custom = await loadCustomCommands(cwd);
  const customSlash: SlashCommand[] = custom.map((cmd) => ({
    name: cmd.name,
    description: cmd.description,
    category: 'custom' as const,
    custom: cmd,
  }));
  return [...BUILTIN_SLASH_COMMANDS, ...customSlash];
}

export function slashCommandsToItems(commands: SlashCommand[]): AutocompleteItem[] {
  return commands.map((cmd) => ({
    id: `slash:${cmd.name}`,
    display: cmd.name,
    description: cmd.description,
    kind: 'slash' as const,
    insertText: `${cmd.name} `,
  }));
}

export function filterSlashCommands(commands: SlashCommand[], query: string): SlashCommand[] {
  const q = query.startsWith('/') ? query : `/${query}`;
  return commands.filter((cmd) => cmd.name.startsWith(q));
}

export function getSlashQuery(value: string): string | null {
  if (!value.startsWith('/')) return null;
  const space = value.indexOf(' ');
  if (space !== -1) return null;
  return value;
}

export function getBangQuery(value: string): string | null {
  if (!value.startsWith('!')) return null;
  if (value.startsWith('!!')) return null;
  const space = value.indexOf(' ');
  if (space !== -1) return null;
  return value;
}

export function mentionTriggerIndex(value: string, cursorOffset?: number): number | undefined {
  const end = cursorOffset ?? value.length;
  const before = value.slice(0, end);
  const at = before.lastIndexOf('@');
  if (at === -1) return undefined;
  const between = before.slice(at + 1);
  if (/\s/.test(between)) return undefined;
  return at;
}

export function getAtQuery(value: string, cursorOffset?: number): string | null {
  const idx = mentionTriggerIndex(value, cursorOffset);
  if (idx === undefined) return null;
  const end = cursorOffset ?? value.length;
  return value.slice(idx, end);
}

export function detectInputTrigger(value: string, cursorOffset?: number): InputTrigger | null {
  if (getSlashQuery(value)) return '/';
  if (getBangQuery(value)) return '!';
  if (mentionTriggerIndex(value, cursorOffset) !== undefined) return '@';
  return null;
}

export function findCustomCommand(
  commands: SlashCommand[],
  line: string,
): CustomCommand | undefined {
  const trimmed = line.trim();
  const spaceIdx = trimmed.indexOf(' ');
  const command = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
  const entry = commands.find((c) => c.name === command && c.custom);
  return entry?.custom;
}

export interface PaletteAction {
  id: string;
  title: string;
  description: string;
  category: string;
  run: () => void | Promise<void>;
}

export function buildPaletteActions(options: {
  slashCommands: SlashCommand[];
  onInsertSlash: (text: string) => void;
  onScan: () => void;
  onExit: () => void;
  onCycleMode: () => void;
}): PaletteAction[] {
  const slash: PaletteAction[] = options.slashCommands.map((cmd) => ({
    id: `palette:${cmd.name}`,
    title: cmd.name,
    description: cmd.description,
    category: cmd.category,
    run: () => options.onInsertSlash(`${cmd.name} `),
  }));

  const quick: PaletteAction[] = [
    {
      id: 'palette:cycle-mode',
      title: 'Cycle interaction mode',
      description: 'Shift+Tab — direct → plan → plan-yolo → plan-verbose',
      category: 'session',
      run: options.onCycleMode,
    },
    {
      id: 'palette:scan',
      title: '/scan',
      description: 'Scan codebase and save context',
      category: 'workspace',
      run: options.onScan,
    },
    {
      id: 'palette:exit',
      title: '/exit',
      description: 'Exit Lemon Code',
      category: 'session',
      run: options.onExit,
    },
  ];

  return [...quick, ...slash];
}

export function filterPaletteActions(actions: PaletteAction[], query: string): PaletteAction[] {
  const q = query.trim().toLowerCase();
  if (!q) return actions;
  return actions.filter(
    (a) =>
      a.title.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q),
  );
}

export type { CustomCommand, InteractionMode };
