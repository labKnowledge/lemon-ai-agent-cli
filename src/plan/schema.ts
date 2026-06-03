import { z } from 'lemon-ai-agent';

export const specialistType = z.enum(['researcher', 'coder', 'tester', 'reviewer', 'general']);

export const planStepSchema = z.object({
  id: z.string(),
  task: z.string(),
  specialist: specialistType,
  parallelGroup: z.number().optional(),
  dependsOn: z.array(z.string()).optional(),
});

export const planOptionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  score: z.number().min(0).max(100),
  rationale: z.string(),
});

export const clarifyingQuestionSchema = z.object({
  question: z.string(),
  why: z.string(),
  priority: z.enum(['critical', 'optional']),
});

export const planDocumentSchema = z.object({
  summary: z.string(),
  clarifyingQuestions: z.array(clarifyingQuestionSchema),
  options: z.array(planOptionSchema).min(1),
  recommendedOptionId: z.string(),
  selectedApproach: z.string().default(''),
  steps: z.array(planStepSchema),
  executionStrategy: z.enum(['sequential', 'parallel', 'mixed']),
});

export type PlanDocument = z.infer<typeof planDocumentSchema>;
export type PlanStep = z.infer<typeof planStepSchema>;
export type PlanOption = z.infer<typeof planOptionSchema>;
export type SpecialistType = z.infer<typeof specialistType>;

export const SPECIALIST_AGENT_MAP: Record<SpecialistType, string> = {
  researcher: 'researcher_agent',
  coder: 'coder_agent',
  tester: 'tester_agent',
  reviewer: 'reviewer_agent',
  general: 'general_agent',
};
