# Design decisions — recipe-app

Why the project looks the way it does, including the alternatives that were rejected
and why. Split out of the README so that the README stays a guide to running the
project rather than a record of how it got here.

New decisions are recorded in the closing comment of the issue they belong to and
labelled `decision`. `is:issue is:closed label:decision` lists them.

See also [README.md](../README.md) for setup, data model and API endpoints.

---

## Data model decisions

**Units are an enum, not free text.** A string column produces "tbsp", "Tbsp"
and "tablespoon" as three distinct units, which makes the V2 shopping list
impossible to aggregate. No conversion happens anywhere — not even grams to
kilograms; amounts are only ever added up when the unit is identical. That is
also why `CUP` is harmless despite being defined differently around the world.

**Uniqueness sits on `nameNormalized`, not on `name`.** A `@unique` on `name`
compares byte for byte and would happily store "Zwiebel" next to "zwiebel".
`name` keeps the display spelling; `nameNormalized` holds the folded form and
carries the index. The database does not normalise on its own — it only compares
what it is handed.

The folding therefore lives in exactly one place, `src/common/normalize-name.ts`,
and both the seed and the service call it. Two definitions would drift apart and
the unique index would stop catching anything. It applies NFC normalisation,
collapses whitespace runs to a single space, trims, and lowercases. NFC is the
one that is invisible: `ö` exists both as a single code point and as `o` plus a
combining diaeresis, identical on screen and two different strings to Postgres.

**Plural detection is deliberately not automated.** German has no rule for it
(Zwiebeln→Zwiebel, but Eier→Ei and Lachs→Lachs). `IngredientAlias` exists so a
mapping can be recorded once, by hand, and reused. The real protection against
duplicates is the autocomplete when entering a recipe.

**`onDelete` differs per direction, on purpose.** Deleting a recipe cascades to
its `RecipeIngredient` rows — "200 g flour" means nothing without its recipe.
Deleting an *ingredient* that is still used is restricted, which is the default
and left implicit: cascading there would silently strip an ingredient from every
recipe that uses it, and nobody would notice until they cooked one.

**`amount` is `Decimal`, and optional.** Binary floating point cannot represent
0.1 exactly, so adding three of them for a shopping list yields
`0.30000000000000004`. `Decimal(8, 2)` is exact. It is nullable because "salt to
taste" has neither an amount nor a unit — `unit` is nullable for the same
reason, so the V2 shopping list has to handle NULL either way: list the
ingredient, but do not add it up.

**Two time fields, not one.** `prepMinutes` is hands-on work, `totalMinutes` is
wall clock including resting and baking. A bread with 15 minutes of work and two
hours of proving makes the case: one column would answer two different questions
and get one of them wrong. The V2 meal plan cares about `prepMinutes` ("can I do
this on a Tuesday?"), planning the day itself about `totalMinutes` ("when do I
have to start?"). Both are optional. Finer breakdowns — resting and baking as
separate figures — stay in `description` rather than becoming columns.

**`instructions` holds Markdown, not HTML** (decided 17 September 2026). The
column is plain `text` and always was; what changed is what goes into it. Bold
text, lists and links are all expressible in Markdown, so the format restricts
nothing a recipe needs to say.

Storing HTML would have put a sanitiser into both backends. From V3 on,
instruction text arrives from other people's websites, where schema.org delivers
it as HTML — stored unfiltered, that is stored XSS. Sanitising means an allowlist
of tags and attributes, and this repository has two backends: `sanitize-html` in
TypeScript and `Ganss.Xss` in C#, two lists that would have to stay identical.
That is the shape of the normalisation problem again, with a worse failure mode.
A diverging normalisation produces a duplicate row; a diverging allowlist
produces a hole.

Markdown needs none of it. `**Teig**` is inert in every language, so neither
backend gains a dependency and nothing has to be checked on write. Rendering —
and with it sanitising — happens once, in Angular, where the DOM is actually
produced.

Two further consequences fall out in the project's favour. The renderer can be
limited to bold, lists and links and made to drop headings, so a recipe body
cannot break the page's heading outline and the WCAG AA requirement survives
contact with user input. And unrendered Markdown is still readable prose, where
unrendered HTML is markup.

The editor is a `<textarea>` with a small toolbar and a preview (Sprint 8), not a
WYSIWYG component. Recipe *steps* as their own table remain a V2 ticket and are a
separate question: paragraphs are formatting and belong in the text, steps are
data, and a table only earns its place once something uses the structure —
ticking them off while cooking, a timer per step.

**`note`, `groupLabel` and `position` belong to the line, not to the
ingredient.** `note` holds the qualifier for this one occurrence — "fresh",
"finely diced", "level", "for frying". `groupLabel` is the sub-heading a recipe
prints above a run of ingredients ("Für den Teig"); it is presentation only and
plays no part in any lookup. `position` is `NOT NULL` with no default on
purpose: the order of an ingredient list is part of the recipe, and there is no
sensible fallback. It is assigned from the index of the incoming list, never
maintained by hand.

**Primary keys are UUID v7** (`@default(dbgenerated("uuidv7()")) @db.Uuid`). The
first 48 bits are a timestamp, so keys sort chronologically and new rows append
to the end of the index instead of landing in random places, the way v4 does.

The value is generated by **PostgreSQL 18**, which ships `uuidv7()` as a
built-in function, not by the Prisma client. `dbgenerated` tells Prisma that the
column has a default it does not control, and the migration writes it into the
table. The practical difference from `@default(uuid(7))`, which generates in the
client: a hand-written `INSERT` in psql that omits `id` works.

**The join table allows the same ingredient twice.** `RecipeIngredient` has its
own `id` primary key rather than a composite one over `(recipeId,
ingredientId)`. Real recipes need it: a Langos lists `Öl` twice, 30 ml in the
dough and an unmeasured amount for frying. `note` and `amount` are what tell the
two rows apart. The cost is that nothing stops a duplicate entered by mistake —
that check belongs in the service, where it can distinguish the two cases.

**Scaling servings is calculated, never written back.** Amounts always refer to
`recipe.servings`. Writing a scaled amount back would overwrite the base value
every time somebody cooks for a different number of people.

---

## Second backend: ASP.NET Core

The V1 API will be implemented a second time, in C# with ASP.NET Core and Entity
Framework Core. Both are learning goals of this project next to NestJS, and the
project already holds everything a second backend needs: a finished API to match
and a database to talk to.

It works because the frontend only knows URLs and JSON. Both backends serve the
same endpoints with the same request and response shapes, against the same
PostgreSQL database. Only one of them runs at a time; `requests.http` tests
either one by pointing `@host` at the other port.

The order is deliberate. The NestJS API for V1 is completed first, so the .NET
version has a working reference for every endpoint and only the framework is
new. The Angular frontend comes after both backends because it is the part of
the stack that is already familiar.

**Prisma owns the schema.** EF Core has a migration system of its own, and two
migration histories changing one database contradict each other. The .NET
backend therefore reads the existing tables — database first, via
`dotnet ef dbcontext scaffold` — and never creates a migration. Every schema
change still starts in `schema.prisma`.

Three things the two backends have to agree on that the database does not
enforce today. Two of them were settled on 15 September 2026, before the .NET
work started; neither is built yet.

- **`updatedAt` — decided: two database triggers.** `@updatedAt` is Prisma
  client behaviour, not a database default (see
  [Prisma Studio](../README.md#prisma-studio)). EF Core knows nothing about it, so a second
  backend would have to carry the same rule a second time, and edited recipes
  would otherwise keep their creation timestamp. The rule moves into the
  database instead: a `BEFORE UPDATE` trigger on `recipe` sets
  `NEW.updated_at = now()`, and an `AFTER INSERT/UPDATE/DELETE` trigger on
  `recipe_ingredient` sets the column on the parent recipe. The second trigger
  is what makes the rule complete. An update carrying only the ingredient list
  sends no `UPDATE` for the recipe at all, so a trigger on `recipe` alone would
  miss exactly the case that prompted the question (see the PATCH section).
  A trigger cannot be expressed in `schema.prisma`; it arrives as hand-written
  SQL in a migration created with `--create-only`. Until then both backends
  keep setting the column themselves.
- **Name normalization — decided: one implementation per language, one shared
  set of test cases.** The rule that `normalizeIngredientName` exists in exactly
  one place cannot hold across two languages. A C# version that skipped NFC
  would let an existing ingredient in a second time, as a row the unique index
  does not recognise as a duplicate. A generated column in Postgres was the
  alternative and was rejected: normalization runs on the read side as well —
  the search term in `IngredientsService.findAll` has to pass through the same
  function before it can match `name_normalized` — so C# needs its own
  implementation either way, and the column would have removed only half of the
  duplication. It would also have been the harder half to verify: Prisma cannot
  express a generated column, and `nameNormalized` is written explicitly in
  every `create` and `upsert`.
- **The `unit` enum and UUID v7.** Npgsql, the .NET driver for PostgreSQL, has
  to be told explicitly about the Postgres enum type `unit`, and EF Core has to
  leave `id` to the database the way Prisma does.

**The shared normalization test cases.** Both implementations apply the same
steps in the same order — NFC, runs of whitespace to a single space, trim,
lowercase — and both have to produce these results:

| Input | Expected | Guards against |
|---|---|---|
| `"ZWIEBEL"` | `zwiebel` | case |
| `"  Zwiebel  "` | `zwiebel` | surrounding whitespace |
| `"Crème  fraîche"` | `crème fraîche` | repeated whitespace |
| `"Frühlingszwiebel"` with a decomposed `ü` (`u` + U+0308) | same result as the composed spelling | missing NFC |
| `"Öl"` | `öl` | lowercasing beyond ASCII |

The NFC case is the only one that is invisible on screen: an editor draws both
spellings identically, but one string is a character longer than the other. That
is precisely why it belongs in the list — and why the same cases will run
against both backends in the CI pipeline.

Timestamps were a fourth such point and were settled in the database before the
.NET work began: `created_at` and `updated_at` are `timestamptz`, which Npgsql
maps to a `DateTime` of kind `Utc`. With plain `timestamp` columns it would have
refused to write a UTC `DateTime` at all. See [Timestamps](../README.md#timestamps).

**One `DATABASE_URL`, two spellings.** Both backends read the same variable from
the same `.env`, but they do not accept the same format. Prisma expects the URI
form, `postgresql://user:password@host:port/database`. Npgsql expects semicolon-
separated pairs, `Host=…;Username=…`, and has never supported URIs
([npgsql#2090](https://github.com/npgsql/npgsql/issues/2090), open since 2018).

Rather than keeping the same secret twice in two spellings, the .NET backend
translates at startup. `AddDatabaseConnection` in
`apps/api-dotnet/Utility/UrlExtensions.cs` is an extension method on
`WebApplicationBuilder` and handles three cases in order:

1. `ConnectionStrings:Default` is already set — do nothing. This is what lets
   Compose supply the connection directly as `ConnectionStrings__Default` later,
   without the translation getting in the way.
2. Neither that nor `DATABASE_URL` is set — throw, so startup fails immediately
   and with a readable message instead of at the first query.
3. Otherwise split the URI with `System.Uri`, rebuild it with
   `NpgsqlConnectionStringBuilder`, and store the result under
   `ConnectionStrings:Default`, where EF Core will look for it.

Three details in that translation are easy to get wrong:

- **`?schema=public` is a Prisma parameter.** Npgsql has no `schema` keyword and
  rejects the connection string if the query part is carried over. `public` is
  the default anyway, so the query is dropped.
- **`UserInfo` is a single string**, `user:password`, split at the *first* colon —
  a password may contain colons of its own.
- **A URI without an explicit port yields `-1`**, not the default, so 5432 is
  filled in by hand.

ASP.NET Core does not read `.env` files at all; that convention comes from Node.
[DotNetEnv](https://www.nuget.org/packages/DotNetEnv) loads the repository-root
`.env` into environment variables before `WebApplication.CreateBuilder` builds
the configuration — `TraversePath()` walks up from the project directory to find
it, and `NoClobber()` leaves real environment variables untouched, which is what
a container needs.

### Reading the schema into EF Core

The model classes and the `DbContext` are generated from the live database, not
written by hand. The command lives here because it is not a one-off: every
change to `schema.prisma` is followed by another run.

`dotnet ef` is not part of the SDK. It is registered in
`.config/dotnet-tools.json`, so a fresh clone needs one restore before the
command below works:

```bash
dotnet tool restore
```

Then, from `apps/api-dotnet`:

```bash
dotnet ef dbcontext scaffold "Name=ConnectionStrings:Default" \
  Npgsql.EntityFrameworkCore.PostgreSQL \
  --context RecipeDbContext \
  --context-dir Data \
  --output-dir Models \
  --no-onconfiguring \
  --table recipe \
  --table ingredient \
  --table ingredient_alias \
  --table recipe_ingredient \
  --force
```

Four of those arguments are not cosmetic.

- **`Name=ConnectionStrings:Default`** resolves through the application's own
  configuration, which means `AddDatabaseConnection` supplies the connection and
  the password never reaches the shell history.
- **`--no-onconfiguring`** suppresses an `OnConfiguring` method that would
  otherwise be written into the `DbContext` with the connection string — password
  included — in plain text. The scaffolder prints a warning about it, but by then
  the file exists.
- **`--table`**, once per table. Without it the scaffolder also picks up
  `_prisma_migrations`, Prisma's own bookkeeping, and turns it into a model
  class. EF Core sees the database, not the intent; naming the four tables keeps
  the migration history out of a backend that must never write to it.
- **`--force`** overwrites. It does not tidy up: a file the run no longer
  produces is simply left behind, so a table dropped from the schema leaves its
  class on disk until it is deleted by hand.

**The `unit` columns are hand-written.** A PostgreSQL enum has no CLR type to map
to, so the scaffolder emits `HasPostgresEnum` for the type itself and then skips
every column using it:

```
Enum column 'public.ingredient.default_unit' cannot be scaffolded,
define a CLR enum type and add the property manually.
```

This is a warning, not an error. The build succeeds and two columns are silently
absent — which is why it is written down here. Three files supply what the
scaffolder cannot, and none of them is touched by a later `--force`:

| File | Contains |
|---|---|
| `Models/Unit.cs` | the C# enum, one `[PgName]` per value |
| `Models/UnitProperties.cs` | `Ingredient.DefaultUnit` and `RecipeIngredient.Unit` |
| `Data/RecipeDbContext.Partial.cs` | `HasColumnName` for both |

The `[PgName]` attributes are required rather than decorative. Npgsql translates
member names to snake_case by default and would look for `gram`, while the values
in Postgres are upper case. Spelling each one out also keeps the mapping visible:
a unit added to `schema.prisma` has to be added here too, and the pairing is
readable line by line.

`MapEnum` completes the link when the context is registered in `Program.cs`:

```csharp
builder.Services.AddDbContext<RecipeDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("Default"),
        npgsql => npgsql.MapEnum<Unit>("unit")));
```

**Generated files are never edited.** Everything hand-written goes into a
separate file — a `partial class` for the models, and for the context the
`OnModelCreatingPartial` hook that the scaffolder declares and calls at the end
of `OnModelCreating` for exactly this purpose. The rule matters more here than in
a code-first project, because the regeneration is routine rather than rare.

The same reasoning rules out `IEntityTypeConfiguration<T>`, the usual way to
split a large `OnModelCreating` into one file per entity: the scaffolder does not
produce it, so it would have to be maintained by hand and rewritten after every
schema change. With four tables the generated `OnModelCreating` stays readable
as it is.

**What to check after a run.** The generated configuration should still carry
`HasDefaultValueSql("uuidv7()")` on every id — that is what makes EF Core omit
the column on insert and read the value back, leaving id generation to Postgres
18 the way Prisma does. Timestamps appear as `HasPrecision(3)` with no explicit
column type, because Npgsql maps `DateTime` to `timestamptz` by default; see
[Timestamps](../README.md#timestamps).

### The reading endpoints

`GET /recipes` and `GET /recipes/{id}` answer with the same JSON as the NestJS
versions, but four things had to be arranged differently to get there.
`GET /ingredients` adds a fifth, at the end of this section.

**The projection is the column list.** On the Prisma side, picking columns and
shaping the response are two separate steps: `select: recipeListSelect` names the
columns, `toRecipeListItem` builds the object (see
[DTOs, mappers and validation](../README.md#dtos-mappers-and-validation)). EF Core has no
equivalent of that first step. A mapping function taking a loaded `Recipe` would
force every column to be read first, `instructions` included — the one thing the
overview is supposed to avoid. Written into the query instead, as
`Select(r => new RecipeListItemDto(…))`, the shape *is* the column list and the
generated SQL reads five columns.

The same holds one level down. `GET /recipes/{id}` needs the ingredient name,
which lives a table deeper, and the detail query reaches it with
`i.Ingredient.Name` inside the nested projection rather than with
`Include`/`ThenInclude`. `Include` loads a related entity in full and is ignored
inside a projection; the navigation in the `Select` is what makes EF Core write
the join. Ordering by `position` goes into that inner projection too, where
Prisma had it on the `include`.

A consequence worth naming: `AsNoTracking()` is absent on purpose. What comes out
of a projection is not an entity, so the change tracker has nothing to track.

**Two System.Text.Json defaults differ from Nest.** Property names already match
— camelCase is the default, so `PrepMinutes` serialises as `prepMinutes`. Enums
do not: by default they are written as **numbers**, which would have put
`"unit": 6` where Nest writes `"unit": "TABLESPOON"`. `Models/Unit.cs` therefore
carries `[JsonConverter(typeof(JsonStringEnumConverter))]` on the type and a
`[JsonStringEnumMemberName]` per value, next to the `[PgName]` attributes that
were already there. The two look alike and are read by different libraries:
`PgName` faces the database, `JsonStringEnumMemberName` faces the HTTP client.
That they carry the same text is a property of the values chosen, not a link
between the attributes.

`decimal?` needs no such help. `amount` serialises as a number on its own, where
Prisma's `Decimal` had to be sent through `.toNumber()` to avoid a quoted string.

**400 and 404 are decided by a missing route constraint.** An unknown but valid
UUID has to answer 404, a path that is not a UUID at all has to answer 400. With
`[HttpGet("{id:guid}")]` the constraint is checked during routing, `/recipes/x`
matches no endpoint, and the answer is 404 — wrong for this contract. Without the
constraint the route matches, model binding fails to parse the segment into a
`Guid`, and `[ApiController]` turns that into a 400 with `ValidationProblemDetails`.
NestJS arrives at the same two answers through `ParseUUIDPipe`, which throws
`BadRequestException`.

The error *body* is not aligned, deliberately. Nest sends
`{ statusCode, message, error }`, ASP.NET Core sends RFC 9457 `ProblemDetails`.
The contract between the two backends is the status code; matching the body would
mean working against the platform for a payload a client does not read. For the
same reason the UUID *version* is not checked: `ParseUUIDPipe({ version: '7' })`
rejects a v4 UUID with 400, `Guid` has no such notion, and an unknown v7 UUID
ends in 404 regardless.

**The service returns `null` rather than throwing.** `RecipesService.findOne`
throws `NotFoundException`, which is idiomatic in Nest because the framework
ships an exception filter that turns any `HttpException` into a response. ASP.NET
Core has no such mapping: an escaping exception is a 500 unless middleware is
added to translate it. So `GetByIdAsync` returns `RecipeDetailDto?` and the
controller decides that `null` means `NotFound()`.

**`Like`, not `ILike`, is what a normalized column asks for.** This is the fifth
point, and it belongs to `GET /ingredients?search=`. The search term goes through
`IngredientName.Normalize` — not through `Trim` — and is then compared against
`name_normalized`. That is the read side of the normalisation decision: a
computed column in Postgres would have covered the write side only, because a
term that never passed through the same function cannot match the column it is
compared with.

Once both sides are lowercase, the case-insensitive operator has nothing left to
do. `EF.Functions.ILike` still works, but it is wrong in three small ways.
It claims the column may hold uppercase letters, which `Normalize` rules out on
every write, so the next reader has to go looking for a case that does not exist.
It folds case a second time, by the database locale rather than by
`ToLowerInvariant` — a second definition of "the same name" next to the one the
whole decision was meant to keep singular. And it would put different SQL behind
the same endpoint on the two ports, which the shared request file in sprint 9 is
supposed to rule out. `EF.Functions.Like` comes from EF Core itself, `ILike` from
the Npgsql provider; `ILIKE` is a Postgres extension and appears in no SQL
standard.

The recipe search keeps `ILike`, and for the opposite reason: `recipe.title`
stores the display form, `Römertopfbrot` with a capital R, and `?search=römer`
has to find it. There the case folding is the work, not the surplus.

One query shows the whole rule. It filters on `name_normalized`, orders by `name`
and projects `name` into the DTO: **compare against the normalized column,
display and sort the other one.** The cap of 20 rows sits between the ordering
and the projection, so Postgres sorts the whole table and returns the first
twenty — the autocomplete wants the first twenty by name, not twenty arbitrary
rows sorted afterwards.

### The writing endpoints

`POST /ingredients` is the first of them, and the smallest: one row, no
transaction. What it had to settle applies to every write that follows.

**The unique index decides, in both languages.** Neither backend looks for an
existing row before it writes — the reasoning is in
[Duplicates: let the constraint decide](../README.md#duplicates-let-the-constraint-decide)
and does not change with the language. What changes is the shape of the refusal.
Prisma raises `P2002`; Npgsql raises a `PostgresException` whose `SqlState` is
`23505`, the SQLSTATE that Prisma's code stands for, available as
`PostgresErrorCodes.UniqueViolation` rather than as a literal. It arrives wrapped
in EF Core's `DbUpdateException`, so the catch has to look at `InnerException` —
done as an exception filter (`when`), which leaves every other
`DbUpdateException` untouched instead of catching it and rethrowing.

**The service knows no status codes.** In Nest, `IngredientsService.create`
throws `ConflictException` and the framework's exception filter answers 409.
ASP.NET Core has no such mapping, and an escaping exception is a 500. The same
split is rebuilt by hand: `Exceptions/ConflictException.cs` is a plain exception
named after the status code, `ConflictExceptionHandler` implements
`IExceptionHandler` and returns `false` for anything else, and `Program.cs` wires
it with `AddExceptionHandler` plus `AddProblemDetails` and enables it with
`UseExceptionHandler`. Without the `AddProblemDetails` the 409 would come back
with an empty body.

**Unknown fields are refused globally.** Nest's `ValidationPipe` is configured
with `forbidNonWhitelisted`, so `{ "name": "Lauch", "id": "abc" }` is a 400.
System.Text.Json skips unmapped members silently, which would have made the same
body a 201, so `AddJsonOptions` sets
`UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow`. The deserialiser
then throws, the input formatter records a model error, and `[ApiController]`
answers 400 — the same route every other validation failure takes. It is set
globally rather than as an attribute on the DTO because `forbidNonWhitelisted` is
global too, and because `POST /recipes` would otherwise need the attribute on the
nested ingredient line as well. The pipe's other half, `whitelist: true`, needs no
counterpart: it strips unknown properties off the object, which System.Text.Json
never puts there.

**201 without a `Location` header.** Nest answers 201 to any `@Post` by default;
ASP.NET Core returns whatever the action returns, and `Ok(dto)` would have been a
200 and a broken contract. `CreatedAtAction` is the usual answer and does not fit
here — it builds `Location` from an action, and V1 has no route that serves a
single ingredient. So the action returns `Created` with no URI. The `null` needs a
cast to `string?`, because `Created(null, value)` is ambiguous between the
`string?` and the `Uri` overload.

The error *body* is not aligned here either, for the reason given above under the
reading endpoints: the contract between the backends is the status code.

`POST /recipes` follows, and it is where the two ORMs stop resembling each other.

**The transaction is explicit, and it did not have to be.** EF Core wraps every
`SaveChangesAsync` in a transaction of its own. Written as a single save — the new
ingredients hung into the recipe through navigation properties, EF ordering the
INSERTs itself — the endpoint would already be atomic, with no
`BeginTransactionAsync` anywhere. That version was rejected for a reason that is
about the project, not about the code: it makes the ticket's rollback criterion
vacuous, because nothing has been written before the one save, so there is nothing
to roll back. The service therefore saves twice — ingredients first, so they carry
their ids, then the recipe with its join rows — and holds the two together with an
explicit transaction. Without it, a failure in the second save would leave freshly
created ingredients behind. The test was done by hand, exactly as on the Nest side:
a temporary `throw` between the two saves, a request naming an ingredient that did
not exist yet, 500, and the name absent from `ingredient` afterwards.

Rollback needs no `catch`. The transaction is held in an `await using` variable, and
a transaction disposed without a commit rolls back, so an exception escaping before
`CommitAsync` does the right thing on its own.

**There is no `upsert`, which turns out to be an improvement.** `resolveIngredientIds`
upserts once per line, so twenty ingredients are twenty round trips. EF Core offers
nothing equivalent, and the shape that replaces it is a single query: normalise every
name, `Distinct()`, and one `Where(... Contains ...)`, which Npgsql writes as
`name_normalized = ANY($1)`. What comes back is a dictionary keyed by the normalised
name; the loop then adds an entity for each name that is missing from it. A name
appearing twice in one request is handled by the same dictionary — the new entity is
put in it immediately, so the second `" salz "` finds what the first `"Salz"` created.

**The dictionary holds entities, not ids.** Prisma can return an id because `upsert`
has already written the row. Here a new ingredient has no id until Postgres assigns
one, so the join row is linked through the navigation property
(`Ingredient = ingredient`) and EF fills the foreign key once it knows it. The same
line works for ingredients that were already in the database, so the loop never has
to tell the two cases apart.

**`servings` is left alone rather than defaulted.** The column defaults to 2 in
Postgres, and EF decides per property whether to send it at all: a value equal to the
property's *sentinel* is omitted from the INSERT. Since EF Core 8 a property
configured with `HasDefaultValue(x)` takes `x` as its sentinel, which raised the
question whether a freshly built `Recipe` — `Servings == 0` — would write an explicit
0 and shut the database default out. It does not: a request without `servings` comes
back with 2. So nothing is configured, and the service assigns `Servings` only when
the request carried a value. Writing `2` in C# was never an option; the default would
then live in two places.

**201 with a `Location` header, unlike `POST /ingredients`.** The objection above does
not apply here, because `GET /recipes/{id}` exists: `CreatedAtAction` can build the URI
from `nameof(GetById)` plus the new id. Nest sends no `Location`, and that is not a
breach — the contract is the status code, and the header is what ASP.NET Core does
when it can.

**The response is fetched again after the commit.** `CreateAsync` returns
`GetByIdAsync(recipe.Id)`, which costs one more query but is the only way the promise
"same shape as `GET /recipes/{id}`" holds by construction rather than by hand.

**One rendering difference remains.** `amount` comes back as `800.00` where Nest sends
`800`. A `decimal` carries the scale of `numeric(8,2)` and System.Text.Json writes it
out; a JavaScript number cannot hold trailing zeros, so Prisma's `.toNumber()` loses
them. The values parse equal, the bytes differ. Aligning it would mean a converter
whose only job is to drop information, which is not worth it for a figure every client
reads as a number.

**`DELETE` deletes without loading, and the row count is the answer.** The usual EF Core
way to remove something is to load it, call `Remove` and let `SaveChangesAsync` work out
what to write — a `SELECT` followed by a `DELETE` to learn something the `DELETE` already
knows. `ExecuteDeleteAsync` sends the statement straight away and returns the number of
rows it hit. Filtered on the primary key that number is 0 or 1, which is exactly the
distinction the endpoint needs, and it is the counterpart to Prisma raising `P2025` on
the Nest side. Nothing is queued, so there is no `SaveChangesAsync` after it; a call
there would find no tracked change and do nothing.

That the join rows go too is therefore entirely the database's doing. EF Core can
replay a cascade in memory for entities it has loaded, and here it has loaded none —
what removes the `recipe_ingredient` rows is `ON DELETE CASCADE` on the foreign key,
inside the same statement. Which is what makes the missing transaction correct rather
than merely convenient: one statement is always all or nothing. See
[`DELETE /recipes/:id`](../README.md#delete-recipesid-one-statement-no-transaction).

**A 204 is typed as `ActionResult`, without a `T`.** `ActionResult<RecipeDetailDto>`
compiles — `NoContent()` and `NotFound()` convert to it implicitly — and it would be a
promise the method never keeps, since neither answer carries a body. The signature is
not only documentation here: `MapOpenApi` derives the API description from it, so the
`T` would advertise a response schema no client ever receives.

### Validation

Decided 2026-09-24. The Nest API validates with `class-validator`, which Nest
ships with; the .NET side uses DataAnnotations, which ASP.NET Core ships with.
That keeps the comparison honest — both backends are measured by what their
framework offers, not by what can be bolted onto it.

`[ApiController]` collects the violations by itself and answers 400 with
`ProblemDetails`, nested collections included: a broken ingredient line is
reported as `ingredients[0].name`, the counterpart to Nest's
`ingredients.0.name`.

Three rules DataAnnotations cannot express, and where they go instead:

- **"At most two decimal places"** for `amount` has no built-in attribute.
  `[Range]` covers the bounds, the scale needs a small custom
  `ValidationAttribute`. `Utility/MaxDecimalPlacesAttribute.cs` is it: it compares
  the value with itself rounded to the allowed number of places. Reading
  `decimal.Scale` would have been shorter and wrong — a `decimal` keeps trailing
  zeros, so `1.500` has a scale of 3 and would be refused, while
  `@IsNumber({ maxDecimalPlaces: 2 })` accepts it, JavaScript numbers having
  dropped the zeros long before the check. The rule exists because the column is
  `numeric(8,2)`: Postgres rounds a third place away instead of complaining.
- **"May be absent, must not be null"** for `servings`. Nest says this with
  `@ValidateIf((_, value) => value !== undefined)`; `@IsOptional` would not do, it
  lets `null` through. An `int?` in C# cannot tell the two apart — both arrive as
  `null`. The distinction is recovered where the trimming already lives, in the
  setter: System.Text.Json calls it for `"servings": null` and not at all for a
  missing field, so a second private field records that it ran. Deciding on two
  fields at once is beyond any attribute, so `CreateRecipeDto` implements
  `IValidatableObject`; its `Validate` names `Servings` in the `ValidationResult`,
  which is what files the error under `servings` in the `ProblemDetails`.
- **No counterpart to `@Transform`.** Nest trims `name` before it validates,
  otherwise `"   "` passes `@IsNotEmpty` and normalizes to an empty
  `name_normalized`. DataAnnotations has no step that runs before validation, so
  the trimming moves into the property itself. That is what decides the shape of
  the DTO: a request DTO is a class with a backing field, not a record. A
  positional record parameter has nowhere to put the trim, and validation
  attributes written on one never reach the generated property, so they are
  simply not checked. The response DTOs stay records — nothing is validated or
  trimmed on the way out.

FluentValidation expresses all three directly and is common in .NET projects. It is
**deferred to V2, not rejected**. The V2 rules — meal plan entries, shopping
list quantities — are where the extra expressiveness starts to pay, and by then
both write paths exist in both languages to compare it against. Its cost today
is a NuGet dependency plus wiring: since version 11 the automatic MVC
integration lives in a separate package its own maintainers advise against, so
the validator has to be invoked from a filter or the controller.

Whether both backends are carried on into V2 is open.

---

## Nutrition

Nutrition figures are planned in two stages. Neither is scheduled yet, and both
are out of scope for V1.

**Stage 1: figures on the recipe.** `Recipe` gains columns for calories and the
three macronutrients — protein, carbohydrates and fat — per serving, entered by
hand or taken over by the V3 importer. schema.org's `Recipe` type carries a
`nutrition` object with `calories`, `proteinContent`, `carbohydrateContent` and
`fatContent`, and many recipe sites fill it. Whether the remaining values of the
EU nutrition label follow — saturated fat, sugar and salt, plus fibre — is
decided when stage 1 is built; schema.org has fields for all of them. Sorting ("under
600 kcal, most protein first") and restricting the random suggestions are then
an ordinary `where` and `orderBy`. Combined with the V2 meal plan and the
servings chosen there, the week's total follows by multiplication.

**Stage 2: figures calculated from the ingredients**, the way calorie trackers
such as Lifesum or Yazio work. Every ingredient holds its nutrients per 100 g,
plus a gram weight per unit that is specific to that ingredient: a tablespoon
of flour weighs about 10 g, a tablespoon of oil about 14 g, a clove of garlic
about 4 g. `2 TABLESPOON` of flour then becomes 20 g, and 20 % of the per-100 g
values.

That is a deliberate, narrow exception to "no conversion anywhere": the gram
weights feed the nutrition estimate only, never the shopping list, which keeps
adding up identical units only. A line without an amount ("salt to taste") or
without a gram weight for its unit marks the recipe's figure as *incomplete*
instead of silently counting as zero, and a hand-entered stage-1 value applies
wherever no calculated one is possible.

The code is small; the data is not. Candidate sources are USDA FoodData Central
(public domain, US foods, English), Open Food Facts (ODbL, a share-alike licence
for databases; strong on packaged products, weak on raw ingredients) and the
German Bundeslebensmittelschlüssel, whose licence terms have to be checked
first. As with [Shipped starter recipes](#shipped-starter-recipes), no external
data enters the repository before its licence is clear.

Nutrition never lives on a `RecipeIngredient` row — stage 1 puts it on the
recipe, stage 2 on the ingredient. That keeps the join rows free to be replaced
wholesale when a recipe is edited.

---

## Recipe images

A photo per recipe is planned but not scheduled yet. The decisions that shape
it:

- **Files, not database rows.** The image lives as a file in a Docker volume;
  the recipe stores only its name. A backup then has to cover both the database
  and that volume.
- **What is accepted.** A size limit, and only JPEG, PNG and WebP — checked by
  the file's content, not its extension. SVG is excluded because it can carry
  scripts.
- **Location data is stripped.** Phone photos carry GPS coordinates in their
  EXIF metadata; left in, every recipe photo records where the kitchen is. This
  matters at the latest with V4, when strangers can see recipes.
- **Resized on upload.** A phone photo is 4–8 MB, the recipe list needs a few
  hundred KB. Resizing costs memory, which is scarce on the NAS and on a
  Raspberry Pi.
- **Imported images.** schema.org recipes carry an image URL. Hot-linking it
  would break the rule that nothing is loaded from elsewhere at runtime, so an
  imported image is either downloaded once or not shown — decided with V3. Its
  copyright stays with the source, one more reason imported recipes never become
  public (see [Multi-user (V4)](#multi-user-v4)).
- **Uploads go through `multer`.** The patched version is forced by an override;
  see [Known audit findings](#known-audit-findings).

---

## Shipped starter recipes

The application ships with an empty database, the way [Mealie](https://github.com/mealie-recipes/mealie)
and [Tandoor Recipes](https://github.com/TandoorRecipes/recipes) do. Their value
is the importer, not the content — people self-host a recipe app to keep *their
own* recipes somewhere they control.

The seed in `apps/api/prisma/seed.ts` is development fixtures only: a handful of
recipes that prove shared ingredients resolve to a single `ingredient` row. It
wipes the tables on every run and is not a delivery mechanism.

Shipping a ready-made recipe library was considered and deferred to **after
V3**, for two reasons.

**Technical.** Every usable source lists ingredients as free text — `2 EL
Olivenöl` in a single string — while `RecipeIngredient` wants `amount`, `unit`
and `ingredientId` in three columns. The parser that splits them is the same one
the V3 URL import has to build. Doing it earlier means writing it twice.

**Licensing.** A recipe as a list of ingredients plus steps is generally not
covered by copyright in Germany, but the wording of the instructions and the
photographs are, and a collection such as Chefkoch is protected in its own right
under database rights (§ 87a UrhG) regardless of the individual entries.
Scraping one into a public AGPL repository is not an option. What is: own
recipes, the German [Wikibooks Kochbuch](https://de.wikibooks.org/wiki/Kochbuch)
(CC BY-SA 3.0, attribution required), or public-domain cookbooks. A CC BY-SA
data set needs its own licence notice for the data directory, separate from the
AGPL covering the code.

When it is built it is a **separate mechanism from the seed**: a JSON file in
the repository, imported on first start, idempotent, and possible to skip. Under
V4 those entries become recipes with `visibility: PUBLIC` owned by a system user
— see below.

---

## Multi-user (V4)

V1 to V3 are built for a single household: no accounts, no tenancy, one shared
set of data. Opening the application to strangers is a different project, and
this section records the design decisions so the earlier versions do not paint
themselves into a corner. None of it is built ahead of time — a `visibility`
column that only ever holds one value is in the way of every query and buys
nothing.

The guiding idea: **a recipe belongs to someone, an ingredient belongs to
nobody.**

| Table | Visibility | Why |
|---|---|---|
| `Ingredient` | global | Master data. An onion is the same vegetable for everyone; nothing about it is private. |
| `IngredientAlias` | per user | A personal turn of phrase. Global aliases are an open door: one wrong mapping silently affects everybody else's imports. |
| `Recipe` | owner plus visibility | The user's own content. |

Schema changes, all of them plain migrations:

- new `User` model
- `Recipe` gains `ownerId` (FK) and `visibility` (enum `PRIVATE` / `PUBLIC`,
  defaulting to `PRIVATE`)
- `IngredientAlias` gains `userId`, and its unique index moves from `alias` to
  `@@unique([userId, alias])`
- `Recipe`: `@@unique([sourceName, externalId])` becomes
  `@@unique([ownerId, sourceName, externalId])`, otherwise one user's import
  blocks everyone else's
- new `SavedRecipe` model, many-to-many between `User` and `Recipe`, composite
  primary key `[userId, recipeId]` plus `savedAt`

The shared starter library is not a special case: those are recipes with
`visibility: PUBLIC` owned by a system user.

**Adding someone else's recipe comes in two flavours.** *Copying* inserts a new
row owned by the copying user, with an optional `copiedFromId` recording where
it came from, and is therefore editable. *Saving* only inserts a `SavedRecipe`
row and stays a pointer at content owned by somebody else.

Neither needs a rule of its own. A single check — only the owner may edit —
produces both behaviours, because the saving user is not the owner. That check
belongs in the service layer, not in the database: Postgres has no notion of a
logged-in user. It can enforce foreign keys, not permissions.

`SavedRecipe` uses `onDelete: Cascade`, so a saved recipe can disappear when its
owner deletes it, and can change underneath the reader when its owner edits it.
Call it *saved* or *bookmarked* in the interface, never something that promises
permanence; anyone who needs to rely on a recipe should copy it. For the same
reason the V2 meal plan holds a copy rather than a pointer — otherwise Thursday's
shopping list turns up empty because a stranger deleted their recipe.

**Imported recipes must never become public.** A set of cooking instructions is
a protected literary work (a bare list of ingredients is not). Copying one into
a private cookbook is fine; republishing it is not. The switch to `PUBLIC` has
to be blocked in code for any recipe with a `sourceUrl`, not merely left out of
the interface — the operator of a public instance is liable for what its users
publish.

Finally, the part that is not code: real accounts mean personal data, so an
imprint, a privacy policy and a deletion process are required, on top of
operating the service, taking backups and applying security updates
indefinitely for other people. Once nutrition figures exist, what a named person
eats week by week may count as health data under Art. 9 GDPR, which raises the
bar further. The 2 GB Synology is not the machine for that.

---

## Known audit findings

`npm audit` reports a stack exhaustion issue in `deepmerge-ts`. It reaches the
tree through exactly one path:

```
api -> prisma (devDependency) -> @prisma/config -> deepmerge-ts
```

`prisma` is the CLI, not the runtime library — `@prisma/client` does not depend
on it. The package therefore never ships with the application. `@prisma/config`
merges this project's own Prisma configuration, so the input is not attacker
controlled. The finding is accepted until Prisma raises the dependency.

Do **not** run `npm audit fix --force` here: it "resolves" the report by
downgrading `prisma` to 6.12.0, which would break the version parity between
`prisma` and `@prisma/client` that Prisma requires.

### `multer`: overridden

`@nestjs/platform-express` 12.0.1 pins `multer` to exactly `2.2.0`, which has
four advisories — denial of service through crafted field names and aborted
uploads, and a bypass of the file size limit — all fixed in `2.3.0`. The root
`package.json` therefore forces the patched version:

```json
"overrides": { "multer": "2.3.0" }
```

An override tells npm to install that version no matter what a dependency asks
for; in a workspaces monorepo npm reads overrides from the root `package.json`
only. `multer` handles `multipart/form-data` and runs only on routes that use
Nest's `FileInterceptor`. There are none yet, so the vulnerable code is not
reachable today — but [recipe images](#recipe-images) are planned, and an upload
endpoint would reach it directly. Remove the override once
`@nestjs/platform-express` itself depends on `2.3.0` or later.

`npm ls multer` reports the result as `multer@2.3.0 invalid: "2.2.0" from
node_modules/@nestjs/platform-express` and exits with code 1. That is `npm ls`
comparing the installed version against the parent's exact pin without taking
the override into account — the nested form
`"@nestjs/platform-express": { "multer": "2.3.0" }` gives the same verdict. The
install itself is correct: `npm ci`, which CI and Docker builds use, accepts the
lockfile and installs `2.3.0`. Do not use `npm ls` as a pass/fail check in a
pipeline while the override is in place.

**npm applies an override only when it resolves a package anew.** With `multer`
already recorded in `package-lock.json`, `npm install` answered "up to date",
`npm update` moved 94 other packages and still kept `2.2.0`, and reinstalling
`@nestjs/platform-express` changed nothing. Deleting the `multer` entry from the
lockfile by hand is worse: npm then installs no `multer` at all, because it
trusts the rest of the file. What works is regenerating the lockfile:

```bash
rm package-lock.json && npm install
```

That also moves every other package to the newest version its range allows —
here 95 packages, none across a major version — so run the API, the lint and the
requests afterwards.

### `qs`: updated

`qs` parses URL-encoded request bodies, and Nest registers that parser for every
request, so this finding was reachable. Every package using it — `express`,
`body-parser`, `superagent` — accepts any `6.x` above a minimum, so
`npm update qs` moved the lockfile to the fixed `6.16.0` without touching a
`package.json`.

### `mysql2`: accepted

`prisma` — the CLI, a devDependency — pins `mysql2` to `3.15.3`, which has two
advisories concerning connections to a MySQL server. Prisma loads that driver
only for a MySQL datasource; this project uses PostgreSQL, and the CLI never
ships with the application. The finding is dismissed in Dependabot as
"vulnerable code is not actually used". `npm audit fix --force` would "resolve"
it by downgrading `prisma` to 6.19.3.

### Reading audit output in this repo

`npm audit --omit=dev` is not reliable in a workspaces monorepo — it has been
observed listing devDependencies of `apps/api` anyway. To find out whether a
finding actually affects the shipped application, inspect the path instead:

```bash
npm ls <package-name>
```

If every path runs through a devDependency such as `prisma`, `@nestjs/cli` or
`jest`, the code is build tooling and never reaches production.

Do not run `npm audit fix --force`: it resolves the report by downgrading
`@nestjs/mau` to 0.0.6, which is not a fix.

### The same check on the .NET side

NuGet reads the GitHub Advisory Database as npm does, and audits on every
restore. Two properties in `RecipeApi.csproj` state the intent rather than leave
it to the SDK default:

```xml
<NuGetAudit>true</NuGetAudit>
<NuGetAuditMode>all</NuGetAuditMode>
```

`all` includes transitive packages; `direct` would only look at the five
references written in the project file. Both values happen to match the current
default, which is exactly why they are spelled out — an SDK upgrade cannot
quietly turn the audit down.

`NuGetAuditLevel` is deliberately absent. Its default is `low`, meaning every
severity is reported; setting it to `moderate` would hide findings rather than
add any.

To ask on demand rather than wait for a restore:

```bash
dotnet list package --vulnerable --include-transitive
dotnet list package --deprecated
```

`--include-transitive` is not optional. Without it the command inspects only the
direct references — the opposite default from `npm audit`, which always walks the
whole tree.

There is no equivalent of npm's `overrides` here, and none is needed. Within one
application NuGet resolves a single version per package, and the nearest
reference wins: naming a patched version directly in `RecipeApi.csproj` overrides
whatever a dependency asked for.
