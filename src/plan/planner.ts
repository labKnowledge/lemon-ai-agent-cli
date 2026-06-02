import { createLemonAgent, z } from 'lemon-ai-agent';
import type { LemonAgent } from 'lemon-ai-agent';
import type { CliConfig } from '../config.js';
import { planDocumentSchema, type PlanDocument } from './schema.js';

const PLANNER_JSON_INSTRUCTION = `Respond with ONLY valid JSON matching this schema (no markdown fences):
{
  "summary": "string",
  "clarifyingQuestions": [{"question":"string","why":"string","priority":"critical|optional"}],
  "options": [{"id":"string","title":"string","description":"string","score":0-100,"rationale":"string"}],
  "recommendedOptionId": "string",
  "selectedApproach": "",
  "steps": [{"id":"string","task":"string","specialist":"researcher|coder|tester|reviewer|general","parallelGroup":1,"dependsOn":["id"]}],
  "executionStrategy": "sequential|parallel|mixed"
}`;

function plannerPrompt(cwd: string): string {
  return `You are a planning specialist for software engineering tasks.

Workspace root: ${cwd}

Produce a structured plan with:
- A concise summary of the task and approach
- 2-4 options scored 0-100 with rationale (higher = better fit)
- recommendedOptionId matching the highest-scored viable option
- clarifyingQuestions with priority critical (must ask) or optional (nice to have)
- steps assigned to specialists: researcher, coder, tester, reviewer, general
- parallelGroup for steps that can run concurrently (same number = parallel)
- dependsOn for steps that must wait for others
- executionStrategy: sequential, parallel, or mixed

Leave selectedApproach as empty string.

${PLANNER_JSON_INSTRUCTION}`;
}

export async function createPlanner(config: CliConfig): Promise<LemonAgent> {
  return createLemonAgent({
    model: config.model,
    systemMessage: plannerPrompt(config.cwd),
    maxIterations: 3,
  });
}

export async function generatePlan(
  planner: LemonAgent,
  userInput: string,
  context?: string,
): Promise<PlanDocument> {
  const input = context
    ? `${userInput}\n\nAdditional context:\n${context}\n\nReturn the plan as JSON only.`
    : `${userInput}\n\nReturn the plan as JSON only.`;

  const result = await planner.invoke({ input });

  if (result.structuredOutput) {
    return planDocumentSchema.parse(result.structuredOutput);
  }

  const text = result.output?.trim();
  if (text) {
    const parsed = tryParsePlanFromText(text);
    if (parsed) return parsed;
  }

  throw new Error('Planner did not return valid JSON. Try rephrasing your request.');
}

function tryParsePlanFromText(text: string): PlanDocument | null {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const raw = JSON.parse(jsonMatch[0]) as unknown;
    return planDocumentSchema.parse(raw);
  } catch {
    return null;
  }
}

// Re-export schema for tests
export { planDocumentSchema, z };
