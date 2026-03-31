"""Embed clause texts and column prompts using kanon-2-embedder."""

import numpy as np

EMBED_BATCH = 128  # max texts per embedding call


def embed_clauses(client, clause_texts: list[str]) -> np.ndarray:
    """Embed clause texts with task=retrieval/document. Returns (N, 1792)."""
    return _batch_embed(client, clause_texts, task="retrieval/document")


def embed_prompts(client, prompts: list[str]) -> np.ndarray:
    """Embed column prompts with task=retrieval/query. Returns (M, 1792)."""
    return _batch_embed(client, prompts, task="retrieval/query")


def _batch_embed(client, texts: list[str], task: str) -> np.ndarray:
    """Embed texts in batches with halving fallback on error."""
    if not texts:
        return np.zeros((0, 1792))
    all_vecs: list[list[float]] = []
    _embed_chunk(client, texts, task, EMBED_BATCH, all_vecs)
    return np.array(all_vecs)


def _embed_chunk(client, texts: list[str], task: str,
                 batch_size: int, out: list):
    """Recursively embed with halving batch size on failure."""
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        try:
            r = client.embeddings.create(
                model="kanon-2-embedder", texts=batch, task=task)
            # Sort by index to guarantee order
            sorted_embs = sorted(r.embeddings, key=lambda e: e.index)
            for emb in sorted_embs:
                out.append(emb.embedding)
        except Exception:
            if batch_size <= 1:
                # Single text failed — insert zero vector
                for _ in batch:
                    out.append([0.0] * 1792)
            else:
                # Halve batch size and retry
                half = max(1, batch_size // 2)
                _embed_chunk(client, batch, task, half, out)
