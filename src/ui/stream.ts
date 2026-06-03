import type { UiBridge } from './bridge.js';
import { bridgeAppend, bridgeAppendToken, nextChunkId } from './bridge.js';

export interface StreamHandlers {
  onToken?: (text: string) => void;
  onToolStart?: (tool: string, input: unknown) => void;
  onToolEnd?: (tool: string) => void;
  onDone?: (output: string) => void;
}

export async function streamAgentResponse(
  agent: { stream: (opts: { input: string }) => AsyncGenerator<unknown> },
  input: string,
  handlers: StreamHandlers = {},
): Promise<string> {
  let output = '';

  for await (const chunk of agent.stream({ input })) {
    const c = chunk as {
      type: string;
      text?: string;
      tool?: string;
      input?: unknown;
      result?: { output?: string };
    };

    switch (c.type) {
      case 'token':
        if (c.text) {
          output += c.text;
          handlers.onToken?.(c.text);
        }
        break;
      case 'tool_start':
        handlers.onToolStart?.(c.tool ?? 'unknown', c.input);
        break;
      case 'tool_end':
        handlers.onToolEnd?.(c.tool ?? 'unknown');
        break;
      case 'done':
        if (c.result?.output) {
          output = c.result.output;
          handlers.onDone?.(output);
        }
        break;
    }
  }

  return output;
}

export function createTuiStreamHandlers(bridge?: UiBridge | null): StreamHandlers {
  const b = bridge ?? null;
  return {
    onToken: (text) => {
      if (b) {
        b.appendToken(text);
      } else {
        bridgeAppendToken(text);
      }
    },
    onToolStart: (tool, input) => {
      const args = formatToolInput(input);
      const line = `[tool] ${tool}${args ? ` ${args}` : ''}`;
      if (b) {
        b.append({ type: 'tool', text: line, fg: '#7dcfff' });
      } else {
        bridgeAppend({ type: 'tool', text: line, fg: '#7dcfff' });
      }
    },
    onToolEnd: () => {},
    onDone: () => {},
  };
}

export function getStreamHandlers(): StreamHandlers {
  return createTuiStreamHandlers();
}

function formatToolInput(input: unknown): string {
  if (!input || typeof input !== 'object') return '';
  const entries = Object.entries(input as Record<string, unknown>)
    .filter(([, v]) => v != null)
    .map(([k, v]) => {
      const val = typeof v === 'string' && v.length > 80 ? `${v.slice(0, 77)}...` : String(v);
      return `${k}=${JSON.stringify(val)}`;
    });
  return entries.join(' ');
}
