import { useState } from 'react';
import {
  FolderOpen, Plus, Trash2, ChevronDown, ChevronRight, FileText,
} from 'lucide-react';
import type { Manifest, DocumentGroup } from '@/types';

interface GroupCardProps {
  group: DocumentGroup;
  manifest: Manifest;
  ungrouped: Manifest['rows'];
  onToggle: () => void;
  onRemove: () => void;
  onAddDoc: (docId: string) => void;
  onRemoveDoc: (docId: string) => void;
}

export function GroupCard({
  group, manifest, ungrouped, onToggle, onRemove, onAddDoc, onRemoveDoc,
}: GroupCardProps) {
  const [showAdd, setShowAdd] = useState(false);
  const docs = group.documents
    .map((id) => manifest.rows.find((r) => r._id === id))
    .filter(Boolean);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 cursor-pointer"
        onClick={onToggle}>
        {group.isExpanded
          ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
        <FolderOpen className="w-3.5 h-3.5 text-indigo-500" />
        <span className="flex-1 text-xs font-semibold text-slate-700">{group.name}</span>
        <span className="text-[10px] text-slate-400">{docs.length} docs</span>
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="p-1 hover:bg-red-50 rounded text-slate-300 hover:text-red-500 transition-colors">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {group.isExpanded && (
        <div className="px-3 py-2 space-y-1 border-t border-slate-100">
          {docs.map((row) => row && (
            <div key={row._id} className="flex items-center gap-2 py-1">
              <FileText className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="flex-1 text-xs text-slate-600 truncate">{row._document}</span>
              <button onClick={() => onRemoveDoc(row._id)}
                className="text-[10px] text-slate-400 hover:text-red-500">remove</button>
            </div>
          ))}
          {ungrouped.length > 0 && (
            <div className="pt-1 border-t border-slate-100">
              {showAdd ? (
                <div className="space-y-1">
                  {ungrouped.map((r) => (
                    <button key={r._id} onClick={() => { onAddDoc(r._id); setShowAdd(false); }}
                      className="w-full flex items-center gap-2 py-1 text-xs text-indigo-600
                                 hover:bg-indigo-50 rounded px-1 transition-colors">
                      <Plus className="w-3 h-3" /> {r._document}
                    </button>
                  ))}
                </div>
              ) : (
                <button onClick={() => setShowAdd(true)}
                  className="text-[10px] text-indigo-600 font-medium hover:underline">
                  + Add document
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface CreateFormProps {
  name: string;
  selected: Set<string>;
  rows: { _id: string; _document: string }[];
  onNameChange: (v: string) => void;
  onToggle: (id: string) => void;
  onCreate: () => void;
  onCancel: () => void;
}

export function CreateGroupForm({
  name, selected, rows, onNameChange, onToggle, onCreate, onCancel,
}: CreateFormProps) {
  return (
    <div className="border border-indigo-200 rounded-xl p-4 bg-indigo-50/30 space-y-3">
      <input value={name} onChange={(e) => onNameChange(e.target.value)}
        placeholder="Group name..." autoFocus
        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg
                   focus:outline-none focus:ring-2 focus:ring-indigo-300" />
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {rows.map((r) => (
          <label key={r._id}
            className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-white
                       cursor-pointer transition-colors">
            <input type="checkbox" checked={selected.has(r._id)}
              onChange={() => onToggle(r._id)}
              className="rounded border-slate-300 text-indigo-600" />
            <FileText className="w-3 h-3 text-slate-400" />
            <span className="text-xs text-slate-700 truncate">{r._document}</span>
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={onCreate} disabled={!name.trim() || selected.size === 0}
          className="flex-1 py-2 text-xs font-semibold text-white bg-indigo-600
                     rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors">
          Create ({selected.size})
        </button>
        <button onClick={onCancel}
          className="px-3 py-2 text-xs text-slate-600 border border-slate-200
                     rounded-lg hover:bg-slate-50 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}
