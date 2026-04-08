"""Batched Isaacus extraction on full documents (backward compat).

For segment-focused extraction, see isaacus_segment.py.
"""

from isaacus_common import ENRICHMENT_COLUMNS, conf, null_cell, cell as _cell, simplify_prompt  # noqa: F401
from isaacus_enrich import (  # noqa: F401 — re-exported for isaacus_extract.py
    batch_enrich, party_from_enrichment, _map_one,
)


def map_enrichment(doc, text: str, col_id: str) -> dict | None:
    """Compat wrapper: single-column enrichment mapping for isaacus_extract.py."""
    return _map_one(doc, text, col_id)

QA_BATCH = 3  # max documents per QA/classification call


def _qa_single(client, text: str, query: str):
    try:
        r = client.extractions.qa.create(
            model="kanon-answer-extractor", query=query,
            texts=[text], top_k=3, ignore_inextractability=True)
        return r.extractions[0]
    except Exception:
        return None


def batch_qa(client, texts: list[str], prompt: str) -> list[dict]:
    """Run QA batched on full documents, with single-doc fallback."""
    query = simplify_prompt(prompt)
    all_extractions: list = []
    for i in range(0, len(texts), QA_BATCH):
        batch = texts[i:i + QA_BATCH]
        try:
            r = client.extractions.qa.create(
                model="kanon-answer-extractor", query=query,
                texts=batch, top_k=3, ignore_inextractability=True)
            all_extractions.extend(r.extractions)
        except Exception:
            for t in batch:
                all_extractions.append(_qa_single(client, t, query))
    return _qa_extractions_to_cells(all_extractions)


def _qa_extractions_to_cells(all_extractions: list) -> list[dict]:
    cells = []
    for ex in all_extractions:
        if ex is None:
            cells.append(null_cell("API error"))
            continue
        answers = [a for a in ex.answers if a.score > 0.1]
        if not answers:
            cells.append(null_cell())
            continue
        best = answers[0]
        val = ("; ".join(a.text for a in answers[:3])
               if len(answers) > 1 else best.text)
        quotes = [{"quote": a.text, "start": a.start, "end": a.end,
                   "location": None} for a in answers]
        cells.append({
            "value": val, "source_quote": best.text, "source_location": None,
            "source_start": best.start, "source_end": best.end,
            "source_quotes": quotes if len(quotes) > 1 else None,
            "confidence": conf(best.score), "notes": None,
        })
    return cells


def _classify_single(client, text: str, query_iql: str):
    try:
        r = client.classifications.universal.create(
            model="kanon-universal-classifier",
            query=query_iql, texts=[text], is_iql=True)
        return r.classifications[0]
    except Exception:
        return None


def _batch_classify(client, texts: list[str], query_iql: str) -> list:
    all_class: list = []
    for i in range(0, len(texts), QA_BATCH):
        batch = texts[i:i + QA_BATCH]
        # Filter empties; keep index mapping
        live = [(j, t) for j, t in enumerate(batch) if t.strip()]
        if not live:
            all_class.extend([None] * len(batch))
            continue
        try:
            r = client.classifications.universal.create(
                model="kanon-universal-classifier",
                query=query_iql, texts=[t for _, t in live], is_iql=True)
            results = {j: c for (j, _), c in zip(live, r.classifications)}
        except Exception:
            results = {}
            for j, t in live:
                results[j] = _classify_single(client, t, query_iql)
        for j in range(len(batch)):
            all_class.append(results.get(j))
    return all_class


def batch_clause(client, texts: list[str], prompt: str) -> list[dict]:
    """Find relevant clauses across all texts, batched."""
    query = simplify_prompt(prompt).rstrip('?')
    all_class = _batch_classify(client, texts, f"{{{query}}}")
    cells = []
    for c in all_class:
        if c is None:
            cells.append(null_cell("API error"))
            continue
        if not c.chunks:
            cells.append(null_cell())
            continue
        top = sorted(c.chunks, key=lambda x: x.score, reverse=True)[:3]
        best = top[0]
        quotes = [{"quote": ch.text, "start": ch.start, "end": ch.end,
                   "location": None} for ch in top]
        if c.score < 0.3:
            cells.append({**null_cell("Needs LLM synthesis"),
                          "_context": [ch.text for ch in top]})
        else:
            cells.append({
                "value": ("; ".join(ch.text for ch in top)
                          if len(top) > 1 else best.text),
                "source_quote": best.text, "source_location": None,
                "source_start": best.start, "source_end": best.end,
                "source_quotes": quotes if len(quotes) > 1 else None,
                "confidence": conf(best.score), "notes": None,
                "_context": [ch.text for ch in top],
            })
    return cells


def batch_bool(client, texts: list[str], prompt: str) -> list[dict]:
    """Yes/No classification across all texts, batched."""
    query = simplify_prompt(prompt).rstrip('?')
    all_class = _batch_classify(client, texts, f"{{{query}}}")
    cells = []
    for c in all_class:
        if c is None:
            cells.append(null_cell("API error"))
            continue
        ch = max(c.chunks, key=lambda x: x.score) if c.chunks else None
        cells.append({
            "value": "Yes" if c.score > 0.5 else "No",
            "source_quote": ch.text if ch else None, "source_location": None,
            "source_start": ch.start if ch else None,
            "source_end": ch.end if ch else None,
            "confidence": conf(abs(c.score - 0.5) * 2), "notes": None,
        })
    return cells


def batch_enum(client, texts: list[str], col: dict) -> list[dict]:
    """Score each enum option across all texts, batched."""
    options = col.get("options", [])
    if not options:
        return batch_qa(client, texts, col["prompt"])
    label = col["label"].lower()
    scores: list[dict] = [{} for _ in texts]
    for opt in options:
        all_class = _batch_classify(
            client, texts, f"{{The {label} is {opt.replace('_', ' ')}}}")
        for i, c in enumerate(all_class):
            ch = max(c.chunks, key=lambda x: x.score) if c.chunks else None
            scores[i][opt] = (c.score, ch)
    cells = []
    for ds in scores:
        best_opt = max(ds, key=lambda o: ds[o][0])
        sc, chunk = ds[best_opt]
        cells.append({
            "value": best_opt,
            "source_quote": chunk.text if chunk else None,
            "source_location": None,
            "source_start": chunk.start if chunk else None,
            "source_end": chunk.end if chunk else None,
            "confidence": conf(sc), "notes": None,
        })
    return cells
