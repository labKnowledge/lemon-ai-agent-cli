import type { LemonAgent } from 'lemon-ai-agent';
import type { LemonGrove } from 'lemon-ai-agent';
import type { CliConfig } from '../config.ts';

export interface TuiStartOptions {
  config: CliConfig;
  agent: LemonAgent;
  grove: LemonGrove;
  initialPrompt?: string;
  autoRun?: boolean;
  planYoloOneShot?: boolean;
}

export interface PendingAsk {
  prompt: string;
  placeholder?: string;
  resolve: (value: string) => void;
}
