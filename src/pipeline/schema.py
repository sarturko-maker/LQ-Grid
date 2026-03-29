#!/usr/bin/env python3
"""
Schema validation utilities for extraction schemas.

A schema defines the columns (fields) to extract from documents.
Each column has: id, label, prompt, type, and optional metadata.

Usage:
    python3 schema.py --validate templates/schemas/consent-review.json
    python3 schema.py --list templates/schemas/
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any


VALID_TYPES = {"string", "date", "boolean", "number", "enum", "list"}

REQUIRED_COLUMN_FIELDS = {"id", "label", "prompt", "type"}


def validate_column(col: dict, index: int) -> list[str]:
    """Validate a single column definition. Returns list of errors."""
    errors = []
    prefix = f"Column {index} ({col.get('id', 'unknown')})"

    for field in REQUIRED_COLUMN_FIELDS:
        if field not in col:
            errors.append(f"{prefix}: missing required field '{field}'")

    col_type = col.get("type", "")
    if col_type and col_type not in VALID_TYPES:
        errors.append(
            f"{prefix}: invalid type '{col_type}'. "
            f"Must be one of: {', '.join(sorted(VALID_TYPES))}"
        )

    if col_type == "enum" and "options" not in col:
        errors.append(f"{prefix}: enum type requires 'options' array")

    if col_type == "enum" and "options" in col:
        if not isinstance(col["options"], list) or len(col["options"]) == 0:
            errors.append(f"{prefix}: 'options' must be a non-empty array")

    col_id = col.get("id", "")
    if col_id and not col_id.replace("_", "").isalnum():
        errors.append(
            f"{prefix}: id must be alphanumeric with underscores only"
        )

    return errors


def validate_schema(schema: dict) -> list[str]:
    """Validate a full extraction schema. Returns list of errors."""
    errors = []

    if "name" not in schema:
        errors.append("Schema missing 'name' field")

    if "columns" not in schema:
        errors.append("Schema missing 'columns' array")
        return errors

    if not isinstance(schema["columns"], list):
        errors.append("'columns' must be an array")
        return errors

    if len(schema["columns"]) == 0:
        errors.append("Schema must have at least one column")

    # Check for duplicate IDs
    ids = [c.get("id") for c in schema["columns"] if "id" in c]
    seen = set()
    for col_id in ids:
        if col_id in seen:
            errors.append(f"Duplicate column id: '{col_id}'")
        seen.add(col_id)

    # Validate each column
    for i, col in enumerate(schema["columns"]):
        errors.extend(validate_column(col, i))

    return errors


def load_schema(filepath: Path) -> dict:
    """Load and validate a schema file. Exits on error."""
    if not filepath.exists():
        print(f"Schema file not found: {filepath}")
        sys.exit(1)

    with open(filepath, "r", encoding="utf-8") as f:
        schema = json.load(f)

    errors = validate_schema(schema)
    if errors:
        print(f"Schema validation errors in {filepath.name}:")
        for err in errors:
            print(f"  - {err}")
        sys.exit(1)

    return schema


def list_schemas(directory: Path) -> list[dict[str, Any]]:
    """List all valid schemas in a directory."""
    schemas = []
    for filepath in sorted(directory.glob("*.json")):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                schema = json.load(f)
            errors = validate_schema(schema)
            schemas.append({
                "file": filepath.name,
                "name": schema.get("name", "Unnamed"),
                "description": schema.get("description", ""),
                "columns": len(schema.get("columns", [])),
                "valid": len(errors) == 0,
                "errors": errors,
            })
        except (json.JSONDecodeError, KeyError) as e:
            schemas.append({
                "file": filepath.name,
                "name": "Invalid",
                "description": str(e),
                "columns": 0,
                "valid": False,
                "errors": [str(e)],
            })
    return schemas


def main():
    parser = argparse.ArgumentParser(description="Schema validation")
    parser.add_argument("--validate", help="Validate a schema file")
    parser.add_argument("--list", help="List schemas in a directory")
    args = parser.parse_args()

    if args.validate:
        schema = load_schema(Path(args.validate))
        print(f"Schema '{schema['name']}' is valid.")
        print(f"  Columns: {len(schema['columns'])}")
        for col in schema["columns"]:
            print(f"    - {col['id']}: {col['label']} ({col['type']})")

    elif args.list:
        schemas = list_schemas(Path(args.list))
        if not schemas:
            print("No schemas found.")
            return
        for s in schemas:
            status = "OK" if s["valid"] else "INVALID"
            print(f"  [{status}] {s['file']}: {s['name']} ({s['columns']} cols)")
            if not s["valid"]:
                for err in s["errors"]:
                    print(f"         {err}")

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
