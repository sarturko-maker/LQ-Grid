"""Isaacus hybrid pipeline: Isaacus finds (zero hallucination), Sonnet reasons on top.

Usage:
    python3 src/pipeline/isaacus_pipeline.py \
        --texts data/output/texts/ \
        --schema templates/schemas/consent-review.json \
        --output data/output/results/
"""

import argparse
import json
from pathlib import Path

import numpy as np

from isaacus_common import ENRICHMENT_COLUMNS, load_env, simplify_prompt, null_cell
from isaacus_enrich import (
    batch_enrich, extract_segments, map_enrichment_columns, party_from_enrichment,
)
from isaacus_embed import embed_clauses, embed_prompts
from isaacus_retrieve import build_all_contexts_filtered
from isaacus_segment import (
    extract_qa_from_segments, classify_bool_from_segments,
    classify_enum_from_segments,
)
from isaacus_link import link_results_for_doc


def _extract_column(client, col, clauses_per_doc):
    ctype = col.get("type", "string")
    if ctype == "boolean":
        return classify_bool_from_segments(client, clauses_per_doc, col["prompt"])
    if ctype == "enum":
        return classify_enum_from_segments(client, clauses_per_doc, col)
    return extract_qa_from_segments(client, clauses_per_doc, col["prompt"])


def _get_clauses_for_col(contexts, col_id, n):
    result = []
    for i in range(n):
        refs = contexts[i]["column_map"].get(col_id, [])
        result.append([contexts[i]["unique_clauses"][r] for r in refs])
    return result


def _build_finding(cell: dict | None) -> dict | None:
    """Convert an Isaacus cell to a compact finding for Sonnet context."""
    if not isinstance(cell, dict) or cell.get("value") is None:
        return None
    return {k: cell.get(k) for k in
            ("value", "confidence", "source_quote", "source_start", "source_end")}


def _build_agents(names, results, contexts, non_enrich, isaacus_findings, n):
    """Package ALL non-enrichment columns for Sonnet, with Isaacus findings."""
    agents = []
    for bi in range(0, n, 5):
        batch_docs = []
        for i in range(bi, min(bi + 5, n)):
            ctx = contexts[i]
            if not ctx["unique_clauses"]:
                continue
            cols_for_doc = []
            for col in non_enrich:
                cid = col["id"]
                refs = ctx["column_map"].get(cid, [])
                entry = {
                    "id": cid, "label": col["label"], "prompt": col["prompt"],
                    "type": col.get("type", "string"),
                    "clause_indices": refs,
                }
                finding = isaacus_findings[i].get(cid)
                if finding:
                    entry["isaacus_finding"] = finding
                cols_for_doc.append(entry)
            batch_docs.append({
                "filename": names[i],
                "party_group": results[i].get("_party_group"),
                "context_clauses": ctx["unique_clauses"],
                "columns": cols_for_doc,
            })
        if batch_docs:
            agents.append({"batch_name": f"batch-rag-{len(agents) + 1:03d}",
                           "documents": batch_docs})
    return agents


def main():
    ap = argparse.ArgumentParser(description="Isaacus hybrid pipeline")
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
    out_dir = Path(args.output)
    out_dir.mkdir(parents=True, exist_ok=True)
    if not text_files:
        print("No text files found"); return

    names = [tf.name for tf in text_files]
    texts = [tf.read_text() for tf in text_files]
    n = len(texts)
    non_enrich = [c for c in columns if c["id"] not in ENRICHMENT_COLUMNS]

    print(f"[pipeline] {n} docs, {len(columns)} cols "
          f"({len(non_enrich)} for Sonnet overlay)")

    # Phase 1: Enrich
    print("[pipeline] enriching...")
    edocs = batch_enrich(client, texts)

    # Phase 2: Segments
    print("[pipeline] extracting segments...")
    all_clauses = [extract_segments(edocs[i], texts[i]) for i in range(n)]

    # Enrichment results (final — no Sonnet overlay needed)
    results: list[dict] = []
    for i in range(n):
        party = party_from_enrichment(edocs[i], texts[i])
        row: dict = {"_document": names[i], "_party_group": party,
                     "_relationship_group": None}
        row.update(map_enrichment_columns(edocs[i], texts[i], columns))
        results.append(row)

    # Phase 3: Embed all non-enrichment columns
    print("[pipeline] embedding...")
    all_clause_texts = [c["text"] for clauses in all_clauses for c in clauses]
    clause_vecs = embed_clauses(client, all_clause_texts)

    all_embeds: list[np.ndarray] = [np.zeros((0, 1792))] * n
    pos = 0
    for i in range(n):
        nc = len(all_clauses[i])
        if nc > 0:
            all_embeds[i] = clause_vecs[pos:pos + nc]
        pos += nc

    prompt_texts = [simplify_prompt(c["prompt"]) for c in non_enrich]
    prompt_vecs = embed_prompts(client, prompt_texts)

    # Phase 4: Retrieve (threshold + dedup)
    print("[pipeline] retrieving...")
    contexts = build_all_contexts_filtered(
        all_clauses, all_embeds, prompt_vecs, non_enrich, k=10, threshold=0.4)

    # Phase 5: Isaacus preliminary extraction on ALL non-enrichment columns
    isaacus_findings: list[dict] = [{} for _ in range(n)]
    for col in non_enrich:
        cid = col["id"]
        print(f"  [isaacus] {cid}")
        clauses_per_doc = _get_clauses_for_col(contexts, cid, n)
        cells = _extract_column(client, col, clauses_per_doc)
        for i in range(min(len(cells), n)):
            finding = _build_finding(cells[i])
            if finding:
                isaacus_findings[i][cid] = finding

    # Phase 6: Entity linking on Isaacus findings
    print("[pipeline] entity linking...")
    for i in range(n):
        # Temporarily put findings into results for linking
        for cid, f in isaacus_findings[i].items():
            results[i][cid] = f
        results[i] = link_results_for_doc(edocs[i], texts[i], results[i],
                                          non_enrich)
        # Update findings with linked data, then remove from results
        for cid in list(isaacus_findings[i]):
            if cid in results[i] and isinstance(results[i][cid], dict):
                isaacus_findings[i][cid] = _build_finding(results[i][cid])
            results[i].pop(cid, None)

    # Write enrichment results (final)
    isaacus_out = out_dir / "batch-isaacus.json"
    isaacus_out.write_text(json.dumps(results, indent=2))

    # Phase 7: Build Sonnet prompts — ALL non-enrichment columns
    agents = _build_agents(names, results, contexts, non_enrich,
                           isaacus_findings, n)
    rag_out = out_dir / "rag-prompts.json"
    rag_out.write_text(json.dumps({"agents": agents}, indent=2))

    # Summary
    enr = sum(1 for r in results for v in r.values()
              if isinstance(v, dict) and v.get("value") is not None)
    hints = sum(1 for f in isaacus_findings for v in f.values() if v)
    print(f"[pipeline] enrichment: {enr} cells (final)")
    print(f"[pipeline] isaacus hints: {hints} preliminary findings for Sonnet")
    print(f"[pipeline] {len(agents)} Sonnet agents for "
          f"{len(non_enrich)} columns")


if __name__ == "__main__":
    main()
