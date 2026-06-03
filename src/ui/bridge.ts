export type TranscriptChunkType =
  | 'system'
  | 'user'
  | 'assistant'
  | 'tool'
  | 'plan'
  | 'shell'
  | 'wave'
  | 'agent';

export interface TranscriptChunk {
  id: string;
  type: TranscriptChunkType;
  text: string;
  fg?: string;
}

export interface AskOptions {
  placeholder?: string;
}

export interface UiBridge {
  append(chunk: Omit<TranscriptChunk, 'id'> & { id?: string }): void;
  appendToken(text: string): void;
  ask(prompt: string, options?: AskOptions): Promise<string>;
}

let activeBridge: UiBridge | null = null;

export function setUiBridge(bridge: UiBridge | null): void {
  activeBridge = bridge;
}

export function getUiBridge(): UiBridge | null {
  return activeBridge;
}

export function bridgeAppend(chunk: Omit<TranscriptChunk, 'id'> & { id?: string }): void {
  activeBridge?.append(chunk);
}

export function bridgeAppendToken(text: string): void {
  activeBridge?.appendToken(text);
}

export function bridgeAsk(prompt: string, options?: AskOptions): Promise<string> {
  if (!activeBridge) {
    throw new Error('UiBridge not initialized');
  }
  return activeBridge.ask(prompt, options);
}

let chunkCounter = 0;

export function nextChunkId(): string {
  chunkCounter += 1;
  return `chunk-${chunkCounter}`;
}
