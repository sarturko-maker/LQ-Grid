import { useState, useRef } from 'react';
import { Upload, FileText, Loader2, Check, AlertCircle } from 'lucide-react';

const RELAY = 'http://localhost:3002';
const ACCEPTED = new Set(['.pdf', '.docx', '.doc', '.txt', '.md']);

type UploadState = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

export function DropZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [state, setState] = useState<UploadState>('idle');
  const [fileCount, setFileCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = async (files: File[]) => {
    const valid = files.filter((f) => {
      const ext = '.' + f.name.split('.').pop()?.toLowerCase();
      return ACCEPTED.has(ext);
    });
    if (valid.length === 0) {
      setErrorMsg('No supported files (PDF, DOCX, TXT)');
      setState('error');
      setTimeout(() => setState('idle'), 3000);
      return;
    }

    setFileCount(valid.length);
    setState('uploading');

    const form = new FormData();
    for (const f of valid) form.append('file', f);

    try {
      const r = await fetch(`${RELAY}/upload`, { method: 'POST', body: form });
      if (!r.ok) throw new Error('Upload failed');
      setState('processing');
      // Pipeline is triggered via channel — UI will auto-refresh when manifest appears
      setTimeout(() => setState('done'), 2000);
    } catch {
      setErrorMsg('Could not reach server. Is Claude Code running?');
      setState('error');
      setTimeout(() => setState('idle'), 4000);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) uploadFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) uploadFiles(files);
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div
        className={`w-full max-w-lg border-2 border-dashed rounded-xl p-12
                     text-center transition-colors cursor-pointer
                     ${isDragging ? 'border-indigo-400 bg-indigo-50'
                       : state === 'error' ? 'border-red-300 bg-red-50'
                       : state === 'done' ? 'border-emerald-300 bg-emerald-50'
                       : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => state === 'idle' && inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" multiple accept=".pdf,.docx,.doc,.txt,.md"
          className="hidden" onChange={handleFileSelect} />

        <div className="flex flex-col items-center gap-4">
          {state === 'idle' && (
            <>
              <div className="p-4 bg-indigo-50 rounded-full">
                <Upload className="w-8 h-8 text-indigo-600" />
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-700">
                  Drop contracts here
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  PDF, DOCX, or TXT — or click to browse
                </p>
              </div>
            </>
          )}

          {(state === 'uploading' || state === 'processing') && (
            <>
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <div>
                <p className="text-lg font-semibold text-slate-700">
                  {state === 'uploading' ? `Uploading ${fileCount} files...` : 'Processing...'}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  {state === 'processing' && 'Claude is converting and extracting data'}
                </p>
              </div>
            </>
          )}

          {state === 'done' && (
            <>
              <div className="p-4 bg-emerald-50 rounded-full">
                <Check className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <p className="text-lg font-semibold text-emerald-700">
                  {fileCount} contracts uploaded
                </p>
                <p className="text-sm text-emerald-600 mt-1">
                  Extraction in progress — grid will populate automatically
                </p>
              </div>
            </>
          )}

          {state === 'error' && (
            <>
              <div className="p-4 bg-red-50 rounded-full">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <p className="text-sm text-red-600">{errorMsg}</p>
            </>
          )}

          {state === 'idle' && (
            <div className="flex items-center gap-3 text-xs text-slate-400 mt-2">
              <FileText className="w-3.5 h-3.5" />
              <span>Files are saved, converted, and reviewed automatically</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
