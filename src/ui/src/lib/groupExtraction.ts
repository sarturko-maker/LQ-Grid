/**
 * Request combined extraction for a document group.
 *
 * Sends a channel request to Claude Code asking it to read ALL documents
 * in the group together and extract the consent-review columns as a single
 * combined result — later documents (addendums, amendments) prevail over
 * earlier ones where they vary the terms.
 */

import type { Cell, Column } from '@/types';
import { pollResponse } from './actions';

const RELAY = 'http://localhost:3002';

export async function requestGroupExtraction(
  groupName: string,
  documentNames: string[],
  columns: Column[],
): Promise<Record<string, Cell>> {
  const reqId = `gex_${Date.now()}`;
  const colList = columns.map((c) => `- ${c.id}: ${c.prompt}`).join('\n');
  const docList = documentNames.map((d) => `data/output/texts/${d}`).join('\n');

  const prompt =
    `GROUPED EXTRACTION: "${groupName}"\n\n` +
    `Read ALL of these documents together as a single contractual relationship:\n${docList}\n\n` +
    `These documents form a group (e.g. master agreement + addendums/amendments). ` +
    `Where a later document amends or varies a term in an earlier document, ` +
    `the LATER document prevails. Analyse them as a whole.\n\n` +
    `Extract these fields for the GROUP (not per document):\n${colList}\n\n` +
    `Return ONLY a raw JSON object (no markdown, no code fences) with this structure:\n` +
    `{ "field_id": { "value": "...", "display": "...", "source_quote": "...", ` +
    `"source_location": "Document + Clause", "confidence": "high|medium|low", ` +
    `"status": "complete", "notes": "..." } }`;

  await fetch(`${RELAY}/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: reqId,
      type: 'action',
      payload: { actionId: 'group-extraction', groupName },
      prompt,
    }),
  });

  const result = await pollResponse(reqId, 180000);
  if (result.status !== 'done' || !result.data) {
    throw new Error('Group extraction timed out');
  }

  return parseCellsFromResponse(result.data);
}

function parseCellsFromResponse(data: unknown): Record<string, Cell> {
  let text = '';
  if (typeof data === 'object' && data !== null && 'answer' in data) {
    text = String((data as { answer: string }).answer);
  } else if (typeof data === 'string') {
    text = data;
  } else {
    text = JSON.stringify(data);
  }

  // Try raw JSON
  try {
    const obj = JSON.parse(text);
    if (typeof obj === 'object' && !Array.isArray(obj)) return obj;
  } catch { /* not raw */ }

  // Extract from code block
  const block = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (block) {
    try { return JSON.parse(block[1]); } catch { /* bad */ }
  }

  // Find JSON object
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch { /* bad */ }
  }

  throw new Error('Could not parse extraction results');
}
