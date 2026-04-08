"""Isaacus hybrid pipeline: Isaacus finds (zero hallucination), Sonnet verifies all."""

import argparse
import json
from pathlib import Path

import numpy as np

from isaacus_common import ENRICHMENT_COLUMNS, load_env, simplify_prompt
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
    if not isinstance(cell, dict) or cell.get("value") is None:
        return None
    return {k: cell.get(k) for k in
            ("value", "confidence", "source_quote", "source_start", "source_end")}


def _build_agents(names, results, contexts, columns, all_findings, n):
    """1 agent per doc, ALL columns (enrichment + non-enrichment) with hints."""
    agents = []
    for i in range(n):
        ctx = contexts[i]
        if not ctx["unique_clauses"]:
            continue
        cols_out = []
        for col in columns:
            cid = col["id"]
            refs = ctx["column_map"].get(cid, [])
            entry = {"id": cid, "label": col["label"], "prompt": col["prompt"],
                     "type": col.get("type", "string"), "clause_indices": refs}
            finding = all_findings[i].get(cid)
            if finding:
                entry["isaacus_finding"] = finding
            cols_out.append(entry)
        agents.append({
            "batch_name": f"batch-rag-{i + 1:03d}",
            "documents": [{
                "filename": names[i],
                "party_group": results[i].get("_party_group"),
                "context_clauses": ctx["unique_clauses"],
                "columns": cols_out,
            }],
        })
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

    print(f"[pipeline] {n} docs, {len(columns)} cols (Sonnet verifies all)")

    # Phase 1: Enrich
    print("[pipeline] enriching...")
    edocs = batch_enrich(client, texts)

    # Phase 2: Segments
    print("[pipeline] extracting segments...")
    all_clauses = [extract_segments(edocs[i], texts[i]) for i in range(n)]

    # Enrichment — preliminary (Sonnet verifies), also provides _party_group
    results: list[dict] = []
    all_findings: list[dict] = [{} for _ in range(n)]
    for i in range(n):
        party = party_from_enrichment(edocs[i], texts[i])
        row: dict = {"_document": names[i], "_party_group": party,
                     "_relationship_group": None}
        enr = map_enrichment_columns(edocs[i], texts[i], columns)
        # Store enrichment as findings (preliminary), write to results as fallback
        row.update(enr)
        for cid, cell in enr.items():
            f = _build_finding(cell)
            if f:
                all_findings[i][cid] = f
        results.append(row)

    # Phase 3: Embed ALL columns
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

    # Save clause index for agentic search
    idx_dir = out_dir / "clause_index"
    idx_dir.mkdir(parents=True, exist_ok=True)
    for i in range(n):
        np.save(str(idx_dir / f"{names[i]}.npy"), all_embeds[i])
        (idx_dir / f"{names[i]}.json").write_text(json.dumps(all_clauses[i]))

    prompt_texts = [simplify_prompt(c["prompt"]) for c in columns]
    prompt_vecs = embed_prompts(client, prompt_texts)

    # Phase 4: Retrieve
    print("[pipeline] retrieving...")
    contexts = build_all_contexts_filtered(
        all_clauses, all_embeds, prompt_vecs, columns, k=10, threshold=0.4)

    # Phase 5: Isaacus extraction on non-enrichment columns
    non_enrich = [c for c in columns if c["id"] not in ENRICHMENT_COLUMNS]
    for col in non_enrich:
        cid = col["id"]
        print(f"  [isaacus] {cid}")
        clauses_per_doc = _get_clauses_for_col(contexts, cid, n)
        cells = _extract_column(client, col, clauses_per_doc)
        for i in range(min(len(cells), n)):
            f = _build_finding(cells[i])
            if f:
                all_findings[i][cid] = f

    # Phase 6: Entity linking
    print("[pipeline] entity linking...")
    for i in range(n):
        tmp = dict(results[i])
        for cid, f in all_findings[i].items():
            tmp[cid] = f
        tmp = link_results_for_doc(edocs[i], texts[i], tmp, columns)
        for cid in all_findings[i]:
            if cid in tmp and isinstance(tmp[cid], dict):
                all_findings[i][cid] = _build_finding(tmp[cid])

    # Write enrichment fallback (Sonnet results overwrite via format_for_ui merge)
    isaacus_out = out_dir / "batch-isaacus.json"
    isaacus_out.write_text(json.dumps(results, indent=2))

    # Phase 7: Sonnet prompts — ALL columns, 1 doc per agent
    agents = _build_agents(names, results, contexts, columns, all_findings, n)
    rag_out = out_dir / "rag-prompts.json"
    rag_out.write_text(json.dumps({"agents": agents}, indent=2))

    hints = sum(1 for f in all_findings for v in f.values() if v)
    print(f"[pipeline] {hints} isaacus hints across {len(columns)} columns")
    print(f"[pipeline] {len(agents)} Sonnet agents (1 per doc, all columns)")


if __name__ == "__main__":
    main()
