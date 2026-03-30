# LQ Grid

AI-powered bulk contract review. Drop contracts, get a structured grid with source-highlighted extractions.

Built on [Claude Code](https://claude.ai/claude-code) — Claude reads the contracts, extracts structured data, and powers an interactive review interface. Optionally uses [Isaacus](https://isaacus.com/) legal NLP models for faster extraction (Preview).

## Important Disclaimer

**This software is not legal advice.** LQ Grid is an AI-assisted tool that helps lawyers review documents more efficiently. It does not replace professional legal judgment.

- All AI-generated extractions must be verified by a qualified legal professional before being relied upon.
- The software may produce inaccurate, incomplete, or misleading outputs.
- No attorney-client relationship is created by using this software.
- The authors and contributors accept no liability for any decisions made based on outputs from this tool.
- Always consult a qualified solicitor or attorney for legal advice specific to your transaction.

**By using this software, you acknowledge that AI-generated contract analysis is inherently unreliable and must be independently verified.**

## What It Does

LQ Grid turns a folder of PDF and DOCX contracts into a structured, interactive review grid — the kind of spreadsheet M&A lawyers build manually over weeks.

- **Schema picker**: Choose from built-in extraction templates (M&A DD, consent review, GDPR) or define custom columns — previews show every column before you start
- **Two extraction engines**: Claude (Sonnet agents read full contracts) or Isaacus (Preview — legal NLP models, ~10x faster for structured fields)
- **Source highlighting**: Click any cell, click "View Source" — the original PDF or DOCX opens with the exact clause highlighted in yellow
- **Analyst chat**: Ask questions about the reviewed contracts in natural language
- **Counterparty profiles**: Click a counterparty name to see all their agreements, risk summary, and consent tracking
- **Document grouping**: Group related contracts (MSA + addendums) for combined analysis
- **Export**: Excel and CSV export with cell colouring

## Prerequisites

- [Claude Code](https://claude.ai/claude-code) (Claude Max subscription)
- [Bun](https://bun.sh/) (for the channel server)
- [Node.js](https://nodejs.org/) 18+ (for the UI)
- Python 3.10+ (for document conversion)
- [Isaacus API key](https://isaacus.com/) (optional — for the Isaacus extraction engine)

## Quick Start

```bash
# 1. Clone
git clone https://github.com/sarturko-maker/LQ-Grid.git
cd LQ-Grid

# 2. Install dependencies
pip install -r requirements.txt
cd src/ui && npm install && cd ../..

# 3. (Optional) Set up Isaacus for faster extraction
echo 'ISAACUS_API_KEY=iuak_v1_YOUR_KEY' > .env

# 4. Start the UI (keep this terminal open)
cd src/ui && npm run dev

# 5. In another terminal, start Claude Code with the channel
claude --dangerously-load-development-channels server:lq-ui-bridge
```

Open http://localhost:5173, drop your contracts, pick a schema (or define custom columns), choose your extraction engine, and click Start. The grid populates automatically.

## How It Works

```
  Contracts (PDF/DOCX)
         |
         v
  +--------------+     +------------------+
  | convert.py   | --> | Engine choice:   |
  | PDF/DOCX→txt |     |                  |
  +--------------+     | Claude (Sonnet)  |     +-----------+
                        |   Full-document  | --> | Grid UI   |
                        |   LLM extraction |     | React app |
                        |        OR        |     +-----------+
                        | Isaacus (Preview)|          |
                        |   Enrichment +   |          v
                        |   QA + Classify  |     View Source
                        +------------------+     Highlighted
                                                 in original
```

### Architecture

Claude Code is the extraction engine. The React UI communicates with Claude Code via an MCP channel server (`channel/ui-bridge.ts` + `channel/http-routes.ts`) on port 3002. The UI never calls an LLM directly — all intelligence goes through Claude Code.

**Claude engine** (default): Sonnet agents read full contract text and extract all columns. Thorough but slower for large batches.

**Isaacus engine** (Preview): Legal NLP models from [Isaacus](https://isaacus.com/). Enrichment for structured fields (counterparty, dates, jurisdiction), extractive QA for text fields, universal classification for boolean/enum fields. All documents are batched per column (~25 API calls instead of ~220). Much faster, but analytical fields (key risks, summaries) may have gaps.

### Extraction Schemas

Three built-in schemas, plus custom column support:

| Schema | Columns | Use Case |
|--------|---------|----------|
| `consent-review.json` | 15 | M&A change of control / consent review |
| `ma-dd-standard.json` | 14 | Standard M&A due diligence |
| `data-mapping.json` | 12 | GDPR data processing mapping |
| Custom | User-defined | Define your own columns at upload time |

The upload screen shows every column in each schema as preview pills, so you know exactly what you're getting before extraction starts.

### Source Highlighting

When Claude extracts a clause, it quotes the text verbatim. At display time, the UI finds the first and last words of the quote in the rendered PDF/DOCX and highlights everything between them. No LLM call at display time — highlighting is instant DOM manipulation.

- **PDF**: Overlay divs positioned over text layer spans
- **DOCX**: CSS Custom Highlight API with `<mark>` fallback
- **Text**: Direct character offset slicing

## Project Structure

```
LQ-Grid/
  CLAUDE.md                # Instructions for Claude Code
  requirements.txt         # Python dependencies
  .env                     # Isaacus API key (gitignored)
  channel/
    ui-bridge.ts           # MCP channel server (Bun)
    http-routes.ts         # HTTP route handlers (upload, clear, groups)
  src/
    pipeline/              # Python scripts
      convert.py           #   PDF/DOCX → plain text
      format_for_ui.py     #   Merge results → manifest (no LLM)
      isaacus_extract.py   #   Isaacus extraction pipeline (Preview)
      isaacus_strategies.py #  Batched QA, classification, enrichment
      group_documents.py   #   Document grouping by party/relationship
      export.py            #   Manifest → XLSX/CSV
      md_to_docx.py        #   Markdown → Word
      schema.py            #   Schema validation
    ui/                    # React app
      src/
        components/
          Grid/            #   DataGrid, cells, filters, headers
          Sidebar/         #   Cell detail, document viewer, profiles
          Chat/            #   Analyst chat
          Upload/          #   DropZone, SchemaPicker, CustomSchemaEditor
        hooks/             #   State management
        lib/               #   Utilities, highlighting, export
  templates/
    schemas/               # Extraction schemas (JSON)
    letters/               # Letter templates
  data/
    contracts/             # Drop your documents here
    output/                # Generated files (gitignored)
  .claude/
    agents/reviewer.md     # Reviewer teammate instructions
```

## Features

### Upload & Schema Selection
- Drag-and-drop or click to browse (PDF, DOCX, TXT)
- Schema picker with column preview pills for each template
- Custom schema editor — define your own extraction columns inline
- Engine toggle: Claude (thorough) or Isaacus (fast, Preview)

### Grid
- Column filters (dropdown for yes/no, text search for strings)
- Smart sorting (dates chronological, enums by severity)
- Resizable columns
- Text wrap toggle
- Row numbers
- Drag-to-reorder columns
- Semantic cell colouring (buyer's M&A perspective)
- Clear grid button to reset and start fresh

### Document Preview
- PDFs rendered with text layer (via pdf.js)
- DOCX rendered inline (via docx-preview)
- Source clause highlighting in the original document
- Download original file

### Counterparty Profiles
- All agreements with a counterparty in one view
- Auto-computed risk summary
- Editable fields: category, materiality, relationship owner
- Consent strategy: priority, approach, handling notes
- Notice tracker: status workflow from draft to received

### Document Grouping
- Group by relationship (MSA + addendums)
- Group by party (same counterparty)
- Combined extraction (later documents prevail)

### Deliverables
- Consent request letters (bespoke, clause-specific)
- Summary reports, board flags, disclosure schedules
- All generated as Word documents

## Configuration

### `.claude/agents/reviewer.md`

Controls how Claude extracts data. Each reviewer agent reads contract text files and returns JSON with:
- `value` — extracted data
- `source_quote` — verbatim clause text
- `source_location` — clause reference
- `source_start` / `source_end` — character offsets (optional, for precise highlighting)
- `confidence` — high / medium / low
- `notes` — explanations for ambiguous extractions

### `CLAUDE.md`

Full instructions for Claude Code — the extraction workflow, channel event handling, highlighting architecture, and project rules.

### `.env`

Isaacus API key for the Isaacus extraction engine (optional). This file is gitignored and never committed.

```
ISAACUS_API_KEY=iuak_v1_YOUR_KEY_HERE
```

## License

MIT License. See [LICENSE](LICENSE).

**Additional disclaimer**: This software is provided for informational and educational purposes only. It is not a substitute for professional legal advice. See the disclaimer at the top of this file.
