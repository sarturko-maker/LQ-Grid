"""Entity linking: cross-reference QA answers with ILGS knowledge graph."""

from isaacus_common import ENRICHMENT_COLUMNS


def spans_overlap(a_start: int, a_end: int, b_start: int, b_end: int) -> bool:
    """Check if two character ranges overlap."""
    return a_start < b_end and a_end > b_start


def find_linked_entities(doc, text: str,
                         answer_start: int, answer_end: int) -> list[dict]:
    """Find ILGS entities whose mentions overlap with an answer span.

    Returns list of {"type", "id", "value"} dicts.
    """
    linked: list[dict] = []
    seen: set[str] = set()

    for person in doc.persons:
        if person.id in seen:
            continue
        mention_spans = list(person.mentions) if person.mentions else []
        if person.name:
            mention_spans.append(person.name)
        for span in mention_spans:
            if spans_overlap(answer_start, answer_end, span.start, span.end):
                seen.add(person.id)
                name = text[person.name.start:person.name.end] if person.name else None
                linked.append({"type": "person", "id": person.id,
                               "value": name, "entity_type": person.type})
                break

    for loc in doc.locations:
        if loc.id in seen:
            continue
        mention_spans = list(loc.mentions) if loc.mentions else []
        if loc.name:
            mention_spans.append(loc.name)
        for span in mention_spans:
            if spans_overlap(answer_start, answer_end, span.start, span.end):
                seen.add(loc.id)
                name = text[loc.name.start:loc.name.end] if loc.name else None
                linked.append({"type": "location", "id": loc.id,
                               "value": name})
                break

    for term in doc.terms:
        if term.id in seen:
            continue
        mention_spans = list(term.mentions) if term.mentions else []
        if term.name:
            mention_spans.append(term.name)
        for span in mention_spans:
            if spans_overlap(answer_start, answer_end, span.start, span.end):
                seen.add(term.id)
                name = text[term.name.start:term.name.end] if term.name else None
                linked.append({"type": "term", "id": term.id,
                               "value": name})
                break

    return linked


def link_and_enrich_cell(doc, text: str, cell_dict: dict) -> dict:
    """Attach linked ILGS entities to a cell. Upgrade confidence if confirmed."""
    if doc is None:
        return cell_dict
    start = cell_dict.get("source_start")
    end = cell_dict.get("source_end")
    if start is None or end is None:
        return cell_dict

    linked = find_linked_entities(doc, text, start, end)
    if linked:
        cell_dict["linked_entities"] = linked
        if cell_dict.get("confidence") == "medium":
            cell_dict["confidence"] = "high"
    return cell_dict


def link_results_for_doc(doc, text: str, row: dict,
                         columns: list[dict]) -> dict:
    """Link all non-enrichment cells in a result row to ILGS entities."""
    if doc is None:
        return row
    for col in columns:
        cid = col["id"]
        if cid in ENRICHMENT_COLUMNS or cid not in row:
            continue
        cell_dict = row[cid]
        if isinstance(cell_dict, dict) and cell_dict.get("value") is not None:
            row[cid] = link_and_enrich_cell(doc, text, cell_dict)
    return row
