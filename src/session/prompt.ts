import { getUiBridge } from '../ui/bridge.js';

export async function askUser(prompt: string): Promise<string> {
  const bridge = getUiBridge();
  if (bridge) {
    return bridge.ask(prompt);
  }
  throw new Error('UiBridge not initialized — cannot prompt user');
}
