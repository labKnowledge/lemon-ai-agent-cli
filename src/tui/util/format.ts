import { basename, sep } from 'node:path';

export function truncateMiddle(text: string, max: number): string {
  if (text.length <= max) return text;
  if (max <= 3) return text.slice(0, max);
  const keep = max - 3;
  const head = Math.ceil(keep / 2);
  const tail = Math.floor(keep / 2);
  return `${text.slice(0, head)}...${text.slice(-tail)}`;
}

export function formatCwd(cwd: string, max = 48): string {
  const base = basename(cwd) || cwd;
  if (cwd.length <= max) return cwd;
  const parts = cwd.split(sep).filter(Boolean);
  if (parts.length <= 2) return truncateMiddle(cwd, max);
  return truncateMiddle(`${parts[0]}${sep}...${sep}${base}`, max);
}

export function horizontalRule(width: number, char = '─'): string {
  return char.repeat(Math.max(8, Math.min(width, 120)));
}
