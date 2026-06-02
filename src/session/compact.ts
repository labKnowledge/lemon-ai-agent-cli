import { createLemonAgent } from 'lemon-ai-agent';
import type { CliConfig } from '../config.js';
import { compactSession, loadSession, type SessionData } from './memory.js';

function buildTranscript(messages: SessionData['messages']): string {
  return messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');
}

export async function compactConversation(
  config: CliConfig,
  sessionId: string,
  hint?: string,
): Promise<SessionData> {
  const session = await loadSession(sessionId);
  if (session.messages.length === 0) {
    return session;
  }

  const summarizer = await createLemonAgent({
    model: config.model,
    systemMessage:
      'You summarize conversation history for continuation. Be concise but preserve decisions, file paths, errors, and todos.',
    maxIterations: 1,
  });

  const focus = hint ? ` Focus on: ${hint}` : '';
  const result = await summarizer.invoke({
    input: `Summarize this conversation for continuation.${focus}\n\n${buildTranscript(session.messages)}`,
  });

  const summary = result.output?.trim() ?? 'Conversation summarized.';
  return compactSession(sessionId, summary);
}
