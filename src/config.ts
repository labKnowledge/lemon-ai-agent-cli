import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import type { ApprovalMode } from './approval/modes.js';

loadEnv();

export interface CliConfig {
  cwd: string;
  model: string;
  approval: ApprovalMode;
  sessionId: string;
  googleApiKey: string | undefined;
}

const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEFAULT_SESSION = 'default';

export function resolveConfig(options: {
  cwd?: string;
  model?: string;
  approval?: string;
  session?: string;
}): CliConfig {
  const cwd = resolve(options.cwd ?? process.cwd());
  const approval = parseApproval(options.approval);

  return {
    cwd,
    model: options.model ?? DEFAULT_MODEL,
    approval,
    sessionId: options.session ?? DEFAULT_SESSION,
    googleApiKey: process.env.GOOGLE_API_KEY,
  };
}

function parseApproval(value?: string): ApprovalMode {
  if (value === 'smart' || value === 'yolo') return value;
  return 'always';
}

export function maskKey(key: string | undefined): string {
  if (!key) return '(not set)';
  if (key.length <= 8) return '****';
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}
