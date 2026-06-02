import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

type AskFn = (prompt: string) => Promise<string>;

let sharedAsk: AskFn | null = null;

/** Bind the active REPL ask fn so nested prompts reuse it (avoids double echo). */
export function setSharedPromptAsk(ask: AskFn | null): void {
  sharedAsk = ask;
}

export async function askUser(prompt: string): Promise<string> {
  if (sharedAsk) {
    return sharedAsk(prompt);
  }

  const rl = createInterface({ input, output });
  try {
    return await rl.question(prompt);
  } finally {
    rl.close();
  }
}
