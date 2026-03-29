import { useState } from 'react';
import {
  X, FolderOpen, Plus, Users, Link2, Loader2, Check,
} from 'lucide-react';
import type { Manifest, DocumentGroup } from '@/types';
import { GroupCard, CreateGroupForm } from './GroupCard';
import { pollResponse } from '@/lib/actions';
import { parseGroupsFromResponse } from '@/lib/parseGroups';

const RELAY = 'http://localhost:3002';

interface GroupPanelProps {
  manifest: Manifest;
  groups: DocumentGroup[];
  onAdd: (name: string, documents: string[]) => string;
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
  onAddDoc: (groupId: string, docId: string) => void;
  onRemoveDoc: (groupId: string, docId: string) => void;
  onRequestExtraction: (groupId: string, name: string, docIds: string[]) => void;
  onClose: () => void;
}

export function GroupPanel({
  manifest, groups, onAdd, onRemove, onToggle,
  onAddDoc, onRemoveDoc, onRequestExtraction, onClose,
}: GroupPanelProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [relState, setRelState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [partyState, setPartyState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  const grouped = new Set(groups.flatMap((g) => g.documents));
  const ungrouped = manifest.rows.filter((r) => !grouped.has(r._id));

  const handleCreate = () => {
    if (!newName.trim() || selected.size === 0) return;
    const docs = Array.from(selected);
    const id = onAdd(newName.trim(), docs);
    onRequestExtraction(id, newName.trim(), docs);
    setNewName('');
    setSelected(new Set());
    setCreating(false);
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const handleAutoGroup = async (mode: 'relationship' | 'party') => {
    const setState = mode === 'relationship' ? setRelState : setPartyState;
    setState('loading');
    try {
      const reqId = `grp_${Date.now()}`;
      const prompt = mode === 'relationship'
        ? `Read data/output/ui-manifest.json and contract texts in data/output/texts/.\n` +
          `Identify related documents — master agreements with their addendums, amendments, ` +
          `side letters, participation agreements, schedules, or any subordinate documents.\n` +
          `Return ONLY a raw JSON array (no markdown, no code fences):\n` +
          `[{ "name": "Group Name", "documents": ["row_id", ...] }]`
        : `Read data/output/ui-manifest.json.\n` +
          `Group documents sharing the same counterparty or related corporate entities.\n` +
          `Return ONLY a raw JSON array (no markdown, no code fences):\n` +
          `[{ "name": "Party Name", "documents": ["row_id", ...] }]`;

      await fetch(`${RELAY}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reqId, type: 'action', payload: { actionId: `auto-group-${mode}` }, prompt }),
      });

      const result = await pollResponse(reqId, 180000);
      if (result.status === 'done' && result.data) {
        const parsed = parseGroupsFromResponse(result.data);
        for (const g of parsed) {
          if (g.name && g.documents?.length > 0) {
            const id = onAdd(g.name, g.documents);
            onRequestExtraction(id, g.name, g.documents);
          }
        }
        setState(parsed.length > 0 ? 'done' : 'error');
      } else {
        setState('error');
      }
    } catch {
      setState('error');
    }
    setTimeout(() => setState('idle'), 3000);
  };

  return (
    <div className="h-full flex flex-col bg-white animate-in slide-in-from-right duration-300">
      <PanelHeader onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Auto-detect
          </p>
          <div className="grid grid-cols-2 gap-2">
            <AutoBtn icon={Link2} label="By Relationship" sub="MSA + addendums"
              state={relState} onClick={() => handleAutoGroup('relationship')} />
            <AutoBtn icon={Users} label="By Party" sub="Same counterparty"
              state={partyState} onClick={() => handleAutoGroup('party')} />
          </div>
        </div>

        {groups.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Groups ({groups.length})
            </p>
            {groups.map((g) => (
              <GroupCard key={g.id} group={g} manifest={manifest} ungrouped={ungrouped}
                onToggle={() => onToggle(g.id)} onRemove={() => onRemove(g.id)}
                onAddDoc={(did) => onAddDoc(g.id, did)}
                onRemoveDoc={(did) => onRemoveDoc(g.id, did)} />
            ))}
          </div>
        )}

        {creating ? (
          <CreateGroupForm
            name={newName} selected={selected} rows={ungrouped}
            onNameChange={setNewName} onToggle={toggleSelect}
            onCreate={handleCreate} onCancel={() => setCreating(false)}
          />
        ) : (
          <button onClick={() => setCreating(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-xs
                       font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200
                       rounded-lg hover:bg-indigo-100 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Manual Group
          </button>
        )}
      </div>
    </div>
  );
}

function PanelHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-indigo-50 rounded-lg">
          <FolderOpen className="w-4 h-4 text-indigo-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Document Groups</h3>
          <p className="text-[11px] text-slate-400">Combine related contracts for joint analysis</p>
        </div>
      </div>
      <button onClick={onClose}
        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function AutoBtn({ icon: Icon, label, sub, state, onClick }: {
  icon: typeof Link2; label: string; sub: string;
  state: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} disabled={state === 'loading'}
      className="flex flex-col items-center gap-1 p-3 text-xs border border-slate-200
                 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50">
      {state === 'loading' ? <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
        : state === 'done' ? <Check className="w-4 h-4 text-emerald-500" />
        : <Icon className="w-4 h-4 text-slate-500" />}
      <span className="font-semibold text-slate-700">{label}</span>
      <span className="text-[10px] text-slate-400">
        {state === 'loading' ? 'Analysing...' : state === 'done' ? 'Groups created' : sub}
      </span>
    </button>
  );
}
