# LQ Grid

AI-powered bulk contract review. Drop contracts, get a structured grid with source-highlighted extractions.

Built on [Claude Code](https://claude.ai/claude-code) — Claude reads the contracts, extracts structured data, and powers an interactive review interface.

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

- **Extraction**: Claude reads each contract and extracts structured fields (counterparty, assignment clauses, change of control, governing law, etc.)
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

## Quick Start

```bash
# 1. Clone
git clone https://github.com/sarturko-maker/LQ-Grid.git
cd LQ-Grid

# 2. Install dependencies
pip install -r requirements.txt
cd src/ui && npm install && cd ../..

# 3. Start the UI (keep this terminal open)
cd src/ui && npm run dev

# 4. In another terminal, start Claude Code with the channel
claude --dangerously-load-development-channels server:lq-ui-bridge

# 5. Drop your contracts into data/contracts/ and tell Claude:
```

```
I have contracts in data/contracts/. Review them for M&A consent
and change of control issues. Use the consent-review schema.
```

Claude converts the documents, extracts data in parallel using Sonnet, builds the grid, and the UI populates automatically at http://localhost:5173.

## How It Works

```
  Contracts (PDF/DOCX)
         |
         v
  +--------------+     +------------------+     +-----------+
  | convert.py   | --> | Claude (Sonnet)  | --> | Grid UI   |
  | PDF/DOCX→txt |     | Extract fields   |     | React app |
  +--------------+     | Quote verbatim   |     +-----------+
                        | Return offsets   |          |
                        +------------------+          v
                                                 Click cell
                                                     |
                                                     v
                                              +-------------+
                                              | View Source  |
                                              | Highlighted  |
                                              | in original  |
                                              | PDF or DOCX  |
                                              +-------------+
```

### Architecture

Claude Code is the extraction engine. The React UI communicates with Claude Code via an MCP channel server on port 3002. The UI never calls an LLM directly — all intelligence goes through Claude Code.

### Extraction Schemas

Three built-in schemas for different review types:

| Schema | Columns | Use Case |
|--------|---------|----------|
| `consent-review.json` | 11 | M&A change of control / consent review |
| `ma-dd-standard.json` | 14 | Standard M&A due diligence |
| `data-mapping.json` | 12 | GDPR data processing mapping |

### Source Highlighting

When Claude extracts a clause, it quotes the text verbatim. At display time, the UI finds the first and last words of the quote in the rendered PDF/DOCX and highlights everything between them. No LLM call at display time — highlighting is instant DOM manipulation.

- **PDF**: Overlay divs positioned over text layer spans
- **DOCX**: CSS Custom Highlight API with `<mark>` fallback
- **Text**: Direct character offset slicing

## Project Structure

```
LQ-Grid/
  CLAUDE.md              # Instructions for Claude Code
  requirements.txt       # Python dependencies
  channel/
    ui-bridge.ts         # MCP channel server (Bun)
  src/
    pipeline/            # Python scripts
      convert.py         #   PDF/DOCX → plain text
      format_for_ui.py   #   Merge results → manifest (no LLM)
      export.py          #   Manifest → XLSX/CSV
      md_to_docx.py      #   Markdown → Word
      schema.py          #   Schema validation
    ui/                  # React app
      src/
        components/
          Grid/          #   DataGrid, cells, filters, headers
          Sidebar/       #   Cell detail, document viewer, profiles
          Chat/          #   Analyst chat
          Upload/        #   Drag-and-drop zone
        hooks/           #   State management
        lib/             #   Utilities, highlighting, export
  templates/
    schemas/             # Extraction schemas (JSON)
    letters/             # Letter templates
  data/
    contracts/           # Drop your documents here
    output/              # Generated files (gitignored)
  .claude/
    agents/reviewer.md   # Reviewer teammate instructions
```

## Features

### Grid
- Column filters (dropdown for yes/no, text search for strings)
- Smart sorting (dates chronological, enums by severity)
- Resizable columns
- Text wrap toggle
- Row numbers
- Drag-to-reorder columns
- Semantic cell colouring (buyer's M&A perspective)

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

## License

MIT License. See [LICENSE](LICENSE).

**Additional disclaimer**: This software is provided for informational and educational purposes only. It is not a substitute for professional legal advice. See the disclaimer at the top of this file.
