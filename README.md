# recipe-app

Self-hosted, ad-free web application for managing recipes, generating weekly
suggestions and deriving a shopping list from them.

Private project for a single household. No multi-tenancy, no public sign-up. (YET)

## Status

Under development. See [Roadmap](#roadmap) for what is and is not implemented.

## Tech stack

| Layer      | Choice                        |
| ---------- | ----------------------------- |
| Backend    | NestJS, TypeScript            |
| ORM        | Prisma                        |
| Database   | PostgreSQL 17                 |
| Frontend   | Angular, standalone components |
| Runtime    | Docker Compose                |

## Requirements

- Node.js 24 (see `.nvmrc`)
- Docker with Compose v2

## Getting started

```bash
# For Web connection
git clone https://github.com/LittlePumpkin87/recipe-app
# For SSH connection
git clone git@github.com:LittlePumpkin87/recipe-app.git

cd recipe-app

# 1. Create your environment file and set a database password
cp .env.example .env
openssl rand -base64 24   # paste into POSTGRES_PASSWORD and DATABASE_URL

# 2. Start the database
docker compose up -d db

# 3. Install dependencies
npm install
```

Verify that the database is up:

```bash
docker compose ps          # db should report "healthy"
```

## Repository layout

This is an npm workspaces monorepo. Application packages live under `apps/`.

```
.
├── apps/               # workspace packages (added as development proceeds)
├── docker-compose.yml  # local infrastructure
└── .env.example        # template for .env — .env is never committed
```

## Working with the database

The database runs in a container; its data lives in the named Docker volume
`pgdata` and survives container restarts.

```bash
docker compose up -d db                     # start
docker compose stop db                      # stop, keep data
docker compose logs db                      # inspect logs
docker compose exec db psql -U recipe -d recipe   # open a SQL shell
docker compose down -v                      # stop and DELETE all data
```

`docker compose down -v` is the way to start over from an empty database.
Note that `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB` are only
applied when the volume is empty — changing them later has no effect until
the volume is removed.

If port 5432 is already taken on your machine, set `POSTGRES_PORT` in `.env`
to a free port and update the port in `DATABASE_URL` to match.

## Roadmap

**V1** — recipe CRUD, central ingredient list without duplicates, search by
title, mobile friendly, WCAG AA.

**V2** — random weekly suggestions, meal plan, shopping list.

**V3** — recipe import from URLs via schema.org metadata.

## License

Copyright (C) 2026 Little Pumpkin Design (Jennifer Roob)

Licensed under the GNU Affero General Public License v3.0 — see [LICENSE](LICENSE).

As required by section 13 of the AGPL, a link to this repository is shown in
the application's user interface.