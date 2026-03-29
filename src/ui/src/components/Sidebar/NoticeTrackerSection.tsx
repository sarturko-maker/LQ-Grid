import type { NoticeTracker, ConsentStatus } from '@/types';
import { consentStatusLabel, consentStatusColor } from '@/lib/counterpartyUtils';
import { downloadFile } from '@/lib/actions';
import { Download } from 'lucide-react';

interface NoticeTrackerProps {
  notice: NoticeTracker;
  onUpdate: (partial: Partial<NoticeTracker>) => void;
}

const STATUSES: ConsentStatus[] = [
  'not_started', 'letter_generated', 'sent',
  'awaiting_response', 'consent_received', 'consent_refused', 'conditional',
];

export function NoticeTrackerSection({ notice, onUpdate }: NoticeTrackerProps) {
  const currentIdx = STATUSES.indexOf(notice.status);

  return (
    <div>
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
        Notice Tracking
      </p>

      {/* Status workflow dots */}
      <div className="flex items-center gap-1 mb-4">
        {STATUSES.map((s, i) => (
          <button key={s} onClick={() => onUpdate({ status: s })}
            title={consentStatusLabel(s)}
            className={`flex-1 h-2 rounded-full transition-colors cursor-pointer
              ${i <= currentIdx ? statusBarColor(notice.status) : 'bg-slate-200'}
              hover:opacity-80`} />
        ))}
      </div>

      {/* Current status label */}
      <div className="mb-3">
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full
          ${consentStatusColor(notice.status)}`}>
          {consentStatusLabel(notice.status)}
        </span>
      </div>

      {/* Status selector */}
      <div className="space-y-2">
        <Field label="Status">
          <select value={notice.status}
            onChange={(e) => onUpdate({ status: e.target.value as ConsentStatus })}
            className="input-sm">
            {STATUSES.map((s) => (
              <option key={s} value={s}>{consentStatusLabel(s)}</option>
            ))}
          </select>
        </Field>

        {(notice.status === 'sent' || notice.status === 'awaiting_response' ||
          notice.status === 'consent_received' || notice.status === 'consent_refused' ||
          notice.status === 'conditional') && (
          <>
            <Field label="Sent">
              <input type="date" value={notice.sentDate || ''}
                onChange={(e) => onUpdate({ sentDate: e.target.value || null })}
                className="input-sm" />
            </Field>
            <Field label="Method">
              <select value={notice.method || ''}
                onChange={(e) => onUpdate({ method: (e.target.value || null) as NoticeTracker['method'] })}
                className="input-sm">
                <option value="">Select...</option>
                <option value="email">Email</option>
                <option value="courier">Courier</option>
                <option value="hand">Hand Delivery</option>
              </select>
            </Field>
          </>
        )}

        {(notice.status === 'consent_received' || notice.status === 'consent_refused' ||
          notice.status === 'conditional') && (
          <Field label="Response">
            <input type="date" value={notice.responseDate || ''}
              onChange={(e) => onUpdate({ responseDate: e.target.value || null })}
              className="input-sm" />
          </Field>
        )}

        {notice.status === 'conditional' && (
          <Field label="Conditions">
            <textarea value={notice.conditions || ''} rows={2}
              onChange={(e) => onUpdate({ conditions: e.target.value || null })}
              placeholder="Conditions attached to consent..."
              className="input-sm resize-none" />
          </Field>
        )}

        {notice.letterFile && (
          <button onClick={() => downloadFile('letters', notice.letterFile!)}
            className="flex items-center gap-2 text-xs text-indigo-600 hover:underline mt-1">
            <Download className="w-3 h-3" /> {notice.letterFile}
          </button>
        )}
      </div>
    </div>
  );
}

function statusBarColor(status: ConsentStatus): string {
  if (status === 'consent_received') return 'bg-emerald-400';
  if (status === 'consent_refused') return 'bg-red-400';
  if (status === 'conditional') return 'bg-orange-400';
  return 'bg-indigo-400';
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-[11px] text-slate-500 w-16 shrink-0 pt-1.5">{label}</span>
      <div className="flex-1 [&_.input-sm]:w-full [&_.input-sm]:text-xs [&_.input-sm]:px-2.5
                       [&_.input-sm]:py-1.5 [&_.input-sm]:border [&_.input-sm]:border-slate-200
                       [&_.input-sm]:rounded-lg [&_.input-sm]:focus:ring-1
                       [&_.input-sm]:focus:ring-indigo-300 [&_.input-sm]:focus:outline-none">
        {children}
      </div>
    </div>
  );
}
