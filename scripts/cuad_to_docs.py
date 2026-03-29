#!/usr/bin/env python3
"""
Convert CUAD dataset contracts to PDF and DOCX files for testing.
Outputs to test-contracts/ (gitignored).

Usage:
    python3 scripts/cuad_to_docs.py [--count 50]
"""

import argparse
import random
import re
import sys
from pathlib import Path

from datasets import load_dataset
from docx import Document
from docx.shared import Pt
from reportlab.lib.pagesizes import LETTER
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "test-contracts"

random.seed(42)


def load_cuad(n: int) -> list[dict]:
    print("Loading CUAD dataset from HuggingFace...")
    ds = load_dataset("kenlevine/CUAD", split="train")
    entries = ds[0]["data"]
    print(f"  Found {len(entries)} contracts")

    contracts = []
    for entry in entries:
        text = entry["paragraphs"][0]["context"]
        if len(text) < 500:
            continue
        contracts.append({"title": entry["title"], "text": text})
        if len(contracts) >= n:
            break

    print(f"  Selected {len(contracts)} contracts (2K-80K chars)")
    return contracts


def slug(title: str) -> str:
    return re.sub(r"[^a-zA-Z0-9]+", "-", title)[:55].strip("-").lower()


def save_as_docx(text: str, filepath: Path) -> None:
    doc = Document()
    style = doc.styles["Normal"]
    style.font.name = "Calibri"
    style.font.size = Pt(11)
    for para in text.split("\n\n"):
        para = para.strip()
        if para:
            doc.add_paragraph(para)
    doc.save(str(filepath))


def save_as_pdf(text: str, filepath: Path) -> None:
    doc = SimpleDocTemplate(
        str(filepath), pagesize=LETTER,
        leftMargin=72, rightMargin=72, topMargin=72, bottomMargin=72,
    )
    styles = getSampleStyleSheet()
    story: list = []
    for para in text.split("\n\n"):
        para = para.strip()
        if not para:
            continue
        safe = para.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        s = styles["Heading2"] if para.isupper() and len(para) < 80 else styles["Normal"]
        story.append(Paragraph(safe, s))
        story.append(Spacer(1, 6))
    if story:
        doc.build(story)


def main():
    parser = argparse.ArgumentParser(description="Convert CUAD contracts to PDF/DOCX")
    parser.add_argument("--count", type=int, default=50, help="Number of contracts")
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    contracts = load_cuad(args.count)

    print(f"\nGenerating {len(contracts)} files to {OUT_DIR}...")
    for i, c in enumerate(contracts):
        s = slug(c["title"])
        ext = "pdf" if i % 2 == 0 else "docx"
        fname = f"contract-{i+1:03d}-{s}.{ext}"
        fpath = OUT_DIR / fname

        try:
            if ext == "pdf":
                save_as_pdf(c["text"], fpath)
            else:
                save_as_docx(c["text"], fpath)
            print(f"  {fname}")
        except Exception as e:
            print(f"  SKIP {fname}: {e}")

    print(f"\nDone: {len(contracts)} contracts in {OUT_DIR}")


if __name__ == "__main__":
    main()
