import { X, Building2, FileText, AlertTriangle, Shield } from 'lucide-react';
import type { Manifest, CounterpartyProfile as Profile, ConsentStrategy, NoticeTracker } from '@/types';
import type { CounterpartySummary } from '@/lib/counterpartyUtils';
import { consentStatusColor, consentStatusLabel } from '@/lib/counterpartyUtils';
import { ProfileFields } from './ProfileFields';
import { NoticeTrackerSection } from './NoticeTrackerSection';

interface Props {
  name: string;
  manifest: Manifest;
  summary: CounterpartySummary | undefined;
  profile: Profile;
  onUpdate: (partial: Partial<Profile>) => void;
  onUpdateStrategy: (partial: Partial<ConsentStrategy>) => void;
  onUpdateNotice: (partial: Partial<NoticeTracker>) => void;
  onDocClick: (rowId: string) => void;
  onClose: () => void;
}

export function CounterpartyProfile({
  name, manifest, summary, profile,
  onUpdate, onUpdateStrategy, onUpdateNotice,
  onDocClick, onClose,
}: Props) {
  const rows = summary?.rowIds.map((id) => manifest.rows.find((r) => r._id === id)).filter(Boolean) || [];

  return (
    <div className="h-full flex flex-col bg-white animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 bg-indigo-50 rounded-lg shrink-0">
            <Building2 className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-800 truncate">{name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-slate-400">{rows.length} agreement{rows.length !== 1 ? 's' : ''}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                ${consentStatusColor(profile.notice.status)}`}>
                {consentStatusLabel(profile.notice.status)}
              </span>
            </div>
          </div>
        </div>
        <button onClick={onClose}
          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Risk summary */}
        {summary && <RiskSummary summary={summary} />}

        {/* Agreements list */}
        <div>
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Agreements
          </p>
          <div className="space-y-1">
            {rows.map((row) => row && (
              <button key={row._id} onClick={() => onDocClick(row._id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg
                           hover:bg-slate-50 transition-colors text-left">
                <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="flex-1 truncate text-slate-700">{row._document}</span>
                <span className="text-[10px] text-slate-400 shrink-0">
                  {row.cells.contract_type?.display || ''}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Editable profile fields + strategy */}
        <ProfileFields profile={profile}
          onUpdate={onUpdate} onUpdateStrategy={onUpdateStrategy} />

        {/* Notice tracker */}
        <NoticeTrackerSection notice={profile.notice} onUpdate={onUpdateNotice} />
      </div>
    </div>
  );
}

function RiskSummary({ summary }: { summary: CounterpartySummary }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3 space-y-2">
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
        Risk Summary
      </p>
      <div className="flex flex-wrap gap-1.5">
        {summary.hasAssignment && (
          <Badge icon={AlertTriangle} label="Assignment restricted" cls="bg-amber-100 text-amber-700" />
        )}
        {summary.hasCoc && (
          <Badge icon={Shield} label="CoC clause" cls="bg-red-100 text-red-700" />
        )}
        {summary.mechanisms.map((m) => (
          <Badge key={m} label={m.replace(/_/g, ' ')}
            cls={m === 'termination_right' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'} />
        ))}
        {summary.actions.map((a) => (
          <Badge key={a} label={a.replace(/_/g, ' ')}
            cls={a === 'obtain_consent' ? 'bg-amber-100 text-amber-700'
              : a === 'flag_for_review' ? 'bg-red-100 text-red-700'
              : 'bg-emerald-100 text-emerald-700'} />
        ))}
        {!summary.hasAssignment && !summary.hasCoc && summary.mechanisms.length === 0 && (
          <Badge label="No restrictions" cls="bg-emerald-100 text-emerald-700" />
        )}
      </div>
    </div>
  );
}

function Badge({ icon: Icon, label, cls }: {
  icon?: typeof AlertTriangle; label: string; cls: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      {Icon && <Icon className="w-3 h-3" />} {label}
    </span>
  );
}
