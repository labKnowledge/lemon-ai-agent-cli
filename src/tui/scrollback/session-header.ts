import type { CliConfig } from '../../config.ts';
import type { InteractionMode } from '../../plan/modes.ts';
import { modeLabel } from '../../plan/modes.ts';
import { LEMON_CODE_VERSION, lemonCodeWordmark } from '../brand/logo.ts';
import { LEMON_TOKENS } from '../theme/tokens.ts';
import { formatCwd, horizontalRule } from '../util/format.ts';

export interface SessionHeaderContext {
  config: CliConfig;
  mode: InteractionMode;
  width: number;
}

export function buildSessionHeaderText(ctx: SessionHeaderContext): string {
  const narrow = ctx.width < 80;
  const lines: string[] = [];

  for (const row of lemonCodeWordmark(narrow)) {
    lines.push(row);
  }

  const version = `v${LEMON_CODE_VERSION}`;
  if (narrow) {
    lines.push(`${version}  ·  ${modeLabel(ctx.mode)}  ·  ${ctx.config.approval}`);
  } else {
    const brandPad = ' '.repeat(Math.max(0, 2));
    lines.push(`${brandPad}${version}`);
  }

  const cwd = formatCwd(ctx.config.cwd, narrow ? 36 : 56);
  const session = ctx.config.sessionId;
  const model = ctx.config.model;

  if (narrow) {
    lines.push(`cwd ${cwd}`);
    lines.push(`session ${session}  ·  ${model}`);
  } else {
    lines.push(`cwd: ${cwd}  ·  session: ${session}  ·  model: ${model}`);
    lines.push(`mode: ${modeLabel(ctx.mode)}  ·  approval: ${ctx.config.approval}`);
  }

  lines.push(horizontalRule(ctx.width));
  lines.push(
    narrow
      ? 'Shift+Tab · / cmds · @files · !shell · ctrl+p'
      : 'Shift+Tab cycle  ·  / commands  ·  @ files  ·  ! shell  ·  ctrl+p palette',
  );

  return lines.join('\n');
}

export function sessionHeaderFg(): string {
  return LEMON_TOKENS.brand;
}

export function sessionHeaderMetaFg(): string {
  return LEMON_TOKENS.muted;
}
