#!/usr/bin/env python3
"""Measures how many allrecipes recipes the ingredient catalog maps
completely, and lists the most frequent names it does not know.

A recipe counts as covered when every line resolves to a catalog entry. The
names come from `Ingredient_Names`, written by allrecipes-csv-to-json.py. The
two raw-line rules from docs/DECISIONS.md are applied (cans, "red pepper"); the
importer is the authoritative implementation, this is an estimate.
"""

import json
import re
import sys
import unicodedata
from collections import Counter

SOURCE = "data/allrecipes.ndjson"
CATALOG = "apps/api/prisma/ingredient-catalog.json"
TOP_UNKNOWN = 30

CAN = re.compile(r"\b(cans?|jars?)\b", re.I)
FLAKES = re.compile(r"\b(crushed|teaspoons?|tablespoons?|tsp|tbsp|pinch(es)?|dash(es)?)\b", re.I)


def normalize(name):
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", name)).strip().lower()


def load_aliases(path):
    with open(path, encoding="utf-8") as file:
        entries = json.load(file)
    aliases = {}
    for entry in entries:
        key = entry["en"] or entry["enPlural"]
        names = [entry["en"], entry["enPlural"], *entry["aliases"]["en"]]
        for alias in filter(None, names):
            aliases[normalize(alias)] = key
    return aliases


def resolve(raw_line, name, aliases):
    if name == "red pepper":
        name = "red pepper flakes" if FLAKES.search(raw_line) else "red bell pepper"
    if CAN.search(raw_line) and f"canned {name}" in aliases:
        return aliases[f"canned {name}"]
    return aliases.get(name)


def main():
    source = sys.argv[1] if len(sys.argv) > 1 else SOURCE
    catalog = sys.argv[2] if len(sys.argv) > 2 else CATALOG

    recipes = []
    with open(source, encoding="utf-8") as records:
        for record in records:
            recipe = json.loads(record)
            raw = recipe.get("Ingredients_Raw")
            names = recipe.get("Ingredient_Names")
            if isinstance(raw, list) and isinstance(names, list):
                recipes.append([
                    (line, [normalize(name) for name in line_names])
                    for line, line_names in zip(raw, names)
                    if line.strip()
                ])

    aliases = load_aliases(catalog)

    covered = 0
    used = set()
    unknown = Counter()
    for lines in recipes:
        missing = []
        found = []
        for line, line_names in lines:
            for name in line_names or ["(no name)"]:
                entry = resolve(line, name, aliases)
                (found if entry else missing).append(entry or name)
        if missing:
            unknown.update(set(missing))
        else:
            covered += 1
            used.update(found)

    print(f"recipes: {len(recipes)}, fully mapped: {covered} ({covered / len(recipes):.1%})")
    print(f"catalog entries used by mapped recipes: {len(used)}")
    print("most frequent unknown names (recipes containing them):")
    for name, count in unknown.most_common(TOP_UNKNOWN):
        print(f"  {count:6}  {name}")


if __name__ == "__main__":
    main()
