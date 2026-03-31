"""Isaacus enrichment: segment extraction and enrichment-mapped columns."""

from isaacus_common import ENRICHMENT_COLUMNS, cell


def batch_enrich(client, texts: list[str]) -> list:
    """Enrich in batches of 8 with per-doc fallback. Returns list of doc objects."""
    docs: list = [None] * len(texts)
    for i in range(0, len(texts), 8):
        batch = texts[i:i + 8]
        try:
            r = client.enrichments.create(
                model="kanon-2-enricher", texts=batch, overflow_strategy="auto")
            for j, result in enumerate(r.results):
                docs[i + j] = result.document
        except Exception:
            for j, t in enumerate(batch):
                try:
                    r = client.enrichments.create(
                        model="kanon-2-enricher", texts=[t],
                        overflow_strategy="auto")
                    docs[i + j] = r.results[0].document
                except Exception as e:
                    print(f"  enrich failed for doc {i + j}: {e}")
    return docs


def extract_segments(doc, text: str) -> list[dict]:
    """Extract clause-level segments from enrichment document.

    Returns list of {id, text, start, end, type, title, level}.
    Uses unit/item segments (actual clauses), not containers.
    """
    if doc is None:
        return fallback_chunk(text)
    clauses = []
    for seg in doc.segments:
        if seg.kind not in ('unit', 'item'):
            continue
        s, e = seg.span.start, seg.span.end
        if e <= s:
            continue
        clause_text = text[s:e]
        if len(clause_text.strip()) < 20:
            continue
        title = None
        if seg.title:
            title = text[seg.title.start:seg.title.end]
        clauses.append({
            "id": seg.id, "text": clause_text,
            "start": s, "end": e,
            "type": seg.type, "title": title, "level": seg.level,
        })
    if not clauses:
        return fallback_chunk(text)
    return clauses


def fallback_chunk(text: str, size: int = 1500, overlap: int = 200) -> list[dict]:
    """Simple sliding-window chunker when enrichment fails."""
    chunks = []
    i = 0
    idx = 0
    while i < len(text):
        end = min(i + size, len(text))
        chunk = text[i:end]
        if chunk.strip():
            chunks.append({
                "id": f"chunk_{idx}", "text": chunk,
                "start": i, "end": end,
                "type": "chunk", "title": None, "level": 0,
            })
            idx += 1
        i += size - overlap
    return chunks


def map_enrichment_columns(doc, text: str, columns: list[dict]) -> dict:
    """Map enrichment data to schema columns. Returns {col_id: cell}."""
    if doc is None:
        return {}
    mapped = {}
    for col in columns:
        cid = col["id"]
        if cid not in ENRICHMENT_COLUMNS:
            continue
        result = _map_one(doc, text, cid)
        if result:
            mapped[cid] = result
    return mapped


def _map_one(doc, text: str, col_id: str) -> dict | None:
    if col_id in ('counterparty', 'our_party'):
        persons = [p for p in doc.persons if p.type in ('corporate', 'natural')]
        if not persons: return None
        p = persons[0] if col_id == 'counterparty' else (
            persons[1] if len(persons) > 1 else None)
        if not p: return None
        name = text[p.name.start:p.name.end]
        return cell(name, name, p.name.start, p.name.end)
    if col_id == 'contract_type' and doc.title:
        t = text[doc.title.start:doc.title.end]
        return cell(t, t, doc.title.start, doc.title.end)
    if col_id in ('date', 'effective_date'):
        for d in doc.dates:
            if d.type in ('effective', 'signature', 'creation') and d.mentions:
                m = d.mentions[0]
                return cell(d.value, text[m.start:m.end], m.start, m.end)
        if doc.dates and doc.dates[0].mentions:
            d, m = doc.dates[0], doc.dates[0].mentions[0]
            return cell(d.value, text[m.start:m.end], m.start, m.end, "medium")
        return None
    if col_id == 'expiry_date':
        for d in doc.dates:
            if d.type in ('expiry', 'renewal') and d.mentions:
                m = d.mentions[0]
                return cell(d.value, text[m.start:m.end], m.start, m.end)
        return None
    if col_id == 'governing_law' and doc.jurisdiction:
        return cell(doc.jurisdiction, None, None, None, "medium")
    return None


def party_from_enrichment(doc, text: str) -> str | None:
    if doc is None: return None
    persons = [p for p in doc.persons if p.type == 'corporate']
    if not persons: return None
    name = text[persons[0].name.start:persons[0].name.end]
    for s in [", Inc.", " Inc.", " LLC", " Ltd.", " Corp.",
              " Corporation", " S.A.", " GmbH", " Limited", " Co."]:
        name = name.replace(s, "")
    return name.strip() or None
