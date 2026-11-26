# API — how the endpoints work

The endpoint list is in the [README](../README.md#-api-endpoints). This file explains what happens behind them.

## How the two searches differ

Both search endpoints take `?search=` and both match on a substring, but they
compare against different columns, and the reason is worth knowing before
copying one into the other.

`GET /recipes?search=` filters on `recipe.title`, which stores the display form.
There is no second column to compare against, so the query asks Postgres to
ignore case with `mode: 'insensitive'` — Prisma turns that into `ILIKE`.

`GET /ingredients?search=` filters on `ingredient.nameNormalized` and pushes the
search term through the same `normalizeIngredientName` that wrote the column.
Both sides are lowercase, trimmed and NFC-normalized by the time they meet, so
no `mode` is needed. It is also the more correct of the two: `ILIKE` handles
case, but not an `ö` that arrived as `o` plus a combining diaeresis — a real
possibility with text pasted from elsewhere.

The rule that follows: **compare normalized values, display one of the four
names.** The search compares against `nameNormalized`; `POST /ingredients` and
the lookup inside `POST /recipes` compare against `ingredient_alias.alias`, which
is stored normalized as well. The search does not read aliases yet, so a
catalog entry is found by its English key ("salt", not "Salz"); searching all
aliases comes with #44. The API returns all four names; the frontend picks the
one for its language, falling back to the other number when one form is missing.

Recipe titles have no normalized column and do not need one. `?search=roemer`
finding *Römertopfbrot* is a nice-to-have; an ingredient list that grows a
second `Öl` row is a data defect.

The same split exists in the .NET API, one layer closer to the SQL: the recipe
search uses `EF.Functions.ILike`, the ingredient search `EF.Functions.Like`. See
[The reading endpoints](DECISIONS.md#the-reading-endpoints) for why the
weaker operator is the right one on a normalized column.

## `POST /recipes`: one request, one transaction

`POST /recipes` receives the recipe and its ingredient list in a single request.
Ingredients are referenced by name, never by id. For each line the service
normalizes the name and looks it up in `ingredient_alias` with the recipe's
`language`: a hit links that ingredient, otherwise a new one is created together
with its name as the first alias, in one nested write. English "paprika" is
therefore the spice from the catalog, while German "Paprika" finds no alias
(paprika, DE) and becomes an ingredient of its own. A name that appears twice in
one request — `"Salz"` for the soup and `" salz "` to taste — is looked up once;
the ids are kept in a `Map` keyed by the normalized name, so both lines point at
the same ingredient. `position` is taken from the index in the incoming list,
starting at 1.

`language` is required in the body and decides where a **new** ingredient's
name goes: `"DE"` writes `nameDe`, `"EN"` writes `nameEn`, the other column stays
`NULL`, and `nameNormalized` holds the name in that language. An existing
ingredient is linked unchanged. `POST /ingredients` takes the same `language`
field for the same reason. `PATCH /recipes/:id` may omit it; new ingredients in
a replaced list then take the recipe's stored language, and a `language` in the
same request wins over the stored one. The detail response carries the recipe's
`language`.

Three things are called "ingredient" here, and the code gives each its own word,
in both backends: an `ingredientLine` is what the request sent, an `ingredient`
is the row in the table, and a `recipeIngredient` is the link between a recipe
and one of them.

The request DTO has no `sourceUrl`, `sourceName` or `externalId`. Provenance
belongs to the importer, which writes through its own input type, and
`forbidNonWhitelisted` answers 400 if a client sends those fields anyway.

`buildRecipeCreateData` builds the insert's `data` and runs no query, so each
caller chooses its own `include` or `select`. Prisma derives the result type
from that argument: `create()` includes the ingredient lines for the mapper, the
importer selects only the `id`.

All of it runs in **one transaction**. The ingredients are written first, the
recipe and its join rows last, so the case that matters is a failure in between:
a dropped connection or a restart must not leave a freshly created ingredient
behind without a recipe. Every call inside the `$transaction` callback goes
through `transactionClient`. A single `this.prisma.` call in there would run on
a different connection, commit on its own and survive the rollback — and every
successful request would look exactly the same, which is why it has to be
tested with a failure.

That test was done by hand: with a temporary `throw` between the ingredient loop
and `recipe.create`, a request containing a new ingredient answers `500` and
leaves neither the ingredient nor the recipe in the database. Nest answers a
plain `Error` with a generic `Internal server error` on purpose, since its
message may contain internals; the message and stack trace appear only in the
server log.

On success the response is `201` with the same shape as `GET /recipes/:id`. The
mapper runs after the commit, outside the transaction.

**Aliases decide, in both backends.** `resolveIngredientIds` (Nest) and
`ResolveIngredientsAsync` (.NET), shared by `POST /recipes` and
`PATCH /recipes/:id`, look up `ingredient_alias` only; `nameNormalized` is the
row's key, not a search column. Nest asks once per name with `findUnique`, .NET
asks once for all names of the request and loads each alias's ingredient with
`Include`. Two requests that create the same new name at the same moment both
find no alias; the second then fails on the unique index with a 500. For one
household that is accepted. There is deliberately no endpoint for managing
aliases.

## `DELETE /recipes/:id`: one statement, no transaction

Deleting a recipe touches two tables and still needs no transaction. The foreign
key from `recipe_ingredient` to `recipe` is declared `ON DELETE CASCADE`, so
Postgres removes the join rows as part of the same `DELETE` statement, and a
single statement is always all or nothing. `POST /recipes` needs `$transaction`
because it sends several statements in a row; this endpoint sends one. The
ingredients themselves stay — the cascade only runs from a recipe to its lines.

The service deletes without looking first, for the same reason `POST
/ingredients` inserts without looking first: a missing row surfaces as Prisma
error `P2025` and becomes a `404`. A successful delete answers `204 No Content`,
since the client already knows which recipe it removed. A second `DELETE` on the
same id answers `404`.

## `PATCH /recipes/:id`: fields in place, ingredient list replaced

A field missing from the request is left untouched: Prisma treats `undefined` as
"do not change", so `{ "title": "…" }` renames the recipe and nothing else.
`null` is different — it clears a nullable column such as `description`, and is
rejected with a `400` for a `NOT NULL` one (see "Optional is not the same as
nullable" under [DTOs, mappers and validation](BACKEND.md#dtos-mappers-and-validation)).

A present `ingredients` replaces the whole list. Inside one transaction the
service updates the recipe's own fields, resolves the ingredient names exactly
as `POST /recipes` does — both call the same private `resolveIngredientIds` —
deletes every `recipe_ingredient` row of the recipe and writes the new list,
positions again taken from the index. An ingredient that dropped out of the list
is unlinked, not deleted; it stays in `ingredient` for other recipes.

`updated_at` is not set by the service. A request carrying only `ingredients`
leaves every recipe field `undefined`, and Prisma then sends no `UPDATE` for the
recipe at all — a recipe whose flour went from one to two tablespoons would look
untouched. Since 12 October 2026 two database triggers own the column, the
second of which covers exactly this case by touching the parent recipe whenever
a `recipe_ingredient` row changes. See
[Second backend: ASP.NET Core](DECISIONS.md#second-backend-aspnet-core).

Replacing gives the join rows new ids on every edit. That is harmless as long as
nothing points at a single row: the meal plan will point at recipes, the
shopping list at ingredients, nutrition figures at either. Should that change,
the rows already carry their own `id`, so a line-by-line comparison would change
the API and the service, not the schema.

**The order inside the transaction matters.** The recipe update runs first. For
an unknown id it raises `P2025` before anything has been written, and the
service answers `404`. Resolving the ingredients first would create ingredients
for a recipe that does not exist, and inserting the join rows would then fail on
the foreign key with `P2003` — rolled back all the same, but answered with a
`500`. Prisma checks the row even when `data` is empty, so a request carrying
only `ingredients` answers `404` for an unknown id as well. The `catch` sits
around the whole `$transaction`, never inside the
callback: an error caught in there would let the callback finish normally, and
Prisma would commit.

On success the response is `200` with the updated recipe, read with
`findUniqueOrThrow` at the end of the transaction — a query that already sees
the transaction's own, not yet committed writes.

## Duplicates: let the constraint decide

`POST /ingredients` does not look for an existing row before it writes. It
inserts the ingredient and its first alias in one write, and the unique indexes
decide: (`alias`, `language`) on `ingredient_alias` and (`name_normalized`,
`language`) on `ingredient`. If the name is taken in that language, Postgres
refuses the insert, nothing of the write remains, Prisma raises error code `P2002`,
and the service turns that into `409 Conflict`. The .NET backend follows the same
rule against the same indexes; only the name of the refusal differs, where Npgsql
reports SQLSTATE `23505` inside an EF Core `DbUpdateException` — see
[The writing endpoints](DECISIONS.md#the-writing-endpoints).

A lookup first would not save the catch, only add a query. Two requests for
"Zwiebel" arriving together would both find nothing and both insert, and the
second would still hit the index — as an unhandled 500. The index is the only
check that holds when requests overlap, so it is the only check.
`POST /recipes` relies on the same index for the ingredients it creates.

Two consequences worth knowing:

- **The first spelling wins.** `" ZWIEBEL "` and `"Zwiebel"` normalize to the
  same value, so whichever arrives second is refused, and the ingredient keeps
  the display form of the first. There is no `PATCH /ingredients` in V1;
  rename it in Prisma Studio.
- **A name is taken per language.** "Eier" in German is an alias of the
  catalog entry egg, so `{ "name": "Eier", "language": "DE" }` answers 409. In
  English there is no alias "eier", so the same name with `"EN"` creates a new
  ingredient.
