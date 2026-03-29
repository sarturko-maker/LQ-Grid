#!/usr/bin/env python3
"""
Generate consent request letters from ui-manifest.json.

Reads the manifest, finds contracts needing consent,
drafts letters using the template, converts to DOCX.

Usage: python3 generate_letters.py
"""

import json
import sys
from pathlib import Path

PROJECT = Path(__file__).resolve().parent.parent.parent
MANIFEST = PROJECT / "data" / "output" / "ui-manifest.json"
TEMPLATE = PROJECT / "templates" / "letters" / "consent-request.md"
OUTPUT_DIR = PROJECT / "data" / "output" / "letters"


def slugify(name: str) -> str:
    return name.lower().replace(" ", "-").replace(".", "").replace(",", "")


def generate():
    manifest = json.loads(MANIFEST.read_text())
    template = TEMPLATE.read_text()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    count = 0
    for row in manifest["rows"]:
        cells = row["cells"]
        action = (cells.get("action", {}).get("value") or "").lower()
        if action != "obtain_consent":
            continue

        cp = cells.get("counterparty", {}).get("display") or "Unknown"
        ctype = cells.get("contract_type", {}).get("display") or "Agreement"
        date = cells.get("date", {}).get("display") or "[DATE]"
        addr = cells.get("notice_address", {}).get("display") or "[ADDRESS]"
        mechanism = cells.get("mechanism", {}).get("display") or "consent"
        assign_quote = cells.get("assignment_found", {}).get("source_quote") or ""
        coc_quote = cells.get("coc_found", {}).get("source_quote") or ""
        assign_loc = cells.get("assignment_found", {}).get("source_location") or ""
        coc_loc = cells.get("coc_found", {}).get("source_location") or ""

        # Split address into lines
        addr_parts = [p.strip() for p in addr.split(",")]
        addr_block = "\n".join(addr_parts)

        # Build the letter
        letter = f"""[DATE]

{addr_block}

Dear Sir/Madam,

## Re: {ctype} dated {date} (the "Agreement")

We write to inform you that Meridian Data Systems Ltd ("Meridian") is undergoing a change of control transaction.

"""
        if assign_quote:
            letter += f"""We note that pursuant to {assign_loc} of the Agreement:

> "{assign_quote}"

"""
        if coc_quote:
            letter += f"""We further note that pursuant to {coc_loc} of the Agreement:

> "{coc_quote}"

"""
        letter += f"""In light of the above, we hereby request your written consent to the continuation of the Agreement following the change of control.

We confirm that:

1. The transaction will not materially affect Meridian's ability to perform its obligations under the Agreement;
2. All terms and conditions of the Agreement will remain in full force and effect following completion; and
3. There will be no change to the day-to-day management of the services/obligations under the Agreement.

We would be grateful if you could confirm your consent in writing at your earliest convenience, and in any event within 14 days of the date of this letter.

Should you have any questions, please do not hesitate to contact the undersigned.

Yours faithfully,

**[SIGNATORY NAME]**
**[SIGNATORY TITLE]**
Meridian Data Systems Ltd
45 Chancery Lane
London WC2A 1PQ
"""

        slug = slugify(cp)
        md_path = OUTPUT_DIR / f"consent-{slug}.md"
        md_path.write_text(letter, encoding="utf-8")
        count += 1
        print(f"  Drafted: consent-{slug}.md")

    # Convert all to DOCX
    if count > 0:
        from md_to_docx import process_directory
        docx_count = process_directory(OUTPUT_DIR)
        # Remove .md files, keep only .docx
        for f in OUTPUT_DIR.glob("*.md"):
            f.unlink()
        print(f"\nGenerated {docx_count} DOCX letters")
    else:
        print("No contracts require consent")


if __name__ == "__main__":
    generate()
