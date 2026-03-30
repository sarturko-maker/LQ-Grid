import { useState, useEffect, useRef } from 'react';
import { X, FileText, ZoomIn, ZoomOut, Download, FileSearch, Eye } from 'lucide-react';
import type { SourceRef } from '@/types';
import { DocxViewer } from './DocxViewer';
import { PdfViewer } from './PdfViewer';
import { SourceView } from './SourceView';

interface DocumentViewProps {
  documentName: string;
  sourceQuote: string | null;
  sourceStart?: number;
  sourceEnd?: number;
  sourceQuotes?: SourceRef[];
  onClose: () => void;
}

type ViewMode = 'source' | 'original';

export function DocumentView({
  documentName, sourceQuote, sourceStart, sourceEnd, sourceQuotes, onClose,
}: DocumentViewProps) {
  const [docText, setDocText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceExt, setSourceExt] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasHighlight = !!(sourceQuote || (sourceStart != null && sourceEnd != null) || (sourceQuotes && sourceQuotes.length > 0));
  // Always default to original document — lawyers need to see the real thing
  const [viewMode, setViewMode] = useState<ViewMode>('original');

  const stem = documentName.replace(/\.(txt|pdf|docx)$/, '');

  useEffect(() => {
    setLoading(true);
    setSourceUrl(null);
    setSourceExt(null);
    setViewMode('original');

    const probeSource = async () => {
      for (const ext of ['pdf', 'docx']) {
        try {
          const url = `/data/contracts/${stem}.${ext}`;
          const r = await fetch(url, { method: 'HEAD' });
          const ct = r.headers.get('content-type') || '';
          if (r.ok && !ct.includes('text/html')) {
            setSourceUrl(url); setSourceExt(ext); return;
          }
        } catch { /* continue */ }
      }
    };

    Promise.all([
      fetch(`/data/output/texts/${stem}.txt`, { cache: 'no-store' })
        .then((r) => r.ok ? r.text() : null).catch(() => null),
      probeSource(),
    ]).then(([text]) => { setDocText(text); setLoading(false); });
  }, [documentName, stem, hasHighlight]);

  // Auto-scroll to highlight in source view
  useEffect(() => {
    if (!loading && viewMode === 'source' && scrollRef.current) {
      const t = setTimeout(() => {
        scrollRef.current?.querySelector('mark')
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 200);
      return () => clearTimeout(t);
    }
  }, [loading, viewMode, docText]);

  return (
    <div className="h-full flex flex-col bg-slate-100 animate-in slide-in-from-right duration-300">
      <Header name={documentName} ext={sourceExt} url={sourceUrl}
        zoom={zoom} setZoom={setZoom}
        viewMode={viewMode} hasOriginal={!!sourceUrl} hasHighlight={hasHighlight}
        onToggleView={(m) => setViewMode(m)} onClose={onClose} />

      <div ref={scrollRef} className="flex-1 overflow-auto p-4">
        {loading ? (
          <Spinner />
        ) : viewMode === 'source' && docText ? (
          <SourceView docText={docText} sourceQuote={sourceQuote}
            sourceStart={sourceStart} sourceEnd={sourceEnd}
            sourceQuotes={sourceQuotes} zoom={zoom} />
        ) : viewMode === 'original' && sourceExt === 'pdf' && sourceUrl ? (
          <div style={{ height: 'calc(100vh - 160px)' }}>
            <PdfViewer url={sourceUrl} sourceQuote={sourceQuote} zoom={zoom} />
          </div>
        ) : viewMode === 'original' && sourceExt === 'docx' && sourceUrl ? (
          <DocxViewer url={sourceUrl} sourceQuote={sourceQuote}
            plainText={docText} sourceStart={sourceStart} sourceEnd={sourceEnd} zoom={zoom} />
        ) : docText ? (
          <SourceView docText={docText} sourceQuote={sourceQuote}
            sourceStart={sourceStart} sourceEnd={sourceEnd}
            sourceQuotes={sourceQuotes} zoom={zoom} />
        ) : (
          <div className="flex flex-col items-center justify-center h-[400px] text-slate-400">
            <FileText className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">Document not available</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function Header({ name, ext, url, zoom, setZoom, viewMode, hasOriginal,
  hasHighlight, onToggleView, onClose }: {
  name: string; ext: string | null; url: string | null;
  zoom: number; setZoom: (fn: (z: number) => number) => void;
  viewMode: ViewMode; hasOriginal: boolean; hasHighlight: boolean;
  onToggleView: (mode: ViewMode) => void; onClose: () => void;
}) {
  return (
    <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="p-1.5 bg-indigo-50 rounded-lg">
          <FileText className="w-4 h-4 text-indigo-600" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
            {viewMode === 'source' ? 'Text View' : `${ext?.toUpperCase() || 'Text'} Preview`}
          </p>
          <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {/* View toggle */}
        {hasOriginal && (
          <div className="flex rounded-lg border border-slate-200 overflow-hidden mr-1">
            {hasHighlight && (
              <button onClick={() => onToggleView('source')}
                className={`px-2 py-1 text-[10px] font-semibold flex items-center gap-1
                  ${viewMode === 'source' ? 'bg-yellow-50 text-yellow-700' : 'bg-white text-slate-400 hover:bg-slate-50'}`}>
                <FileSearch className="w-3 h-3" />Text
              </button>
            )}
            <button onClick={() => onToggleView('original')}
              className={`px-2 py-1 text-[10px] font-semibold flex items-center gap-1
                ${viewMode === 'original' ? 'bg-indigo-50 text-indigo-700' : 'bg-white text-slate-400 hover:bg-slate-50'}`}>
              <Eye className="w-3 h-3" />{ext?.toUpperCase()}
            </button>
          </div>
        )}
        {url && <a href={url} download={name}
          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
          <Download className="w-3.5 h-3.5" /></a>}
        <button onClick={() => setZoom((z) => Math.max(50, z - 10))}
          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
          <ZoomOut className="w-3.5 h-3.5" /></button>
        <span className="text-[10px] text-slate-400 w-8 text-center">{zoom}%</span>
        <button onClick={() => setZoom((z) => Math.min(200, z + 10))}
          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
          <ZoomIn className="w-3.5 h-3.5" /></button>
        <div className="w-px h-4 bg-slate-200 mx-1" />
        <button onClick={onClose}
          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
          <X className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

