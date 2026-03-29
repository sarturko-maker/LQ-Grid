/** Text view with guaranteed offset-based highlighting.
 *  Renders the exact text the LLM read, with the exact passage highlighted. */
export function SourceView({ docText, sourceQuote, sourceStart, sourceEnd, zoom }: {
  docText: string;
  sourceQuote: string | null;
  sourceStart?: number;
  sourceEnd?: number;
  zoom: number;
}) {
  let before = docText, highlighted = '', after = '';

  // Offset-based: deterministic split
  if (sourceStart != null && sourceEnd != null &&
      sourceStart >= 0 && sourceEnd > sourceStart && sourceEnd <= docText.length) {
    before = docText.slice(0, sourceStart);
    highlighted = docText.slice(sourceStart, sourceEnd);
    after = docText.slice(sourceEnd);
  } else if (sourceQuote) {
    // Fallback: search for the quote string
    const idx = docText.indexOf(sourceQuote);
    if (idx >= 0) {
      before = docText.slice(0, idx);
      highlighted = docText.slice(idx, idx + sourceQuote.length);
      after = docText.slice(idx + sourceQuote.length);
    }
  }

  return (
    <div className="max-w-[700px] mx-auto bg-white shadow-lg rounded-lg overflow-hidden"
      style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}>
      <div className="p-10 min-h-[800px]">
        <div className="whitespace-pre-wrap text-sm leading-[1.8] text-slate-800
                        font-[Georgia,serif] tracking-[0.01em]">
          {highlighted ? (
            <>
              <span>{before}</span>
              <mark className="bg-yellow-200/80 text-slate-900 px-0.5 rounded
                               border-b-2 border-yellow-400 font-medium">{highlighted}</mark>
              <span>{after}</span>
            </>
          ) : docText}
        </div>
      </div>
    </div>
  );
}
