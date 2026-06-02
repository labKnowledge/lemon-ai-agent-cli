import { resolve, relative, sep } from 'node:path';

export function resolveWithinCwd(cwd: string, targetPath: string): string {
  const resolved = resolve(cwd, targetPath);
  const normalizedCwd = resolve(cwd);

  if (resolved === normalizedCwd) return resolved;

  const rel = relative(normalizedCwd, resolved);
  if (rel.startsWith('..') || rel.startsWith(`..${sep}`)) {
    throw new Error(`Path escapes workspace: ${targetPath}`);
  }

  return resolved;
}
