import type { CliRenderer } from '@opentui/core';
import type { ScrollInfo } from '@opentui/core';

interface ScrollbackInternals {
  renderOffset: number;
  footerHeight: number;
  terminalHeight: number;
  _splitHeight: number;
  syncSplitScrollback(): void;
  getSplitPinnedRenderOffset(): number;
  processSingleMouseEvent(mouseEvent: TranscriptMouseEvent): boolean;
  lib: {
    repaintSplitFooter(rendererPtr: unknown, pinnedRenderOffset: number, force: boolean): number;
  };
  rendererPtr: unknown;
}

interface TranscriptMouseEvent {
  type: string;
  y: number;
  scroll?: ScrollInfo;
}

function internals(renderer: CliRenderer): ScrollbackInternals {
  return renderer as unknown as ScrollbackInternals;
}

export class TranscriptScrollController {
  private followTail = true;
  private userOffset = 0;
  private installed = false;

  private originalGetSplitPinnedRenderOffset: (() => number) | null = null;
  private originalProcessSingleMouseEvent:
    | ((mouseEvent: TranscriptMouseEvent) => boolean)
    | null = null;
  private onFrame: (() => void) | null = null;

  constructor(private readonly renderer: CliRenderer) {}

  install(): void {
    if (this.installed) return;

    const r = internals(this.renderer);
    this.userOffset = r.renderOffset;

    this.originalGetSplitPinnedRenderOffset = r.getSplitPinnedRenderOffset.bind(this.renderer);
    r.getSplitPinnedRenderOffset = () => {
      if (this.followTail) {
        return this.originalGetSplitPinnedRenderOffset!();
      }
      return this.userOffset;
    };

    this.originalProcessSingleMouseEvent = r.processSingleMouseEvent.bind(this.renderer);
    r.processSingleMouseEvent = (mouseEvent) => {
      if (
        r._splitHeight > 0 &&
        mouseEvent.type === 'scroll' &&
        mouseEvent.y < r.renderOffset
      ) {
        this.handleWheel(mouseEvent.scroll);
        return true;
      }
      return this.originalProcessSingleMouseEvent!(mouseEvent);
    };

    this.onFrame = () => {
      if (this.followTail) return;
      const current = internals(this.renderer).renderOffset;
      if (current === this.userOffset) return;
      const ri = internals(this.renderer);
      ri.renderOffset = ri.lib.repaintSplitFooter(ri.rendererPtr, this.userOffset, false);
    };
    this.renderer.on('frame', this.onFrame);

    this.installed = true;
  }

  destroy(): void {
    if (!this.installed) return;

    const r = internals(this.renderer);
    if (this.originalGetSplitPinnedRenderOffset) {
      r.getSplitPinnedRenderOffset = this.originalGetSplitPinnedRenderOffset;
    }
    if (this.originalProcessSingleMouseEvent) {
      r.processSingleMouseEvent = this.originalProcessSingleMouseEvent;
    }
    if (this.onFrame) {
      this.renderer.off('frame', this.onFrame);
    }

    this.originalGetSplitPinnedRenderOffset = null;
    this.originalProcessSingleMouseEvent = null;
    this.onFrame = null;
    this.installed = false;
  }

  isFollowTail(): boolean {
    return this.followTail;
  }

  getUserOffset(): number {
    return this.userOffset;
  }

  handleWheel(scroll: ScrollInfo | undefined): void {
    if (!scroll) return;
    const lines = Math.max(1, Math.round(scroll.delta));
    if (scroll.direction === 'up') {
      this.scrollByLines(-lines);
    } else if (scroll.direction === 'down') {
      this.scrollByLines(lines);
    }
  }

  private bottomPinnedOffset(): number {
    if (this.originalGetSplitPinnedRenderOffset) {
      return this.originalGetSplitPinnedRenderOffset();
    }
    return internals(this.renderer).getSplitPinnedRenderOffset();
  }

  private viewportLines(): number {
    const r = internals(this.renderer);
    return Math.max(1, r.terminalHeight - r.footerHeight);
  }

  private clampOffset(offset: number): number {
    return Math.max(0, Math.min(offset, this.bottomPinnedOffset()));
  }

  private applyOffset(offset: number): void {
    const clamped = this.clampOffset(offset);
    this.userOffset = clamped;
    const r = internals(this.renderer);
    r.renderOffset = r.lib.repaintSplitFooter(r.rendererPtr, clamped, true);
    this.renderer.requestRender();
  }

  scrollByLines(n: number): void {
    if (n === 0) return;
    this.followTail = false;
    const base = internals(this.renderer).renderOffset;
    this.applyOffset(base + n);
  }

  scrollByPage(n: number): void {
    this.scrollByLines(n * this.viewportLines());
  }

  jumpToBottom(): void {
    this.followTail = true;
    internals(this.renderer).syncSplitScrollback();
    this.userOffset = internals(this.renderer).renderOffset;
    this.renderer.requestRender();
  }

  jumpToTop(): void {
    this.followTail = false;
    this.applyOffset(0);
  }
}
