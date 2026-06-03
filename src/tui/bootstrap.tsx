import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import { App } from './App.tsx';
import type { TuiStartOptions } from './types.ts';

export async function startTui(options: TuiStartOptions): Promise<void> {
  const renderer = await createCliRenderer({
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
