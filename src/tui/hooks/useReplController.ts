import { useCallback, useRef, type MutableRefObject } from 'react';
import type { LemonAgent } from 'lemon-ai-agent';
import type { LemonGrove } from 'lemon-ai-agent';
import type { CliConfig } from '../../config.ts';
import type { InteractionMode } from '../../plan/modes.ts';
import { formatModeChange, isPlanMode, parseSlashCommand } from '../../plan/modes.ts';
import { routeInput, runPlanPipeline } from '../../plan/pipeline.ts';
import { scanCodebase } from '../../codebase/scan.ts';
import { executeShell, printShellResult } from '../../tools/shell.ts';
import {
  appendTurn,
  buildInputWithContext,
  saveSession,
  saveCodebaseContext,
  type SessionData,
} from '../../session/memory.ts';
import {
  applyModeToSession,
  applyPlanToSession,
  getInteractionMode,
} from '../../session/mode-state.ts';
import { invalidateFileIndex } from '../autocomplete/file-search.ts';
import { findCustomCommand, type SlashCommand } from '../commands/registry.ts';
import { expandAtMentions } from '../input/expand-mentions.ts';
import { scanActivity } from '../../ui/activity.ts';
import { createChunk, useUiBridgeContext } from '../context/UiBridgeContext.tsx';

export function useReplController(
  agent: LemonAgent,
  grove: LemonGrove,
  config: CliConfig,
  interactionMode: InteractionMode,
  setInteractionMode: (mode: InteractionMode) => void,
  sessionRef: MutableRefObject<SessionData>,
  slashCommands: SlashCommand[],
  onCopy?: () => Promise<void>,
) {
  const { append, setProcessing, setActivity } = useUiBridgeContext();
  const lastBangCommand = useRef<string | null>(null);

  const appendUser = useCallback(
    (text: string) => {
      append(createChunk({ type: 'user', text: `> ${text}`, fg: '#7aa2f7' }));
    },
    [append],
  );

  const appendSystem = useCallback(
    (text: string, fg = '#565f89') => {
      append(createChunk({ type: 'system', text, fg }));
    },
    [append],
  );

  const appendPlanSummary = useCallback(
    (output: string) => {
      append(
        createChunk({
          type: 'assistant',
          text: output,
          format: 'markdown',
          streaming: false,
          fg: '#c0caf5',
        }),
      );
    },
    [append],
  );

  const runScan = useCallback(async () => {
    appendSystem('Scanning codebase...', '#7dcfff');
    setActivity(scanActivity());
    setProcessing(true);
    try {
      const result = await scanCodebase(config.cwd, { depth: 2 });
      sessionRef.current = await saveCodebaseContext(
        config.sessionId,
        result.summary,
        result.scannedAt,
      );
      invalidateFileIndex();
      appendSystem(result.summary);
    } finally {
      setProcessing(false);
    }
  }, [appendSystem, config, sessionRef, setActivity, setProcessing]);

  const handleLine = useCallback(
    async (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      if (trimmed === '/exit' || trimmed === '/quit') {
        return 'exit' as const;
      }

      if (trimmed === '/scan') {
        await runScan();
        return;
      }

      if (trimmed === '/copy') {
        await onCopy?.();
        return;
      }

      if (trimmed.startsWith('!')) {
        const command = resolveBangCommand(trimmed, lastBangCommand.current);
        if (!command) {
          appendSystem('No previous bang command to repeat.', '#e0af68');
          return;
        }
        lastBangCommand.current = command;
        const result = await executeShell(command, config.cwd, {
          workspaceCwd: config.cwd,
          approval: config.approval,
        });
        printShellResult(result);
        return;
      }

      const custom = findCustomCommand(slashCommands, trimmed);
      if (custom) {
        const spaceIdx = trimmed.indexOf(' ');
        const args = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1).trim();
        const userInput = args ? `${custom.prompt}\n\n${args}` : custom.prompt;
        const modeForTurn = custom.mode ?? interactionMode;

        if (custom.mode) {
          setInteractionMode(custom.mode);
          sessionRef.current = applyModeToSession(sessionRef.current, custom.mode);
          await saveSession(sessionRef.current);
        }

        appendUser(trimmed);
        setProcessing(true);
        try {
          const expanded = await expandAtMentions(config.cwd, userInput);
          const agentInput = buildInputWithContext(
            sessionRef.current.messages,
            expanded,
            sessionRef.current.codebaseContext,
          );
          const result = await routeInput(modeForTurn, agentInput, agent, grove, config);
          if (result.plan) {
            sessionRef.current = applyPlanToSession(sessionRef.current, result.plan);
            await saveSession(sessionRef.current);
          }
          if (!result.cancelled && result.output) {
            if (isPlanMode(modeForTurn)) appendPlanSummary(result.output);
            const updated = await appendTurn(config.sessionId, trimmed, result.output);
            sessionRef.current.messages = updated.messages;
          }
        } finally {
          setProcessing(false);
        }
        return;
      }

      const slash = parseSlashCommand(trimmed);
      if (slash?.mode && !slash.prompt) {
        setInteractionMode(slash.mode);
        sessionRef.current = applyModeToSession(sessionRef.current, slash.mode);
        await saveSession(sessionRef.current);
        appendSystem(formatModeChange(slash.mode));
        return;
      }

      let userInput = trimmed;
      let modeForTurn: InteractionMode = interactionMode;

      if (slash?.mode) {
        modeForTurn = slash.mode;
        setInteractionMode(slash.mode);
        sessionRef.current = applyModeToSession(sessionRef.current, slash.mode);
        await saveSession(sessionRef.current);
        userInput = slash.prompt ?? trimmed;
      }

      appendUser(userInput);
      setProcessing(true);

      try {
        const expanded = await expandAtMentions(config.cwd, userInput);
        const agentInput = buildInputWithContext(
          sessionRef.current.messages,
          expanded,
          sessionRef.current.codebaseContext,
        );

        const result = await routeInput(modeForTurn, agentInput, agent, grove, config);

        if (result.plan) {
          sessionRef.current = applyPlanToSession(sessionRef.current, result.plan);
          await saveSession(sessionRef.current);
        }

        if (!result.cancelled && result.output) {
          if (isPlanMode(modeForTurn)) {
            appendPlanSummary(result.output);
          }
          const updated = await appendTurn(config.sessionId, userInput, result.output);
          sessionRef.current.messages = updated.messages;
        }
      } finally {
        setProcessing(false);
      }
    },
    [
      agent,
      grove,
      config,
      interactionMode,
      sessionRef,
      slashCommands,
      append,
      appendUser,
      appendSystem,
      appendPlanSummary,
      setInteractionMode,
      setProcessing,
      setActivity,
      runScan,
      onCopy,
    ],
  );

  const runOneShot = useCallback(
    async (prompt: string, planYolo: boolean) => {
      appendUser(prompt);
      setProcessing(true);
      try {
        const session = sessionRef.current;
        const expanded = await expandAtMentions(config.cwd, prompt);
        const agentInput = buildInputWithContext(
          session.messages,
          expanded,
          session.codebaseContext,
        );
        const mode = planYolo ? 'plan-yolo' : getInteractionMode(session);

        if (planYolo) {
          const result = await runPlanPipeline('plan-yolo', agentInput, grove, config);
          if (!result.cancelled && result.output) {
            appendPlanSummary(result.output);
            await appendTurn(config.sessionId, prompt, result.output);
          }
        } else {
          const result = await routeInput(mode, agentInput, agent, grove, config);
          if (!result.cancelled && result.output) {
            if (isPlanMode(mode)) {
              appendPlanSummary(result.output);
            }
            await appendTurn(config.sessionId, prompt, result.output);
          }
        }
      } finally {
        setProcessing(false);
      }
    },
    [agent, grove, config, sessionRef, append, appendUser, appendPlanSummary, setProcessing],
  );

  return {
    handleLine,
    runOneShot,
    appendSystem,
    runScan,
    getLastBangCommand: () => lastBangCommand.current,
  };
}

function resolveBangCommand(line: string, lastCommand: string | null): string | null {
  if (line === '!!') return lastCommand;
  const withoutBang = line.slice(1).trim();
  return withoutBang || null;
}
