import type { Manifest, ConsentStatus } from '@/types';

export interface CounterpartySummary {
  name: string;
  rowIds: string[];
  contractTypes: string[];
  actions: string[];
  hasAssignment: boolean;
  hasCoc: boolean;
  mechanisms: string[];
}

/** Get unique counterparties with their agreements and risk summary. */
export function getUniqueCounterparties(manifest: Manifest | null): CounterpartySummary[] {
  if (!manifest) return [];
  const map = new Map<string, CounterpartySummary>();

  for (const row of manifest.rows) {
    const cp = row.cells.counterparty;
    const name = cp?.display || cp?.value;
    if (!name) continue;
    const key = normalizeName(name);

    if (!map.has(key)) {
      map.set(key, {
        name, rowIds: [], contractTypes: [], actions: [],
        hasAssignment: false, hasCoc: false, mechanisms: [],
      });
    }
    const s = map.get(key)!;
    s.rowIds.push(row._id);

    const ctype = row.cells.contract_type?.display || row.cells.contract_type?.value;
    if (ctype && !s.contractTypes.includes(ctype)) s.contractTypes.push(ctype);

    const action = row.cells.action?.value;
    if (action && !s.actions.includes(action)) s.actions.push(action);

    const mech = row.cells.mechanism?.value;
    if (mech && mech !== 'none' && !s.mechanisms.includes(mech)) s.mechanisms.push(mech);

    if (row.cells.assignment_found?.value === 'Yes') s.hasAssignment = true;
    if (row.cells.coc_found?.value === 'Yes') s.hasCoc = true;
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/[,.\s]+/g, ' ');
}

export function consentStatusLabel(status: ConsentStatus): string {
  const labels: Record<ConsentStatus, string> = {
    not_started: 'Not Started', letter_generated: 'Letter Ready',
    sent: 'Sent', awaiting_response: 'Awaiting Response',
    consent_received: 'Received', consent_refused: 'Refused',
    conditional: 'Conditional',
  };
  return labels[status];
}

export function consentStatusColor(status: ConsentStatus): string {
  const colors: Record<ConsentStatus, string> = {
    not_started: 'bg-slate-200 text-slate-600',
    letter_generated: 'bg-blue-100 text-blue-700',
    sent: 'bg-amber-100 text-amber-700',
    awaiting_response: 'bg-amber-100 text-amber-700',
    consent_received: 'bg-emerald-100 text-emerald-700',
    consent_refused: 'bg-red-100 text-red-700',
    conditional: 'bg-orange-100 text-orange-700',
  };
  return colors[status];
}
