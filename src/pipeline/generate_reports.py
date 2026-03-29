#!/usr/bin/env python3
"""
Generate reports from ui-manifest.json.

Creates: summary-report, board-flags, disclosure-schedule.
All as DOCX.

Usage:
    python3 generate_reports.py --type summary
    python3 generate_reports.py --type board-flags
    python3 generate_reports.py --type disclosure
    python3 generate_reports.py --all
"""

import argparse
import json
from pathlib import Path

PROJECT = Path(__file__).resolve().parent.parent.parent
MANIFEST = PROJECT / "data" / "output" / "ui-manifest.json"
OUTPUT_DIR = PROJECT / "data" / "output" / "reports"


def load_manifest():
    return json.loads(MANIFEST.read_text())


def get_cell(row, col_id):
    c = row["cells"].get(col_id, {})
    return c.get("display") or c.get("value") or "—"


def generate_summary():
    m = load_manifest()
    rows = m["rows"]
    cols = {c["id"]: c["label"] for c in m["columns"]}

    consent = [r for r in rows if get_cell(r, "action").lower() == "obtain_consent"]
    notify = [r for r in rows if get_cell(r, "action").lower() == "send_notification"]
    no_act = [r for r in rows if get_cell(r, "action").lower() == "no_action"]

    md = f"# Client Summary Report\n\n"
    md += f"## 1. Overview\n\n"
    md += f"We have reviewed **{len(rows)} contracts** as part of the change of control due diligence exercise.\n\n"
    md += f"- Contracts requiring consent: **{len(consent)}**\n"
    md += f"- Contracts requiring notification: **{len(notify)}**\n"
    md += f"- No action required: **{len(no_act)}**\n\n"

    if consent:
        md += f"## 2. Contracts Requiring Consent\n\n"
        for r in consent:
            cp = get_cell(r, "counterparty")
            ct = get_cell(r, "contract_type")
            mech = get_cell(r, "mechanism")
            md += f"- **{cp}** ({ct}) — Mechanism: {mech}\n"
        md += "\n"

    if no_act:
        md += f"## 3. No Action Required\n\n"
        for r in no_act:
            cp = get_cell(r, "counterparty")
            ct = get_cell(r, "contract_type")
            md += f"- **{cp}** ({ct})\n"
        md += "\n"

    md += f"## 4. Recommendation\n\n"
    md += f"We recommend that consent letters are issued to the {len(consent)} counterparties "
    md += f"identified above at the earliest opportunity to avoid delays to completion.\n"

    return md


def generate_board_flags():
    m = load_manifest()
    rows = m["rows"]

    md = "# Board Approval Flags\n\n"
    md += "The following contracts may require board-level attention:\n\n"

    for r in rows:
        flags = []
        mech = get_cell(r, "mechanism").lower()
        coc = get_cell(r, "coc_found").lower()
        nc = get_cell(r, "non_compete") if "non_compete" in r["cells"] else ""

        if mech == "termination_right":
            flags.append("Counterparty has a **termination right** on change of control")
        if coc in ("yes", "true") and mech == "consent":
            flags.append("Change of control requires **prior written consent**")
        if nc and "non-compete" not in nc.lower().startswith("no"):
            if len(nc) > 10 and "no " not in nc.lower()[:5]:
                flags.append(f"**Non-compete restriction**: {nc[:100]}")

        if flags:
            cp = get_cell(r, "counterparty")
            ct = get_cell(r, "contract_type")
            md += f"### {cp} ({ct})\n\n"
            for f in flags:
                md += f"- {f}\n"
            md += "\n"

    return md


def generate_disclosure():
    m = load_manifest()
    rows = m["rows"]

    md = "# Disclosure Schedule\n\n"
    md += "## Part [X] — Material Contracts\n\n"

    for i, r in enumerate(rows, 1):
        cp = get_cell(r, "counterparty")
        ct = get_cell(r, "contract_type")
        date = get_cell(r, "date")
        law = get_cell(r, "governing_law")
        assign = get_cell(r, "assignment_found")
        coc = get_cell(r, "coc_found")
        action = get_cell(r, "action")

        md += f"### {i}. {ct} with {cp}\n\n"
        md += f"- **Date:** {date}\n"
        md += f"- **Governing law:** {law}\n"
        md += f"- **Assignment restriction:** {assign}\n"
        md += f"- **Change of control provision:** {coc}\n"
        md += f"- **Action required:** {action}\n\n"

    return md


GENERATORS = {
    "summary": ("summary-report.md", generate_summary),
    "board-flags": ("board-flags.md", generate_board_flags),
    "disclosure": ("disclosure-schedule.md", generate_disclosure),
}


def run(report_type: str):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    filename, generator = GENERATORS[report_type]
    md = generator()
    md_path = OUTPUT_DIR / filename
    md_path.write_text(md, encoding="utf-8")

    # Convert to DOCX
    from md_to_docx import convert_md_to_docx
    docx_path = md_path.with_suffix(".docx")
    convert_md_to_docx(md_path, docx_path)
    md_path.unlink()  # Remove .md, keep only .docx
    print(f"Generated: {docx_path.name}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--type", choices=list(GENERATORS.keys()))
    parser.add_argument("--all", action="store_true")
    args = parser.parse_args()

    if args.all:
        for t in GENERATORS:
            run(t)
    elif args.type:
        run(args.type)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
