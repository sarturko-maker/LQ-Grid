# LQ Grid

Bulk contract review for M&A lawyers. Upload contracts, define
extraction columns, review results interactively, generate deliverables.

## Quick Start

```bash
# 1. Install Python deps
pip install -r requirements.txt

# 2. Install UI deps
cd src/ui && npm install && cd ../..

# 3. Start Claude Code with channel server
claude --dangerously-load-development-channels server:lq-ui-bridge

# 4. In another terminal, start the UI
cd src/ui && npm run dev
```

## Full Extraction Workflow

When pointed to a folder of contracts:

1. **Convert** documents to plain text:
   ```
   python3 src/pipeline/convert.py --input data/contracts/ --output data/output/texts/
   ```

2. **Copy originals** to UI public dir (for PDF/DOCX preview):
   ```
   mkdir -p src/ui/public/data/contracts
   cp data/contracts/*.pdf data/contracts/*.docx src/ui/public/data/contracts/
   ```

3. **Choose schema** — pick the right extraction template:
   - `templates/schemas/consent-review.json` — 11 columns (assignment, CoC, mechanism, action)
   - `templates/schemas/ma-dd-standard.json` — 14 columns (broader DD)
   - `templates/schemas/data-mapping.json` — 12 columns (GDPR)

4. **Extract** — spawn Sonnet reviewer agents in batches of 5 documents.
   Each agent reads the contract texts and returns structured JSON with:
   - `value`, `source_quote` (verbatim), `source_location` (clause ref)
   - `source_start`, `source_end` (character offsets for highlighting)
   - `confidence`, `notes`

   Write results to `data/output/results/batch-NNN.json`.

5. **Build manifest**:
   ```
   python3 src/pipeline/format_for_ui.py \
     --results data/output/results/ \
     --schema templates/schemas/consent-review.json \
     --output data/output/ui-manifest.json \
     --contracts data/contracts/
   cp data/output/ui-manifest.json src/ui/public/data/output/ui-manifest.json
   ```

6. The UI auto-refreshes every 3 seconds from the manifest.

## Architecture

Claude Code IS the extraction engine. No separate API key.
Claude Max subscription powers everything.

### UI ↔ Claude Code communication (Channels)

The React UI communicates with Claude Code via an MCP channel server.
The channel server (channel/ui-bridge.ts) runs on port 3002:
- Receives HTTP POSTs from the UI
- Pushes them into the CC session as `<channel>` events
- Exposes a `reply` tool for CC to send responses back
- Serves generated files (letters, reports) for download

### Data flow

1. Documents dropped into data/contracts/
2. convert.py → plain text in data/output/texts/
3. **Copy originals to src/ui/public/data/contracts/** (for PDF/DOCX preview)
4. Claude Code spawns Sonnet reviewer agents to extract structured data
5. Results written to data/output/results/ (one JSON per batch)
6. format_for_ui.py merges all batches → ui-manifest.json
7. Copy manifest to src/ui/public/data/output/ui-manifest.json
8. React UI auto-refreshes every 3 seconds

## Responding to channel events

When a `<channel source="lq-ui-bridge">` event arrives, parse the JSON.

### type: "upload" (Contracts uploaded via UI)

The user dropped contracts into the UI. The files are already saved to
data/contracts/ and src/ui/public/data/contracts/.

1. Run `python3 src/pipeline/convert.py --input data/contracts/ --output data/output/texts/`
2. Spawn Sonnet reviewer agents (batches of 5) to extract all columns
3. Run format_for_ui.py to build the manifest
4. Copy manifest to src/ui/public/data/output/ui-manifest.json
5. Reply confirming how many documents were processed

### type: "query" (Analyst chat)

1. Read data/output/ui-manifest.json
2. Answer as an **experienced M&A solicitor**
3. Use the **reply** tool with the request_id
4. Format in Markdown (tables need proper GFM syntax)
5. Use **Sonnet** model for queries

### type: "add_column"

1. Read the prompt and outputType from payload
2. Generate a short column title
3. Add to schema
4. Spawn Sonnet reviewers for ALL documents in data/output/texts/
5. Write results to data/output/results/batch-NNN-columnname.json
6. Run format_for_ui.py and copy manifest to UI public dir
7. Reply confirming completion

### type: "action"

1. Read the actionId from payload
2. For **consent-letters**: Read ACTUAL contracts, draft bespoke letters
3. For **reports**: Generate report, save as .md → convert to .docx
4. Reply confirming what was generated

## Source Highlighting

The crown jewel feature. When a user clicks "View Source" on a cell,
the original PDF or DOCX opens with the exact clause highlighted.

### How it works

**At extraction time (Sonnet):**
- Returns `source_quote` (verbatim text from the document)
- Optionally returns `source_start`/`source_end` (char offsets into .txt file)

**At display time (code, instant — no LLM call):**
- Takes first 5 words of quote as **start anchor**
- Takes last 5 words as **end anchor**
- Searches rendered PDF/DOCX DOM for anchors
- Highlights everything between start and end

**PDF**: Overlay `<div>` elements positioned over text layer spans using
`getBoundingClientRect()`. MutationObserver watches for lazy-loaded pages.

**DOCX**: CSS Custom Highlight API with TreeWalker + `<mark>` fallback.
Auto-scales via ResizeObserver to fit sidebar width.

**Text**: Direct offset-based `slice()` when offsets available.

## Key Features

### Document Grouping
- **By Relationship**: MSA + addendums/amendments analysed as one unit
- **By Party**: Same counterparty across multiple contracts
- Groups get combined extraction (most restrictive provision prevails)
- Stored in localStorage

### Counterparty Profiles
- Click any counterparty name → profile panel opens
- Risk summary (auto from extraction), agreements list
- Editable: category, materiality, relationship owner, revenue, notes
- Consent strategy: priority (1-5), approach (pre/post-signing)
- Notice tracker: status workflow from Not Started → Consent Received

### Grid Features
- Column filters (dropdown for boolean/enum, text search for string)
- Smart sorting (dates chronological, booleans Yes-first, enums by severity)
- Resizable columns (drag right edge of header)
- Text wrap toggle (like Excel — row expands to fit)
- Row numbers
- Drag-to-reorder columns
- Semantic cell colouring (buyer's M&A perspective)

### Document Preview
- PDFs render via @react-pdf-viewer with text layer highlighting
- DOCX render via docx-preview with auto-scaling
- Vite plugin serves .docx files (bypasses SPA fallback)
- Download original button

## Key Files

### Channel
- channel/ui-bridge.ts — MCP channel server (Bun + @modelcontextprotocol/sdk)
- .mcp.json — registers the channel with Claude Code

### Pipeline (Python)
- src/pipeline/convert.py — PDF/DOCX/TXT → plain text
- src/pipeline/format_for_ui.py — merge results → ui-manifest.json (deterministic, NO LLM)
- src/pipeline/export.py — ui-manifest → XLSX/CSV
- src/pipeline/schema.py — schema validation
- src/pipeline/md_to_docx.py — Markdown → DOCX (Calibri 11pt)

### UI (React + TypeScript + TanStack Table + Tailwind v4)
- src/ui/src/App.tsx — main app, sidebar routing
- src/ui/src/components/Grid/ — DataGrid, GridCell, GridHeader, GridToolbar, ColumnFilter, GroupRow, ChildRow, ConsentBadge, buildColumns
- src/ui/src/components/Sidebar/ — CellDetail, ColumnEditor, ActionsPanel, DocumentView, DocxViewer, PdfViewer, SourceView, GroupPanel, GroupCard, CounterpartyProfile, CounterpartyList, ProfileFields, NoticeTrackerSection, AnalystChat
- src/ui/src/hooks/ — useManifest, useVerification, useSidebar, usePendingColumns, useGrouping, useCounterparties
- src/ui/src/lib/ — requests, actions, exportData, models, bridge, groupExtraction, parseGroups, counterpartyUtils, highlightText

### Data
- data/contracts/ — source documents (PDF and DOCX)
- data/output/texts/ — converted plain text
- data/output/results/ — extraction JSON (one file per batch)
- data/output/ui-manifest.json — what the UI reads
- data/output/responses/ — channel reply files
- data/output/letters/ — generated consent letters (.docx)
- data/output/reports/ — generated reports (.docx)

### Templates
- templates/schemas/consent-review.json — 11 columns (M&A consent review)
- templates/schemas/ma-dd-standard.json — 14 columns (standard DD)
- templates/schemas/data-mapping.json — 12 columns (GDPR)

### Config
- .claude/agents/reviewer.md — reviewer teammate instructions
- .claude/settings.json — PostToolUse hook for pending UI requests
- requirements.txt — Python dependencies
- src/ui/vite.config.ts — Vite config with DOCX serving plugin

## Cell Colour Logic (buyer's M&A perspective)

- Assignment restricted = **amber** (we need consent)
- No restriction = **green** (all clear)
- Change of control present = **amber** (triggered by our deal)
- No CoC = **green**
- Mechanism: consent = **amber**, termination_right = **red**, notification = **blue**, none = **green**
- Action: obtain_consent = **amber**, flag_for_review = **red**, send_notification = **blue**, no_action = **green**
- Non-compete present = **amber** (risk)

## Column Output Types

- **verbatim**: "Extract the EXACT text. Quote the clause VERBATIM."
- **summary**: "Provide a concise summary in 1-3 sentences."
- **classification**: "Answer with ONLY Yes or No."
- **date**: "Extract the date as DD Month YYYY."

## Rules

- No source file over 200 lines. Split if approaching.
- format_for_ui.py is DETERMINISTIC — no LLM calls.
- The UI never calls an LLM. All intelligence goes through Claude Code.
- All generated letters must be DOCX (lawyers use Word).
- Letters must be bespoke — read the actual contract, quote specific clauses.
- Analyst answers must be legally accurate with proper subtlety.
- Always copy updated manifest to src/ui/public/data/output/ui-manifest.json.
- Always copy contract files to src/ui/public/data/contracts/.
- Use Sonnet for extraction and queries. Opus only when explicitly requested.
