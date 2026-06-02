import { LemonGrove, resolveModel } from 'lemon-ai-agent';
import type { LemonGrove as LemonGroveType } from 'lemon-ai-agent';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { CliConfig } from '../config.js';
import { createShellGate } from '../approval/gate.js';
import { createTools } from '../tools/index.js';
import {
  createCoder,
  createGeneral,
  createResearcher,
  createReviewer,
  createTester,
} from './specialists.js';

function orchestratorPrompt(cwd: string): string {
  return `You are the orchestrator for a multi-agent software engineering team.

Workspace root: ${cwd}

Coordinate specialists when needed. You also have direct access to workspace tools for simple tasks.
Prefer delegating complex work to the appropriate specialist agent.
Summarize outcomes clearly when synthesizing specialist outputs.`;
}

export async function createGrove(config: CliConfig): Promise<LemonGroveType> {
  const model = (await resolveModel(config.model)) as BaseChatModel;

  const [researcher, coder, tester, reviewer, general] = await Promise.all([
    createResearcher(config),
    createCoder(config),
    createTester(config),
    createReviewer(config),
    createGeneral(config),
  ]);

  const grove = new LemonGrove(
    {
      model,
      systemMessage: orchestratorPrompt(config.cwd),
      tools: createTools(config),
      maxIterations: 25,
    },
    {
      conductorMode: true,
      sharedMemory: true,
      delegationTrace: true,
      humanGate: config.approval !== 'yolo' ? createShellGate(config.approval) : undefined,
    },
  )
    .addSpecialist('researcher_agent', 'Research and gather facts from the codebase', researcher)
    .addSpecialist('coder_agent', 'Write, edit, and refactor code', coder)
    .addSpecialist('tester_agent', 'Run tests and verify behavior', tester)
    .addSpecialist('reviewer_agent', 'Review changes for quality and correctness', reviewer)
    .addSpecialist('general_agent', 'General-purpose tasks', general);

  return grove;
}
