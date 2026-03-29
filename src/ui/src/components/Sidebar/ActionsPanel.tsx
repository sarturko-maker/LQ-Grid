import { useState, useEffect } from 'react';
import {
  X, FileSignature, BarChart3, Shield, ScrollText,
  Sparkles, Download, FileText, Loader2,
} from 'lucide-react';
import {
  listFiles, downloadFile, requestAction,
  type GeneratedFile,
} from '@/lib/actions';
import type { Manifest } from '@/types';

interface ActionsPanelProps {
  manifest: Manifest;
  onClose: () => void;
}

interface ActionDef {
  id: string;
  label: string;
  subtitle: string;
  icon: typeof FileSignature;
  color: string;
  dir: string;
  prompt: string;
}

const ACTIONS: ActionDef[] = [
  {
    id: 'consent-letters', label: 'Consent Letters', dir: 'letters',
    subtitle: 'Request letters for contracts requiring consent',
    icon: FileSignature, color: 'text-emerald-600 bg-emerald-50',
    prompt: 'Draft consent request letters for all contracts requiring consent. Save as DOCX to data/output/letters/.',
  },
  {
    id: 'summary-report', label: 'Client Summary', dir: 'reports',
    subtitle: 'Overview of all contracts, consents, risks',
    icon: BarChart3, color: 'text-indigo-600 bg-indigo-50',
    prompt: 'Generate client summary report. Save as DOCX to data/output/reports/.',
  },
  {
    id: 'board-flags', label: 'Board Approval Flags', dir: 'reports',
    subtitle: 'Material contracts needing board attention',
    icon: Shield, color: 'text-amber-600 bg-amber-50',
    prompt: 'Flag contracts for board approval. Save as DOCX to data/output/reports/.',
  },
  {
    id: 'disclosure-schedule', label: 'Disclosure Schedule', dir: 'reports',
    subtitle: 'Entries for SPA disclosure letter',
    icon: ScrollText, color: 'text-purple-600 bg-purple-50',
    prompt: 'Draft disclosure schedule. Save as DOCX to data/output/reports/.',
  },
];

export function ActionsPanel({ onClose }: ActionsPanelProps) {
  return (
    <div className="h-full flex flex-col bg-white animate-in slide-in-from-right duration-300">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-50 rounded-lg">
            <Sparkles className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Actions</h3>
            <p className="text-[11px] text-slate-400">Generate deliverables</p>
          </div>
        </div>
        <button onClick={onClose}
          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {ACTIONS.map((a) => (
          <ActionCard key={a.id} action={a} />
        ))}
      </div>
    </div>
  );
}

function ActionCard({ action }: { action: ActionDef }) {
  const [state, setState] = useState<'idle' | 'requesting' | 'polling' | 'ready' | 'error'>('idle');
  const [files, setFiles] = useState<GeneratedFile[]>([]);

  // Check for existing files on mount
  useEffect(() => {
    listFiles(action.dir).then((f) => {
      const relevant = f.filter((x) => x.name.includes(action.id.split('-')[0]));
      if (relevant.length > 0) {
        setFiles(relevant);
        setState('ready');
      }
    });
  }, [action.dir, action.id]);

  const handleGenerate = async () => {
    setState('requesting');
    try {
      await requestAction(action.id, action.prompt);
      setState('polling');
      // Poll for files to appear
      const poll = setInterval(async () => {
        const f = await listFiles(action.dir);
        const relevant = f.filter((x) => x.name.endsWith('.docx'));
        if (relevant.length > 0) {
          setFiles(relevant);
          setState('ready');
          clearInterval(poll);
        }
      }, 3000);
      // Stop polling after 2 minutes
      setTimeout(() => clearInterval(poll), 120000);
    } catch {
      setState('error');
    }
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="p-4 flex items-start gap-3">
        <div className={`p-2 rounded-xl shrink-0 ${action.color}`}>
          <action.icon className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-800">{action.label}</p>
          <p className="text-xs text-slate-500 mt-0.5">{action.subtitle}</p>
        </div>
      </div>

      <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-2.5">
        {state === 'idle' && (
          <button onClick={handleGenerate}
            className="w-full py-2 text-xs font-semibold text-white bg-slate-800
                       rounded-lg hover:bg-slate-700 transition-colors active:scale-[0.98]">
            Generate
          </button>
        )}

        {(state === 'requesting' || state === 'polling') && (
          <div className="flex items-center justify-center gap-2 py-2 text-xs text-slate-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {state === 'requesting' ? 'Sending request...' : 'Generating...'}
          </div>
        )}

        {state === 'ready' && files.length > 0 && (
          <div className="space-y-1">
            {files.map((f) => (
              <button key={f.name} onClick={() => downloadFile(action.dir, f.name)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg
                           hover:bg-white transition-colors group">
                <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="flex-1 text-left text-slate-700 truncate">{f.name}</span>
                <Download className="w-3 h-3 text-slate-300 group-hover:text-indigo-600" />
              </button>
            ))}
          </div>
        )}

        {state === 'error' && (
          <p className="text-xs text-red-500 py-1">
            Could not connect to relay. Run: python3 src/pipeline/relay.py
          </p>
        )}
      </div>
    </div>
  );
}
