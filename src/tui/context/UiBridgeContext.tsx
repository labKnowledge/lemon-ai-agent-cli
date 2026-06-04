import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import type { ActivityState, TranscriptChunk, UiBridge } from '../../ui/bridge.ts';
import { nextChunkId, setUiBridge } from '../../ui/bridge.ts';
import type { PendingAsk } from '../types.ts';

export interface UiBridgeContextValue {
  chunks: TranscriptChunk[];
  append: (chunk: Omit<TranscriptChunk, 'id'> & { id?: string }) => void;
  appendToken: (text: string) => void;
  finalizeAssistant: (text: string) => void;
  pendingAsk: PendingAsk | null;
  setPendingAsk: (ask: PendingAsk | null) => void;
  processing: boolean;
  setProcessing: (v: boolean) => void;
  activity: ActivityState | null;
  setActivity: (state: ActivityState | null) => void;
}

const UiBridgeCtx = createContext<UiBridgeContextValue | null>(null);

export function useUiBridgeContext(): UiBridgeContextValue {
  const ctx = useContext(UiBridgeCtx);
  if (!ctx) throw new Error('UiBridgeContext not available');
  return ctx;
}

export function UiBridgeProvider({
  value,
  children,
}: {
  value: UiBridgeContextValue;
  children: ReactNode;
}) {
  const bridge = useMemo<UiBridge>(
    () => ({
      append(chunk) {
        value.append(chunk);
      },
      appendToken(text) {
        value.appendToken(text);
      },
      finalizeAssistant(text) {
        value.finalizeAssistant(text);
      },
      ask(prompt, options) {
        return new Promise<string>((resolve) => {
          value.setPendingAsk({
            prompt,
            placeholder: options?.placeholder,
            resolve,
          });
        });
      },
      setActivity(state) {
        value.setActivity(state);
      },
    }),
    [
      value.append,
      value.appendToken,
      value.finalizeAssistant,
      value.setPendingAsk,
      value.setActivity,
    ],
  );

  useEffect(() => {
    setUiBridge(bridge);
    return () => setUiBridge(null);
  }, [bridge]);

  return <UiBridgeCtx.Provider value={value}>{children}</UiBridgeCtx.Provider>;
}

export function createChunk(chunk: Omit<TranscriptChunk, 'id'> & { id?: string }): TranscriptChunk {
  return { ...chunk, id: chunk.id ?? nextChunkId() };
}
