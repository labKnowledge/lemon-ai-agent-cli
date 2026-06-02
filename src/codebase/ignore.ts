import { readFile } from 'node:fs/promises';
import { join, normalize, sep } from 'node:path';
import { detectProfiles, getProfileIgnores } from './profiles.js';

const BASE_IGNORES = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/.next/**',
  '**/.turbo/**',
  '**/.cache/**',
  '**/.venv/**',
  '**/venv/**',
  '**/__pycache__/**',
  '**/.pytest_cache/**',
  '**/.mypy_cache/**',
  '**/*.egg-info/**',
  '**/target/**',
  '**/vendor/**',
  '**/.idea/**',
  '**/.DS_Store',
  '**/.env',
  '**/.env.*',
];

function gitignoreLineToGlob(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  let pattern = trimmed;
  if (pattern.startsWith('/')) pattern = pattern.slice(1);
  if (pattern.endsWith('/')) pattern = `${pattern}**`;

  if (!pattern.includes('*') && !pattern.includes('/')) {
    pattern = `**/${pattern}`;
  }
  if (!pattern.startsWith('**')) {
    pattern = `**/${pattern}`;
  }

  return pattern;
}

async function parseIgnoreFile(path: string): Promise<string[]> {
  try {
    const content = await readFile(path, 'utf-8');
    return content
      .split('\n')
      .map(gitignoreLineToGlob)
      .filter((p): p is string => p != null);
  } catch {
    return [];
  }
}

export async function resolveIgnorePatterns(cwd: string): Promise<string[]> {
  const profiles = await detectProfiles(cwd);
  const profileIgnores = getProfileIgnores(profiles);

  const [gitignore, cursorignore] = await Promise.all([
    parseIgnoreFile(join(cwd, '.gitignore')),
    parseIgnoreFile(join(cwd, '.cursorignore')),
  ]);

  return [...new Set([...BASE_IGNORES, ...profileIgnores, ...gitignore, ...cursorignore])];
}

function normalizePath(p: string): string {
  return normalize(p).split(sep).join('/');
}

function matchPattern(relativePath: string, pattern: string): boolean {
  const path = normalizePath(relativePath);
  const pat = pattern.replace(/^\*\*\//, '').replace(/\/\*\*$/, '');

  if (pattern.includes('*')) {
    const regex = new RegExp(
      '^' +
        pattern
          .replace(/\*\*/g, '.*')
          .replace(/\*/g, '[^/]*')
          .replace(/\./g, '\\.')
          .replace(/\//g, '\\/') +
        '$',
    );
    return regex.test(path) || path.split('/').some((seg) => regex.test(seg));
  }

  return (
    path === pat ||
    path.startsWith(`${pat}/`) ||
    path.split('/').includes(pat)
  );
}

const IGNORED_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '.turbo',
  '.cache',
  '.venv',
  'venv',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  'target',
  'vendor',
  '.idea',
  '.DS_Store',
  '.tox',
  '.nox',
  'htmlcov',
  '.pnpm-store',
  '.yarn',
  'out',
  '.gradle',
]);

function hasIgnoredSegment(relativePath: string): boolean {
  return relativePath
    .split('/')
    .some((seg) => IGNORED_DIR_NAMES.has(seg) || seg.endsWith('.egg-info'));
}

export function isIgnored(relativePath: string, patterns: string[]): boolean {
  const normalized = normalizePath(relativePath);
  if (!normalized || normalized === '.') return false;

  if (hasIgnoredSegment(normalized)) return true;

  for (const pattern of patterns) {
    if (matchPattern(normalized, pattern)) return true;
  }
  return false;
}
