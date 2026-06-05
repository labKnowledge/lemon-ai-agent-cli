import {
  MarkdownRenderable,
  TextRenderable,
  type CliRenderer,
  type ScrollbackSurface,
} from '@opentui/core';
import {
  inferChunkFormat,
  nextChunkId,
  normalizeChunk,
  type TranscriptChunk,
} from '../../ui/bridge.ts';
import { chunkFg } from './chunk-colors.ts';
import { createMarkdownRenderable } from './markdown-factory.ts';
import {
  buildSessionHeaderText,
  sessionHeaderFg,
  type SessionHeaderContext,
} from './session-header.ts';
import type { TranscriptScrollController } from './scroll-controller.ts';

type ScrollbackChunk = Omit<TranscriptChunk, 'id'> & { id?: string };

export class TranscriptScrollback {
  private surface: ScrollbackSurface | null = null;
  private markdown: MarkdownRenderable | null = null;
  private lastCommittedBlockCount = 0;
  private streamContent = '';
  private streamFg = '#c0caf5';
  private resizeListener: ((width: number, height: number) => void) | null = null;
  private headerContext: SessionHeaderContext | null = null;
  private lastHeaderWidth = 0;
  private headerMounted = false;

  constructor(
    private readonly renderer: CliRenderer,
    private readonly scroll?: TranscriptScrollController,
  ) {
    this.resizeListener = () => {
      if (this.surface && !this.surface.isDestroyed) {
        this.surface.render();
      }
    };
    this.renderer.on('resize', this.resizeListener);
  }

  destroy(): void {
    if (this.resizeListener) {
      this.renderer.off('resize', this.resizeListener);
      this.resizeListener = null;
    }
    this.endStreamSurface();
    this.headerContext = null;
    this.headerMounted = false;
  }

  mountSessionHeader(ctx: SessionHeaderContext): void {
    this.headerContext = { ...ctx, width: ctx.width || this.renderer.terminalWidth };
    this.lastHeaderWidth = this.headerContext.width;
    this.writeSessionHeaderBlock();
    this.headerMounted = true;
  }

  repaintSessionHeader(ctx: SessionHeaderContext): void {
    this.headerContext = { ...ctx, width: ctx.width || this.renderer.terminalWidth };
    if (!this.headerMounted) {
      this.mountSessionHeader(this.headerContext);
      return;
    }
    if (this.lastHeaderWidth === this.headerContext.width) return;
    this.lastHeaderWidth = this.headerContext.width;
  }

  replay(headerCtx: SessionHeaderContext, chunks: TranscriptChunk[]): void {
    this.endStreamSurface();
    this.resetScrollbackSurface();
    this.headerMounted = false;
    this.mountSessionHeader(headerCtx);
    for (const chunk of chunks) {
      if (chunk.streaming) continue;
      this.appendChunk(chunk);
    }
  }

  onResize(headerCtx?: SessionHeaderContext, chunks?: TranscriptChunk[]): void {
    if (this.surface && !this.surface.isDestroyed) {
      this.surface.render();
    }

    if (!headerCtx) return;

    const width = headerCtx.width || this.renderer.terminalWidth;
    if (this.headerMounted && this.lastHeaderWidth === width) return;

    if (chunks && chunks.length > 0) {
      this.replay({ ...headerCtx, width }, chunks);
      return;
    }

    this.repaintSessionHeader({ ...headerCtx, width });
  }

  appendChunk(raw: ScrollbackChunk): void {
    const chunk = { ...normalizeChunk(raw), id: raw.id ?? nextChunkId() };
    if (chunk.streaming) return;

    this.endStreamSurface();

    const fg = chunkFg(chunk.type, chunk.fg);
    const format = inferChunkFormat(chunk.type, chunk.format);

    this.scroll?.preserveOffsetOnNextCommit();
    this.renderer.writeToScrollback((ctx) => {
      const root =
        format === 'markdown'
          ? createMarkdownRenderable(ctx.renderContext, {
              id: `scrollback-${chunk.id}`,
              content: chunk.text,
              fg,
              streaming: false,
              width: ctx.width,
            })
          : new TextRenderable(ctx.renderContext, {
              id: `scrollback-${chunk.id}`,
              content: chunk.text,
              fg,
              width: ctx.width,
            });

      return {
        root,
        width: ctx.width,
        startOnNewLine: true,
        trailingNewline: true,
      };
    });
    this.scroll?.onAfterCommit();
  }

  beginAssistantStream(chunkId: string, fg = '#c0caf5'): void {
    this.endStreamSurface();
    this.streamFg = fg;
    this.streamContent = '';
    this.lastCommittedBlockCount = 0;

    this.surface = this.renderer.createScrollbackSurface({ startOnNewLine: true });
    this.markdown = createMarkdownRenderable(this.surface.renderContext, {
      id: `stream-${chunkId}`,
      content: '',
      fg,
      streaming: true,
      width: '100%',
    });
    this.surface.root.add(this.markdown);
  }

  async appendAssistantDelta(text: string): Promise<void> {
    if (!text) return;

    if (!this.surface || !this.markdown) {
      this.beginAssistantStream(nextChunkId(), this.streamFg);
    }

    this.streamContent += text;
    const md = this.markdown!;
    md.content = this.streamContent;

    await this.renderAndCommitStable();
  }

  async finalizeAssistant(text: string): Promise<void> {
    const finalText = text || this.streamContent;
    if (!finalText) {
      this.endStreamSurface();
      return;
    }

    if (!this.surface || !this.markdown) {
      this.appendChunk({
        type: 'assistant',
        text: finalText,
        format: 'markdown',
        fg: this.streamFg,
      });
      return;
    }

    this.streamContent = finalText;
    this.markdown.content = finalText;
    this.markdown.streaming = false;

    await this.surface.settle();
    this.surface.render();

    if (this.surface.height > 0) {
      this.scroll?.preserveOffsetOnNextCommit();
      this.surface.commitRows(0, this.surface.height);
      this.scroll?.onAfterCommit();
    }

    this.endStreamSurface();
  }

  private writeSessionHeaderBlock(): void {
    if (!this.headerContext) return;

    const content = buildSessionHeaderText(this.headerContext);
    const fg = sessionHeaderFg();

    this.scroll?.preserveOffsetOnNextCommit();
    this.renderer.writeToScrollback((ctx) => {
      const root = new TextRenderable(ctx.renderContext, {
        id: `session-header-${Date.now()}`,
        content,
        fg,
        width: ctx.width,
      });

      return {
        root,
        width: ctx.width,
        startOnNewLine: false,
        trailingNewline: true,
      };
    });
    this.scroll?.onAfterCommit();
  }

  private resetScrollbackSurface(): void {
    const reset = (this.renderer as unknown as { resetSplitScrollback?(seedRows?: number): void })
      .resetSplitScrollback;
    reset?.call(this.renderer, 0);
  }

  private async renderAndCommitStable(): Promise<void> {
    const surface = this.surface;
    const md = this.markdown;
    if (!surface || !md) return;

    await surface.settle();
    surface.render();

    const stableBlocks = md._stableBlockCount;
    if (stableBlocks <= this.lastCommittedBlockCount) return;

    const rowEnd = this.stableRowEnd(md, stableBlocks);
    if (rowEnd > 0) {
      this.scroll?.preserveOffsetOnNextCommit();
      surface.commitRows(0, rowEnd);
      this.scroll?.onAfterCommit();
      this.lastCommittedBlockCount = stableBlocks;

      const tail = this.unstableMarkdownTail(md);
      md.content = tail;
      this.streamContent = tail;

      await surface.settle();
      surface.render();
    }
  }

  private stableRowEnd(md: MarkdownRenderable, stableBlockCount: number): number {
    if (stableBlockCount <= 0) return 0;
    const last = md._blockStates[stableBlockCount - 1];
    if (!last) return 0;
    const marginTop = last.marginTop ?? 0;
    return marginTop + last.renderable.y + last.renderable.height;
  }

  private unstableMarkdownTail(md: MarkdownRenderable): string {
    const state = md._parseState;
    if (!state?.tokens?.length) return md.content;
    const stable = state.stableTokenCount ?? 0;
    if (stable <= 0) return md.content;
    return state.tokens
      .slice(stable)
      .map((token) => token.raw)
      .join('');
  }

  private endStreamSurface(): void {
    if (this.surface && !this.surface.isDestroyed) {
      this.surface.destroy();
    }
    this.surface = null;
    this.markdown = null;
    this.lastCommittedBlockCount = 0;
    this.streamContent = '';
  }
}
