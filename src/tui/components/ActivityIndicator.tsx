import { useEffect, useState } from 'react';
import type { ActivityState } from '../../ui/bridge.ts';
import { activityUsesSecondLine } from '../../ui/activity.ts';
import { frameForPhase, tickBar } from '../activity/frames.ts';
import { useActivityTicker } from '../hooks/useActivityTicker.ts';
import { LEMON_TOKENS } from '../theme/tokens.ts';

function formatElapsed(startedAt: number, now: number): string {
  const secs = Math.floor((now - startedAt) / 1000);
  if (secs < 3) return '';
  return ` · ${secs}s`;
}

export function ActivityIndicator({
  activity,
  pendingAsk,
}: {
  activity: ActivityState | null;
  pendingAsk: boolean;
}) {
  const active = activity !== null && !pendingAsk;
  const frameIndex = useActivityTicker(active);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (!active || !activity) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active, activity]);

  if (pendingAsk) {
    return (
      <box style={{ width: '100%', flexDirection: 'column' }}>
        <text
          content="Waiting for your response (Esc to cancel)"
          style={{ fg: LEMON_TOKENS.muted }}
        />
      </box>
    );
  }

  if (!activity) return null;

  const spinner = frameForPhase(activity.phase, frameIndex);
  const elapsed = formatElapsed(activity.startedAt, now);
  const line1 = `${spinner}  ${activity.label}${elapsed}`;
  const showBar = activityUsesSecondLine(activity.phase);

  return (
    <box style={{ width: '100%', flexDirection: 'column' }}>
      <text content={line1} style={{ fg: LEMON_TOKENS.brand }} />
      {showBar && (
        <text
          content={
            activity.detail ? `${tickBar(frameIndex)}  ${activity.detail}` : tickBar(frameIndex)
          }
          style={{ fg: LEMON_TOKENS.muted }}
        />
      )}
    </box>
  );
}
