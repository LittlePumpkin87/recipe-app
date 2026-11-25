#!/usr/bin/env python3
"""Counts every ingredient name in the allrecipes NDJSON, read from the raw
lines by `ingredient-parser-nlp`, and writes them by frequency as TSV.

This was the starting point of the ingredient catalog: the most frequent
names were grouped into catalog entries. Run it again after a dataset update
to find frequent names the catalog does not know yet.
"""

import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict

from ingredient_parser import parse_ingredient

SOURCE = "data/allrecipes.ndjson"
TARGET = "data/ingredient-inventory.tsv"
COVERAGE_MARKS = (0.5, 0.75, 0.8, 0.9, 0.95, 0.98)


def normalize(name):
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", name)).strip().lower()


def main():
    source = sys.argv[1] if len(sys.argv) > 1 else SOURCE
    target = sys.argv[2] if len(sys.argv) > 2 else TARGET

    line_counts = Counter()
    recipes_per_line = defaultdict(set)
    with open(source, encoding="utf-8") as records:
        for recipe_index, record in enumerate(records):
            raw = json.loads(record).get("Ingredients_Raw")
            if not isinstance(raw, list):
                continue
            for raw_line in raw:
                if raw_line.strip():
                    line_counts[raw_line] += 1
                    recipes_per_line[raw_line].add(recipe_index)

    name_lines = Counter()
    name_recipes = defaultdict(set)
    example = {}
    without_name = 0
    for raw_line, count in line_counts.items():
        parsed = parse_ingredient(raw_line, string_units=True)
        if not parsed.name:
            without_name += count
            continue
        for part in parsed.name:
            name = normalize(part.text)
            name_lines[name] += count
            name_recipes[name] |= recipes_per_line[raw_line]
            example.setdefault(name, raw_line)

    with open(target, "w", encoding="utf-8") as out:
        out.write("lines\trecipes\tname\texample\n")
        for name, count in name_lines.most_common():
            out.write(f"{count}\t{len(name_recipes[name])}\t{name}\t{example[name]}\n")

    print(f"distinct raw lines: {len(line_counts)}, lines without name: {without_name}")
    print(f"distinct names: {len(name_lines)}, used once: {sum(1 for c in name_lines.values() if c == 1)}")

    total = sum(name_lines.values())
    running = 0
    marks = iter(COVERAGE_MARKS)
    mark = next(marks)
    for rank, (_, count) in enumerate(name_lines.most_common(), 1):
        running += count
        while mark and running / total >= mark:
            print(f"{mark:.0%} of lines covered by top {rank} names")
            mark = next(marks, None)


if __name__ == "__main__":
    main()
