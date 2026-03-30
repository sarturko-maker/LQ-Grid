import { useEffect, useRef, useCallback } from 'react';
import { Viewer, Worker } from '@react-pdf-viewer/core';
import '@react-pdf-viewer/core/lib/styles/index.css';

const WORKER_URL = `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;

interface PdfViewerProps {
  url: string;
  sourceQuote: string | null;
  zoom?: number;
}

function norm(s: string): string {
  return s.replace(/[\u00A0\u200B\u00AD\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ').toLowerCase().trim();
}

/** Build map from each normalized char index → original char index. */
function buildPosMap(text: string): number[] {
  const map: number[] = [];
  let lastWasSpace = false;
  for (let i = 0; i < text.length; i++) {
    const isSpace = /[\s\u00A0\u200B\u00AD\uFEFF]/.test(text[i]);
    if (isSpace) {
      if (!lastWasSpace && map.length > 0) map.push(i);
      lastWasSpace = true;
    } else {
      map.push(i);
      lastWasSpace = false;
    }
  }
  return map;
}

function highlightPdf(container: HTMLElement, quote: string): boolean {
  container.querySelectorAll('.lq-pdf-hl').forEach((e) => e.remove());

  const normQuote = norm(quote);
  const words = normQuote.split(/\s+/);
  if (words.length < 2) return false;

  const startAnchor = words.slice(0, 5).join(' ');
  const endAnchor = words.slice(-5).join(' ');

  const textLayers = container.querySelectorAll('.rpv-core__text-layer');

  for (const layer of textLayers) {
    const spans = Array.from(
      layer.querySelectorAll('.rpv-core__text-layer-text')
    ) as HTMLElement[];
    if (spans.length === 0) continue;

    // 1. Build full text with span position tracking
    let fullText = '';
    const spanInfo: Array<{ el: HTMLElement; start: number; end: number }> = [];
    for (const sp of spans) {
      const t = sp.textContent || '';
      const start = fullText.length;
      fullText += t;
      spanInfo.push({ el: sp, start, end: fullText.length });
    }

    // 2. Normalize full text and build position map
    const normFull = norm(fullText);
    const posMap = buildPosMap(fullText);

    // 3. Find anchors in normalized text
    const startIdx = normFull.indexOf(startAnchor);
    if (startIdx === -1) continue;

    let endIdx: number;
    if (words.length <= 10 || startAnchor === endAnchor) {
      const fi = normFull.indexOf(normQuote, startIdx);
      endIdx = fi !== -1 ? fi + normQuote.length : startIdx + normQuote.length;
    } else {
      const ei = normFull.indexOf(endAnchor, startIdx + startAnchor.length);
      endIdx = ei !== -1 ? ei + endAnchor.length : startIdx + normQuote.length;
    }

    // 4. Map normalized positions back to original positions
    const origStart = posMap[Math.min(startIdx, posMap.length - 1)] ?? 0;
    const origEnd = (posMap[Math.min(endIdx - 1, posMap.length - 1)] ?? origStart) + 1;

    // 5. Find spans that overlap [origStart, origEnd]
    const matchSpans: HTMLElement[] = [];
    for (const { el, start, end } of spanInfo) {
      if (end > origStart && start < origEnd) {
        matchSpans.push(el);
      }
    }

    if (matchSpans.length === 0) continue;

    // 6. Create overlay divs
    const layerEl = layer as HTMLElement;
    const layerRect = layerEl.getBoundingClientRect();

    for (const span of matchSpans) {
      const r = span.getBoundingClientRect();
      const ov = document.createElement('div');
      ov.className = 'lq-pdf-hl';
      Object.assign(ov.style, {
        position: 'absolute',
        left: `${r.left - layerRect.left}px`,
        top: `${r.top - layerRect.top}px`,
        width: `${r.width}px`,
        height: `${r.height}px`,
        backgroundColor: 'rgba(250, 204, 21, 0.5)',
        borderBottom: '2px solid rgb(234, 179, 8)',
        pointerEvents: 'none',
        borderRadius: '2px',
        zIndex: '2',
        mixBlendMode: 'multiply',
      });
      layerEl.appendChild(ov);
    }

    matchSpans[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    return true;
  }
  return false;
}

export function PdfViewer({ url, sourceQuote, zoom = 100 }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const didHighlight = useRef(false);
  const observerRef = useRef<MutationObserver | null>(null);

  const tryHighlight = useCallback(() => {
    if (!sourceQuote || !containerRef.current || didHighlight.current) return;
    if (highlightPdf(containerRef.current, sourceQuote)) {
      didHighlight.current = true;
      observerRef.current?.disconnect();
    }
  }, [sourceQuote]);

  useEffect(() => {
    didHighlight.current = false;
    if (!sourceQuote || !containerRef.current) return;

    observerRef.current = new MutationObserver(() => {
      if (!didHighlight.current) tryHighlight();
    });
    observerRef.current.observe(containerRef.current, {
      childList: true, subtree: true,
    });

    const t = setTimeout(tryHighlight, 800);
    return () => { clearTimeout(t); observerRef.current?.disconnect(); };
  }, [url, sourceQuote, tryHighlight]);

  return (
    <div ref={containerRef}
      className="h-full w-full bg-white rounded-lg shadow-lg overflow-hidden
                 [&_.rpv-core__viewer]:h-full"
      style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left',
               width: `${10000 / zoom}%`, height: `${10000 / zoom}%` }}>
      <Worker workerUrl={WORKER_URL}>
        <Viewer fileUrl={url} />
      </Worker>
    </div>
  );
}
