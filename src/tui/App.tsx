import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useKeyboard, useOnResize, useRenderer } from '@opentui/react';
import type { ActivityState, TranscriptChunk } from '../ui/bridge.ts';
import { normalizeChunk, thinkingActivity } from '../ui/bridge.ts';
import { activityUsesSecondLine } from '../ui/activity.ts';
import type { InteractionMode } from '../plan/modes.ts';
import { cycleMode, formatModeChange } from '../plan/modes.ts';
import { getInteractionMode } from '../session/mode-state.ts';
import { loadSession } from '../session/memory.ts';
import type { SessionData } from '../session/memory.ts';
import type { TuiStartOptions } from './types.ts';
import {
  createChunk,
  UiBridgeProvider,
  useUiBridgeContext,
  type UiBridgeContextValue,
} from './context/UiBridgeContext.tsx';
import { StatusBar } from './components/StatusBar.tsx';
import { InputBar } from './components/InputBar.tsx';
import { CommandPalette } from './components/CommandPalette.tsx';
import { PromptModal } from './components/PromptModal.tsx';
import { useReplController } from './hooks/useReplController.ts';
import { buildPaletteActions, loadSlashCommands, type SlashCommand } from './commands/registry.ts';
import { TranscriptScrollback } from './scrollback/transcript-scrollback.ts';
import { TUI_FOOTER_HEIGHT } from './bootstrap.tsx';

const TOKEN_FLUSH_MS = 50;

export function App({
  config,
  agent,
  grove,
  initialPrompt,
  autoRun,
  planYoloOneShot,
}: TuiStartOptions) {
  const renderer = useRenderer();
  const scrollback = useMemo(() => new TranscriptScrollback(renderer), [renderer]);
  const sessionRef = useRef<SessionData | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [chunks, setChunks] = useState<TranscriptChunk[]>([]);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('direct');
  const [pendingAsk, setPendingAsk] = useState<UiBridgeContextValue['pendingAsk']>(null);
  const [processing, setProcessingState] = useState(false);
  const [activity, setActivityState] = useState<ActivityState | null>(null);
  const oneShotRan = useRef(false);

  const setActivity = useCallback((state: ActivityState | null) => {
    setActivityState(state);
  }, []);

  const setProcessing = useCallback((v: boolean) => {
    setProcessingState(v);
    if (!v) {
      setActivityState(null);
    } else {
      setActivityState((prev) => prev ?? thinkingActivity());
    }
  }, []);

  const tokenBufferRef = useRef('');
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => scrollback.destroy(), [scrollback]);

  useEffect(() => {
    void loadSession(config.sessionId).then((session) => {
      sessionRef.current = session;
      const mode = getInteractionMode(session);
      setInteractionMode(mode);
      scrollback.mountSessionHeader({
        config,
        mode,
        width: renderer.terminalWidth,
      });
      const welcome = createChunk({
        type: 'system',
        text: 'Ready. Type a message, /command, or !shell command.',
        fg: '#565f89',
      });
      setChunks([welcome]);
      scrollback.appendChunk(welcome);
      setSessionLoaded(true);
    });
  }, [config, config.sessionId, scrollback, renderer]);

  const flushTokenBuffer = useCallback(() => {
    const pending = tokenBufferRef.current;
    if (!pending) return;
    tokenBufferRef.current = '';

    setChunks((prev) => {
      const last = prev[prev.length - 1];
      if (last?.type === 'assistant' && last.streaming) {
        void scrollback.appendAssistantDelta(pending);
        return [...prev.slice(0, -1), { ...last, text: last.text + pending }];
      }
      const chunk = createChunk({
        type: 'assistant',
        text: pending,
        format: 'markdown',
        streaming: true,
        fg: '#c0caf5',
      });
      scrollback.beginAssistantStream(chunk.id, chunk.fg);
      void scrollback.appendAssistantDelta(pending);
      return [...prev, chunk];
    });
  }, [scrollback]);

  const scheduleTokenFlush = useCallback(() => {
    if (flushTimerRef.current != null) return;
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      flushTokenBuffer();
    }, TOKEN_FLUSH_MS);
  }, [flushTokenBuffer]);

  const append = useCallback(
    (chunk: Omit<TranscriptChunk, 'id'> & { id?: string }) => {
      const normalized = createChunk(normalizeChunk(chunk));
      if (!normalized.streaming) {
        scrollback.appendChunk(normalized);
      }
      setChunks((prev) => [...prev, normalized]);
    },
    [scrollback],
  );

  const appendToken = useCallback(
    (text: string) => {
      tokenBufferRef.current += text;
      scheduleTokenFlush();
    },
    [scheduleTokenFlush],
  );

  const finalizeAssistant = useCallback(
    (text: string) => {
      if (flushTimerRef.current != null) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      const pending = tokenBufferRef.current;
      tokenBufferRef.current = '';

      let mergedFromState = text || pending;
      setChunks((prev) => {
        const last = prev[prev.length - 1];
        if (last?.type === 'assistant') {
          const merged = last.streaming ? last.text + pending : last.text;
          mergedFromState = text || merged;
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              text: mergedFromState,
              format: 'markdown' as const,
              streaming: false,
              fg: '#c0caf5',
            },
          ];
        }
        mergedFromState = text || pending;
        return [
          ...prev,
          createChunk({
            type: 'assistant',
            text: mergedFromState,
            format: 'markdown',
            streaming: false,
            fg: '#c0caf5',
          }),
        ];
      });

      void (async () => {
        if (pending) {
          await scrollback.appendAssistantDelta(pending);
        }
        await scrollback.finalizeAssistant(mergedFromState);
      })();
    },
    [scrollback],
  );

  const bridgeValue = useMemo<UiBridgeContextValue>(
    () => ({
      chunks,
      append,
      appendToken,
      finalizeAssistant,
      pendingAsk,
      setPendingAsk,
      processing,
      setProcessing,
      activity,
      setActivity,
    }),
    [
      chunks,
      append,
      appendToken,
      finalizeAssistant,
      pendingAsk,
      processing,
      setProcessing,
      activity,
      setActivity,
    ],
  );


  if (!sessionLoaded || !sessionRef.current) {
    return (
      <box
        style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}
      >
        <text content="Loading session..." style={{ fg: '#565f89' }} />
      </box>
    );
  }

  return (
    <UiBridgeProvider value={bridgeValue}>
      <AppInner
        config={config}
        agent={agent}
        grove={grove}
        sessionRef={sessionRef as MutableRefObject<SessionData>}
        interactionMode={interactionMode}
        setInteractionMode={setInteractionMode}
        pendingAsk={pendingAsk}
        setPendingAsk={setPendingAsk}
        processing={processing}
        activity={activity}
        renderer={renderer}
        scrollback={scrollback}
        initialPrompt={initialPrompt}
        autoRun={autoRun}
        planYoloOneShot={planYoloOneShot}
        oneShotRan={oneShotRan}
      />
    </UiBridgeProvider>
  );
}

function AppInner({
  config,
  agent,
  grove,
  sessionRef,
  interactionMode,
  setInteractionMode,
  pendingAsk,
  setPendingAsk,
  processing,
  activity,
  renderer,
  scrollback,
  initialPrompt,
  autoRun,
  planYoloOneShot,
  oneShotRan,
}: {
  config: TuiStartOptions['config'];
  agent: TuiStartOptions['agent'];
  grove: TuiStartOptions['grove'];
  sessionRef: MutableRefObject<SessionData>;
  interactionMode: InteractionMode;
  setInteractionMode: (m: InteractionMode) => void;
  pendingAsk: UiBridgeContextValue['pendingAsk'];
  setPendingAsk: UiBridgeContextValue['setPendingAsk'];
  processing: boolean;
  activity: ActivityState | null;
  renderer: ReturnType<typeof useRenderer>;
  scrollback: TranscriptScrollback;
  initialPrompt?: string;
  autoRun?: boolean;
  planYoloOneShot?: boolean;
  oneShotRan: MutableRefObject<boolean>;
}) {
  const { chunks } = useUiBridgeContext();
  const [slashCommands, setSlashCommands] = useState<SlashCommand[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [autocompleteRows, setAutocompleteRows] = useState(0);
  const [paletteRows, setPaletteRows] = useState(0);
  const [insertText, setInsertText] = useState<string | null>(null);
  const [bangTick, setBangTick] = useState(0);

  useEffect(() => {
    void loadSlashCommands(config.cwd).then(setSlashCommands);
  }, [config.cwd]);

  const { handleLine, runOneShot, appendSystem, runScan, getLastBangCommand } = useReplController(
    agent,
    grove,
    config,
    interactionMode,
    setInteractionMode,
    sessionRef,
    slashCommands,
  );

  const lastBangCommand = useMemo(() => {
    void bangTick;
    return getLastBangCommand();
  }, [bangTick, getLastBangCommand]);

  useOnResize(() => {
    scrollback.onResize({ config, mode: interactionMode, width: renderer.terminalWidth }, chunks);
  });

  const exitApp = useCallback(() => {
    scrollback.destroy();
    renderer.destroy();
    process.exit(0);
  }, [renderer, scrollback]);

  const cycleInteractionMode = useCallback(() => {
    const next = cycleMode(interactionMode);
    setInteractionMode(next);
    sessionRef.current = {
      ...sessionRef.current,
      interactionMode: next,
    };
    scrollback.replay({ config, mode: next, width: renderer.terminalWidth }, chunks);
    appendSystem(formatModeChange(next));
  }, [interactionMode, config, scrollback, chunks, appendSystem, sessionRef, setInteractionMode]);

  const paletteActions = useMemo(
    () =>
      buildPaletteActions({
        slashCommands,
        onInsertSlash: (text) => {
          setPaletteOpen(false);
          setInsertText(text);
        },
        onScan: () => void runScan(),
        onExit: exitApp,
        onCycleMode: cycleInteractionMode,
      }),
    [slashCommands, runScan, exitApp, cycleInteractionMode],
  );

  const activityExtraRows =
    activity && !pendingAsk && activityUsesSecondLine(activity.phase) ? 1 : 0;

  useEffect(() => {
    const extra = paletteOpen ? paletteRows : autocompleteRows;
    renderer.footerHeight =
      TUI_FOOTER_HEIGHT + (pendingAsk ? 4 : 0) + extra + activityExtraRows;
  }, [
    renderer,
    pendingAsk,
    paletteOpen,
    paletteRows,
    autocompleteRows,
    activityExtraRows,
  ]);

  useEffect(() => {
    if (!autoRun || !initialPrompt || oneShotRan.current) return;
    oneShotRan.current = true;
    void (async () => {
      await runOneShot(initialPrompt, planYoloOneShot ?? false);
      setTimeout(() => exitApp(), 300);
    })();
  }, [autoRun, initialPrompt, planYoloOneShot, runOneShot, exitApp, oneShotRan]);

  useKeyboard((key) => {
    if (paletteOpen) return;

    if (pendingAsk) {
      if (key.name === 'escape') {
        pendingAsk.resolve('');
        setPendingAsk(null);
      }
      return;
    }

    if (key.ctrl && key.name === 'p') {
      setPaletteOpen(true);
      return;
    }

    const seq = key.sequence ?? '';
    const isShiftTab =
      seq === '\x1b[Z' || seq === '\x1b[9\t]' || (key.name === 'tab' && key.shift === true);

    if (isShiftTab && !processing) {
      cycleInteractionMode();
      return;
    }

    if (key.ctrl && key.name === 'c') {
      exitApp();
    }
  });

  const onSubmitLine = useCallback(
    async (line: string) => {
      const result = await handleLine(line);
      setBangTick((t) => t + 1);
      if (result === 'exit') exitApp();
    },
    [handleLine, exitApp],
  );

  const onPromptSubmit = useCallback(
    (value: string) => {
      if (pendingAsk) {
        pendingAsk.resolve(value);
        setPendingAsk(null);
      }
    },
    [pendingAsk, setPendingAsk],
  );

  return (
    <box
      style={{
        width: '100%',
        height: '100%',
        flexDirection: 'column',
        padding: 1,
        justifyContent: 'flex-end',
      }}
    >
      <StatusBar
        processing={processing}
        activity={activity}
        pendingAsk={Boolean(pendingAsk)}
      />
      {paletteOpen && (
        <CommandPalette
          actions={paletteActions}
          onClose={() => setPaletteOpen(false)}
          onHeightChange={setPaletteRows}
        />
      )}
      {!autoRun && !paletteOpen && (
        <InputBar
          mode={interactionMode}
          disabled={processing || Boolean(pendingAsk)}
          activityLabel={activity?.label}
          cwd={config.cwd}
          slashCommands={slashCommands}
          lastBangCommand={lastBangCommand}
          insertText={insertText}
          onInsertConsumed={() => setInsertText(null)}
          onSubmit={onSubmitLine}
          onMenuHeightChange={setAutocompleteRows}
        />
      )}
      {pendingAsk && <PromptModal pendingAsk={pendingAsk} onSubmit={onPromptSubmit} />}
    </box>
  );
}
