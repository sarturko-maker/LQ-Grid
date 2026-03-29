import { useState } from 'react';
import { useRef } from 'react';
import {
  Download, Plus, Upload,
  ChevronDown, Sparkles, FolderOpen, Users, WrapText,
} from 'lucide-react';
import type { Manifest } from '@/types';
import { exportCSV, exportXLSX } from '@/lib/exportData';
import { MODELS } from '@/lib/models';

interface GridToolbarProps {
  manifest: Manifest;
  verifiedCount: number;
  flaggedCount: number;
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  onAddColumn: () => void;
  onActions: () => void;
  onGrouping: () => void;
  groupCount: number;
  onCounterparties: () => void;
  partyCount: number;
  wrapText: boolean;
  onToggleWrap: () => void;
}

export function GridToolbar({
  manifest, verifiedCount, flaggedCount,
  selectedModel, onModelChange, onAddColumn, onActions, onGrouping,
  groupCount, onCounterparties, partyCount, wrapText, onToggleWrap,
}: GridToolbarProps) {
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const currentModel = MODELS.find((m) => m.id === selectedModel) || MODELS[0];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddContracts = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const form = new FormData();
    for (const f of files) form.append('file', f);
    try {
      await fetch('http://localhost:3002/upload', { method: 'POST', body: form });
    } catch { /* server not running */ }
    e.target.value = '';
  };

  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-slate-200">
      {/* Left: Stats */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs">
          <Pill label={`${manifest.rows.length} documents`} cls="bg-slate-100 text-slate-600" />
          <Pill label={`${manifest.columns.length} columns`} cls="bg-slate-100 text-slate-600" />
          {verifiedCount > 0 && <Pill label={`${verifiedCount} verified`} cls="bg-emerald-50 text-emerald-700" />}
          {flaggedCount > 0 && <Pill label={`${flaggedCount} flagged`} cls="bg-red-50 text-red-700" />}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.doc,.txt,.md"
          className="hidden" onChange={handleAddContracts} />
        <Btn onClick={() => fileInputRef.current?.click()} icon={Upload} label="Add Contracts" />
        <Btn onClick={onAddColumn} icon={Plus} label="Column" />
        <button onClick={onGrouping}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600
                     bg-white border border-slate-200 rounded-lg hover:bg-slate-50
                     transition-colors active:scale-[0.97]">
          <FolderOpen className="w-3.5 h-3.5" /> Group
          {groupCount > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 text-[10px] font-bold bg-indigo-100
                             text-indigo-700 rounded-full">{groupCount}</span>
          )}
        </button>
        <button onClick={onCounterparties}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600
                     bg-white border border-slate-200 rounded-lg hover:bg-slate-50
                     transition-colors active:scale-[0.97]">
          <Users className="w-3.5 h-3.5" /> Parties
          <span className="ml-0.5 px-1.5 py-0.5 text-[10px] font-bold bg-slate-100
                           text-slate-500 rounded-full">{partyCount}</span>
        </button>

        <button onClick={onToggleWrap} title={wrapText ? 'Disable text wrap' : 'Enable text wrap'}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                     transition-colors active:scale-[0.97] border
                     ${wrapText
                       ? 'text-indigo-700 bg-indigo-50 border-indigo-200'
                       : 'text-slate-600 bg-white border-slate-200 hover:bg-slate-50'}`}>
          <WrapText className="w-3.5 h-3.5" /> Wrap
        </button>

        {/* Export */}
        <div className="relative">
          <Btn onClick={() => setShowExportMenu(!showExportMenu)} icon={Download} label="Export" />
          {showExportMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowExportMenu(false)} />
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200
                              rounded-lg shadow-lg z-40 py-1 w-36 animate-in fade-in duration-100">
                <button onClick={() => { exportXLSX(manifest); setShowExportMenu(false); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 font-medium">
                  Excel (.xlsx)
                </button>
                <button onClick={() => { exportCSV(manifest); setShowExportMenu(false); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50">
                  CSV (.csv)
                </button>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <button onClick={onActions}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold
                     text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg
                     hover:bg-indigo-100 transition-all duration-150 active:scale-[0.97]">
          <Sparkles className="w-3.5 h-3.5" /> Actions
        </button>

        <div className="h-5 w-px bg-slate-200 mx-0.5" />

        {/* Model picker */}
        <div className="relative">
          <button onClick={() => setShowModelMenu(!showModelMenu)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                       text-slate-600 bg-slate-50 border border-slate-200 rounded-lg
                       hover:bg-slate-100 transition-colors">
            <span className="font-semibold">{currentModel.name}</span>
            <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200
              ${showModelMenu ? 'rotate-180' : ''}`} />
          </button>
          {showModelMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowModelMenu(false)} />
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200
                              rounded-xl shadow-xl z-40 p-1 w-52 animate-in fade-in duration-100">
                {MODELS.map((m) => (
                  <button key={m.id}
                    onClick={() => { onModelChange(m.id); setShowModelMenu(false); }}
                    className={`w-full text-left px-3 py-2.5 rounded-lg flex flex-col gap-0.5
                      transition-colors ${selectedModel === m.id
                        ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}>
                    <span className="text-xs font-bold">{m.name}</span>
                    <span className="text-[10px] opacity-60">{m.description}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Pill({ label, cls }: { label: string; cls: string }) {
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${cls}`}>{label}</span>;
}

function Btn({ onClick, icon: Icon, label }: { onClick: () => void; icon: typeof Plus; label: string }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600
                 bg-white border border-slate-200 rounded-lg hover:bg-slate-50
                 transition-colors active:scale-[0.97]">
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}
