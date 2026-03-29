import { useRef, useEffect, useState } from 'react';
import { renderAsync } from 'docx-preview';
import { Loader2, FileText } from 'lucide-react';
import { highlightInContainer, clearHighlight } from '@/lib/highlightText';

interface DocxViewerProps {
  url: string;
  sourceQuote: string | null;
  plainText: string | null;
  sourceStart?: number;
  sourceEnd?: number;
}

/** Renders a DOCX file using docx-preview, auto-scaled, with source highlighting. */
export function DocxViewer({ url, sourceQuote, plainText, sourceStart, sourceEnd }: DocxViewerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [scale, setScale] = useState(1);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    setLoading(true);
    setError(false);
    setRendered(false);
    containerRef.current.innerHTML = '';
    clearHighlight();

    fetch(url)
      .then((r) => { if (!r.ok) throw new Error('fetch failed'); return r.blob(); })
      .then((blob) =>
        renderAsync(blob, containerRef.current!, undefined, {
          className: 'docx-wrapper',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: true,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          trimXmlDeclaration: true,
        }),
      )
      .then(() => { setLoading(false); setRendered(true); updateScale(); })
      .catch(() => { setError(true); setLoading(false); });
  }, [url]);

  // Apply highlight ONCE after render completes
  const didHighlight = useRef(false);
  useEffect(() => {
    if (!rendered || !containerRef.current || didHighlight.current) return;
    if (!sourceQuote && sourceStart == null) return;

    const t = setTimeout(() => {
      if (didHighlight.current) return;
      highlightInContainer({
        container: containerRef.current!,
        quote: sourceQuote,
        plainText,
        sourceStart,
        sourceEnd,
      });
      didHighlight.current = true;
    }, 300);
    return () => clearTimeout(t);
  }, [rendered]);

  const updateScale = () => {
    if (!wrapperRef.current || !containerRef.current) return;
    const wrapperW = wrapperRef.current.clientWidth - 32;
    const section = containerRef.current.querySelector('.docx-wrapper > section') as HTMLElement;
    const docW = section?.scrollWidth || 816;
    setScale(Math.min(1, wrapperW / docW));
  };

  useEffect(() => {
    if (!wrapperRef.current) return;
    const ro = new ResizeObserver(updateScale);
    ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-slate-400">
        <FileText className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm">Could not render DOCX</p>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative w-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        </div>
      )}
      <div ref={containerRef}
        className="mx-auto bg-white shadow-lg rounded-lg overflow-hidden
                   [&_.docx-wrapper]:p-0 [&_.docx-wrapper_section]:!max-w-none"
        style={{ transform: `scale(${scale})`, transformOrigin: 'top left',
                 width: `${100 / scale}%` }} />
    </div>
  );
}
