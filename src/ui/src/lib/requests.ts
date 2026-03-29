/**
 * Request system — sends requests to the relay server.
 * The relay writes them to data/output/requests/ for Claude Code.
 */

import type { OutputType } from '@/types';

const RELAY_URL = 'http://localhost:3002/request';

export interface PendingRequest {
  id: string;
  type: 'add_column' | 'action' | 'query';
  status: 'pending' | 'sent' | 'failed';
  payload: Record<string, string>;
  created_at: string;
  prompt: string;
}

/** Send a request to the relay server */
async function sendToRelay(req: PendingRequest): Promise<boolean> {
  try {
    const resp = await fetch(RELAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    return resp.ok;
  } catch {
    console.warn('[requests] Relay not running. Start: python3 src/pipeline/relay.py');
    return false;
  }
}

/** Build prompt for column extraction */
function columnPrompt(prompt: string, outputType: string, model: string): string {
  return (
    `Add a new extraction column to the current review job.\n` +
    `User prompt: "${prompt}"\n` +
    `Output type: ${outputType}\n` +
    `Model: ${model}\n\n` +
    `Steps:\n` +
    `1. Generate a short column title from the prompt.\n` +
    `2. Spawn reviewer teammates to extract this column for ALL documents.\n` +
    `3. Merge results into data/output/results/.\n` +
    `4. Re-run format_for_ui.py to update ui-manifest.json.\n` +
    `5. Copy updated manifest to src/ui/public/data/output/ui-manifest.json.`
  );
}

/** Request to add a new column */
export async function requestAddColumn(
  prompt: string,
  outputType: OutputType,
  model: string
): Promise<PendingRequest> {
  const req: PendingRequest = {
    id: `col_${Date.now()}`,
    type: 'add_column',
    status: 'pending',
    payload: { prompt, outputType, model },
    created_at: new Date().toISOString(),
    prompt: columnPrompt(prompt, outputType, model),
  };
  const sent = await sendToRelay(req);
  req.status = sent ? 'sent' : 'failed';
  return req;
}

/** Request an action */
export async function requestAction(
  actionId: string,
  prompt: string
): Promise<PendingRequest> {
  const req: PendingRequest = {
    id: `act_${Date.now()}`,
    type: 'action',
    status: 'pending',
    payload: { actionId },
    created_at: new Date().toISOString(),
    prompt,
  };
  const sent = await sendToRelay(req);
  req.status = sent ? 'sent' : 'failed';
  return req;
}

/** Request a cross-table query */
export async function requestQuery(
  question: string
): Promise<PendingRequest> {
  const req: PendingRequest = {
    id: `q_${Date.now()}`,
    type: 'query',
    status: 'pending',
    payload: { question },
    created_at: new Date().toISOString(),
    prompt: (
      `Read data/output/ui-manifest.json.\n` +
      `Answer: "${question}"\n` +
      `Reference specific documents and provisions.`
    ),
  };
  const sent = await sendToRelay(req);
  req.status = sent ? 'sent' : 'failed';
  return req;
}

/** Request auto-grouping */
export async function requestAutoGroup(
  mode: 'relationship' | 'party'
): Promise<PendingRequest> {
  const prompt = mode === 'relationship'
    ? `Read data/output/ui-manifest.json and contract texts in data/output/texts/.\n` +
      `Identify related documents (master agreement + addendums, amendments, side letters).\n` +
      `Return JSON: [{ "name": "Group Name", "documents": ["row_id", ...] }]`
    : `Read data/output/ui-manifest.json.\n` +
      `Group documents sharing the same counterparty or corporate group.\n` +
      `Return JSON: [{ "name": "Party Name", "documents": ["row_id", ...] }]`;

  const req: PendingRequest = {
    id: `grp_${Date.now()}`,
    type: 'action',
    status: 'pending',
    payload: { actionId: `auto-group-${mode}` },
    created_at: new Date().toISOString(),
    prompt,
  };
  const sent = await sendToRelay(req);
  req.status = sent ? 'sent' : 'failed';
  return req;
}

/** Check if the relay server is running */
export async function isRelayRunning(): Promise<boolean> {
  try {
    await fetch(RELAY_URL, { method: 'OPTIONS' });
    return true;
  } catch {
    return false;
  }
}
