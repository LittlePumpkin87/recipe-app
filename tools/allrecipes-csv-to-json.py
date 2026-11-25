#!/usr/bin/env python3
"""Converts the allrecipes.com recipe dump (Zenodo record 15169428) from CSV to
NDJSON, one JSON object per line.

Two things make the source awkward for a TypeScript importer: the file is
Windows-1252 rather than UTF-8, and its nested columns hold Python literals in
single quotes, which `JSON.parse` cannot read. This script fixes both.

It also adds `Ingredient_Names`: the names ingredient-parser-nlp reads from each
line of `Ingredients_Raw`, at the same index, because the parser exists only in
Python. Everything else keeps the shape the source gave it; interpreting it is
the importer's job. See tools/README.md.
"""

import ast
import csv
import json
import sys
from collections import Counter

from ingredient_parser import parse_ingredient
from tqdm import tqdm

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
PROGRESS_STEP = 1000


def parse_literal(value):
    """Keeps the original text under `_unparsed` when a field cannot be read, so
    that it stays visible in the output instead of silently becoming null."""
    if value is None or not value.strip():
        return None
    try:
        return ast.literal_eval(value)
    except (ValueError, SyntaxError, MemoryError, RecursionError):
        return {"_unparsed": value}


def parse_names(raw_lines, cache):
    if not isinstance(raw_lines, list):
        return None
    names = []
    for line in raw_lines:
        if line not in cache:
            cache[line] = read_names(line)
        names.append(cache[line])
    return names


def read_names(line):
    if not line.strip():
        return []
    parsed = parse_ingredient(line, string_units=True)
    return [part.text for part in parsed.name]

def count_records(source_path):
    with open(source_path, newline="", encoding="cp1252", errors="replace") as source:
        return sum(1 for _ in csv.DictReader(source, delimiter=";"))

def convert(source_path, target_path):
    csv.field_size_limit(10_000_000)

    rows = 0
    damaged_rows = 0
    failures = Counter()
    cache = {}
    total = count_records(source_path)

    with (
        open(source_path, newline="", encoding="cp1252", errors="replace") as source,
        open(target_path, "w", encoding="utf-8") as target,
    ):
        reader = csv.DictReader(source, delimiter=";")
        for row in tqdm(reader, total=total, unit=" recipes"):
            record = dict(row)

            for column in LITERAL_COLUMNS:
                parsed = parse_literal(row.get(column))
                if isinstance(parsed, dict) and "_unparsed" in parsed:
                    failures[column] += 1
                record[column] = parsed

            record["Ingredient_Names"] = parse_names(record["Ingredients_Raw"], cache)

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
