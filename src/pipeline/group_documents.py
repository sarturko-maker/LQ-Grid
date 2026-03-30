#!/usr/bin/env python3
"""
Deterministic document grouping from ui-manifest.json.

Groups rows by _party_group or _relationship_group metadata that was
extracted by the reviewer LLM at extraction time. No LLM calls here.

Only returns groups with 2+ documents — singletons are ignored.

Usage:
    python3 group_documents.py --manifest data/output/ui-manifest.json --mode party
    python3 group_documents.py --manifest data/output/ui-manifest.json --mode relationship
"""

import argparse
import json
import sys
from pathlib import Path


def group_by_field(manifest: dict, field: str) -> list[dict]:
    """Group manifest rows by a metadata field. Returns groups with 2+ docs."""
    groups: dict[str, list[str]] = {}

    for row in manifest.get("rows", []):
        group_key = row.get(field)
        if not group_key or not isinstance(group_key, str):
            continue
        group_key = group_key.strip()
        if not group_key:
            continue
        groups.setdefault(group_key, []).append(row["_id"])

    # Only keep groups with 2+ documents
    result = []
    for name, docs in sorted(groups.items(), key=lambda x: (-len(x[1]), x[0])):
        if len(docs) >= 2:
            result.append({"name": name, "documents": docs})

    return result


def main():
    parser = argparse.ArgumentParser(description="Group documents from manifest")
    parser.add_argument(
        "--manifest", required=True, help="Path to ui-manifest.json"
    )
    parser.add_argument(
        "--mode", required=True, choices=["party", "relationship"],
        help="Grouping mode: party or relationship",
    )
    args = parser.parse_args()

    manifest_path = Path(args.manifest)
    if not manifest_path.exists():
        print(json.dumps([]))
        sys.exit(0)

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    field = "_party_group" if args.mode == "party" else "_relationship_group"
    groups = group_by_field(manifest, field)

    print(json.dumps(groups))


if __name__ == "__main__":
    main()
