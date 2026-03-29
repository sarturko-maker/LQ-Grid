/**
 * Bridge between the React UI and Claude Code.
 *
 * sendPrompt() is globally available in Claude Code artifacts.
 * The UI never calls an LLM directly — all intelligence goes
 * through Claude Code via this bridge.
 */

import type { OutputType } from '@/types';

declare function sendPrompt(text: string): void;

/** Check if we're running inside Claude Code */
export function isClaudeCodeEnvironment(): boolean {
  return typeof sendPrompt === 'function';
}

function send(text: string): void {
  if (isClaudeCodeEnvironment()) {
    sendPrompt(text);
  } else {
    console.log('[bridge] sendPrompt not available. Would send:', text);
  }
}

/** System prompt fragments for each output type */
const OUTPUT_TYPE_PROMPTS: Record<OutputType, string> = {
  verbatim:
    'Extract the EXACT text from the document. Quote the relevant clause ' +
    'VERBATIM — do not paraphrase or summarise. Include the full clause text.',
  summary:
    'Provide a concise summary of the relevant provision in 1-3 sentences. ' +
    'Focus on the key commercial/legal effect. Do NOT quote verbatim.',
  classification:
    'Answer with ONLY "Yes" or "No". Then provide a brief explanation. ' +
    'The value field must be exactly "Yes" or "No".',
  date:
    'Extract the date and format it as DD Month YYYY (e.g. 15 March 2024). ' +
    'If no exact date is found, state what is available.',
};

/** Get the system prompt fragment for an output type */
export function getOutputTypePrompt(outputType: OutputType): string {
  return OUTPUT_TYPE_PROMPTS[outputType];
}

/** Add a new column with output type and run extraction */
export function addColumn(
  prompt: string,
  outputType: OutputType,
  model: string
): void {
  const typeInstruction = getOutputTypePrompt(outputType);

  send(
    `Add a new extraction column to the current review job.\n` +
    `User prompt: "${prompt}"\n` +
    `Output type: ${outputType}\n` +
    `Output type instruction: ${typeInstruction}\n` +
    `Model to use: ${model}\n\n` +
    `Steps:\n` +
    `1. Generate an appropriate short column title from the prompt.\n` +
    `2. Add the column to the schema.\n` +
    `3. Spawn reviewer teammates to extract this column for all documents.\n` +
    `4. Write results to data/output/results/.\n` +
    `5. Run format_for_ui.py to update data/output/ui-manifest.json.\n` +
    `6. Tell me when the UI is ready to refresh.`
  );
}

/** Run full extraction for all documents and columns */
export function runFullExtraction(model: string): void {
  send(
    `Run full extraction for all documents and all columns.\n` +
    `Model to use: ${model}\n` +
    `Write results to data/output/results/.\n` +
    `Then run format_for_ui.py to update ui-manifest.json.`
  );
}

/** Ask a cross-table question */
export function crossTableQuery(question: string): void {
  send(
    `Read data/output/ui-manifest.json.\n` +
    `Answer this question about the reviewed documents: "${question}"\n` +
    `Reference specific documents in your answer.`
  );
}

/** Convert documents in data/contracts/ */
export function convertDocuments(): void {
  send(
    `Convert all documents in data/contracts/ to plain text.\n` +
    `Run: python3 src/pipeline/convert.py --input data/contracts/ ` +
    `--output data/output/texts/`
  );
}

/** Export results to a file format */
export function exportResults(format: 'xlsx' | 'csv'): void {
  send(
    `Export review results to ${format.toUpperCase()}.\n` +
    `Run: python3 src/pipeline/export.py ` +
    `--manifest data/output/ui-manifest.json ` +
    `--format ${format} ` +
    `--verification data/output/verification.json`
  );
}

/** Draft consent request letters for flagged contracts */
export function draftConsentLetters(): void {
  send(
    `Read data/output/ui-manifest.json and data/output/verification.json.\n` +
    `For every contract where the "action" column value is "obtain_consent":\n` +
    `1. Get the counterparty name, contract type, date, and notice address.\n` +
    `2. Using the template at templates/letters/consent-request.md,\n` +
    `   draft a personalised consent request letter.\n` +
    `3. Save each letter to data/output/letters/consent-[counterparty].md.\n` +
    `List all generated letters when done.`
  );
}

/** Draft notification letters */
export function draftNotificationLetters(): void {
  send(
    `Read data/output/ui-manifest.json and data/output/verification.json.\n` +
    `For every contract where the "action" column value is "send_notification":\n` +
    `1. Get the counterparty name, contract type, date, and notice address.\n` +
    `2. Using the template at templates/letters/notification.md,\n` +
    `   draft a personalised notification letter.\n` +
    `3. Save each letter to data/output/letters/notification-[counterparty].md.\n` +
    `List all generated letters when done.`
  );
}

/** Generate a summary report for client */
export function generateSummaryReport(): void {
  send(
    `Read data/output/ui-manifest.json.\n` +
    `Generate a client-ready summary report covering:\n` +
    `- Total contracts reviewed and breakdown by type\n` +
    `- Contracts requiring consent (list with counterparty and mechanism)\n` +
    `- Contracts requiring notification only\n` +
    `- Contracts with no action required\n` +
    `- Key risks and recommendations\n` +
    `Save to data/output/reports/summary-report.md.`
  );
}

/** Flag contracts that need board approval */
export function flagBoardApproval(): void {
  send(
    `Read data/output/ui-manifest.json.\n` +
    `Identify contracts that may require board-level approval based on:\n` +
    `- Material contracts (high value or strategic importance)\n` +
    `- Contracts with termination rights on change of control\n` +
    `- Contracts with restrictive covenants (non-compete)\n` +
    `List them with reasoning and save to data/output/reports/board-flags.md.`
  );
}

/** Generate disclosure schedule entries */
export function generateDisclosureSchedule(): void {
  send(
    `Read data/output/ui-manifest.json.\n` +
    `Draft disclosure schedule entries for each material contract:\n` +
    `- Contract description (parties, type, date)\n` +
    `- Key provisions that require disclosure\n` +
    `- Any consents or approvals needed\n` +
    `Format suitable for inclusion in an SPA disclosure letter.\n` +
    `Save to data/output/reports/disclosure-schedule.md.`
  );
}

/** Auto-group by document relationship (MSA + addendums/amendments) */
export function autoGroupByRelationship(): void {
  send(
    `Read data/output/ui-manifest.json and the contract texts in data/output/texts/.\n` +
    `Identify related documents (e.g. a master agreement and its addendums,\n` +
    `amendments, side letters, or subordinate agreements).\n` +
    `Return JSON array of groups: [{ "name": "...", "documents": ["row_id", ...] }]`
  );
}

/** Auto-group by counterparty (same party across multiple contracts) */
export function autoGroupByParty(): void {
  send(
    `Read data/output/ui-manifest.json.\n` +
    `Group documents that share the same counterparty (or related entities\n` +
    `within the same corporate group).\n` +
    `Return JSON array of groups: [{ "name": "...", "documents": ["row_id", ...] }]`
  );
}
