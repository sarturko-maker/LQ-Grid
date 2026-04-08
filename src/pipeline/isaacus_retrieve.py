"""Retrieve top-K relevant clauses per column per document via dot product."""

import numpy as np


def retrieve_for_doc(clauses: list[dict], clause_embeds: np.ndarray,
                     prompt_embeds: np.ndarray, columns: list[dict],
                     k: int = 5) -> dict:
    """Retrieve relevant clauses for one document.

    Returns:
        {
            "unique_clauses": [clause_dict, ...],
            "column_map": {col_id: [clause_indices_in_unique]}
        }
    """
    n_clauses = len(clauses)
    if n_clauses == 0:
        return {"unique_clauses": [], "column_map": {}}

    scores = prompt_embeds @ clause_embeds.T
    top_k = min(k, n_clauses)

    seen_ids: dict[str, int] = {}
    unique: list[dict] = []
    column_map: dict[str, list[int]] = {}

    for col_idx, col in enumerate(columns):
        col_scores = scores[col_idx]
        top_indices = np.argpartition(-col_scores, top_k)[:top_k]
        top_indices = top_indices[np.argsort(-col_scores[top_indices])]

        col_clause_refs = []
        for ci in top_indices:
            clause = clauses[ci]
            cid = clause["id"]
            if cid not in seen_ids:
                seen_ids[cid] = len(unique)
                unique.append(clause)
            col_clause_refs.append(seen_ids[cid])

        column_map[col["id"]] = col_clause_refs

    return {"unique_clauses": unique, "column_map": column_map}


def _spans_overlap(a: dict, b: dict) -> bool:
    """Check if two clause dicts have overlapping character ranges."""
    return a["start"] < b["end"] and a["end"] > b["start"]


def retrieve_for_doc_filtered(
    clauses: list[dict], clause_embeds: np.ndarray,
    prompt_embeds: np.ndarray, columns: list[dict],
    k: int = 10, threshold: float = 0.4,
) -> dict:
    """Retrieve with similarity threshold and overlap deduplication.

    Like retrieve_for_doc but:
    - Filters segments below the cosine similarity threshold
    - Deduplicates overlapping spans (prefers larger parent spans)
    """
    n_clauses = len(clauses)
    if n_clauses == 0:
        return {"unique_clauses": [], "column_map": {}}

    scores = prompt_embeds @ clause_embeds.T
    top_k = min(k, n_clauses)

    seen_ids: dict[str, int] = {}
    unique: list[dict] = []
    column_map: dict[str, list[int]] = {}

    for col_idx, col in enumerate(columns):
        col_scores = scores[col_idx]

        # Get top-k candidates
        if n_clauses <= top_k:
            top_indices = np.argsort(-col_scores)
        else:
            top_indices = np.argpartition(-col_scores, top_k)[:top_k]
            top_indices = top_indices[np.argsort(-col_scores[top_indices])]

        # Threshold filter
        candidates = [
            (clauses[ci], float(col_scores[ci]))
            for ci in top_indices if col_scores[ci] >= threshold
        ]

        # Dedup overlapping spans — prefer larger spans, break ties by score
        candidates.sort(key=lambda x: (-(x[0]["end"] - x[0]["start"]), -x[1]))
        deduped: list[dict] = []
        for clause, _score in candidates:
            if not any(_spans_overlap(clause, d) for d in deduped):
                deduped.append(clause)

        col_clause_refs = []
        for clause in deduped:
            cid = clause["id"]
            if cid not in seen_ids:
                seen_ids[cid] = len(unique)
                unique.append(clause)
            col_clause_refs.append(seen_ids[cid])

        column_map[col["id"]] = col_clause_refs

    return {"unique_clauses": unique, "column_map": column_map}


def build_all_contexts(all_clauses, all_embeds, prompt_embeds, columns,
                       k: int = 5) -> list[dict]:
    """Build retrieval contexts for all documents."""
    return [retrieve_for_doc(c, e, prompt_embeds, columns, k)
            for c, e in zip(all_clauses, all_embeds)]


def build_all_contexts_filtered(all_clauses, all_embeds, prompt_embeds,
                                columns, k: int = 10,
                                threshold: float = 0.4) -> list[dict]:
    """Build retrieval contexts with threshold filtering for all documents."""
    return [retrieve_for_doc_filtered(c, e, prompt_embeds, columns, k, threshold)
            for c, e in zip(all_clauses, all_embeds)]
