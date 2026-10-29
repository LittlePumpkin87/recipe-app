# tools

Utilities that belong to neither backend and are not part of the running
application: one prepares external data for import, one compares the two
backends in CI.

The data itself is **not** in this repository — `data/` is ignored. What is kept
here is the procedure, so that a local database can be rebuilt from the same
source and so that it stays recorded where the recipes came from.

## `allrecipes-csv-to-json.py`

Converts a recipe dump of allrecipes.com from CSV to NDJSON — one JSON object
per line — so that the importer in `apps/api` can read it without special
handling.

### Source

[Culinary Recipes Dataset](https://zenodo.org/records/15169428), Zenodo record
15169428, version v1, published 7 April 2025. A single `dataset.csv` of about
110 MB holding 50,510 recipes. Every record carries its original URL, and all of
them point to `www.allrecipes.com`; the recipes themselves were published
between 2018 and 2025.

### Licence

The Zenodo record states ODC-ODbL v1.0. That is the uploader's statement about
their own compilation — the recipe texts belong to allrecipes.com and their
authors.

Consequences, in line with [Shipped starter recipes](../docs/DECISIONS.md#shipped-starter-recipes)
and [Multi-user (V4)](../docs/DECISIONS.md#multi-user-v4):

- the data stays local and private; none of it enters this repository
- no imported recipe ever becomes `visibility: PUBLIC`
- re-fetching the full set from allrecipes.com is not an option; a single recipe
  through the V3 URL import is

### Reproducing the NDJSON

Download `dataset.csv` from the record above into `data/`, then run from the
repository root:

```bash
python3 tools/allrecipes-csv-to-json.py
```

Both paths can be overridden: `python3 tools/allrecipes-csv-to-json.py <source> <target>`.

### Why the conversion is needed

Two properties of the source would otherwise reach the importer:

- **The file is Windows-1252, not UTF-8.** Fractions such as `½` are single
  bytes that are invalid UTF-8. Decoding it wrongly would corrupt ingredient
  names, and because `normalizeIngredientName` applies NFC normalisation, a
  corrupted name normalises to something else and the same ingredient lands in
  the table twice without the unique index noticing.
- **The nested columns hold Python literals**, not JSON: `{'ingredient': 'pineapple'}`
  in single quotes. `JSON.parse` rejects them, and swapping quote characters
  breaks on the first apostrophe inside a string.

The script changes the **format only, never the meaning**. Units stay as the
source wrote them, quantities stay fractions, servings stay a list, instructions
stay an array of steps. Mapping those onto `Unit`, `Decimal(8,2)`, `servings`
and Markdown is the importer's work, in the language the application is written
in, where it can be tested and where the V3 URL import reuses it.

### Result of the run on 12 October 2026

```
50513 records written
0 records containing undecodable characters
unreadable fields per column:
      35 Ingredients_Raw
      10 Servings
       1 Nutrition
       1 Instructions
```

47 unreadable fields out of roughly 455,000 — none of them in `Ingredients`,
the column the import depends on. A field that cannot be parsed keeps its
original text under `_unparsed` rather than becoming `null`, so nothing is lost
silently.

Two notes for the importer:

- The ten unreadable `Servings` values are plain text instead of a list
  (`1 1/2 gallons`), from brines whose yield is a volume. They become an unknown
  serving count.
- 50,510 of the 50,513 URLs contain a numeric recipe id, but only 48,393 are
  distinct: the source holds about 2,100 duplicates. Writing `source_name` and
  `external_id` lets the existing unique constraint on
  (`source_name`, `external_id`) reject them, so the import is idempotent and
  the duplicates need no separate handling.

## `compare-responses.ts`

Checks that the NestJS and the ASP.NET Core backend answer `requests.http`
identically. The `??` assertions in that file test each backend on its own;
both can pass all of them and still disagree, for example on a renamed field.
This script puts the two runs side by side.

### Usage

Run the requests once per backend, each time after a fresh seed, then compare:

```bash
npx httpyac send requests.http --all -e nest --json -o body > /tmp/nest.json
npx httpyac send requests.http --all -e dotnet --json -o body > /tmp/dotnet.json
node tools/compare-responses.ts /tmp/nest.json /tmp/dotnet.json
```

Node 24 runs the file directly by stripping the types, so it only uses syntax
that can be erased: no `enum`, no parameter properties. Exit code 0 means both
runs agree, 1 lists every difference on stderr.

### Rules

- Requests are matched by position; both runs use the same file.
- The status code is compared for every request, except for the deliberate
  differences listed in `ALLOWED_STATUS_DIFFERENCES` by request title. Renaming
  such a request in `requests.http` turns the pipeline red until the list is
  updated.
- Bodies are compared only for 2xx. Error bodies differ on purpose — NestJS has
  its own format, ASP.NET Core returns ProblemDetails.
- `id` and `ingredientId` are dropped at every level, since each run generates
  new UUIDs. Responses carry no timestamps.
- Object keys are sorted before comparing, because the two serializers order
  them differently.
- Arrays keep their order: ingredient order (`position`) is part of the
  contract.
- An entry without a response on both sides is skipped: httpyac lists every
  `###` block, including the chapter headings that hold no request.
- A response on only one side (backend not reachable) counts as a difference.
