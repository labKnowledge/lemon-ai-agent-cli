import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { InteractionMode } from '../plan/modes.js';
import type { PlanDocument } from '../plan/schema.js';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface SessionData {
  id: string;
  messages: ChatMessage[];
  updatedAt: string;
  interactionMode?: InteractionMode;
  lastPlan?: PlanDocument;
}

const SESSIONS_DIR = join(homedir(), '.lemon-cli', 'sessions');

function sessionPath(sessionId: string): string {
  const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return join(SESSIONS_DIR, `${safe}.json`);
}

export async function loadSession(sessionId: string): Promise<SessionData> {
  try {
    const raw = await readFile(sessionPath(sessionId), 'utf-8');
    return JSON.parse(raw) as SessionData;
  } catch {
    return { id: sessionId, messages: [], updatedAt: new Date().toISOString() };
  }
}

export async function saveSession(session: SessionData): Promise<void> {
  await mkdir(SESSIONS_DIR, { recursive: true });
  session.updatedAt = new Date().toISOString();
  await writeFile(sessionPath(session.id), JSON.stringify(session, null, 2), 'utf-8');
}

export function buildInputWithHistory(messages: ChatMessage[], newInput: string): string {
  if (messages.length === 0) return newInput;

  const history = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');

  return `Previous conversation:\n${history}\n\nUser: ${newInput}`;
}

export async function appendTurn(
  sessionId: string,
  userInput: string,
  assistantOutput: string,
): Promise<SessionData> {
  const session = await loadSession(sessionId);
  session.messages.push({ role: 'user', content: userInput });
  session.messages.push({ role: 'assistant', content: assistantOutput });
  await saveSession(session);
  return session;
}
