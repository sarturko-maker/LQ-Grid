import { useState } from 'react';
import { X, Users, Search, Building2 } from 'lucide-react';
import type { ConsentStatus } from '@/types';
import type { CounterpartySummary } from '@/lib/counterpartyUtils';
import { consentStatusLabel, consentStatusColor } from '@/lib/counterpartyUtils';

interface Props {
  parties: CounterpartySummary[];
  getConsentStatus: (name: string) => ConsentStatus;
  onSelect: (name: string) => void;
  onClose: () => void;
}

export function CounterpartyList({ parties, getConsentStatus, onSelect, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterAction, setFilterAction] = useState<string>('');

  const filtered = parties.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus) {
      const status = getConsentStatus(p.name);
      if (status !== filterStatus) return false;
    }
    if (filterAction && !p.actions.includes(filterAction)) return false;
    return true;
  });

  const needConsent = parties.filter((p) => p.actions.includes('obtain_consent')).length;

  return (
    <div className="h-full flex flex-col bg-white animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-50 rounded-lg">
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Counterparties</h3>
            <p className="text-[10px] text-slate-400">
              {parties.length} parties — {needConsent} need consent
            </p>
          </div>
        </div>
        <button onClick={onClose}
          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search + filters */}
      <div className="px-4 py-3 border-b border-slate-100 space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search counterparties..."
            className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 rounded-lg
                       focus:ring-1 focus:ring-indigo-300 focus:outline-none" />
        </div>
        <div className="flex gap-2">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="flex-1 text-[11px] px-2 py-1.5 border border-slate-200 rounded-lg">
            <option value="">All statuses</option>
            <option value="not_started">Not Started</option>
            <option value="sent">Sent</option>
            <option value="consent_received">Received</option>
            <option value="consent_refused">Refused</option>
          </select>
          <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)}
            className="flex-1 text-[11px] px-2 py-1.5 border border-slate-200 rounded-lg">
            <option value="">All actions</option>
            <option value="obtain_consent">Obtain consent</option>
            <option value="send_notification">Send notification</option>
            <option value="no_action">No action</option>
          </select>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {filtered.map((p) => {
          const status = getConsentStatus(p.name);
          return (
            <button key={p.name} onClick={() => onSelect(p.name)}
              className="w-full flex items-start gap-3 p-3 rounded-xl border border-slate-200
                         hover:bg-slate-50 hover:border-indigo-200 transition-all text-left">
              <Building2 className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">{p.name}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {p.rowIds.length} agreement{p.rowIds.length !== 1 ? 's' : ''}
                  {p.contractTypes.length > 0 && ` — ${p.contractTypes.join(', ')}`}
                </p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                    ${consentStatusColor(status)}`}>
                    {consentStatusLabel(status)}
                  </span>
                  {p.hasAssignment && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      Assignment
                    </span>
                  )}
                  {p.hasCoc && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
                      CoC
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-8">No matching counterparties</p>
        )}
      </div>
    </div>
  );
}
