/** Shared abort signal for in-flight agent runs (Ctrl+C). */
let currentController: AbortController | null = null;

export function startRun(): AbortSignal {
  currentController?.abort();
  currentController = new AbortController();
  return currentController.signal;
}

export function endRun(): void {
  currentController = null;
}

export function abortCurrentRun(): boolean {
  if (!currentController) return false;
  currentController.abort();
  return true;
}

export function isAborted(signal?: AbortSignal): boolean {
  return signal?.aborted ?? false;
}
