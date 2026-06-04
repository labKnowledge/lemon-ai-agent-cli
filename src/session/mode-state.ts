import type { InteractionMode } from '../plan/modes.js';
import { modeLabel } from '../plan/modes.js';
import type { PlanDocument } from '../plan/schema.js';
import type { SessionData } from './memory.js';

export function getInteractionMode(session: SessionData): InteractionMode {
  return session.interactionMode ?? 'direct';
}

export function buildPrompt(mode: InteractionMode): string {
  return `Lemon Code [${modeLabel(mode)}]> `;
}

export function applyModeToSession(session: SessionData, mode: InteractionMode): SessionData {
  return { ...session, interactionMode: mode };
}

export function applyPlanToSession(session: SessionData, plan: PlanDocument): SessionData {
  return { ...session, lastPlan: plan };
}
