import { createLemonAgent } from 'lemon-ai-agent';
import type { LemonAgent } from 'lemon-ai-agent';
import type { CliConfig } from '../config.js';
import { createShellGate } from '../approval/gate.js';
import { buildSystemPrompt } from './system-prompt.js';
import { createTools } from '../tools/index.js';

export async function createAgent(config: CliConfig): Promise<LemonAgent> {
  const tools = await createTools(config);

  return createLemonAgent({
    model: config.model,
    tools,
    systemMessage: buildSystemPrompt(config.cwd),
    maxIterations: 25,
    humanGate: config.approval !== 'yolo' ? createShellGate(config.approval) : undefined,
    streamToolEvents: true,
  });
}
