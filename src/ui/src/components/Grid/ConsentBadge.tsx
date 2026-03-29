import type { ConsentStatus } from '@/types';

const DOT_COLORS: Record<ConsentStatus, string> = {
  not_started: 'bg-slate-300',
  letter_generated: 'bg-blue-400',
  sent: 'bg-amber-400',
  awaiting_response: 'bg-amber-400 animate-pulse',
  consent_received: 'bg-emerald-500',
  consent_refused: 'bg-red-500',
  conditional: 'bg-orange-400',
};

export function ConsentBadge({ status }: { status: ConsentStatus }) {
  if (status === 'not_started') return null;
  return (
    <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${DOT_COLORS[status]}`}
      title={status.replace(/_/g, ' ')} />
  );
}
