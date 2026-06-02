import { readdir, readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import type { InteractionMode } from '../plan/modes.js';

export interface CustomCommand {
  name: string;
  description: string;
  prompt: string;
  mode?: InteractionMode;
}

function parseFrontmatter(raw: string): {
  meta: Record<string, string>;
  body: string;
} {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { meta: {}, body: raw.trim() };
  }

  const meta: Record<string, string> = {};
  for (const line of match[1]!.split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }

  return { meta, body: match[2]!.trim() };
}

export async function loadCustomCommands(cwd: string): Promise<CustomCommand[]> {
  const dir = join(cwd, '.lemon', 'commands');
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }

  const commands: CustomCommand[] = [];

  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const name = basename(file, '.md');
    const raw = await readFile(join(dir, file), 'utf-8');
    const { meta, body } = parseFrontmatter(raw);

    const mode = meta.mode as InteractionMode | undefined;
    if (mode && !['direct', 'plan', 'plan-yolo', 'plan-verbose'].includes(mode)) {
      continue;
    }

    commands.push({
      name: `/${name}`,
      description: meta.description ?? `Custom command: ${name}`,
      prompt: body,
      mode,
    });
  }

  return commands;
}
