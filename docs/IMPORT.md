# Bulk import: allrecipes

`src/import/import-allrecipes.ts` fills the database with about 24,700 English
recipes from a public allrecipes.com dump — those whose ingredients the
catalog knows completely. Where the data comes from, its
licence and how to produce `data/allrecipes.ndjson` from it is described in
[docs/TOOLS.md](TOOLS.md). The data stays local; none of it is in this
repository.

**Step by step**, from the repository root, with the database running and
migrated (steps 3 and 5 of [Getting started](../README.md#-getting-started)):

1. Download `dataset.csv` from [Zenodo record 15169428](https://zenodo.org/records/15169428)
   into `data/`.
2. Create the Python environment for the tools, once:

   ```bash
   python3 -m venv tools/.venv
   tools/.venv/bin/pip install -r tools/requirements.txt
   ```

3. Convert the CSV into `data/allrecipes.ndjson`. This runs the ingredient
   parser over every ingredient line and takes several minutes; a progress bar
   shows how far it is:

   ```bash
   tools/.venv/bin/python tools/allrecipes-csv-to-json.py
   ```

4. Empty the tables and run the import:

   ```bash
   docker compose exec db psql -U recipe -d recipe \
     -c 'TRUNCATE recipe_ingredient, ingredient_alias, recipe, ingredient;'
   npm run import:allrecipes
   ```

The NDJSON only has to be produced again when the source or the converter
changes; the import can be repeated from step 4.

All four tables go into one `TRUNCATE`, because Postgres refuses to empty a
table that another table still references.

**It is a script, not an endpoint.** It starts Nest as an application context,
without HTTP, and writes every recipe through `RecipesService.importRecipe()`
as one nested `create`, which Prisma runs as a transaction. The npm script compiles with `nest build` and runs
the result with `node`; `tsx` would be shorter but does not emit the decorator
metadata Nest's dependency injection reads. `class-validator` does not run
either — the `ValidationPipe` belongs to HTTP — so the adapter
(`allrecipes.adapter.ts`) does the checking itself.

**What the counters mean.** Each line of the file ends up in exactly one:

| Counter | Meaning |
|---|---|
| `imported` | written |
| `skipped` | rejected by the adapter before any write: broken source data |
| `unknown` | a line names an ingredient the catalog does not know; nothing written |
| `duplicates` | refused by the unique index on (`source_name`, `external_id`) — the source holds about 2,100 copies |
| `failed` | any other error; the source URL is printed |

The run on 25 November 2026 read 50,513 lines: 24,745 imported, 21,060
unknown, 3,479 skipped, 1,229 duplicates, 0 failed. `ingredient` held 1,201 rows
before and after — the catalog and nothing else.

**The import creates no ingredients.** It loads the ingredient catalog first:
`apps/api/prisma/ingredient-catalog.json` (1,201 entries) goes into `ingredient`
and `ingredient_alias` in a transaction of its own. The importer then reads all
English aliases once into a map, alias → ingredient id. The catalog cannot
change during the run, so every recipe is resolved in memory, without a query
per line. A recipe with one line that matches no alias counts as `unknown` and
is not written. `POST /recipes` and `PATCH /recipes/:id` are not affected: they
still create an ingredient they do not know. See
[Data model decisions](DECISIONS.md#data-model-decisions).

**How a line is read.** The ingredient name comes from `Ingredient_Names`, which
the converter fills with `ingredient-parser-nlp` (see
[docs/TOOLS.md](TOOLS.md)). Amount, unit and note come from the
source's own split into name, quantity, unit and remainder, with the original
line (`Ingredients_Raw`) as a fallback:

| Source line | Stored as |
|---|---|
| `2 cups white sugar` | `white sugar`, 2, `CUP` |
| `1 (18.25 ounce) package yellow cake mix` | `yellow cake mix`, 1, `PACK`, note `18.25 ounce` |
| `5 fluid ounces heavy cream` | `heavy cream`, 5, `FLUID_OUNCE` |
| `1 (14.5 ounce) can diced tomatoes` | `canned diced tomatoes`, 1, `CAN` |
| `1 teaspoon crushed red pepper` | `red pepper flakes`, 1, `TEASPOON` |
| `0.33 cup butter or margarine, melted` | `butter`, 0.33, `CUP`, note `or margarine, melted` |
| `salt and ground black pepper to taste` | two lines: `salt` and `black pepper`, each with note `to taste` |

The second row: the source leaves the unit empty and drops the decimal point
from the size, so the container word and the size are taken from the original
line. The third: the source cuts "fluid ounces" in half and leaves "ounces" at
the front of the name. Rows four and five are the two rules that read the
original line: the parser drops "can" and "crushed", and those words decide the
product. Rows six and seven: when the parser finds several names in one line,
a line with "or" keeps the first as the ingredient and the rest in the note, so
the shopping list counts one; any other line becomes one row per name, with the
amount on the first only.

**What gets skipped.** A recipe without a recipe id in its URL, without
instructions or ingredients, without parsed names, with a title over 100
characters, or with an ingredient whose name in the source's split is empty or
begins with a dash or a digit. The last rule protects the amount, not the name:
`1 1/4 cups white sugar` arrives as name `14 cups white sugar` with amount 1.
The parser fixes the name but the amount would still be wrong. For the same
reason a recipe is skipped when the split name is a broken phrase (`and cooled
rice`) and the original line begins with a digit (`2 cups cooked and cooled
rice`): there is no amount to trust.

**Do not seed afterwards.** `npx prisma db seed` empties every table, imported
recipes included.
