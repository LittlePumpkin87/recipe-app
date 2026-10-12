#!/usr/bin/env python3
"""Converts the allrecipes.com recipe dump (Zenodo record 15169428) from CSV to
NDJSON, one JSON object per line.

Two things make the source awkward for a TypeScript importer: the file is
Windows-1252 rather than UTF-8, and its nested columns hold Python literals in
single quotes, which `JSON.parse` cannot read. This script fixes both and
nothing else. Units, fractions, servings and instructions keep the shape the
source gave them — interpreting those is the importer's job, in the language the
application is written in.
"""

import ast
import csv
import json
import sys
from collections import Counter

SOURCE = "data/dataset.csv"
TARGET = "data/allrecipes.ndjson"

# Columns carrying a Python list or dict instead of a plain value
LITERAL_COLUMNS = [
    "Category",
    "Cuisine",
    "Ingredients",
    "Ingredients_Raw",
    "Instructions",
    "Cooking Methods",
    "Implements",
    "Servings",
    "Nutrition",
]

REPLACEMENT = "�"


def parse_literal(value):
    """Keeps the original text under `_unparsed` when a field cannot be read, so
    that it stays visible in the output instead of silently becoming null."""
    if value is None or not value.strip():
        return None
    try:
        return ast.literal_eval(value)
    except (ValueError, SyntaxError, MemoryError, RecursionError):
        return {"_unparsed": value}


def convert(source_path, target_path):
    csv.field_size_limit(10_000_000)

    rows = 0
    damaged_rows = 0
    failures = Counter()

    with (
        open(source_path, newline="", encoding="cp1252", errors="replace") as source,
        open(target_path, "w", encoding="utf-8") as target,
    ):
        for row in csv.DictReader(source, delimiter=";"):
            record = dict(row)

            for column in LITERAL_COLUMNS:
                parsed = parse_literal(row.get(column))
                if isinstance(parsed, dict) and "_unparsed" in parsed:
                    failures[column] += 1
                record[column] = parsed

            line = json.dumps(record, ensure_ascii=False)
            if REPLACEMENT in line:
                damaged_rows += 1

            target.write(line + "\n")
            rows += 1

    report(rows, damaged_rows, failures)


def report(rows, damaged_rows, failures):
    print(f"{rows} records written")
    print(f"{damaged_rows} records containing undecodable characters")

    if failures:
        print("unreadable fields per column:")
        for column, count in failures.most_common():
            print(f"  {count:7} {column}")
    else:
        print("no unreadable fields")


if __name__ == "__main__":
    source = sys.argv[1] if len(sys.argv) > 1 else SOURCE
    target = sys.argv[2] if len(sys.argv) > 2 else TARGET
    convert(source, target)
