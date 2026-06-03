import type { PlanMode } from './modes.js';
import type { PlanDocument } from './schema.js';
import { renderPlanCard, renderSelectedApproach } from './render.js';
import { askUser } from '../session/prompt.js';
import { bridgeAppend } from '../ui/bridge.js';

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
  bridgeAppend({ type: 'plan', text: renderPlanCard(plan) });

  if (mode === 'plan-yolo') {
    const selected = autoSelectOption(plan);
    bridgeAppend({ type: 'plan', text: renderSelectedApproach(selected), fg: '#9ece6a' });
    return { action: 'execute', plan: selected };
  }

  if (mode === 'plan-verbose') {
    return promptApproval(plan, originalPrompt);
  }

  const withAnswers = await askCriticalQuestions(plan);
  if (withAnswers !== plan) {
    bridgeAppend({ type: 'system', text: '(Plan updated with your answers)', fg: '#565f89' });
  }
  return promptApproval(withAnswers, originalPrompt);
}

export async function collectVerboseContext(plan: PlanDocument): Promise<string | undefined> {
  if (plan.clarifyingQuestions.length === 0) return undefined;

  bridgeAppend({ type: 'system', text: '── Clarifying Questions ──', fg: '#c0caf5' });
  const answers = await askQuestions(
    plan.clarifyingQuestions.map((q) => {
      bridgeAppend({
        type: 'system',
        text: `  (${q.priority}) ${q.why}`,
        fg: '#565f89',
      });
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

  const appendix = critical.map((q, i) => `Q: ${q.question}\nA: ${answers[i]}`).join('\n\n');

  return {
    ...plan,
    summary: `${plan.summary}\n\nUser clarifications:\n${appendix}`,
  };
}

async function askQuestions(questions: string[]): Promise<string[]> {
  const answers: string[] = [];

  for (const question of questions) {
    const answer = await askUser(`? ${question}`);
    answers.push(answer);
  }

  return answers;
}

async function promptApproval(plan: PlanDocument, originalPrompt: string): Promise<GateResult> {
  const answer = (await askUser('[y] approve  [e] edit  [n] cancel')).trim().toLowerCase();

  if (answer === 'y' || answer === 'yes') {
    const selected = selectOptionForApproval(plan);
    bridgeAppend({ type: 'plan', text: renderSelectedApproach(selected), fg: '#9ece6a' });
    return { action: 'execute', plan: selected };
  }

  if (answer === 'e' || answer === 'edit') {
    const revision = await askUser('Enter revised request:');
    return { action: 'edit', revision: revision.trim() || originalPrompt };
  }

  bridgeAppend({ type: 'system', text: 'Plan cancelled.', fg: '#e0af68' });
  return { action: 'cancel' };
}

function selectOptionForApproval(plan: PlanDocument): PlanDocument {
  const recommended = plan.options.find((o) => o.id === plan.recommendedOptionId);
  const selected = recommended ?? plan.options[0]!;
  return {
    ...plan,
    selectedApproach: `${selected.title}: ${selected.description}`,
    recommendedOptionId: selected.id,
  };
}
