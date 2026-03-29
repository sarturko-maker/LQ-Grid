/**
 * Highlight a text passage in a DOM container.
 *
 * Strategy: extract the first ~5 words and last ~5 words of the quote,
 * find them in the DOM text, highlight everything between.
 */

const HIGHLIGHT_NAME = 'source-quote';
const MARK_CLASS = 'lq-source-highlight';

interface HighlightParams {
  container: HTMLElement;
  quote?: string | null;
  plainText?: string | null;
  sourceStart?: number;
  sourceEnd?: number;
  /** Force <mark> injection instead of CSS Custom Highlight API (needed for PDF text layers) */
  forceMarks?: boolean;
}

export function highlightInContainer(params: HighlightParams): boolean {
  const { container, quote, plainText, sourceStart, sourceEnd } = params;
  clearHighlight(container);
  if (!container) return false;

  let searchText: string | null = null;
  if (plainText && sourceStart != null && sourceEnd != null &&
      sourceStart >= 0 && sourceEnd > sourceStart && sourceEnd <= plainText.length) {
    searchText = plainText.slice(sourceStart, sourceEnd);
  }
  if (!searchText && quote) searchText = quote;
  if (!searchText || searchText.length < 5) return false;

  const { fullText, nodeMap } = collectTextNodes(container);
  const normFull = norm(fullText);
  const normQuote = norm(searchText);

  // Extract word-based anchors
  const words = normQuote.split(/\s+/);
  if (words.length === 0) return false;

  const startAnchor = words.slice(0, Math.min(5, words.length)).join(' ');
  const endAnchor = words.slice(Math.max(0, words.length - 5)).join(' ');

  // Find start anchor
  const startIdx = normFull.indexOf(startAnchor);
  if (startIdx === -1) return false;

  // Find end anchor after the start
  let endIdx: number;
  if (words.length <= 10) {
    // Short quote — end is start + full match
    const fullMatch = normFull.indexOf(normQuote, startIdx);
    endIdx = fullMatch !== -1 ? fullMatch + normQuote.length : startIdx + normQuote.length;
  } else {
    const searchAfter = startIdx + startAnchor.length;
    const endAnchorIdx = normFull.indexOf(endAnchor, searchAfter);
    endIdx = endAnchorIdx !== -1
      ? endAnchorIdx + endAnchor.length
      : startIdx + Math.min(normQuote.length, normFull.length - startIdx);
  }

  // Map to original positions
  const posMap = buildPosMap(fullText);
  if (posMap.length === 0) return false;
  const origStart = posMap[Math.min(startIdx, posMap.length - 1)];
  const origEnd = (posMap[Math.min(endIdx - 1, posMap.length - 1)] ?? origStart) + 1;

  const ranges = buildRanges(nodeMap, origStart, origEnd);
  if (ranges.length === 0) return false;

  if (!params.forceMarks && 'highlights' in CSS) {
    (CSS as any).highlights.set(HIGHLIGHT_NAME, new Highlight(...ranges));
  } else {
    injectMarks(ranges);
  }

  ranges[0].startContainer.parentElement
    ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return true;
}

export function clearHighlight(container?: HTMLElement): void {
  if ('highlights' in CSS) (CSS as any).highlights.delete(HIGHLIGHT_NAME);
  container?.querySelectorAll(`mark.${MARK_CLASS}`).forEach((m) =>
    m.replaceWith(...m.childNodes));
}

function norm(s: string): string {
  return s.replace(/[\u00A0\u200B\u00AD\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ').toLowerCase().trim();
}

function collectTextNodes(container: HTMLElement) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodeMap: Array<{ node: Text; start: number }> = [];
  let fullText = '';
  let node: Text | null;
  while ((node = walker.nextNode() as Text)) {
    nodeMap.push({ node, start: fullText.length });
    fullText += node.textContent || '';
  }
  return { fullText, nodeMap };
}

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

function buildRanges(nodeMap: Array<{ node: Text; start: number }>,
  absStart: number, absEnd: number): Range[] {
  const ranges: Range[] = [];
  for (const { node, start } of nodeMap) {
    const nodeEnd = start + (node.textContent?.length || 0);
    if (nodeEnd <= absStart || start >= absEnd) continue;
    const range = new Range();
    range.setStart(node, Math.max(0, absStart - start));
    range.setEnd(node, Math.min(node.textContent!.length, absEnd - start));
    ranges.push(range);
  }
  return ranges;
}

function injectMarks(ranges: Range[]): void {
  for (let i = ranges.length - 1; i >= 0; i--) {
    try {
      const mark = document.createElement('mark');
      mark.className = MARK_CLASS;
      mark.style.backgroundColor = 'rgba(250, 204, 21, 0.5)';
      mark.style.borderBottom = '2px solid rgb(234, 179, 8)';
      mark.appendChild(ranges[i].extractContents());
      ranges[i].insertNode(mark);
    } catch { /* boundary issues */ }
  }
}
