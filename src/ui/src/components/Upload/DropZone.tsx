import { useState, useRef } from 'react';
import { Upload, FileText, Loader2, Check, AlertCircle, X, ArrowRight } from 'lucide-react';
import { SchemaPicker } from './SchemaPicker';
import { CustomSchemaEditor, type CustomColumn } from './CustomSchemaEditor';

const RELAY = 'http://localhost:3002';
const ACCEPTED = new Set(['.pdf', '.docx', '.doc', '.txt', '.md']);

export function DropZone() {
  const [drag, setDrag] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'processing' | 'done'>('idle');
  const [files, setFiles] = useState<File[]>([]);
  const [schema, setSchema] = useState<string | null>(null);
  const [customCols, setCustomCols] = useState<CustomColumn[]>([{ label: '', prompt: '' }]);
  const [error, setError] = useState('');
  const [engine, setEngine] = useState<'claude' | 'isaacus'>('claude');
  const ref = useRef<HTMLInputElement>(null);

  const validCustom = customCols.filter(c => c.label && c.prompt).length;
  const ready = files.length > 0 && schema != null
    && (schema !== 'custom' || validCustom > 0);

  const accept = (list: File[]) => {
    const ok = list.filter(f =>
      ACCEPTED.has('.' + (f.name.split('.').pop() || '').toLowerCase()));
    if (!ok.length) { setError('No supported files (PDF, DOCX, TXT)'); return; }
    setFiles(ok);
    setError('');
  };

  const start = async () => {
    if (!ready || !schema) return;
    setPhase('uploading');
    const form = new FormData();
    for (const f of files) form.append('file', f);
    form.append('schema', schema);
    if (schema === 'custom')
      form.append('custom_columns',
        JSON.stringify(customCols.filter(c => c.label && c.prompt)));
    form.append('engine', engine);
    try {
      const r = await fetch(`${RELAY}/upload`, { method: 'POST', body: form });
      if (!r.ok) throw new Error();
      setPhase('processing');
      setTimeout(() => setPhase('done'), 2000);
    } catch {
      setError('Could not reach server. Is Claude Code running?');
      setPhase('idle');
    }
  };

  const drop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    accept(Array.from(e.dataTransfer.files));
  };
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    accept(Array.from(e.target.files || []));
    e.target.value = '';
  };

  if (phase !== 'idle') {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className={`w-full max-w-lg border-2 border-dashed rounded-xl p-12 text-center
          ${phase === 'done' ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300'}`}>
          {phase !== 'done' ? (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-lg font-semibold text-slate-700">
                {phase === 'uploading'
                  ? `Uploading ${files.length} files...` : 'Processing...'}
              </p>
              {phase === 'processing' && (
                <p className="text-sm text-slate-500">
                  {engine === 'isaacus'
                    ? 'Isaacus is extracting data'
                    : 'Claude is converting and extracting data'}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-emerald-100 rounded-full">
                <Check className="w-8 h-8 text-emerald-600" />
              </div>
              <p className="text-lg font-semibold text-emerald-700">
                {files.length} contracts uploaded
              </p>
              <p className="text-sm text-emerald-600">
                Grid will populate automatically
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto py-10 px-6">
        <input ref={ref} type="file" multiple accept=".pdf,.docx,.doc,.txt,.md"
          className="hidden" onChange={pick} />

        {/* File drop / file summary */}
        {files.length === 0 ? (
          <div className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
            transition-colors ${drag
              ? 'border-indigo-400 bg-indigo-50'
              : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'}`}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)} onDrop={drop}
            onClick={() => ref.current?.click()}>
            <div className="flex flex-col items-center gap-3">
              <div className="p-3 bg-indigo-50 rounded-full">
                <Upload className="w-6 h-6 text-indigo-600" />
              </div>
              <p className="text-base font-semibold text-slate-700">
                Drop contracts here
              </p>
              <p className="text-sm text-slate-500">
                PDF, DOCX, or TXT &mdash; or click to browse
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between px-4 py-3
            bg-emerald-50 border border-emerald-200 rounded-xl"
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)} onDrop={drop}>
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-emerald-100 rounded-lg">
                <FileText className="w-4 h-4 text-emerald-700" />
              </div>
              <span className="text-sm font-semibold text-emerald-800">
                {files.length} contract{files.length !== 1 ? 's' : ''} ready
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => ref.current?.click()}
                className="text-xs text-emerald-700 hover:text-emerald-900 font-medium">
                Change
              </button>
              <button onClick={() => setFiles([])}
                className="p-1 text-emerald-400 hover:text-red-500">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {error}
          </p>
        )}

        {/* Schema selection */}
        <SchemaPicker selected={schema} onSelect={setSchema} />

        {/* Custom column editor */}
        {schema === 'custom' && (
          <CustomSchemaEditor columns={customCols} onChange={setCustomCols} />
        )}

        {/* Engine toggle */}
        <div className="mt-6 flex justify-center">
          <div className="inline-flex p-0.5 bg-slate-100 rounded-lg text-xs font-medium">
            {(['claude', 'isaacus'] as const).map(e => (
              <button key={e} onClick={() => setEngine(e)}
                className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5
                  ${engine === e ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
                {e === 'claude' ? 'Claude' : <>Isaacus <span className="px-1 py-0.5 text-[9px]
                  font-bold bg-amber-100 text-amber-700 rounded">PREVIEW</span></>}
              </button>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-4 flex justify-center">
          <button onClick={start} disabled={!ready}
            className="flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white
              bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-all
              shadow-lg shadow-indigo-200
              disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none">
            Start Extraction <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <p className="text-center text-xs text-slate-400 mt-3
          flex items-center justify-center gap-1">
          <FileText className="w-3 h-3" />
          Files are converted and reviewed automatically
        </p>
      </div>
    </div>
  );
}
