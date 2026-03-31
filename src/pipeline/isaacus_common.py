"""Shared utilities for the Isaacus RAG pipeline."""

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
