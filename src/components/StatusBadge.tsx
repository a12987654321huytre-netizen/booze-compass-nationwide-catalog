import type { StoreStatus } from '../types/store';

export function StatusBadge({ status }: { status: StoreStatus }) {
  if (status.state === 'unknown') return null;
  return (
    <p className={`status-badge status-badge--${status.state}`}>
      {status.label ?? (status.state === 'open' ? 'Open' : 'Closed')}
    </p>
  );
}
