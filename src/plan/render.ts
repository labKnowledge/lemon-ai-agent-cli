import type { PlanDocument } from './schema.js';

export function renderPlanCard(plan: PlanDocument): string {
  const lines: string[] = [];

  lines.push('## Plan');
  lines.push('');
  lines.push(plan.summary);
  lines.push('');
  lines.push('### Options');
  lines.push('');

  const sorted = [...plan.options].sort((a, b) => b.score - a.score).slice(0, 3);
  for (const opt of sorted) {
    const recommended = opt.id === plan.recommendedOptionId;
    lines.push(
      recommended
        ? `- **[${opt.score}] ${opt.title}** — ${opt.description}`
        : `- [${opt.score}] ${opt.title} — ${opt.description}`,
    );
    lines.push(`  - *${opt.rationale}*`);
  }
  lines.push('');

  if (plan.steps.length > 0) {
    lines.push('### Steps');
    lines.push('');
    for (const step of plan.steps) {
      const parallel = step.parallelGroup != null ? ` (parallel g${step.parallelGroup})` : '';
      const deps = step.dependsOn?.length ? ` ← ${step.dependsOn.join(', ')}` : '';
      lines.push(`${step.id}. **${step.specialist}**${parallel}${deps}: ${step.task}`);
    }
    lines.push('');
    lines.push(`**Strategy:** ${plan.executionStrategy}`);
  }

  return lines.join('\n');
}

export function renderSelectedApproach(plan: PlanDocument): string {
  return `**Selected:** ${plan.selectedApproach}`;
}
