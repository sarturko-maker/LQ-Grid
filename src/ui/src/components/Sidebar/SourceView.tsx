import type { SourceRef } from '@/types';

interface Region { start: number; end: number }

/** Resolve all highlight regions from the available source data. */
function resolveRegions(
  docText: string,
  sourceQuote: string | null,
  sourceStart?: number,
  sourceEnd?: number,
  sourceQuotes?: SourceRef[],
): Region[] {
  const regions: Region[] = [];

  // Multiple quotes take priority
  if (sourceQuotes && sourceQuotes.length > 0) {
    for (const sq of sourceQuotes) {
      if (sq.start != null && sq.end != null &&
          sq.start >= 0 && sq.end > sq.start && sq.end <= docText.length) {
        regions.push({ start: sq.start, end: sq.end });
      } else if (sq.quote) {
        const idx = docText.indexOf(sq.quote);
        if (idx >= 0) regions.push({ start: idx, end: idx + sq.quote.length });
      }
    }
  }

  // Fall back to single quote
  if (regions.length === 0) {
    if (sourceStart != null && sourceEnd != null &&
        sourceStart >= 0 && sourceEnd > sourceStart && sourceEnd <= docText.length) {
      regions.push({ start: sourceStart, end: sourceEnd });
    } else if (sourceQuote) {
      const idx = docText.indexOf(sourceQuote);
      if (idx >= 0) regions.push({ start: idx, end: idx + sourceQuote.length });
    }
  }

  // Sort and deduplicate
  regions.sort((a, b) => a.start - b.start);
  return regions;
}

/** Text view with guaranteed offset-based highlighting.
 *  Renders the exact text the LLM read, with the exact passage(s) highlighted. */
export function SourceView({ docText, sourceQuote, sourceStart, sourceEnd, sourceQuotes, zoom }: {
  docText: string;
  sourceQuote: string | null;
  sourceStart?: number;
  sourceEnd?: number;
  sourceQuotes?: SourceRef[];
  zoom: number;
}) {
  const regions = resolveRegions(docText, sourceQuote, sourceStart, sourceEnd, sourceQuotes);

  // Build segments: alternating normal/highlighted text
  const segments: Array<{ text: string; highlighted: boolean }> = [];
  let cursor = 0;
  for (const r of regions) {
    if (r.start > cursor) {
      segments.push({ text: docText.slice(cursor, r.start), highlighted: false });
    }
    segments.push({ text: docText.slice(r.start, r.end), highlighted: true });
    cursor = r.end;
  }
  if (cursor < docText.length) {
    segments.push({ text: docText.slice(cursor), highlighted: false });
  }

  const hasHighlight = regions.length > 0;

  return (
    <div className="max-w-[700px] mx-auto bg-white shadow-lg rounded-lg overflow-hidden"
      style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}>
      <div className="p-10 min-h-[800px]">
        <div className="whitespace-pre-wrap text-sm leading-[1.8] text-slate-800
                        font-[Georgia,serif] tracking-[0.01em]">
          {hasHighlight ? (
            segments.map((seg, i) =>
              seg.highlighted ? (
                <mark key={i} className="bg-yellow-200/80 text-slate-900 px-0.5 rounded
                                         border-b-2 border-yellow-400 font-medium">
                  {seg.text}
                </mark>
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )
          ) : docText}
        </div>
      </div>
    </div>
  );
}
