import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import { App } from './App.tsx';
import type { TuiStartOptions } from './types.ts';

/** Footer rows: status (3) + input (3) + padding (2) + margin */
export const TUI_FOOTER_HEIGHT = 10;

export async function startTui(options: TuiStartOptions): Promise<void> {
  const renderer = await createCliRenderer({
    screenMode: 'split-footer',
    footerHeight: TUI_FOOTER_HEIGHT,
    externalOutputMode: 'capture-stdout',
    consoleMode: 'disabled',
    exitOnCtrlC: false,
  });

  const root = createRoot(renderer);
  root.render(
    <App
      config={options.config}
      agent={options.agent}
      grove={options.grove}
      initialPrompt={options.initialPrompt}
      autoRun={options.autoRun}
      planYoloOneShot={options.planYoloOneShot}
    />,
  );
}
