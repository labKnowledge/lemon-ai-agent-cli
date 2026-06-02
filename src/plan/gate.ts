import { stdout as output } from 'node:process';
import pc from 'picocolors';
import type { PlanMode } from './modes.js';
import type { PlanDocument, PlanOption } from './schema.js';
import { renderPlanCard, renderSelectedApproach } from './render.js';
import { askUser } from '../session/prompt.js';

export type GateResult =
  | { action: 'execute'; plan: PlanDocument }
  | { action: 'cancel' }
  | { action: 'edit'; revision: string };

export function autoSelectOption(plan: PlanDocument): PlanDocument {
  const best = [...plan.options].sort((a, b) => b.score - a.score)[0];
  const selected = best ?? plan.options.find((o) => o.id === plan.recommendedOptionId);
  if (!selected) return plan;

  return {
    ...plan,
    selectedApproach: `${selected.title}: ${selected.description}`,
    recommendedOptionId: selected.id,
  };
}

export async function runPlanGate(
  mode: PlanMode,
  plan: PlanDocument,
  originalPrompt: string,
): Promise<GateResult> {
  output.write(renderPlanCard(plan));

  if (mode === 'plan-yolo') {
    const selected = autoSelectOption(plan);
    output.write(renderSelectedApproach(selected));
    return { action: 'execute', plan: selected };
  }

  if (mode === 'plan-verbose') {
    return promptApproval(plan, originalPrompt);
  }

  const withAnswers = await askCriticalQuestions(plan);
  if (withAnswers !== plan) {
    output.write(pc.dim('\n(Plan updated with your answers)\n'));
  }
  return promptApproval(withAnswers, originalPrompt);
}

export async function collectVerboseContext(plan: PlanDocument): Promise<string | undefined> {
  if (plan.clarifyingQuestions.length === 0) return undefined;

  output.write(pc.bold('\n── Clarifying Questions ──\n'));
  const answers = await askQuestions(
    plan.clarifyingQuestions.map((q) => {
      output.write(pc.dim(`  (${q.priority}) ${q.why}\n`));
      return q.question;
    }),
  );

  return plan.clarifyingQuestions
    .map((q, i) => `Q: ${q.question}\nA: ${answers[i] ?? '(skipped)'}`)
    .join('\n\n');
}

async function askCriticalQuestions(plan: PlanDocument): Promise<PlanDocument> {
  const critical = plan.clarifyingQuestions.filter((q) => q.priority === 'critical');
  if (critical.length === 0) return plan;

  const answers = await askQuestions(critical.map((q) => q.question));
  if (answers.every((a) => !a.trim())) return plan;

  const appendix = critical
    .map((q, i) => `Q: ${q.question}\nA: ${answers[i]}`)
    .join('\n\n');

  return {
    ...plan,
    summary: `${plan.summary}\n\nUser clarifications:\n${appendix}`,
  };
}

async function askQuestions(questions: string[]): Promise<string[]> {
  const answers: string[] = [];

  for (const question of questions) {
    const answer = await askUser(`\n${pc.yellow('?')} ${question}\n> `);
    answers.push(answer);
  }

  return answers;
}

async function promptApproval(
  plan: PlanDocument,
  originalPrompt: string,
): Promise<GateResult> {
  const answer = (
    await askUser(
      `\n${pc.bold('[y]')} approve  ${pc.bold('[e]')} edit  ${pc.bold('[n]')} cancel\n> `,
    )
  )
    .trim()
    .toLowerCase();

  if (answer === 'y' || answer === 'yes') {
    const selected = selectOptionForApproval(plan);
    output.write(renderSelectedApproach(selected));
    return { action: 'execute', plan: selected };
  }

  if (answer === 'e' || answer === 'edit') {
    const revision = await askUser('Enter revised request:\n> ');
    return { action: 'edit', revision: revision.trim() || originalPrompt };
  }

  output.write(pc.yellow('\nPlan cancelled.\n'));
  return { action: 'cancel' };
}

function selectOptionForApproval(plan: PlanDocument): PlanDocument {
  const recommended = plan.options.find((o) => o.id === plan.recommendedOptionId);
  const selected: PlanOption = recommended ?? plan.options[0]!;
  return {
    ...plan,
    selectedApproach: `${selected.title}: ${selected.description}`,
    recommendedOptionId: selected.id,
  };
}
