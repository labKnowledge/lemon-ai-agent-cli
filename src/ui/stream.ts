import {
  approvalActivity,
  delegateActivity,
  formatToolDetail,
  thinkingActivity,
  toolActivity,
} from './activity.js';
import type { UiBridge } from './bridge.js';
import {
  bridgeAppend,
  bridgeAppendToken,
  bridgeFinalizeAssistant,
  bridgeSetActivity,
} from './bridge.js';

export interface StreamHandlers {
  onToken?: (text: string) => void;
  onToolStart?: (tool: string, input: unknown) => void;
  onToolEnd?: (tool: string) => void;
  onDelegationSummary?: (trace: { toolsInvoked: string[] }) => void;
  onApprovalRequired?: (tool: string) => void;
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
      trace?: { toolsInvoked: string[] };
      action?: { tool?: string };
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
      case 'delegation_summary':
        if (c.trace) handlers.onDelegationSummary?.(c.trace);
        break;
      case 'approval_required':
        handlers.onApprovalRequired?.(c.action?.tool ?? 'tool');
        break;
      case 'done':
        if (c.result?.output) {
          output = c.result.output;
        }
        break;
    }
  }

  if (output) {
    handlers.onDone?.(output);
  }

  return output;
}

export function createTuiStreamHandlers(bridge?: UiBridge | null): StreamHandlers {
  const b = bridge ?? null;

  const setActivity = (state: Parameters<NonNullable<UiBridge['setActivity']>>[0]) => {
    if (b?.setActivity) {
      b.setActivity(state);
    } else {
      bridgeSetActivity(state);
    }
  };

  return {
    onToken: (text) => {
      if (b) {
        b.appendToken(text);
      } else {
        bridgeAppendToken(text);
      }
    },
    onToolStart: (tool, input) => {
      const detail = formatToolDetail(input);
      const args = detail ? ` ${detail}` : '';
      const line = `[tool] ${tool}${args}`;
      setActivity(toolActivity(tool, detail));
      if (b) {
        b.append({ type: 'tool', text: line, fg: '#7dcfff' });
      } else {
        bridgeAppend({ type: 'tool', text: line, fg: '#7dcfff' });
      }
    },
    onToolEnd: () => {
      setActivity(thinkingActivity());
    },
    onDelegationSummary: (trace) => {
      const invoked = trace.toolsInvoked?.length
        ? trace.toolsInvoked.join(', ')
        : undefined;
      setActivity(
        delegateActivity(
          invoked ? `Coordinating specialists (${invoked})` : 'Coordinating specialists',
        ),
      );
    },
    onApprovalRequired: (tool) => {
      setActivity(approvalActivity(tool));
    },
    onDone: (output) => {
      if (b) {
        b.finalizeAssistant(output);
      } else {
        bridgeFinalizeAssistant(output);
      }
    },
  };
}

export function getStreamHandlers(): StreamHandlers {
  return createTuiStreamHandlers();
}
