import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useKeyboard, useOnResize, useRenderer } from '@opentui/react';
import type { TranscriptChunk } from '../ui/bridge.ts';
import { normalizeChunk } from '../ui/bridge.ts';
import type { InteractionMode } from '../plan/modes.ts';
import { cycleMode, formatModeChange } from '../plan/modes.ts';
import { getInteractionMode } from '../session/mode-state.ts';
import { loadSession } from '../session/memory.ts';
import type { SessionData } from '../session/memory.ts';
import type { TuiStartOptions } from './types.ts';
import {
  createChunk,
  UiBridgeProvider,
  type UiBridgeContextValue,
} from './context/UiBridgeContext.tsx';
import { StatusBar } from './components/StatusBar.tsx';
import { InputBar } from './components/InputBar.tsx';
import { PromptModal } from './components/PromptModal.tsx';
import { useReplController } from './hooks/useReplController.ts';
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
  const [processing, setProcessing] = useState(false);
  const oneShotRan = useRef(false);

  const tokenBufferRef = useRef('');
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => scrollback.destroy(), [scrollback]);

  useEffect(() => {
    void loadSession(config.sessionId).then((session) => {
      sessionRef.current = session;
      setInteractionMode(getInteractionMode(session));
      const welcome = createChunk({
        type: 'system',
        text: `Mode: ${getInteractionMode(session)} | Shift+Tab cycle | /p /py /pv /d | /scan | ! shell | /exit`,
        fg: '#565f89',
      });
      setChunks([welcome]);
      scrollback.appendChunk(welcome);
      setSessionLoaded(true);
    });
  }, [config.sessionId, scrollback]);

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
    }),
    [chunks, append, appendToken, finalizeAssistant, pendingAsk, processing],
  );

  useEffect(() => {
    renderer.footerHeight = pendingAsk ? TUI_FOOTER_HEIGHT + 4 : TUI_FOOTER_HEIGHT;
  }, [renderer, pendingAsk]);

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
  renderer: ReturnType<typeof useRenderer>;
  scrollback: TranscriptScrollback;
  initialPrompt?: string;
  autoRun?: boolean;
  planYoloOneShot?: boolean;
  oneShotRan: MutableRefObject<boolean>;
}) {
  const { handleLine, runOneShot, appendSystem } = useReplController(
    agent,
    grove,
    config,
    interactionMode,
    setInteractionMode,
    sessionRef,
  );

  useOnResize(() => {
    scrollback.onResize();
  });

  const exitApp = useCallback(() => {
    scrollback.destroy();
    renderer.destroy();
    process.exit(0);
  }, [renderer, scrollback]);

  useEffect(() => {
    if (!autoRun || !initialPrompt || oneShotRan.current) return;
    oneShotRan.current = true;
    void (async () => {
      await runOneShot(initialPrompt, planYoloOneShot ?? false);
      setTimeout(() => exitApp(), 300);
    })();
  }, [autoRun, initialPrompt, planYoloOneShot, runOneShot, exitApp, oneShotRan]);

  useKeyboard((key) => {
    if (pendingAsk) {
      if (key.name === 'escape') {
        pendingAsk.resolve('');
        setPendingAsk(null);
      }
      return;
    }

    const seq = key.sequence ?? '';
    const isShiftTab =
      seq === '\x1b[Z' || seq === '\x1b[9\t]' || (key.name === 'tab' && key.shift === true);

    if (isShiftTab && !processing) {
      const next = cycleMode(interactionMode);
      setInteractionMode(next);
      sessionRef.current = {
        ...sessionRef.current,
        interactionMode: next,
      };
      appendSystem(formatModeChange(next));
      return;
    }

    if (key.ctrl && key.name === 'c') {
      exitApp();
    }
  });

  const onSubmitLine = useCallback(
    async (line: string) => {
      const result = await handleLine(line);
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
      <StatusBar config={config} mode={interactionMode} />
      {!autoRun && (
        <InputBar
          mode={interactionMode}
          disabled={processing || Boolean(pendingAsk)}
          onSubmit={onSubmitLine}
        />
      )}
      {pendingAsk && <PromptModal pendingAsk={pendingAsk} onSubmit={onPromptSubmit} />}
    </box>
  );
}
