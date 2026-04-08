"""Segment-focused Isaacus extraction.

Runs QA/classification on pre-retrieved clause excerpts
instead of full documents — faster and more focused.
"""

from isaacus_common import conf, null_cell, simplify_prompt, build_segment_text, remap_offsets
from isaacus_strategies import _qa_single, _batch_classify

QA_BATCH = 3


def _prep_segments(clauses_per_doc: list[list[dict]]):
    """Build combined texts and offset maps for all documents."""
    seg_texts, maps = [], []
    for clauses in clauses_per_doc:
        if not clauses:
            seg_texts.append("")
            maps.append([])
        else:
            combined, omap = build_segment_text(clauses)
            seg_texts.append(combined)
            maps.append(omap)
    return seg_texts, maps


def extract_qa_from_segments(client, clauses_per_doc: list[list[dict]],
                             prompt: str) -> list[dict]:
    """QA on concatenated retrieved segments per document."""
    query = simplify_prompt(prompt)
    seg_texts, maps = _prep_segments(clauses_per_doc)

    all_extractions: list = [None] * len(seg_texts)
    for i in range(0, len(seg_texts), QA_BATCH):
        chunk = seg_texts[i:i + QA_BATCH]
        live = [(j, t) for j, t in enumerate(chunk) if t.strip()]
        if not live:
            continue
        try:
            r = client.extractions.qa.create(
                model="kanon-answer-extractor", query=query,
                texts=[t for _, t in live], top_k=3,
                ignore_inextractability=True)
            for (j, _), ex in zip(live, r.extractions):
                all_extractions[i + j] = ex
        except Exception:
            for j, t in live:
                all_extractions[i + j] = _qa_single(client, t, query)

    cells = []
    for idx, ex in enumerate(all_extractions):
        omap = maps[idx] if idx < len(maps) else []
        if ex is None or not seg_texts[idx]:
            cells.append(null_cell("No relevant clauses"))
            continue
        answers = [a for a in ex.answers if a.score > 0.1]
        if not answers:
            cells.append(null_cell())
            continue
        best = answers[0]
        orig_s, orig_e = remap_offsets(best.start, best.end, omap)
        val = ("; ".join(a.text for a in answers[:3])
               if len(answers) > 1 else best.text)
        cells.append({
            "value": val, "source_quote": best.text, "source_location": None,
            "source_start": orig_s, "source_end": orig_e,
            "confidence": conf(best.score), "notes": None,
        })
    return cells


def classify_bool_from_segments(client, clauses_per_doc: list[list[dict]],
                                prompt: str) -> list[dict]:
    """Yes/No classification on concatenated retrieved segments."""
    query = simplify_prompt(prompt).rstrip('?')
    seg_texts, maps = _prep_segments(clauses_per_doc)
    all_class = _batch_classify(client, seg_texts, f"{{{query}}}")

    cells = []
    for idx, c in enumerate(all_class):
        omap = maps[idx] if idx < len(maps) else []
        if c is None or not seg_texts[idx]:
            cells.append(null_cell("No relevant clauses"))
            continue
        ch = max(c.chunks, key=lambda x: x.score) if c.chunks else None
        orig_s, orig_e = (None, None)
        if ch:
            orig_s, orig_e = remap_offsets(ch.start, ch.end, omap)
        cells.append({
            "value": "Yes" if c.score > 0.5 else "No",
            "source_quote": ch.text if ch else None, "source_location": None,
            "source_start": orig_s, "source_end": orig_e,
            "confidence": conf(abs(c.score - 0.5) * 2), "notes": None,
        })
    return cells


def classify_enum_from_segments(client, clauses_per_doc: list[list[dict]],
                                col: dict) -> list[dict]:
    """Per-option classification on concatenated retrieved segments."""
    options = col.get("options", [])
    if not options:
        return extract_qa_from_segments(client, clauses_per_doc, col["prompt"])

    seg_texts, maps = _prep_segments(clauses_per_doc)
    label = col["label"].lower()
    scores: list[dict] = [{} for _ in seg_texts]

    for opt in options:
        all_class = _batch_classify(
            client, seg_texts,
            f"{{The {label} is {opt.replace('_', ' ')}}}")
        for i, c in enumerate(all_class):
            if c is None:
                scores[i][opt] = (0.0, None)
            else:
                ch = max(c.chunks, key=lambda x: x.score) if c.chunks else None
                scores[i][opt] = (c.score, ch)

    cells = []
    for idx, ds in enumerate(scores):
        omap = maps[idx] if idx < len(maps) else []
        if not ds or not seg_texts[idx]:
            cells.append(null_cell("No relevant clauses"))
            continue
        best_opt = max(ds, key=lambda o: ds[o][0])
        sc, chunk = ds[best_opt]
        orig_s, orig_e = (None, None)
        if chunk:
            orig_s, orig_e = remap_offsets(chunk.start, chunk.end, omap)
        cells.append({
            "value": best_opt,
            "source_quote": chunk.text if chunk else None,
            "source_location": None,
            "source_start": orig_s, "source_end": orig_e,
            "confidence": conf(sc), "notes": None,
        })
    return cells
