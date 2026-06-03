import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useKeyboard, useRenderer } from '@opentui/react';
import type { TranscriptChunk } from '../ui/bridge.ts';
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
import { Transcript } from './components/Transcript.tsx';
import { StatusBar } from './components/StatusBar.tsx';
import { InputBar } from './components/InputBar.tsx';
import { PromptModal } from './components/PromptModal.tsx';
import { useReplController } from './hooks/useReplController.ts';

export function App({
  config,
  agent,
  grove,
  initialPrompt,
  autoRun,
  planYoloOneShot,
}: TuiStartOptions) {
  const renderer = useRenderer();
  const sessionRef = useRef<SessionData | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [chunks, setChunks] = useState<TranscriptChunk[]>([]);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('direct');
  const [pendingAsk, setPendingAsk] = useState<UiBridgeContextValue['pendingAsk']>(null);
  const [processing, setProcessing] = useState(false);
  const oneShotRan = useRef(false);

  useEffect(() => {
    void loadSession(config.sessionId).then((session) => {
      sessionRef.current = session;
      setInteractionMode(getInteractionMode(session));
      setSessionLoaded(true);
      setChunks([
        createChunk({
          type: 'system',
          text: `Mode: ${getInteractionMode(session)} | Shift+Tab cycle | /p /py /pv /d | /scan | ! shell | /exit`,
          fg: '#565f89',
        }),
      ]);
    });
  }, [config.sessionId]);

  const append = useCallback((chunk: Omit<TranscriptChunk, 'id'> & { id?: string }) => {
    setChunks((prev) => [...prev, createChunk(chunk)]);
  }, []);

  const appendToken = useCallback((text: string) => {
    setChunks((prev) => {
      const last = prev[prev.length - 1];
      if (last?.type === 'assistant') {
        return [...prev.slice(0, -1), { ...last, text: last.text + text }];
      }
      return [...prev, createChunk({ type: 'assistant', text, fg: '#c0caf5' })];
    });
  }, []);

  const bridgeValue = useMemo<UiBridgeContextValue>(
    () => ({
      chunks,
      append,
      appendToken,
      pendingAsk,
      setPendingAsk,
      processing,
      setProcessing,
    }),
    [chunks, append, appendToken, pendingAsk, processing],
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
        chunks={chunks}
        interactionMode={interactionMode}
        setInteractionMode={setInteractionMode}
        pendingAsk={pendingAsk}
        setPendingAsk={setPendingAsk}
        processing={processing}
        renderer={renderer}
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
  chunks,
  interactionMode,
  setInteractionMode,
  pendingAsk,
  setPendingAsk,
  processing,
  renderer,
  initialPrompt,
  autoRun,
  planYoloOneShot,
  oneShotRan,
}: {
  config: TuiStartOptions['config'];
  agent: TuiStartOptions['agent'];
  grove: TuiStartOptions['grove'];
  sessionRef: MutableRefObject<SessionData>;
  chunks: TranscriptChunk[];
  interactionMode: InteractionMode;
  setInteractionMode: (m: InteractionMode) => void;
  pendingAsk: UiBridgeContextValue['pendingAsk'];
  setPendingAsk: UiBridgeContextValue['setPendingAsk'];
  processing: boolean;
  renderer: ReturnType<typeof useRenderer>;
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

  const exitApp = useCallback(() => {
    renderer.destroy();
    process.exit(0);
  }, [renderer]);

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
      }}
    >
      <StatusBar config={config} mode={interactionMode} />
      <scrollbox
        style={{
          flexGrow: 1,
          marginTop: 1,
          marginBottom: 1,
          rootOptions: { backgroundColor: '#1a1b26' },
          viewportOptions: { backgroundColor: '#16161e' },
        }}
        focused={!pendingAsk}
      >
        <Transcript chunks={chunks} />
      </scrollbox>
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
