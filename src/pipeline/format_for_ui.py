#!/usr/bin/env python3
"""
Deterministic formatter: raw extraction results -> ui-manifest.json

Validates, normalises, enriches with UI metadata.
This is the quality gate. If the LLM returned garbage,
this script catches it before the UI sees it.

NO LLM CALLS. Pure validation and normalisation.

Usage:
    python3 format_for_ui.py \
        --results data/output/results/ \
        --schema schema.json \
        --output data/output/ui-manifest.json
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

from schema import load_schema


def load_results(results_dir: Path) -> list[dict]:
    """Load all result JSON files and merge by document name.

    When multiple batches extract different columns for the same
    document, their fields are merged into a single result dict.
    """
    by_doc: dict[str, dict] = {}

    for filepath in sorted(results_dir.glob("*.json")):
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        items = data if isinstance(data, list) else [data]

        for item in items:
            doc_name = item.get("_document", "unknown")
            if doc_name in by_doc:
                # Merge fields — later batches add new columns
                for key, val in item.items():
                    if key != "_document":
                        by_doc[doc_name][key] = val
            else:
                by_doc[doc_name] = dict(item)

    return list(by_doc.values())


def normalise_confidence(raw: str | None) -> str:
    """Normalise confidence to high/medium/low."""
    if not raw:
        return "low"
    lower = str(raw).strip().lower()
    if lower in ("high", "h"):
        return "high"
    if lower in ("medium", "med", "m"):
        return "medium"
    return "low"


def determine_cell_status(cell: dict) -> str:
    """Determine cell status from extraction data."""
    value = cell.get("value")
    if value is None or (isinstance(value, str) and not value.strip()):
        return "failed"
    return "complete"


def determine_cell_confidence(cell: dict) -> str:
    """Determine display confidence from cell data."""
    raw_conf = normalise_confidence(cell.get("confidence"))
    has_quote = bool(cell.get("source_quote"))
    has_notes = bool(cell.get("notes"))

    if raw_conf == "high" and has_quote:
        return "high"
    if has_quote and not has_notes:
        return "medium" if raw_conf == "low" else raw_conf
    if has_notes:
        return "low"
    return raw_conf


def format_value(value, col_type: str) -> str | None:
    """Format a value based on column type."""
    if value is None:
        return None

    str_val = str(value).strip()
    if not str_val:
        return None

    if col_type == "boolean":
        lower = str_val.lower()
        if lower in ("true", "yes", "1", "y"):
            return "Yes"
        if lower in ("false", "no", "0", "n"):
            return "No"
        return str_val

    if col_type == "date":
        # Try to normalise to ISO 8601
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%B %d, %Y"):
            try:
                dt = datetime.strptime(str_val, fmt)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue
        return str_val  # Return as-is if no format matches

    return str_val


def build_cell(raw_cell: dict, col_type: str) -> dict:
    """Build a UI cell from raw extraction data."""
    value = raw_cell.get("value")
    formatted = format_value(value, col_type)

    cell = {
        "value": formatted,
        "display": formatted or "—",
        "source_quote": raw_cell.get("source_quote"),
        "source_location": raw_cell.get("source_location"),
        "confidence": determine_cell_confidence(raw_cell),
        "status": determine_cell_status(raw_cell),
        "notes": raw_cell.get("notes"),
    }
    # Pass through character offsets if present
    if raw_cell.get("source_start") is not None:
        cell["source_start"] = raw_cell["source_start"]
    if raw_cell.get("source_end") is not None:
        cell["source_end"] = raw_cell["source_end"]
    # Pass through multiple source quotes if present
    if raw_cell.get("source_quotes"):
        cell["source_quotes"] = raw_cell["source_quotes"]
    return cell


def build_manifest(
    schema: dict, results: list[dict], job_name: str | None = None
) -> dict:
    """Build the complete ui-manifest.json structure."""
    columns_def = schema["columns"]
    col_lookup = {c["id"]: c for c in columns_def}

    # Build columns for manifest
    manifest_columns = []
    for col in columns_def:
        manifest_columns.append({
            "id": col["id"],
            "label": col["label"],
            "prompt": col["prompt"],
            "type": col["type"],
            "sortable": True,
            "filterable": True,
            "group": col.get("group"),
        })

    # Build rows
    rows = []
    stats = {"complete": 0, "failed": 0, "pending": 0}

    for doc_result in results:
        doc_name = doc_result.get("_document", "unknown")
        doc_id = doc_name.replace(".", "-").replace(" ", "-").lower()

        cells = {}
        row_has_failure = False

        for col in columns_def:
            col_id = col["id"]
            raw_cell = doc_result.get(col_id, {})

            if not isinstance(raw_cell, dict):
                # Handle case where value is a plain string
                raw_cell = {"value": raw_cell}

            cell = build_cell(raw_cell, col["type"])
            cells[col_id] = cell

            if cell["status"] == "complete":
                stats["complete"] += 1
            elif cell["status"] == "failed":
                stats["failed"] += 1
                row_has_failure = True
            else:
                stats["pending"] += 1

        row_status = "failed" if row_has_failure else "complete"
        row: dict = {
            "_id": doc_id,
            "_document": doc_name,
            "_status": row_status,
            "cells": cells,
        }
        # Preserve grouping metadata from extraction (if present)
        party_group = doc_result.get("_party_group")
        rel_group = doc_result.get("_relationship_group")
        if party_group:
            row["_party_group"] = str(party_group).strip()
        if rel_group:
            row["_relationship_group"] = str(rel_group).strip()

        rows.append(row)

    total_cells = len(rows) * len(columns_def)
    name = job_name or schema.get("name", "Untitled Review")

    return {
        "schema_version": "1.0",
        "job": {
            "name": name,
            "task": schema.get("description", ""),
            "created_at": datetime.utcnow().isoformat() + "Z",
            "document_count": len(rows),
            "column_count": len(columns_def),
        },
        "summary": {
            "total_cells": total_cells,
            "complete": stats["complete"],
            "failed": stats["failed"],
            "pending": stats["pending"],
            "verified": 0,
            "flagged": 0,
        },
        "columns": manifest_columns,
        "rows": rows,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Format extraction results for UI"
    )
    parser.add_argument(
        "--results", required=True, help="Directory with result JSON files"
    )
    parser.add_argument(
        "--schema", required=True, help="Extraction schema JSON file"
    )
    parser.add_argument(
        "--output", required=True, help="Output ui-manifest.json path"
    )
    parser.add_argument(
        "--job-name", help="Optional job name override"
    )
    parser.add_argument(
        "--contracts", help="Original contracts dir (to map .txt back to .pdf/.docx)"
    )
    args = parser.parse_args()

    results_dir = Path(args.results)
    if not results_dir.is_dir():
        print(f"Results directory not found: {results_dir}")
        sys.exit(1)

    schema = load_schema(Path(args.schema))
    results = load_results(results_dir)

    if not results:
        print("No results found. Creating empty manifest.")

    manifest = build_manifest(schema, results, args.job_name)

    # Map .txt document names back to original extensions
    if args.contracts:
        contracts_dir = Path(args.contracts)
        if contracts_dir.is_dir():
            originals = {
                f.stem: f.name for f in contracts_dir.iterdir()
                if not f.name.startswith((".", "_"))
            }
            for row in manifest["rows"]:
                stem = row["_document"].rsplit(".", 1)[0]
                if stem in originals:
                    row["_document"] = originals[stem]
                    row["_id"] = originals[stem].replace(".", "-").replace(" ", "-").lower()

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    s = manifest["summary"]
    print(f"Manifest written: {output_path}")
    print(
        f"  {manifest['job']['document_count']} docs, "
        f"{manifest['job']['column_count']} cols, "
        f"{s['total_cells']} cells "
        f"({s['complete']} complete, {s['failed']} failed)"
    )


if __name__ == "__main__":
    main()
