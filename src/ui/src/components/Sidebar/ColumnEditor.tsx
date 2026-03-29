import { useState } from 'react';
import {
  X, Quote, FileText, CheckCircle, Calendar, ChevronDown,
  Loader2,
} from 'lucide-react';
import { getOutputTypePrompt } from '@/lib/bridge';
import { requestAddColumn } from '@/lib/requests';
import type { OutputType } from '@/types';

interface ColumnEditorProps {
  model: string;
  onColumnAdded: (id: string, prompt: string, outputType: OutputType) => void;
  onClose: () => void;
}

const OUTPUT_TYPES: {
  id: OutputType;
  label: string;
  description: string;
  icon: typeof Quote;
}[] = [
  {
    id: 'verbatim',
    label: 'Verbatim Text',
    description: 'Exact clause language quoted from the document',
    icon: Quote,
  },
  {
    id: 'summary',
    label: 'Summary',
    description: 'AI-generated summary of the relevant provision',
    icon: FileText,
  },
  {
    id: 'classification',
    label: 'Yes / No',
    description: 'Binary classification with brief explanation',
    icon: CheckCircle,
  },
  {
    id: 'date',
    label: 'Date',
    description: 'Extracted date formatted as DD Month YYYY',
    icon: Calendar,
  },
];

export function ColumnEditor({ model, onColumnAdded, onClose }: ColumnEditorProps) {
  const [prompt, setPrompt] = useState('');
  const [outputType, setOutputType] = useState<OutputType>('summary');
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const selectedType = OUTPUT_TYPES.find((t) => t.id === outputType)!;

  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    setSubmitted(true);

    // Send to relay server
    const req = await requestAddColumn(prompt.trim(), outputType, model);

    // Show column in grid immediately (pending state)
    onColumnAdded(req.id, prompt.trim(), outputType);

    if (req.status === 'failed') {
      setSubmitted(false);
      alert('Relay server not running. Start it:\npython3 src/pipeline/relay.py');
      return;
    }

    // Close after brief feedback
    setTimeout(() => onClose(), 1500);
  };

  if (submitted) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-white
                      animate-in fade-in duration-300 p-8">
        <div className="relative mb-4">
          <div className="absolute inset-0 bg-indigo-100 rounded-full animate-ping opacity-50" />
          <div className="relative p-3 bg-indigo-50 rounded-full">
            <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
          </div>
        </div>
        <p className="text-sm font-semibold text-slate-800">Column added</p>
        <p className="text-xs text-slate-500 mt-1 text-center">
          Extraction agents are reviewing all documents...
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Add Column</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Title will be generated from your prompt
          </p>
        </div>
        <button onClick={onClose}
          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Form */}
      <div className="flex-1 p-5 space-y-5 overflow-y-auto">
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">
            What do you want to extract?
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Does this contract contain a non-compete clause? If so, what is its duration and geographic scope?"
            className="w-full px-3 py-3 text-sm border border-slate-200 rounded-xl
                       bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500
                       focus:border-transparent resize-none transition-all duration-200"
            rows={4}
            autoFocus
          />
        </div>

        {/* Output type */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">
            Response Format
          </label>
          <div className="relative">
            <button onClick={() => setShowTypeMenu(!showTypeMenu)}
              className="w-full flex items-center justify-between px-3 py-2.5
                         border border-slate-200 rounded-xl bg-white
                         hover:border-slate-300 transition-colors duration-150">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-indigo-50 rounded-lg">
                  <selectedType.icon className="w-3.5 h-3.5 text-indigo-600" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-slate-800">{selectedType.label}</p>
                  <p className="text-[11px] text-slate-400">{selectedType.description}</p>
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200
                ${showTypeMenu ? 'rotate-180' : ''}`} />
            </button>

            {showTypeMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowTypeMenu(false)} />
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border
                                border-slate-200 rounded-xl shadow-lg z-20 py-1
                                animate-in fade-in zoom-in-95 duration-150">
                  {OUTPUT_TYPES.map((t) => (
                    <button key={t.id}
                      onClick={() => { setOutputType(t.id); setShowTypeMenu(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left
                        hover:bg-slate-50 transition-colors
                        ${outputType === t.id ? 'bg-indigo-50/50' : ''}`}>
                      <div className={`p-1.5 rounded-lg ${
                        outputType === t.id ? 'bg-indigo-100' : 'bg-slate-100'}`}>
                        <t.icon className={`w-3.5 h-3.5 ${
                          outputType === t.id ? 'text-indigo-600' : 'text-slate-500'}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{t.label}</p>
                        <p className="text-[11px] text-slate-400">{t.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* System prompt preview */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">
            System instruction (auto-applied)
          </p>
          <p className="text-xs text-slate-500 leading-relaxed">
            {getOutputTypePrompt(outputType)}
          </p>
        </div>
      </div>

      {/* Submit */}
      <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50">
        <button onClick={handleSubmit} disabled={!prompt.trim()}
          className="w-full py-2.5 text-sm font-bold text-white bg-slate-900
                     rounded-xl hover:bg-slate-800 disabled:opacity-40
                     disabled:cursor-not-allowed transition-all duration-200
                     active:scale-[0.98]">
          Add Column & Extract
        </button>
      </div>
    </div>
  );
}
