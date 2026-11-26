# Backend — NestJS

Workspace, conventions, CI, and how requests are validated.

## Workspace and conventions

The API is an npm workspace named `api`. Run its scripts from the repository
root using the `-w` flag:

```bash
npm run start:dev -w api    # watch mode
npm run start:prod -w api   # run the compiled build from dist/
npm run build -w api        # production build
npm run lint -w api         # oxlint over src/
npm run format -w api       # prettier over src/
npm install <pkg> -w api    # add a dependency to the API, not to the root
```

There is no test runner at the moment. Jest came with the Nest scaffold and was
removed before any real test existed; see
[`deepmerge`: removed with Jest](DECISIONS.md#deepmerge-removed-with-jest). The
runner is chosen with the first test ticket.

Always pass `-w api` when installing. Because npm workspaces hoist packages
into the root `node_modules`, an import can resolve successfully even though
the dependency is not declared in `apps/api/package.json` — which only breaks
once the API is deployed on its own.

Environment variables are read from the `.env` file in the repository root.
`npm run <script> -w api` sets the working directory to `apps/api`, not to the
repository root, so both places that load the file resolve it two levels up:
`ConfigModule` in `src/app.module.ts` for the running application, and
`prisma7.config.ts` for the Prisma CLI.

Inside `src/`, each area of the domain gets one folder holding three files: a
module, a controller and a service. The controller receives HTTP requests and
knows about paths, status codes and query parameters. The service holds the
logic and is the only place a database query may live. The module wires the two
together — it binds the controller to routes at startup and makes the service
injectable, but takes no part in handling a request.

The split pays off when the data source changes: turning a service method into
a Prisma query leaves its controller untouched. New folders are created with
`npx nest g module <name>` from inside `apps/api`, which also registers the
module in `src/app.module.ts`.

The API is compiled to CommonJS. `apps/api/tsconfig.json` sets
`"module": "nodenext"`, which defers to the `type` field of the nearest
`package.json`; since none is set, the emitted output is CommonJS and relative
imports are written without a file extension.

A doc block says what a declaration is or does, in one sentence — never why.
The reasoning lives in the README, in `docs/` and in [DECISIONS.md](DECISIONS.md),
so there is one version of it that cannot drift from a second copy in the code.
A self-explanatory interface gets no block at all. Where a block exists, it sits
directly above the declaration, not above the imports: TypeScript attaches the
text to the symbol, so hovering `PrismaService` anywhere in the editor shows it
without opening the file. The .NET backend follows the same rule with
`/// <summary>`.

## CI

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on every push and
pull request. It starts a PostgreSQL 18 service, builds both backends, applies
the migrations, starts both APIs and runs `npm run compare`, which seeds before
each run itself. On failure it prints both server logs. The workflow needs the
repository secrets `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB`.

## DTOs, mappers and validation

No Prisma row ever leaves a service. Each feature folder holds a `dto/` folder
and a mapper, and the three shapes involved are deliberately different:

| | Prisma model | Response DTO | Request DTO |
|---|---|---|---|
| Describes | how a row is stored | what the API returns | what a client may send |
| `ingredient.id` | ✓ | ✓ | —, Postgres assigns it |
| `ingredient.nameNormalized` | ✓ | — | —, the service derives it |

`RecipeDetailDto` shows why this is not busywork: it exposes a field called
`ingredients` that exists in no table. In the database the relation is called
`recipeIngredients` and the ingredient name sits one table deeper; the mapper
pulls it up and converts `amount` from a Prisma `Decimal` to a plain number,
which would otherwise serialise as a quoted string. The join row's own `id` and
`recipeId` are dropped: neither means anything outside the database. The list DTO drops
`instructions` entirely so the overview stays small as the recipe count grows.

Each mapper derives its input type from the same `select` or `include` constant
the service queries with — `Prisma.RecipeGetPayload<{ select: typeof
recipeListSelect }>` — so a column removed from the query becomes a compiler
error in the mapper rather than an `undefined` in a response.

**Response DTOs are interfaces, request DTOs are classes.** That is not a style
choice. `main.ts` registers a global `ValidationPipe`:

```ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
);
```

A pipe runs between the request and the controller method: it receives the raw
value, returns the value the parameter will hold, or throws. `ParseUUIDPipe` on
`GET /recipes/:id` is the same mechanism in its smallest form.

The `class-validator` decorators — `@IsString()`, `@MaxLength(120)` — do not
check anything by themselves. They register metadata, and the pipe is what calls
`validate()` and reads it. To know *which* class to validate against, the pipe
reads the declared type of the parameter, which the compiler emits thanks to
`emitDecoratorMetadata`. An interface is erased at compile time and leaves
nothing to read, so a request DTO written as an interface would be waved
through unchecked. Response DTOs are never validated and stay interfaces.

The three options each buy something specific. `whitelist` drops properties that
carry no validation decorator, so a client cannot smuggle in an `id`.
`forbidNonWhitelisted` turns that silent drop into a 400 naming the field, which
is the difference between debugging a typo and not noticing it. `transform`
turns the parsed JSON into a real instance of the DTO class, which is what
nested DTOs and type coercion need.

Validation rules belong in the DTO even where the database has its own
constraint. `NOT NULL` forbids `NULL`, not `""` — a minimum length is an API
question. `@MaxLength(120)` mirrors `@db.VarChar(120)` on purpose: the database
protects itself, the DTO tells the client what is allowed, and the difference
shows up as a 400 with a field name instead of a 500 with a database error.

**Optional is not the same as nullable.** `@IsOptional()` skips every other rule
when a value is `undefined` *or* `null`. That is right for a column that may be
empty — `"description": null` clears the description — and wrong for one that
should not be: `"servings": null` would pass validation and be stored as
`NULL`. The column itself is nullable since the `20261012120359_update`
migration, so only the DTO keeps the value out. Such fields use
`@ValidateIf((_, value) => value !== undefined)` instead: a missing value is
skipped, `null` is validated and rejected with a 400. `UpdateRecipeDto` is built
with `PartialType(CreateRecipeDto, { skipNullProperties: false })` for the same
reason — the option makes `PartialType` add that `@ValidateIf` rather than
`@IsOptional` to every field it turns optional.
