"""Shared utilities for the Isaacus hybrid pipeline."""

import os
import re
import sys

ENRICHMENT_COLUMNS = {
    'counterparty', 'our_party', 'contract_type',
    'date', 'effective_date', 'expiry_date', 'governing_law',
}


def load_env():
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass
    if not os.environ.get("ISAACUS_API_KEY"):
        print("ISAACUS_API_KEY not set. Add it to .env", file=sys.stderr)
        sys.exit(1)


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


def cell(value, quote, start, end, confidence="high", note=None):
    return {
        "value": value, "source_quote": quote, "source_location": None,
        "source_start": start, "source_end": end,
        "confidence": confidence, "notes": note,
    }


def simplify_prompt(prompt: str) -> str:
    """Strip LLM instructions, keep the core question."""
    p = re.sub(r'(?i)quote\s.*?(?:verbatim|relevant clause)\.?\s*', '', prompt)
    p = re.sub(r'(?i)^summari[sz]e\s+', 'What are the ', p)
    p = re.sub(r'(?i)identify the top \d[-–]\d', 'What are the main', p)
    p = re.sub(r'(?i)\binclude currency\.?\s*', '', p)
    p = re.sub(r'(?i)\bif (?:so|yes),?\s*', '', p)
    p = p.strip().rstrip('.')
    return p + '?' if not p.endswith('?') else p


# ── Segment text helpers ─────────────────────────────────────

def build_segment_text(clauses: list[dict]) -> tuple[str, list[tuple]]:
    """Concatenate clause texts with \\n\\n separators.

    Returns (combined_text, offset_map) where each entry in offset_map is
    (seg_start_in_combined, seg_end_in_combined, orig_start, orig_end).
    """
    parts: list[str] = []
    offset_map: list[tuple] = []
    pos = 0
    for c in clauses:
        text = c["text"]
        if parts:
            pos += 2  # \n\n separator
        seg_start = pos
        seg_end = pos + len(text)
        offset_map.append((seg_start, seg_end, c["start"], c["end"]))
        parts.append(text)
        pos = seg_end
    return "\n\n".join(parts), offset_map


def remap_offsets(start: int, end: int,
                  offset_map: list[tuple]) -> tuple[int | None, int | None]:
    """Map answer offsets from combined-text space to original document positions.

    If the span crosses segment boundaries, clamps to the segment containing
    the majority of the answer.
    """
    if not offset_map:
        return None, None
    for seg_start, seg_end, orig_start, orig_end in offset_map:
        if start < seg_end and end > seg_start:
            delta_s = max(0, start - seg_start)
            delta_e = min(end - seg_start, seg_end - seg_start)
            return orig_start + delta_s, orig_start + delta_e
    return None, None
