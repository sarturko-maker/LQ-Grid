"""Batched Isaacus extraction strategies.

All functions accept lists of texts and return lists of cells,
so the caller can process all documents in one API call per column.
"""

import re

ENRICHMENT_COLUMNS = {
    'counterparty', 'our_party', 'contract_type',
    'date', 'effective_date', 'expiry_date', 'governing_law',
}

QA_BATCH = 3  # max documents per QA/classification call (large docs cause 500s)


def conf(score: float) -> str:
    if score > 0.8: return "high"
    if score > 0.5: return "medium"
    return "low"


def null_cell(note: str = "Not found") -> dict:
    return {
        "value": None, "source_quote": None, "source_location": None,
        "source_start": None, "source_end": None,
        "confidence": "low", "notes": note,
    }


def simplify_prompt(prompt: str) -> str:
    p = re.sub(r'(?i)quote\s.*?(?:verbatim|relevant clause)\.?\s*', '', prompt)
    p = re.sub(r'(?i)^summari[sz]e\s+', 'What are the ', p)
    p = re.sub(r'(?i)identify the top \d[-–]\d', 'What are the main', p)
    p = re.sub(r'(?i)\binclude currency\.?\s*', '', p)
    p = re.sub(r'(?i)\bif (?:so|yes),?\s*', '', p)
    p = p.strip().rstrip('.')
    return p + '?' if not p.endswith('?') else p


# ── Enrichment (batch of 8) ───────────────────────────────────

def batch_enrich(client, texts: list[str]) -> list:
    """Enrich in batches of 8. Returns list of document objects (or None)."""
    docs: list = [None] * len(texts)
    for i in range(0, len(texts), 8):
        batch = texts[i:i + 8]
        try:
            r = client.enrichments.create(
                model="kanon-2-enricher", texts=batch, overflow_strategy="auto")
            for j, result in enumerate(r.results):
                docs[i + j] = result.document
        except Exception as e:
            print(f"  enrichment batch {i // 8}: {e}")
    return docs


def _cell(value, quote, start, end, confidence="high", note=None):
    return {
        "value": value, "source_quote": quote, "source_location": None,
        "source_start": start, "source_end": end,
        "confidence": confidence, "notes": note,
    }


def map_enrichment(doc, text: str, col_id: str) -> dict | None:
    if col_id in ('counterparty', 'our_party'):
        persons = [p for p in doc.persons if p.type in ('corporate', 'natural')]
        if not persons: return None
        p = persons[0] if col_id == 'counterparty' else (
            persons[1] if len(persons) > 1 else None)
        if not p: return None
        name = text[p.name.start:p.name.end]
        return _cell(name, name, p.name.start, p.name.end)
    if col_id == 'contract_type' and doc.title:
        t = text[doc.title.start:doc.title.end]
        return _cell(t, t, doc.title.start, doc.title.end)
    if col_id in ('date', 'effective_date'):
        for d in doc.dates:
            if d.type in ('effective', 'signature', 'creation') and d.mentions:
                m = d.mentions[0]
                return _cell(d.value, text[m.start:m.end], m.start, m.end,
                             note=f"Date type: {d.type}")
        if doc.dates and doc.dates[0].mentions:
            d, m = doc.dates[0], doc.dates[0].mentions[0]
            return _cell(d.value, text[m.start:m.end], m.start, m.end, "medium")
        return None
    if col_id == 'expiry_date':
        for d in doc.dates:
            if d.type in ('expiry', 'renewal') and d.mentions:
                m = d.mentions[0]
                return _cell(d.value, text[m.start:m.end], m.start, m.end)
        return None
    if col_id == 'governing_law' and doc.jurisdiction:
        return _cell(doc.jurisdiction, None, None, None, "medium")
    return None


def party_from_enrichment(doc, text: str) -> str | None:
    persons = [p for p in doc.persons if p.type == 'corporate']
    if not persons: return None
    name = text[persons[0].name.start:persons[0].name.end]
    for s in [", Inc.", " Inc.", " LLC", " Ltd.", " Corp.",
              " Corporation", " S.A.", " GmbH", " Limited", " Co."]:
        name = name.replace(s, "")
    return name.strip() or None


# ── Batched QA ─────────────────────────────────────────────────

def _qa_single(client, text: str, query: str):
    """QA on one doc. Returns extraction or None on failure."""
    try:
        r = client.extractions.qa.create(
            model="kanon-answer-extractor", query=query,
            texts=[text], top_k=3, ignore_inextractability=True)
        return r.extractions[0]
    except Exception:
        return None


def batch_qa(client, texts: list[str], prompt: str) -> list[dict]:
    """Run QA batched, with single-doc fallback on 500 errors."""
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
            # Batch failed — try each doc individually
            for t in batch:
                all_extractions.append(_qa_single(client, t, query))
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
        val = "; ".join(a.text for a in answers[:3]) if len(answers) > 1 else best.text
        quotes = [{"quote": a.text, "start": a.start, "end": a.end,
                   "location": None} for a in answers]
        cells.append({
            "value": val, "source_quote": best.text, "source_location": None,
            "source_start": best.start, "source_end": best.end,
            "source_quotes": quotes if len(quotes) > 1 else None,
            "confidence": conf(best.score), "notes": None,
        })
    return cells


# ── Batched classification ─────────────────────────────────────

def _classify_single(client, text: str, query_iql: str):
    try:
        r = client.classifications.universal.create(
            model="kanon-universal-classifier",
            query=query_iql, texts=[text], is_iql=True)
        return r.classifications[0]
    except Exception:
        return None


def _batch_classify(client, texts: list[str], query_iql: str) -> list:
    """Classify with per-batch fallback to single-doc calls."""
    all_class: list = []
    for i in range(0, len(texts), QA_BATCH):
        batch = texts[i:i + QA_BATCH]
        try:
            r = client.classifications.universal.create(
                model="kanon-universal-classifier",
                query=query_iql, texts=batch, is_iql=True)
            all_class.extend(r.classifications)
        except Exception:
            for t in batch:
                all_class.append(_classify_single(client, t, query_iql))
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
        ctx = [ch.text for ch in top]
        quotes = [{"quote": ch.text, "start": ch.start, "end": ch.end,
                   "location": None} for ch in top]
        if c.score < 0.3:
            cells.append({**null_cell("Needs LLM synthesis"), "_context": ctx})
        else:
            cells.append({
                "value": "; ".join(ch.text for ch in top) if len(top) > 1
                else best.text,
                "source_quote": best.text, "source_location": None,
                "source_start": best.start, "source_end": best.end,
                "source_quotes": quotes if len(quotes) > 1 else None,
                "confidence": conf(best.score), "notes": None, "_context": ctx,
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
