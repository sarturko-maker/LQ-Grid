#!/usr/bin/env python3
"""
Convert PDF and DOCX files to plain text.

Usage:
    python3 convert.py --input data/contracts/ --output data/output/texts/
    python3 convert.py --file contract.pdf --output data/output/texts/

Supports: .pdf, .docx, .txt, .md
"""

import argparse
import os
import sys
from pathlib import Path


def convert_pdf(filepath: Path) -> str:
    """Extract text from a PDF using pdfplumber (preferred) or PyPDF2."""
    try:
        import pdfplumber
        text_parts = []
        with pdfplumber.open(filepath) as pdf:
            for i, page in enumerate(pdf.pages, 1):
                page_text = page.extract_text() or ""
                if page_text.strip():
                    text_parts.append(f"--- Page {i} ---\n{page_text}")
        return "\n\n".join(text_parts)
    except ImportError:
        pass

    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(str(filepath))
        text_parts = []
        for i, page in enumerate(reader.pages, 1):
            page_text = page.extract_text() or ""
            if page_text.strip():
                text_parts.append(f"--- Page {i} ---\n{page_text}")
        return "\n\n".join(text_parts)
    except ImportError:
        print("Install pdfplumber or PyPDF2: pip install pdfplumber")
        sys.exit(1)


def convert_docx(filepath: Path) -> str:
    """Extract text from a DOCX file using python-docx."""
    try:
        from docx import Document
        doc = Document(str(filepath))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        return "\n\n".join(paragraphs)
    except ImportError:
        print("Install python-docx: pip install python-docx")
        sys.exit(1)


def convert_file(filepath: Path) -> str:
    """Convert a single file to plain text based on extension."""
    suffix = filepath.suffix.lower()
    if suffix == ".pdf":
        return convert_pdf(filepath)
    elif suffix == ".docx":
        return convert_docx(filepath)
    elif suffix in (".txt", ".md"):
        return filepath.read_text(encoding="utf-8", errors="replace")
    else:
        print(f"Unsupported file type: {suffix} ({filepath.name})")
        return ""


def sanitize_filename(name: str) -> str:
    """Remove path traversal characters from filename."""
    return Path(name).name.replace("..", "").replace("/", "_")


def process_directory(input_dir: Path, output_dir: Path) -> int:
    """Convert all supported files in a directory. Returns count."""
    output_dir.mkdir(parents=True, exist_ok=True)
    supported = {".pdf", ".docx", ".txt", ".md"}
    count = 0

    for filepath in sorted(input_dir.iterdir()):
        if filepath.suffix.lower() not in supported:
            continue
        if filepath.name.startswith("."):
            continue

        safe_name = sanitize_filename(filepath.stem) + ".txt"
        output_path = output_dir / safe_name

        print(f"Converting: {filepath.name} -> {safe_name}")
        text = convert_file(filepath)

        if text.strip():
            output_path.write_text(text, encoding="utf-8")
            count += 1
        else:
            print(f"  Warning: no text extracted from {filepath.name}")

    return count


def main():
    parser = argparse.ArgumentParser(description="Convert documents to text")
    parser.add_argument("--input", help="Input directory of documents")
    parser.add_argument("--file", help="Single file to convert")
    parser.add_argument("--output", required=True, help="Output directory")
    args = parser.parse_args()

    output_dir = Path(args.output)

    if args.file:
        filepath = Path(args.file)
        if not filepath.exists():
            print(f"File not found: {filepath}")
            sys.exit(1)
        output_dir.mkdir(parents=True, exist_ok=True)
        safe_name = sanitize_filename(filepath.stem) + ".txt"
        text = convert_file(filepath)
        (output_dir / safe_name).write_text(text, encoding="utf-8")
        print(f"Converted: {filepath.name} -> {safe_name}")

    elif args.input:
        input_dir = Path(args.input)
        if not input_dir.is_dir():
            print(f"Directory not found: {input_dir}")
            sys.exit(1)
        count = process_directory(input_dir, output_dir)
        print(f"\nConverted {count} files to {output_dir}")

    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
