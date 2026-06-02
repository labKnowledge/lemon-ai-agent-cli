export type ApprovalMode = 'always' | 'smart' | 'yolo';

const DESTRUCTIVE_PATTERNS: RegExp[] = [
  /\brm\b/i,
  /\brmdir\b/i,
  /\bdel\b/i,
  /\bunlink\b/i,
  /\bmv\b.+\s+\S/i,
  /\bcp\b.+\s+\S/i,
  />\s*\S/,
  /\|\s*tee\b/i,
  /\bchmod\b/i,
  /\bchown\b/i,
  /\bsudo\b/i,
  /\bkill\b/i,
  /\bpkill\b/i,
  /\bkillall\b/i,
  /\bgit\s+push\b/i,
  /\bgit\s+reset\b/i,
  /\bgit\s+clean\b/i,
  /\bdrop\s+table\b/i,
  /\btruncate\b/i,
  /\bnpm\s+publish\b/i,
  /\bdocker\s+rm\b/i,
  /\bdocker\s+rmi\b/i,
  /\bformat\b/i,
  /\bmkfs\b/i,
  /\bdd\b/i,
];

const BENIGN_PATTERNS: RegExp[] = [
  /^\s*ls\b/i,
  /^\s*dir\b/i,
  /^\s*pwd\b/i,
  /^\s*cat\b/i,
  /^\s*head\b/i,
  /^\s*tail\b/i,
  /^\s*less\b/i,
  /^\s*more\b/i,
  /^\s*find\b/i,
  /^\s*grep\b/i,
  /^\s*rg\b/i,
  /^\s*which\b/i,
  /^\s*whereis\b/i,
  /^\s*echo\b/i,
  /^\s*printenv\b/i,
  /^\s*env\b/i,
  /^\s*node\s+-v\b/i,
  /^\s*npm\s+-v\b/i,
  /^\s*npm\s+test\b/i,
  /^\s*npm\s+run\s+test\b/i,
  /^\s*npm\s+run\s+lint\b/i,
  /^\s*npm\s+run\s+build\b/i,
  /^\s*pnpm\s+test\b/i,
  /^\s*yarn\s+test\b/i,
  /^\s*pytest\b/i,
  /^\s*vitest\b/i,
  /^\s*jest\b/i,
  /^\s*git\s+status\b/i,
  /^\s*git\s+diff\b/i,
  /^\s*git\s+log\b/i,
  /^\s*git\s+branch\b/i,
  /^\s*git\s+show\b/i,
  /^\s*git\s+stash\s+list\b/i,
  /^\s*curl\s+-I\b/i,
  /^\s*wc\b/i,
  /^\s*tree\b/i,
];

export function requiresApproval(mode: ApprovalMode, command: string): boolean {
  if (mode === 'yolo') return false;
  if (mode === 'always') return true;

  const trimmed = command.trim();
  if (DESTRUCTIVE_PATTERNS.some((p) => p.test(trimmed))) return true;
  if (BENIGN_PATTERNS.some((p) => p.test(trimmed))) return false;

  return true;
}
