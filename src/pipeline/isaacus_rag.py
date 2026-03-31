"""Isaacus RAG pipeline: enrich → embed → retrieve → Sonnet fills the grid.

Isaacus finds the relevant clauses. Sonnet reads only those clauses.
~50% fewer LLM tokens than reading full contracts.

Usage:
    python3 src/pipeline/isaacus_rag.py \
        --texts data/output/texts/ \
        --schema templates/schemas/ma-dd-standard.json \
        --output data/output/results/
"""

import argparse
import json
import sys
from pathlib import Path

import numpy as np

from isaacus_common import ENRICHMENT_COLUMNS, load_env, null_cell, simplify_prompt
from isaacus_enrich import (
    batch_enrich, extract_segments,
    map_enrichment_columns, party_from_enrichment,
)
from isaacus_embed import embed_clauses, embed_prompts
from isaacus_retrieve import build_all_contexts


def main():
    ap = argparse.ArgumentParser(description="Isaacus RAG pipeline")
    ap.add_argument("--texts", required=True)
    ap.add_argument("--schema", required=True)
    ap.add_argument("--output", required=True)
    args = ap.parse_args()

    load_env()
    from isaacus import Isaacus
    client = Isaacus()

    schema = json.loads(Path(args.schema).read_text())
    columns = schema["columns"]
    llm_columns = [c for c in columns if c["id"] not in ENRICHMENT_COLUMNS]
    text_files = sorted(Path(args.texts).glob("*.txt"))
    out_dir = Path(args.output)
    out_dir.mkdir(parents=True, exist_ok=True)

    if not text_files:
        print("No text files found"); return

    names = [tf.name for tf in text_files]
    texts = [tf.read_text() for tf in text_files]
    n = len(texts)
    print(f"[rag] {n} documents, {len(columns)} columns "
          f"({len(llm_columns)} need LLM)")

    # Phase 1: Enrich
    print("[rag] enriching...")
    edocs = batch_enrich(client, texts)

    # Extract segments per document
    print("[rag] extracting segments...")
    all_clauses = []
    for i in range(n):
        segs = extract_segments(edocs[i], texts[i])
        all_clauses.append(segs)
        print(f"  {names[i][:40]:40s} {len(segs)} clauses")

    # Build enrichment results
    results: list[dict] = []
    for i in range(n):
        party = party_from_enrichment(edocs[i], texts[i])
        row: dict = {"_document": names[i], "_party_group": party,
                     "_relationship_group": None}
        row.update(map_enrichment_columns(edocs[i], texts[i], columns))
        results.append(row)

    # Phase 2: Embed
    print("[rag] embedding clauses...")
    all_clause_texts = []
    clause_doc_map = []  # (doc_idx, clause_idx_in_doc)
    for i, clauses in enumerate(all_clauses):
        for j, c in enumerate(clauses):
            all_clause_texts.append(c["text"])
            clause_doc_map.append((i, j))

    clause_vecs = embed_clauses(client, all_clause_texts)
    print(f"  {len(all_clause_texts)} clauses embedded")

    # Split embeddings back per document
    all_embeds: list[np.ndarray] = [np.zeros((0, 1792))] * n
    doc_starts = {}
    pos = 0
    for i in range(n):
        nc = len(all_clauses[i])
        if nc > 0:
            all_embeds[i] = clause_vecs[pos:pos + nc]
        doc_starts[i] = pos
        pos += nc

    # Embed column prompts
    print("[rag] embedding prompts...")
    prompt_texts = [simplify_prompt(c["prompt"]) for c in llm_columns]
    prompt_vecs = embed_prompts(client, prompt_texts)

    # Phase 3: Retrieve
    print("[rag] retrieving relevant clauses...")
    contexts = build_all_contexts(all_clauses, all_embeds, prompt_vecs,
                                  llm_columns, k=5)

    # Phase 4: Build rag-prompts.json for Sonnet agents
    agents = []
    batch_size = 5
    for bi in range(0, n, batch_size):
        batch_docs = []
        for i in range(bi, min(bi + batch_size, n)):
            ctx = contexts[i]
            if not ctx["unique_clauses"]:
                continue
            doc_entry = {
                "filename": names[i],
                "party_group": results[i].get("_party_group"),
                "context_clauses": ctx["unique_clauses"],
                "columns": [],
            }
            for col in llm_columns:
                cid = col["id"]
                refs = ctx["column_map"].get(cid, [])
                doc_entry["columns"].append({
                    "id": cid, "label": col["label"],
                    "prompt": col["prompt"], "type": col.get("type", "string"),
                    "clause_indices": refs,
                })
            batch_docs.append(doc_entry)
        if batch_docs:
            agents.append({
                "batch_name": f"batch-rag-{len(agents) + 1:03d}",
                "documents": batch_docs,
            })

    # Write outputs
    enrichment_out = out_dir / "batch-isaacus.json"
    enrichment_out.write_text(json.dumps(results, indent=2))
    print(f"[rag] enrichment results: {enrichment_out}")

    rag_out = out_dir / "rag-prompts.json"
    rag_out.write_text(json.dumps({"agents": agents}, indent=2))
    print(f"[rag] agent prompts: {rag_out} ({len(agents)} agents)")

    # Summary
    enr_cells = sum(1 for r in results for k, v in r.items()
                    if isinstance(v, dict) and v.get("value") is not None)
    total_enr = sum(1 for r in results for k, v in r.items()
                    if isinstance(v, dict))
    llm_cells = n * len(llm_columns)
    avg_clauses = (sum(len(ctx["unique_clauses"]) for ctx in contexts) / n
                   if n else 0)
    print(f"[rag] Enrichment filled {enr_cells}/{total_enr} cells")
    print(f"[rag] {llm_cells} cells for Sonnet ({len(agents)} agents, "
          f"avg {avg_clauses:.0f} clauses/doc)")


if __name__ == "__main__":
    main()
