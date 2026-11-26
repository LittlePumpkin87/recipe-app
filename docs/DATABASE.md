# Database — PostgreSQL and Prisma

Schema conventions, migrations, seed data, and running the database container.

## Naming convention

Models are PascalCase and singular in the schema (`Recipe`), fields are
camelCase. In Postgres everything is snake_case, produced by `@@map` on models
and enums and `@map` on multi-word columns. The enum is easy to forget: without
`@@map("unit")` the type is created as `"Unit"` and needs quoting everywhere,
even though every table around it does not.

The reason is ergonomic: Prisma quotes identifiers when creating them, so an
unmapped model would become a table named `"IngredientAlias"` that needs double
quotes in every hand-written `psql` query. Enum values are English like the rest
of the repository; the display form is the frontend's job.

Note that PascalCase applies to model *names* only, not to their fields.

<a id="prisma-and-migrations"></a>

## Prisma and migrations

The schema lives in `apps/api/prisma/schema.prisma`, migrations in
`apps/api/prisma/migrations/`.

```bash
cd apps/api

npx prisma migrate dev --name <name>   # create and apply a migration
npx prisma migrate dev --name <name> --create-only   # write the SQL only, apply later
npx prisma migrate deploy              # apply existing migrations (production)
npx prisma db seed                     # wipe and rewrite the development data
npx prisma studio                      # browse and edit data in the browser
npx prisma validate                    # check the schema
npx prisma format                      # format and complete relations
```

**These are the only commands run from inside `apps/api`.** Everything else uses
`-w api` from the root. Prisma resolves `schema.prisma` relative to the working
directory, and `apps/api/prisma7.config.ts` loads the repository-root `.env`
explicitly, two levels up, before handing `DATABASE_URL` to the datasource. That
config file exists precisely because the `.env` does not sit next to the schema.

**Read a migration that touches existing data before it runs.** `--create-only`
writes the SQL file without applying it; read it, then run `npx prisma migrate
dev`. One trap: `--create-only` only holds back the *new* migration. `migrate
dev` always applies pending migrations first, so running `--create-only` a
second time applies the first one — and, finding nothing left to change, writes
an empty migration next to it. Delete an empty one before it is applied; once it
is recorded in `_prisma_migrations`, removing the folder makes Prisma report the
history as out of sync.

**Migration files are committed.** Prisma writes plain SQL into
`prisma/migrations/<timestamp>_<name>/migration.sql`, and the applied history is
tracked in a `_prisma_migrations` table inside the database. That is what lets a
fresh clone reach the identical schema, and what makes a schema change
reviewable in a pull request.

**The generated client is not committed.** The generator writes to
`apps/api/src/generated/prisma`, which is listed in `apps/api/.gitignore`. It is
build output derived from the schema and would otherwise produce enormous, noisy
diffs. Since Prisma 7, `prisma migrate dev` no longer regenerates it: run
`npx prisma generate` after every schema change, or the types lag behind the
database without any error until code uses a new column.

**Prisma 7 requires a driver adapter.** The Rust query engine is gone, so the
client cannot open a connection by itself — which is why the `datasource` block
in `schema.prisma` carries no `url`. `@prisma/adapter-pg` wraps the `pg` driver
and is handed to the client when it is constructed, in
`apps/api/src/prisma/prisma.service.ts`:

```ts
const adapter = new PrismaPg({
  connectionString: config.getOrThrow<string>('DATABASE_URL'),
});
super({ adapter });
```

Three consequences. The connection string reaches the *adapter*, never the
client, so guides written for Prisma 5 or 6 that pass a URL to
`new PrismaClient()` no longer apply. `@prisma/adapter-pg` and `@prisma/client`
must be kept on the same version, because they speak an internal protocol that
may change between releases — upgrade them together. And `pg` is deliberately
not a direct dependency; the adapter brings it, so only one place pins its
version.

`DATABASE_URL` reaches the service through `ConfigService`, not through
`process.env` directly. `getOrThrow` aborts the start with the name of the
missing variable instead of failing later, on the first request.

### Seeding

`prisma/seed.ts` fills an empty database with development data. It is registered
in `prisma7.config.ts` under `migrations.seed` and runs via `npx prisma db seed`
from inside `apps/api`.

**It is destructive by design.** Every run empties `recipe_ingredient`, `recipe`
and `ingredient` — in that order, because foreign keys forbid the reverse — and
writes the same recipes again. The result is identical on every run, which is
the point: development against a known data set. `ingredient_alias` needs no
call of its own, its foreign key cascades.

Because `deleteMany()` without a `where` clause deletes every row without
confirmation, the script refuses to run unless `DATABASE_URL` points at
`localhost` or `127.0.0.1`.

**It is not a delivery mechanism.** A handful of recipes is enough, because
their only job is to prove that a shared ingredient resolves to a single
`ingredient` row. Real recipes arrive through `POST /recipes`, the [bulk import](IMPORT.md)
and, from V3, the URL importer — see [Shipped starter recipes](DECISIONS.md#shipped-starter-recipes).

Before the recipes, the seed loads the ingredient catalog
(`apps/api/prisma/ingredient-catalog.json`, 1,201 entries) through the same
`loadIngredients` the importer uses. 8 of the 17 seed ingredients are catalog
entries, the other 9 are created. The transaction gets `timeout: 60_000`, since
the catalog alone is about 5,100 queries and Prisma's default is 5 seconds.

The seed is also the rehearsal for `POST /recipes`: normalise the name, look it
up as an alias in the recipe's language or create the ingredient together with
its alias, keep the ids in a `Map`, then write the recipes and their join rows —
all inside one `$transaction`. Every call within that
block goes through `transactionClient`, never through `prisma`, or it runs
outside the transaction and is not rolled back with it. The name is longer than
the usual `tx` on purpose: it is Prisma's own type name
(`Prisma.TransactionClient`), and it makes a stray `prisma.` call inside the
block stand out.

**`prisma format` completes as well as formats.** Given half a relation it will
add the missing opposite field, move `@relation` to the side holding the foreign
key, and turn a singular relation field into a list. It makes a schema *valid*,
not *correct* — it never decides `onDelete` for you, because that is a
behavioural choice. Run it once you are happy with what you wrote, otherwise you
lose track of which lines are yours.

### Prisma Studio

```bash
cd apps/api && npx prisma studio
```

Opens a browser UI on http://localhost:51212. This is the tool to reach for when
working with *data*; use `psql` or a SQL client for questions about *structure*.

Two things it does that a generic SQL client cannot:

**It knows the schema.** Relations are links rather than raw UUIDs, so a recipe
lists its ingredients and each one navigates through to the ingredient itself.
`unit` is a dropdown of the `Unit` enum, not a free-text field that lets you
type a value the column will reject.

**It writes through the Prisma client, so client-side behaviour applies.** `id`,
`created_at` and `updated_at` all have database-level defaults — see the
`db_level_defaults` migration — so a hand-written `INSERT` in psql that omits
them works too. `updated_at` is set by database triggers (migration
`20261012080553_updated_at_triggers`), so an `UPDATE` in psql moves it just like
the same edit in Studio does.

It is worth having open while building `POST /recipes`: seeding an ingredient by
hand and watching the join rows appear is faster feedback than a test run.


## Working with the database

The database runs in a container. Its data lives in the named Docker volume
`pgdata` and survives container restarts.

```bash
docker compose up -d db                            # start
docker compose stop db                             # stop, keep data
docker compose logs db                             # inspect logs
docker compose exec db psql -U recipe -d recipe    # SQL shell inside the container
docker compose down -v                             # stop and DELETE all data
```

`docker compose down -v` is the way to start over from an empty database.

### Connecting from the host

This is the path the API uses, and the one worth verifying after any change to
`.env` or `docker-compose.yml`:

```bash
psql "postgresql://recipe:<password>@localhost:5432/recipe"
```

```sql
SELECT version();          -- must report 18.x, i.e. the container, not a local server
\conninfo                  -- shows host, port and user of the current connection
```

Note that `docker compose exec db psql ...` connects from inside the container
and therefore does **not** verify the published port, the password in
`DATABASE_URL`, or anything else the API depends on.

Do not install the `postgresql` package to get a client — it brings a server
that binds to port 5432 and will collide with the container. Install
`postgresql-client` instead.

### Timestamps

`created_at` and `updated_at` are `timestamptz(3)` — *timestamp with time
zone*. Despite the name, no zone is stored: the column holds an exact moment,
kept internally as UTC, and converts it on output into the time zone of the
connection, with the offset attached. A change made at 11:43 in Berlin in summer
reads `2026-09-11 09:43:05+00` in a UTC session and `2026-09-11 11:43:05+02`
after `SET timezone = 'Europe/Berlin';` — the same moment, spelled two ways.
Some SQL clients convert to local time on their own.

Until the `timestamptz` migration the columns were plain `timestamp(3)`,
*without* time zone: a date and a clock reading, `09:43:05`, with nothing to say
which zone it belongs to. That it meant UTC was a convention Prisma kept; every
other writer — psql, a trigger, the .NET backend — would have had to know it
too. The PostgreSQL wiki's "Don't Do This" page advises against plain
`timestamp` for exactly this reason. The migration converted the existing values
by reading them in the session's time zone, which is UTC in the container, so
they stayed correct. `SHOW timezone;` is the check to run before such a
migration.

Converting to a user's local time is the frontend's job. The API sends
`"2026-09-11T09:43:05.123Z"`, and Angular's `DatePipe` formats it in the
browser's time zone; neither the API nor the database needs to know where a user
is.

**Moments and days are different types.** Something that *happened* — created,
edited — is a moment and gets `timestamptz`. Something *planned for a day*, such
as a V2 meal plan entry for Tuesday, 15 September, is a calendar date and gets
`date`. Stored as a moment it would be midnight UTC, which a user in New York
sees as Monday, 8 pm — and the soup lands on the wrong day.

### Things that will bite you

**Credentials are only applied to an empty volume.** `POSTGRES_USER`,
`POSTGRES_PASSWORD` and `POSTGRES_DB` are evaluated by the image only during
first-time initialisation. Changing them in `.env` afterwards has no effect and
results in `password authentication failed`. Remove the volume with
`docker compose down -v` to re-initialise.

**Port conflicts.** If 5432 is already in use, set `POSTGRES_PORT` in `.env` to
a free port and update the port inside `DATABASE_URL` to match.

**The volume is mounted at `/var/lib/postgresql`, not at `.../data`.** From
version 18 on, the PostgreSQL image stores data in a major-version
subdirectory (`/var/lib/postgresql/18`). Mounting the parent directory keeps
the old and the new data directory inside a single mount, which
`pg_upgrade --link` requires for a future major version upgrade. Most guides
online still show `/var/lib/postgresql/data`; those are written for version 17
and earlier.

To confirm the data actually lands in the volume:

```bash
docker compose exec db ls -la /var/lib/postgresql   # should contain a "18" directory
```

### Backups

Run `pg_dump` inside the container rather than on the host:

```bash
docker compose exec db pg_dump -U recipe -d recipe > backup.sql
```

`pg_dump` refuses to dump from a server newer than itself, so running it in the
container guarantees matching versions regardless of what is installed on the
host — and it works the same way on any machine the project is deployed to.

Restore into an empty database with:

```bash
docker compose exec -T db psql -U recipe -d recipe < backup.sql
```
