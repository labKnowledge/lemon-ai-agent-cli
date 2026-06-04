import { useEffect, useState } from 'react';

const TICK_MS = 100;

export function useActivityTicker(active: boolean): number {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setFrameIndex(0);
      return;
    }

    const id = setInterval(() => {
      setFrameIndex((i) => i + 1);
    }, TICK_MS);

    return () => clearInterval(id);
  }, [active]);

  return frameIndex;
}
