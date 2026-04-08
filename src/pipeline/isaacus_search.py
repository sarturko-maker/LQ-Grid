"""Agentic RAG search: reviewer agents call this to find additional clauses.

Loads pre-computed clause embeddings from the pipeline, embeds a new query
via Isaacus, and returns the top-k matching clause excerpts.

Usage:
    python3 src/pipeline/isaacus_search.py \
        --doc contract-129.txt \
        --query "transfer of rights without prior consent" \
        --index data/output/results/clause_index \
        --top_k 5
"""

import argparse
import json
import sys
from pathlib import Path

import numpy as np

from isaacus_common import load_env


def search(index_dir: Path, doc_name: str, query: str,
           top_k: int = 5, threshold: float = 0.3) -> list[dict]:
    """Search pre-computed clause index for a document."""
    emb_path = index_dir / f"{doc_name}.npy"
    clause_path = index_dir / f"{doc_name}.json"

    if not emb_path.exists() or not clause_path.exists():
        return []

    clause_embeds = np.load(str(emb_path))
    clauses = json.loads(clause_path.read_text())

    if len(clauses) == 0 or clause_embeds.shape[0] == 0:
        return []

    load_env()
    from isaacus import Isaacus
    client = Isaacus()

    r = client.embeddings.create(
        model="kanon-2-embedder", texts=[query], task="retrieval/query")
    query_vec = np.array(r.embeddings[0].embedding)

    scores = clause_embeds @ query_vec
    top_k = min(top_k, len(clauses))
    top_indices = np.argsort(-scores)[:top_k]

    results = []
    for idx in top_indices:
        score = float(scores[idx])
        if score < threshold:
            continue
        c = clauses[idx]
        results.append({
            "score": round(score, 3),
            "text": c["text"],
            "start": c["start"],
            "end": c["end"],
            "type": c.get("type"),
            "title": c.get("title"),
        })
    return results


def main():
    ap = argparse.ArgumentParser(description="Isaacus clause search")
    ap.add_argument("--doc", required=True, help="Document filename (e.g. contract-129.txt)")
    ap.add_argument("--query", required=True, help="Search query")
    ap.add_argument("--index", required=True, help="Path to clause_index directory")
    ap.add_argument("--top_k", type=int, default=5)
    args = ap.parse_args()

    results = search(Path(args.index), args.doc, args.query, args.top_k)

    if not results:
        print("No matching clauses found.")
        sys.exit(0)

    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
