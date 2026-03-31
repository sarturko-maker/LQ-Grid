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

    # Dot product: (n_prompts, n_clauses)
    scores = prompt_embeds @ clause_embeds.T
    top_k = min(k, n_clauses)

    # Collect unique clause indices across all columns
    seen_ids: dict[str, int] = {}  # clause id -> index in unique list
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


def build_all_contexts(all_clauses: list[list[dict]],
                       all_embeds: list[np.ndarray],
                       prompt_embeds: np.ndarray,
                       columns: list[dict],
                       k: int = 5) -> list[dict]:
    """Build retrieval contexts for all documents.

    Args:
        all_clauses: list of clause lists, one per document
        all_embeds: list of clause embedding arrays, one per document
        prompt_embeds: (n_columns, 1792) array
        columns: schema columns
        k: top-k per column

    Returns: list of retrieval results, one per document
    """
    results = []
    for clauses, embeds in zip(all_clauses, all_embeds):
        results.append(retrieve_for_doc(clauses, embeds, prompt_embeds, columns, k))
    return results
