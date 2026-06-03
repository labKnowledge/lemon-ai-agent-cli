import type { LemonGrove } from 'lemon-ai-agent';
import type { PlanDocument, PlanStep } from './schema.js';
import { SPECIALIST_AGENT_MAP } from './schema.js';
import { getStreamHandlers, streamAgentResponse } from '../ui/stream.js';
import { bridgeAppend } from '../ui/bridge.js';

interface StepResult {
  stepId: string;
  specialist: string;
  output: string;
}

export async function executePlan(grove: LemonGrove, plan: PlanDocument): Promise<string> {
  if (plan.steps.length === 0) {
    return runGroveFallback(grove, plan);
  }

  const waves = buildExecutionWaves(plan);
  const results: StepResult[] = [];
  const completed = new Set<string>();
  const handlers = getStreamHandlers();

  for (let w = 0; w < waves.length; w++) {
    const wave = waves[w]!;
    bridgeAppend({
      type: 'wave',
      text: `[wave ${w + 1}/${waves.length}] ${formatWaveLabel(wave)}`,
      fg: '#bb9af7',
    });

    const waveResults = await runWave(grove, wave, plan, results, completed, handlers);
    results.push(...waveResults);
    for (const r of waveResults) completed.add(r.stepId);
  }

  return formatExecutionSummary(plan, results);
}

async function runWave(
  grove: LemonGrove,
  wave: PlanStep[][],
  plan: PlanDocument,
  priorResults: StepResult[],
  completed: Set<string>,
  handlers: ReturnType<typeof getStreamHandlers>,
): Promise<StepResult[]> {
  const allResults: StepResult[] = [];

  for (const batch of wave) {
    if (batch.length === 1) {
      const result = await runStep(grove, batch[0]!, plan, priorResults, completed, handlers);
      allResults.push(result);
    } else {
      const parallelResults = await Promise.all(
        batch.map((step) => runStep(grove, step, plan, priorResults, completed, handlers)),
      );
      allResults.push(...parallelResults);
    }
  }

  return allResults;
}

async function runStep(
  grove: LemonGrove,
  step: PlanStep,
  plan: PlanDocument,
  priorResults: StepResult[],
  completed: Set<string>,
  handlers: ReturnType<typeof getStreamHandlers>,
): Promise<StepResult> {
  const agentName = SPECIALIST_AGENT_MAP[step.specialist];
  const specialist = grove.getSpecialist(agentName);

  const context = priorResults.length
    ? `\nPrior step outputs:\n${priorResults.map((r) => `[${r.stepId}] ${r.output.slice(0, 500)}`).join('\n')}`
    : '';

  const input = `[Plan step ${step.id}] ${step.task}

Plan summary: ${plan.summary}
Selected approach: ${plan.selectedApproach}${context}`;

  bridgeAppend({
    type: 'agent',
    text: `[agent] ${agentName} — ${step.task.slice(0, 60)}`,
    fg: '#7dcfff',
  });

  if (specialist) {
    const output = await streamAgentResponse(specialist, input, handlers);
    return { stepId: step.id, specialist: agentName, output };
  }

  const output = await streamAgentResponse(grove.getOrchestrator(), input, handlers);
  return { stepId: step.id, specialist: 'orchestrator', output };
}

async function runGroveFallback(grove: LemonGrove, plan: PlanDocument): Promise<string> {
  bridgeAppend({
    type: 'agent',
    text: '[fallback] delegating to grove orchestrator',
    fg: '#bb9af7',
  });
  const input = `Execute this approved plan:

Summary: ${plan.summary}
Approach: ${plan.selectedApproach}
Strategy: ${plan.executionStrategy}`;

  return streamAgentResponse(grove.getOrchestrator(), input, getStreamHandlers());
}

function buildExecutionWaves(plan: PlanDocument): PlanStep[][][] {
  const steps = plan.steps;
  if (steps.length === 0) return [];

  if (plan.executionStrategy === 'sequential') {
    return [steps.map((s) => [s])];
  }

  if (plan.executionStrategy === 'parallel') {
    const groups = groupByParallel(steps);
    return [groups];
  }

  return buildTopologicalWaves(steps);
}

function buildTopologicalWaves(steps: PlanStep[]): PlanStep[][][] {
  const waves: PlanStep[][][] = [];
  const completed = new Set<string>();
  const remaining = new Set(steps.map((s) => s.id));

  while (remaining.size > 0) {
    const ready = steps.filter(
      (s) => remaining.has(s.id) && (s.dependsOn ?? []).every((dep) => completed.has(dep)),
    );

    if (ready.length === 0) {
      const rest = steps.filter((s) => remaining.has(s.id));
      waves.push(...rest.map((s) => [[s]]));
      break;
    }

    const groups = groupByParallel(ready);
    waves.push(groups);

    for (const s of ready) {
      completed.add(s.id);
      remaining.delete(s.id);
    }
  }

  return waves;
}

function groupByParallel(steps: PlanStep[]): PlanStep[][] {
  const batches: PlanStep[][] = [];
  const byGroup = new Map<number | 'none', PlanStep[]>();

  for (const step of steps) {
    const key = step.parallelGroup ?? 'none';
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key)!.push(step);
  }

  for (const [, group] of byGroup) {
    batches.push(group);
  }

  return batches;
}

function formatWaveLabel(wave: PlanStep[][]): string {
  return wave
    .map((batch) => {
      const names = batch.map((s) => SPECIALIST_AGENT_MAP[s.specialist]).join(', ');
      return batch.length > 1 ? `parallel: ${names}` : names;
    })
    .join(' → ');
}

function formatExecutionSummary(plan: PlanDocument, results: StepResult[]): string {
  const parts = [
    `Plan executed: ${plan.summary}`,
    `Approach: ${plan.selectedApproach}`,
    '',
    ...results.map((r) => `### ${r.stepId} (${r.specialist})\n${r.output}`),
  ];
  return parts.join('\n');
}
