import pc from 'picocolors';

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

export function defaultStreamHandlers(): StreamHandlers {
  return {
    onToken: (text) => process.stdout.write(text),
    onToolStart: (tool, input) => {
      const args = formatToolInput(input);
      process.stdout.write(`\n${pc.cyan('[tool]')} ${pc.bold(tool)}${args ? ` ${args}` : ''}\n`);
    },
    onToolEnd: () => {},
    onDone: () => process.stdout.write('\n'),
  };
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
