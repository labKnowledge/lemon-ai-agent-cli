import type { AutocompleteItem } from '../commands/registry.ts';

const COMMON_SHELL_COMMANDS = [
  'npm test',
  'npm run build',
  'npm run dev',
  'npm install',
  'bun test',
  'bun run build',
  'bun run dev',
  'git status',
  'git diff',
  'git log --oneline -10',
  'ls -la',
  'pwd',
];

export function buildShellHintItems(lastBang: string | null): AutocompleteItem[] {
  const items: AutocompleteItem[] = [];
  const seen = new Set<string>();

  if (lastBang) {
    const display = `!${lastBang}`;
    items.push({
      id: 'shell:last',
      display,
      description: 'Repeat last shell command (!!)',
      kind: 'shell',
      insertText: display,
    });
    seen.add(lastBang);
  }

  for (const cmd of COMMON_SHELL_COMMANDS) {
    if (seen.has(cmd)) continue;
    seen.add(cmd);
    items.push({
      id: `shell:${cmd}`,
      display: `!${cmd}`,
      description: 'Run shell command in workspace',
      kind: 'shell',
      insertText: `!${cmd}`,
    });
  }

  return items;
}

export function filterShellItems(items: AutocompleteItem[], query: string): AutocompleteItem[] {
  const q = query.startsWith('!') ? query.slice(1).toLowerCase() : query.toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    const cmd = item.display.slice(1).toLowerCase();
    return cmd.startsWith(q) || cmd.includes(q);
  });
}
