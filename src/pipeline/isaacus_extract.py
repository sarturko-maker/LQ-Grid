"""Isaacus extraction pipeline (Preview) — column-first, batched.

Sends all documents in one API call per column instead of per document.
11 docs × 14 cols = ~25 API calls (not ~220).
"""

import argparse
import json
import os
import sys
from pathlib import Path

from isaacus_strategies import (
    ENRICHMENT_COLUMNS, null_cell,
    batch_enrich, map_enrichment, party_from_enrichment,
    batch_qa, batch_clause, batch_bool, batch_enum,
)


def load_env():
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass
    if not os.environ.get("ISAACUS_API_KEY"):
        print("ISAACUS_API_KEY not set. Add it to .env", file=sys.stderr)
        sys.exit(1)


def main():
    ap = argparse.ArgumentParser(description="Isaacus extraction (Preview)")
    ap.add_argument("--texts", required=True)
    ap.add_argument("--schema", required=True)
    ap.add_argument("--output", required=True)
    args = ap.parse_args()

    load_env()
    from isaacus import Isaacus
    client = Isaacus()

    schema = json.loads(Path(args.schema).read_text())
    columns = schema["columns"]
    text_files = sorted(Path(args.texts).glob("*.txt"))
    Path(args.output).mkdir(parents=True, exist_ok=True)
    if not text_files:
        print("No text files found"); return

    names = [tf.name for tf in text_files]
    texts = [tf.read_text() for tf in text_files]
    n = len(texts)
    print(f"[isaacus] {n} documents, {len(columns)} columns")

    # Phase 1: Batch enrichment (2 API calls for 11 docs)
    print("[isaacus] enrichment...")
    edocs = batch_enrich(client, texts)

    # Initialize results with enrichment data
    results: list[dict] = []
    for i in range(n):
        doc = edocs[i]
        party = party_from_enrichment(doc, texts[i]) if doc else None
        row: dict = {"_document": names[i], "_party_group": party,
                     "_relationship_group": None}
        if doc:
            for col in columns:
                if col["id"] in ENRICHMENT_COLUMNS:
                    cell = map_enrichment(doc, texts[i], col["id"])
                    if cell:
                        row[col["id"]] = cell
        results.append(row)

    # Phase 2: Batch extract remaining columns (1-2 API calls per column)
    for col in columns:
        cid = col["id"]
        miss = [i for i in range(n) if cid not in results[i]]
        if not miss:
            continue
        mtexts = [texts[i] for i in miss]
        ctype = col.get("type", "string")
        print(f"[isaacus] {cid} ({len(mtexts)} docs)...")

        try:
            if ctype == "boolean":
                cells = batch_bool(client, mtexts, col["prompt"])
            elif ctype == "enum":
                cells = batch_enum(client, mtexts, col)
            else:
                cells = batch_qa(client, mtexts, col["prompt"])
                # Fallback: classify where QA returned null
                nulls = [j for j, c in enumerate(cells) if c["value"] is None]
                if nulls:
                    fb = batch_clause(client, [mtexts[j] for j in nulls],
                                      col["prompt"])
                    for j, fc in zip(nulls, fb):
                        cells[j] = fc
        except Exception as e:
            print(f"  {cid}: {e}")
            cells = [null_cell(f"Error: {e}")] * len(mtexts)

        for idx, cell in zip(miss, cells):
            results[idx][cid] = cell

    # Fallback: party group via QA
    no_party = [i for i in range(n) if not results[i].get("_party_group")]
    if no_party:
        try:
            pc = batch_qa(client, [texts[i] for i in no_party],
                          "Who is the counterparty to this contract?")
            for i, cell in zip(no_party, pc):
                if cell["value"]:
                    nm = cell["value"].split(";")[0].strip()
                    for s in [", Inc.", " Inc.", " LLC", " Ltd.", " Corp."]:
                        nm = nm.replace(s, "")
                    results[i]["_party_group"] = nm.strip() or None
        except Exception:
            pass

    out = Path(args.output) / "batch-isaacus.json"
    out.write_text(json.dumps(results, indent=2))
    ok = sum(1 for r in results for k, v in r.items()
             if isinstance(v, dict) and v.get("value") is not None)
    total = sum(1 for r in results for k, v in r.items() if isinstance(v, dict))
    print(f"[isaacus] Done: {ok}/{total} cells extracted")
    print(f"Wrote {len(results)} results to {out}")


if __name__ == "__main__":
    main()
