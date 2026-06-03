import type { PlanDocument } from './schema.js';

export function renderPlanCard(plan: PlanDocument): string {
  const lines: string[] = [];

  lines.push('\n── Plan ──');
  lines.push(plan.summary);
  lines.push('');

  lines.push('Options:');
  const sorted = [...plan.options].sort((a, b) => b.score - a.score).slice(0, 3);
  for (const opt of sorted) {
    const marker = opt.id === plan.recommendedOptionId ? '*' : ' ';
    lines.push(`${marker} [${opt.score}] ${opt.title} — ${opt.description}`);
    lines.push(`    ${opt.rationale}`);
  }
  lines.push('');

  if (plan.steps.length > 0) {
    lines.push('Steps:');
    for (const step of plan.steps) {
      const parallel = step.parallelGroup != null ? ` ∥g${step.parallelGroup}` : '';
      const deps = step.dependsOn?.length ? ` ← ${step.dependsOn.join(', ')}` : '';
      lines.push(`  ${step.id}. [${step.specialist}]${parallel}${deps} ${step.task}`);
    }
    lines.push(`  Strategy: ${plan.executionStrategy}`);
  }

  lines.push('──────────\n');
  return lines.join('\n');
}

export function renderSelectedApproach(plan: PlanDocument): string {
  return `\n→ Selected: ${plan.selectedApproach}\n`;
}
