import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import {
  detectProfiles,
  KEY_FILES_BY_PROFILE,
  type ProjectProfile,
} from './profiles.js';
import { isIgnored, resolveIgnorePatterns } from './ignore.js';

export interface ScanOptions {
  depth?: number;
  refresh?: boolean;
}

export interface ScanResult {
  summary: string;
  profiles: ProjectProfile[];
  keyFiles: string[];
  tree: string;
  scannedAt: string;
}

async function readHead(path: string, lines = 40): Promise<string | null> {
  try {
    const content = await readFile(path, 'utf-8');
    return content.split('\n').slice(0, lines).join('\n');
  } catch {
    return null;
  }
}

async function buildTree(
  cwd: string,
  ignorePatterns: string[],
  maxDepth: number,
): Promise<string> {
  const lines: string[] = [];

  async function walk(dir: string, depth: number, prefix: string): Promise<void> {
    if (depth > maxDepth) return;

    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return;
    }

    entries.sort();

    for (const entry of entries) {
      const rel = relative(cwd, join(dir, entry));
      if (isIgnored(rel, ignorePatterns)) continue;

      const isDir = await isDirectory(join(dir, entry));
      const indent = '  '.repeat(depth);
      lines.push(`${indent}${entry}${isDir ? '/' : ''}`);

      if (isDir && depth < maxDepth) {
        await walk(join(dir, entry), depth + 1, prefix);
      }
    }
  }

  await walk(cwd, 0, '');
  return lines.length ? lines.join('\n') : '(empty)';
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    const info = await stat(path);
    return info.isDirectory();
  } catch {
    return false;
  }
}

function inferStackLabels(profiles: ProjectProfile[], cwd: string): string[] {
  const labels: string[] = [...profiles];

  if (profiles.includes('node')) {
    labels.push('javascript/typescript');
  }
  return labels;
}

async function collectKeyFiles(
  cwd: string,
  profiles: ProjectProfile[],
): Promise<string[]> {
  const candidates = new Set<string>(['README.md']);

  for (const profile of profiles) {
    for (const f of KEY_FILES_BY_PROFILE[profile]) {
      candidates.add(f);
    }
  }

  const common = ['src/index.ts', 'src/main.ts', 'src/main.py', 'main.py', 'index.ts'];
  for (const f of common) candidates.add(f);

  const found: string[] = [];
  for (const file of candidates) {
    try {
      await readFile(join(cwd, file), 'utf-8');
      found.push(file);
    } catch {
      // skip missing
    }
  }

  return found;
}

async function extractScripts(cwd: string, profiles: ProjectProfile[]): Promise<string> {
  if (!profiles.includes('node')) return '';

  try {
    const pkg = JSON.parse(await readFile(join(cwd, 'package.json'), 'utf-8')) as {
      scripts?: Record<string, string>;
    };
    const scripts = Object.keys(pkg.scripts ?? {}).slice(0, 8);
    return scripts.length ? scripts.map((s) => `npm run ${s}`).join(', ') : '';
  } catch {
    return '';
  }
}

export async function scanCodebase(
  cwd: string,
  options: ScanOptions = {},
): Promise<ScanResult> {
  const depth = options.depth ?? 2;
  const ignorePatterns = await resolveIgnorePatterns(cwd);
  const profiles = await detectProfiles(cwd);
  const keyFiles = await collectKeyFiles(cwd, profiles);
  const tree = await buildTree(cwd, ignorePatterns, depth);
  const stackLabels = inferStackLabels(profiles, cwd);
  const scripts = await extractScripts(cwd, profiles);
  const scannedAt = new Date().toISOString();

  const configSnippets: string[] = [];
  for (const file of keyFiles.slice(0, 4)) {
    const head = await readHead(join(cwd, file));
    if (head) {
      configSnippets.push(`--- ${file} (head) ---\n${head}`);
    }
  }

  const ignoreNote =
    'node_modules, .git, dist, .venv, venv, __pycache__, target, vendor, and profile-specific dirs excluded';

  const summary = [
    `Project profile: ${stackLabels.join(', ') || 'unknown'}`,
    `Root: ${cwd}`,
    `Key files: ${keyFiles.join(', ') || 'none detected'}`,
    scripts ? `Scripts: ${scripts}` : '',
    `Ignore note: ${ignoreNote}`,
    '',
    `Structure (depth ${depth}):`,
    tree,
    '',
    ...configSnippets,
  ]
    .filter(Boolean)
    .join('\n');

  return { summary, profiles, keyFiles, tree, scannedAt };
}
