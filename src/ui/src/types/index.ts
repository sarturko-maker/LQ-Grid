/** Job metadata from ui-manifest.json */
export interface Job {
  name: string;
  task: string;
  created_at: string;
  document_count: number;
  column_count: number;
}

/** Summary statistics */
export interface Summary {
  total_cells: number;
  complete: number;
  failed: number;
  pending: number;
  verified: number;
  flagged: number;
}

/** How the column should format its output */
export type OutputType = 'verbatim' | 'summary' | 'classification' | 'date';

/** Column definition */
export interface Column {
  id: string;
  label: string;
  prompt: string;
  type: 'string' | 'date' | 'boolean' | 'number' | 'enum' | 'list';
  outputType?: OutputType;
  sortable: boolean;
  filterable: boolean;
  group: string | null;
}

/** A single source reference for highlighting */
export interface SourceRef {
  quote: string;
  start?: number;
  end?: number;
  location?: string;
}

/** Cell data for a single extraction */
export interface Cell {
  value: string | null;
  display: string;
  source_quote: string | null;
  source_location: string | null;
  /** Character offset (start) into the plain text file — deterministic highlighting */
  source_start?: number;
  /** Character offset (end) into the plain text file */
  source_end?: number;
  /** Multiple source quotes for synthesized/analysis fields */
  source_quotes?: SourceRef[];
  confidence: 'high' | 'medium' | 'low';
  status: 'complete' | 'failed' | 'pending';
  notes: string | null;
}

/** A row representing one document */
export interface Row {
  _id: string;
  _document: string;
  _status: 'complete' | 'failed' | 'pending';
  _group?: string;
  cells: Record<string, Cell>;
}

/** Document group — an analytical unit combining multiple related contracts */
export interface DocumentGroup {
  id: string;
  name: string;
  documents: string[];
  isExpanded: boolean;
  status: 'pending' | 'extracting' | 'complete' | 'error';
  cells?: Record<string, Cell>;
}

/** The full ui-manifest.json structure */
export interface Manifest {
  schema_version: string;
  job: Job;
  summary: Summary;
  columns: Column[];
  rows: Row[];
}

/** Verification entry for a single cell */
export interface VerificationEntry {
  status: 'verified' | 'flagged' | 'pending';
  note: string | null;
  override: string | null;
}

/** The full verification.json structure */
export interface Verification {
  job_name: string;
  updated_at: string;
  cells: Record<string, VerificationEntry>;
}

/** Which cell is currently selected in the grid */
export interface SelectedCell {
  rowId: string;
  colId: string;
}

/** Available AI models */
export interface ModelOption {
  id: string;
  name: string;
  description: string;
}

/** An action that can be triggered from the grid */
export interface Action {
  id: string;
  label: string;
  description: string;
  icon: string;
  /** Which column types / values make this action relevant */
  condition: (manifest: Manifest) => boolean;
}

/** Counterparty category */
export type CounterpartyCategory = 'customer' | 'supplier' | 'landlord' | 'jv' | 'other';

/** Materiality level */
export type Materiality = 'high' | 'medium' | 'low';

/** Consent notice workflow status */
export type ConsentStatus =
  | 'not_started' | 'letter_generated' | 'sent'
  | 'awaiting_response' | 'consent_received' | 'consent_refused' | 'conditional';

/** Notice tracker for a counterparty */
export interface NoticeTracker {
  status: ConsentStatus;
  sentDate: string | null;
  method: 'email' | 'courier' | 'hand' | null;
  responseDate: string | null;
  conditions: string | null;
  letterFile: string | null;
}

/** Consent strategy */
export interface ConsentStrategy {
  priority: 1 | 2 | 3 | 4 | 5;
  approach: 'pre-signing' | 'post-signing' | 'not_required';
  handlingNotes: string;
}

/** Full counterparty profile (persisted in localStorage) */
export interface CounterpartyProfile {
  name: string;
  category: CounterpartyCategory | null;
  materiality: Materiality | null;
  relationshipOwner: string;
  revenueValue: string;
  notes: string;
  strategy: ConsentStrategy;
  notice: NoticeTracker;
  updatedAt: string;
}

/** Sidebar display mode */
export type SidebarMode =
  | 'none'
  | 'cell-detail'
  | 'column-editor'
  | 'chat'
  | 'document-preview'
  | 'actions'
  | 'grouping'
  | 'counterparty-profile'
  | 'counterparty-list';
