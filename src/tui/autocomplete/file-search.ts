import fg from 'fast-glob';
import { resolveIgnorePatterns, isIgnored } from '../../codebase/ignore.ts';
import type { AutocompleteItem } from '../commands/registry.ts';

let cachedCwd: string | null = null;
let cachedFiles: string[] | null = null;

async function getFileIndex(cwd: string): Promise<string[]> {
  if (cachedCwd === cwd && cachedFiles) return cachedFiles;

  const patterns = await resolveIgnorePatterns(cwd);
  const entries = await fg('**/*', {
    cwd,
    dot: false,
    onlyFiles: true,
    suppressErrors: true,
    ignore: patterns,
  });

  const filtered = entries.filter((rel) => !isIgnored(rel, patterns)).sort();
  cachedCwd = cwd;
  cachedFiles = filtered;
  return filtered;
}

export function invalidateFileIndex(): void {
  cachedCwd = null;
  cachedFiles = null;
}

function scorePath(path: string, query: string): number {
  const lower = path.toLowerCase();
  const q = query.toLowerCase();
  if (lower === q) return 100;
  if (lower.startsWith(q)) return 80;
  const base = path.split('/').pop() ?? path;
  if (base.toLowerCase().startsWith(q)) return 60;
  if (lower.includes(q)) return 40;
  return 0;
}

export async function searchFiles(
  cwd: string,
  atQuery: string,
  limit = 10,
): Promise<AutocompleteItem[]> {
  const query = atQuery.startsWith('@') ? atQuery.slice(1) : atQuery;
  const files = await getFileIndex(cwd);

  const scored = files
    .map((path) => ({
      path,
      score: query.length === 0 ? 1 : scorePath(path, query),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));

  const slice = scored.slice(0, limit);

  return slice.map(({ path }) => ({
    id: `file:${path}`,
    display: `@${path}`,
    description: path,
    kind: 'file' as const,
    insertText: `@${path} `,
  }));
}
