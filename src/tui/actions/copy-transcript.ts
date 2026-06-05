import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { CliRenderer } from '@opentui/core';
import type { TranscriptChunk } from '../../ui/bridge.ts';
import { formatTranscriptForCopy } from '../scrollback/transcript-export.ts';

export interface CopyTranscriptResult {
  method: 'clipboard' | 'file';
  path?: string;
  charCount: number;
}

export async function copyTranscript(
  renderer: CliRenderer,
  chunks: TranscriptChunk[],
  sessionId: string,
  selectionText?: string | null,
): Promise<CopyTranscriptResult> {
  const text = selectionText?.trim() || formatTranscriptForCopy(chunks);
  if (!text) {
    return { method: 'clipboard', charCount: 0 };
  }

  if (renderer.copyToClipboardOSC52(text)) {
    return { method: 'clipboard', charCount: text.length };
  }

  const dir = join(homedir(), '.lemon-cli');
  await mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const path = join(dir, `transcript-${sessionId}-${stamp}.txt`);
  await writeFile(path, text, 'utf-8');
  return { method: 'file', path, charCount: text.length };
}

export function formatCopyMessage(result: CopyTranscriptResult): string {
  if (result.charCount === 0) return 'Nothing to copy.';
  if (result.method === 'clipboard') {
    return `Copied ${result.charCount} characters to clipboard.`;
  }
  return `Clipboard unavailable. Wrote ${result.charCount} characters to ${result.path}`;
}
