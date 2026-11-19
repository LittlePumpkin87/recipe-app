#!/usr/bin/env python3
"""Measures how many allrecipes recipes the ingredient catalogue maps
completely, and lists the most frequent names it does not know.

A recipe counts as covered when every line resolves to a catalogue entry. The
two raw-line rules from docs/DECISIONS.md are applied (cans, "red pepper"); the
importer is the authoritative implementation, this is an estimate.
"""

import json
import os
import re
import sys
import unicodedata
from collections import Counter

from ingredient_parser import parse_ingredient

SOURCE = "data/allrecipes.ndjson"
CATALOGUE = "apps/api/prisma/ingredient-catalog.json"
CACHE = "data/parsed-lines.json"
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


def parse_lines(recipes, cache):
    if os.path.exists(cache):
        with open(cache, encoding="utf-8") as file:
            return json.load(file)
    names = {}
    for lines in recipes:
        for line in lines:
            if line not in names:
                names[line] = [normalize(p.text) for p in parse_ingredient(line, string_units=True).name]
    with open(cache, "w", encoding="utf-8") as file:
        json.dump(names, file)
    return names


def resolve(raw_line, name, aliases):
    if name == "red pepper":
        name = "red pepper flakes" if FLAKES.search(raw_line) else "red bell pepper"
    if CAN.search(raw_line) and f"canned {name}" in aliases:
        return aliases[f"canned {name}"]
    return aliases.get(name)


def main():
    source = sys.argv[1] if len(sys.argv) > 1 else SOURCE
    catalogue = sys.argv[2] if len(sys.argv) > 2 else CATALOGUE
    cache = sys.argv[3] if len(sys.argv) > 3 else CACHE

    recipes = []
    with open(source, encoding="utf-8") as records:
        for record in records:
            raw = json.loads(record).get("Ingredients_Raw")
            if isinstance(raw, list):
                recipes.append([line for line in raw if line.strip()])

    names = parse_lines(recipes, cache)
    aliases = load_aliases(catalogue)

    covered = 0
    used = set()
    unknown = Counter()
    for lines in recipes:
        missing = []
        found = []
        for line in lines:
            for name in names[line] or ["(no name)"]:
                entry = resolve(line, name, aliases)
                (found if entry else missing).append(entry or name)
        if missing:
            unknown.update(set(missing))
        else:
            covered += 1
            used.update(found)

    print(f"recipes: {len(recipes)}, fully mapped: {covered} ({covered / len(recipes):.1%})")
    print(f"catalogue entries used by mapped recipes: {len(used)}")
    print(f"most frequent unknown names (recipes containing them):")
    for name, count in unknown.most_common(TOP_UNKNOWN):
        print(f"  {count:6}  {name}")


if __name__ == "__main__":
    main()
