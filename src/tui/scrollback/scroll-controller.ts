import type { CliRenderer } from '@opentui/core';

interface ScrollbackInternals {
  renderOffset: number;
  footerHeight: number;
  terminalHeight: number;
  syncSplitScrollback(): void;
  getSplitPinnedRenderOffset(): number;
  lib: {
    repaintSplitFooter(rendererPtr: unknown, pinnedRenderOffset: number, force: boolean): number;
  };
  rendererPtr: unknown;
}

function internals(renderer: CliRenderer): ScrollbackInternals {
  return renderer as unknown as ScrollbackInternals;
}

export class TranscriptScrollController {
  private followTail = true;
  private savedOffset: number | null = null;

  constructor(private readonly renderer: CliRenderer) {}

  isFollowTail(): boolean {
    return this.followTail;
  }

  setFollowTail(value: boolean): void {
    this.followTail = value;
    if (value) {
      this.savedOffset = null;
    }
  }

  private pinnedOffset(): number {
    return internals(this.renderer).getSplitPinnedRenderOffset();
  }

  private viewportLines(): number {
    const r = internals(this.renderer);
    return Math.max(1, r.terminalHeight - r.footerHeight);
  }

  private clampOffset(offset: number): number {
    return Math.max(0, Math.min(offset, this.pinnedOffset()));
  }

  private applyOffset(offset: number): void {
    const r = internals(this.renderer);
    const clamped = this.clampOffset(offset);
    r.renderOffset = r.lib.repaintSplitFooter(r.rendererPtr, clamped, true);
    this.renderer.requestRender();
  }

  scrollByLines(n: number): void {
    if (n === 0) return;
    this.followTail = false;
    this.applyOffset(internals(this.renderer).renderOffset - n);
  }

  scrollByPage(n: number): void {
    this.scrollByLines(n * this.viewportLines());
  }

  jumpToBottom(): void {
    this.followTail = true;
    this.savedOffset = null;
    internals(this.renderer).syncSplitScrollback();
    this.renderer.requestRender();
  }

  jumpToTop(): void {
    this.followTail = false;
    this.applyOffset(0);
  }

  preserveOffsetOnNextCommit(): void {
    if (this.followTail) {
      this.savedOffset = null;
      return;
    }
    this.savedOffset = internals(this.renderer).renderOffset;
  }

  onAfterCommit(): void {
    if (this.followTail) {
      internals(this.renderer).syncSplitScrollback();
      this.renderer.requestRender();
      return;
    }
    if (this.savedOffset !== null) {
      this.applyOffset(this.savedOffset);
      this.savedOffset = null;
    }
  }
}
