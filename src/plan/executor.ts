import pc from 'picocolors';
import type { LemonGrove } from 'lemon-ai-agent';
import type { PlanDocument, PlanStep } from './schema.js';
import { SPECIALIST_AGENT_MAP } from './schema.js';
import { defaultStreamHandlers, streamAgentResponse } from '../ui/stream.js';

interface StepResult {
  stepId: string;
  specialist: string;
  output: string;
}

export async function executePlan(
  grove: LemonGrove,
  plan: PlanDocument,
): Promise<string> {
  if (plan.steps.length === 0) {
    return runGroveFallback(grove, plan);
  }

  const waves = buildExecutionWaves(plan);
  const results: StepResult[] = [];
  const completed = new Set<string>();

  for (let w = 0; w < waves.length; w++) {
    const wave = waves[w]!;
    process.stdout.write(
      `\n${pc.magenta(`[wave ${w + 1}/${waves.length}]`)} ${formatWaveLabel(wave)}\n`,
    );

    const waveResults = await runWave(grove, wave, plan, results, completed);
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
): Promise<StepResult[]> {
  const allResults: StepResult[] = [];

  for (const batch of wave) {
    if (batch.length === 1) {
      const result = await runStep(grove, batch[0]!, plan, priorResults, completed);
      allResults.push(result);
    } else {
      const parallelResults = await Promise.all(
        batch.map((step) => runStep(grove, step, plan, priorResults, completed)),
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
): Promise<StepResult> {
  const agentName = SPECIALIST_AGENT_MAP[step.specialist];
  const specialist = grove.getSpecialist(agentName);

  const context = priorResults.length
    ? `\nPrior step outputs:\n${priorResults.map((r) => `[${r.stepId}] ${r.output.slice(0, 500)}`).join('\n')}`
    : '';

  const input = `[Plan step ${step.id}] ${step.task}

Plan summary: ${plan.summary}
Selected approach: ${plan.selectedApproach}${context}`;

  process.stdout.write(`${pc.cyan('[agent]')} ${agentName} — ${step.task.slice(0, 60)}\n`);

  if (specialist) {
    const output = await streamAgentResponse(specialist, input, defaultStreamHandlers());
    return { stepId: step.id, specialist: agentName, output };
  }

  const output = await streamAgentResponse(
    grove.getOrchestrator(),
    input,
    defaultStreamHandlers(),
  );
  return { stepId: step.id, specialist: 'orchestrator', output };
}

async function runGroveFallback(grove: LemonGrove, plan: PlanDocument): Promise<string> {
  process.stdout.write(`${pc.magenta('[fallback]')} delegating to grove orchestrator\n`);
  const input = `Execute this approved plan:

Summary: ${plan.summary}
Approach: ${plan.selectedApproach}
Strategy: ${plan.executionStrategy}`;

  return streamAgentResponse(grove.getOrchestrator(), input, defaultStreamHandlers());
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

  // mixed: topological waves
  return buildTopologicalWaves(steps);
}

function buildTopologicalWaves(steps: PlanStep[]): PlanStep[][][] {
  const waves: PlanStep[][][] = [];
  const completed = new Set<string>();
  const remaining = new Set(steps.map((s) => s.id));

  while (remaining.size > 0) {
    const ready = steps.filter(
      (s) =>
        remaining.has(s.id) &&
        (s.dependsOn ?? []).every((dep) => completed.has(dep)),
    );

    if (ready.length === 0) {
      // cycle or missing deps — run rest sequentially
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
