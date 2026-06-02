import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const RULE_FILES = ['LEMON.md', 'AGENTS.md'] as const;

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export interface ProjectRules {
  content: string;
  sources: string[];
}

export async function loadProjectRules(cwd: string): Promise<ProjectRules | null> {
  const parts: string[] = [];
  const sources: string[] = [];

  for (const name of RULE_FILES) {
    const path = join(cwd, name);
    if (await fileExists(path)) {
      const content = await readFile(path, 'utf-8');
      if (content.trim()) {
        parts.push(`### ${name}\n${content.trim()}`);
        sources.push(name);
      }
    }
  }

  if (parts.length === 0) return null;

  return {
    content: parts.join('\n\n'),
    sources,
  };
}

export function appendRulesToPrompt(basePrompt: string, rules: ProjectRules | null): string {
  if (!rules) return basePrompt;
  return `${basePrompt}\n\n## Project instructions\n\n${rules.content}`;
}
