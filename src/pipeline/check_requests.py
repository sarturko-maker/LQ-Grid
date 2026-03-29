#!/usr/bin/env python3
"""
Check for pending UI requests and report them.

Called by Claude Code hooks to detect when the UI needs something.
Outputs JSON that CC can act on.

Usage: python3 check_requests.py
"""

import json
import sys
from pathlib import Path

REQUESTS_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "output" / "requests"
RESPONSES_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "output" / "responses"


def check():
    if not REQUESTS_DIR.exists():
        return []

    pending = []
    for f in sorted(REQUESTS_DIR.glob("*.json")):
        data = json.loads(f.read_text())
        req_id = data.get("id", "")

        # Skip if already responded
        resp_file = RESPONSES_DIR / f"{req_id}.json"
        if resp_file.exists():
            continue

        pending.append({
            "file": f.name,
            "id": req_id,
            "type": data.get("type", ""),
            "prompt": data.get("prompt", ""),
            "payload": data.get("payload", {}),
        })

    return pending


if __name__ == "__main__":
    pending = check()
    if pending:
        print(json.dumps({"pending": len(pending), "requests": pending}, indent=2))
    else:
        print(json.dumps({"pending": 0}))
