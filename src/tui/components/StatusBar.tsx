import type { ActivityState } from '../../ui/bridge.ts';
import { ActivityIndicator } from './ActivityIndicator.tsx';

export function StatusBar({
  processing,
  activity,
  pendingAsk,
}: {
  processing: boolean;
  activity: ActivityState | null;
  pendingAsk: boolean;
}) {
  if (!processing && !activity && !pendingAsk) return null;

  return (
    <box
      style={{
        width: '100%',
        paddingLeft: 1,
        marginBottom: 1,
        flexDirection: 'column',
      }}
    >
      <ActivityIndicator activity={activity} pendingAsk={pendingAsk} />
    </box>
  );
}
