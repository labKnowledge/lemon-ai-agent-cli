import { MarkdownRenderable, type MarkdownOptions, type RenderContext } from '@opentui/core';
import { LEMON_SYNTAX } from '../theme/syntax.ts';
import { LEMON_TREE_SITTER } from '../theme/tree-sitter.ts';

export function createMarkdownRenderable(
  ctx: RenderContext,
  options: {
    id: string;
    content: string;
    fg?: string;
    streaming?: boolean;
    width?: number | 'auto' | `${number}%`;
  },
): MarkdownRenderable {
  const mdOptions: MarkdownOptions = {
    id: options.id,
    content: options.content,
    syntaxStyle: LEMON_SYNTAX,
    treeSitterClient: LEMON_TREE_SITTER,
    internalBlockMode: 'top-level',
    streaming: options.streaming ?? false,
    conceal: true,
    concealCode: false,
    fg: options.fg ?? '#c0caf5',
    width: options.width ?? ('100%' as const),
  };
  return new MarkdownRenderable(ctx, mdOptions);
}
