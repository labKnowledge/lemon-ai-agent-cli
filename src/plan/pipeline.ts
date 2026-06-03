import type { LemonGrove } from 'lemon-ai-agent';
import type { LemonAgent } from 'lemon-ai-agent';
import type { CliConfig } from '../config.js';
import type { InteractionMode, PlanMode } from './modes.js';
import { isPlanMode } from './modes.js';
import { createPlanner, generatePlan } from './planner.js';
import { runPlanGate, collectVerboseContext } from './gate.js';
import { executePlan } from './executor.js';
import type { PlanDocument } from './schema.js';
import { streamAgentResponse, getStreamHandlers } from '../ui/stream.js';

export interface PlanPipelineResult {
  output: string;
  plan?: PlanDocument;
  cancelled?: boolean;
}

export async function runPlanPipeline(
  mode: PlanMode,
  userInput: string,
  grove: LemonGrove,
  config: CliConfig,
): Promise<PlanPipelineResult> {
  const planner = await createPlanner(config);
  let plan = await generatePlan(planner, userInput);

  if (mode === 'plan-verbose') {
    const verboseContext = await collectVerboseContext(plan);
    if (verboseContext) {
      plan = await generatePlan(planner, userInput, verboseContext);
    }
  }

  while (true) {
    const gateResult = await runPlanGate(mode, plan, userInput);

    if (gateResult.action === 'cancel') {
      return { output: 'Plan cancelled.', cancelled: true };
    }

    if (gateResult.action === 'edit') {
      userInput = gateResult.revision;
      plan = await generatePlan(planner, userInput);
      continue;
    }

    const output = await executePlan(grove, gateResult.plan);
    return { output, plan: gateResult.plan };
  }
}

export async function runDirectMode(agent: LemonAgent, userInput: string): Promise<string> {
  return streamAgentResponse(agent, userInput, getStreamHandlers());
}

export async function routeInput(
  mode: InteractionMode,
  userInput: string,
  agent: LemonAgent,
  grove: LemonGrove,
  config: CliConfig,
): Promise<PlanPipelineResult> {
  if (isPlanMode(mode)) {
    return runPlanPipeline(mode, userInput, grove, config);
  }
  const output = await runDirectMode(agent, userInput);
  return { output };
}
