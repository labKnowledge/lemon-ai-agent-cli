import { readFile } from 'node:fs/promises';
import { resolveWithinCwd } from '../../tools/path-utils.ts';

const MENTION_RE = /@([^\s@]+)/g;

export async function expandAtMentions(cwd: string, text: string): Promise<string> {
  const matches = [...text.matchAll(MENTION_RE)];
  if (matches.length === 0) return text;

  const seen = new Set<string>();
  const blocks: string[] = [];

  for (const match of matches) {
    const relPath = match[1]!;
    if (seen.has(relPath)) continue;
    seen.add(relPath);

    try {
      const abs = resolveWithinCwd(cwd, relPath);
      const content = await readFile(abs, 'utf-8');
      const trimmed =
        content.length > 12000 ? `${content.slice(0, 12000)}\n...(truncated)` : content;
      blocks.push(`--- File: ${relPath} ---\n${trimmed}\n--- End ${relPath} ---`);
    } catch {
      blocks.push(`--- File: ${relPath} (could not read) ---`);
    }
  }

  if (blocks.length === 0) return text;

  return `${text}\n\n[Referenced files]\n${blocks.join('\n\n')}`;
}
