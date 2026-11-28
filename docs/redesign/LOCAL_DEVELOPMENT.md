# Local development

How to run the redesign on your own machine. It uses local services only and cannot reach production.

## Start everything

From the root of a checkout of the `redesign` branch:

```bash
pnpm redesign:dev
```

That one command:

1. installs dependencies if they are missing;
2. starts a local Postgres and creates the `openconferences_redesign` database on first run;
3. applies the migrations;
4. adds the invented organisation and conference if they are not there yet;
5. starts the API, the worker and `apps/web-v2`.

| What        | Where                                                                   |
| ----------- | ----------------------------------------------------------------------- |
| Health page | <http://localhost:3100/health>                                          |
| API         | <http://localhost:3101/api/v1> (`/healthz`, `/readyz`)                  |
| Database    | `postgresql://openconferences@127.0.0.1:55433/openconferences_redesign` |

The ports differ from the main checkout (web on 3000, API on 3001, Postgres on 5432), so the live product and the redesign can run side by side.

Stop with `Ctrl+C`. The database keeps running; stop it with `pnpm redesign:db stop`.

### What you need installed

- Node 22 and pnpm 9 (`corepack enable`).
- The Postgres 16 or 17 command line tools, for example `brew install postgresql@17`. Set `PG_BIN` to their `bin` directory if they are not found.

Docker is not needed.

## The environment file

Settings live in `.env.redesign` at the repository root. It is committed, because every value is a local address or a placeholder and none is a secret. Do not add real credentials to it.

- The API, the worker, `apps/web-v2` and the database scripts read `.env.redesign`. Nothing on this branch reads the root `.env`, which points at production.
- A variable that is already exported in your shell wins over the file.
- Email has no provider key, so the worker logs each email and sends nothing. Payments have no gateway keys, so the mock provider is used.

## The guard against a non-local database

On this branch the API, the worker and migrations refuse to run when `DATABASE_URL` is not a Postgres URL on `localhost`, `127.0.0.1` or `::1`. For example:

```bash
DATABASE_URL=postgresql://user@db.example.com:5432/postgres pnpm redesign:dev
```

stops at its first step, before anything connects, with:

```text
Refusing to start: DATABASE_URL points at "db.example.com", which is not a local database.
The redesign branch only runs against a local Postgres (localhost, 127.0.0.1 or ::1).
```

The message names the host and never prints the URL, so a password cannot end up in a log.

The check runs in three places, so there is no path around it:

| Where                                | What it stops                                                  |
| ------------------------------------ | -------------------------------------------------------------- |
| `getConfig()` in `packages/config`   | The API and the worker, before they open any connection        |
| The database client in `packages/db` | Anything else that loads the client: seeds and one-off scripts |
| `packages/db/prisma.config.ts`       | Every Prisma command: `migrate`, `db execute`, `studio`        |

It also refuses a local URL that carries a connection option able to redirect the connection, such as `host`.

There is no setting that turns the guard off. It is removed in the cutover (decision D10).

What it cannot see: a tunnel or port forward that makes a remote database appear on `localhost`. Do not point one at production while working on this branch.

## The database

`infra/redesign/db.sh` (also `pnpm redesign:db <command>`) manages a Postgres server that belongs to the redesign only. It listens on `127.0.0.1:55433`, accepts no password because nothing outside this machine can reach it, and keeps its data in `~/.openconferences/redesign-postgres`, outside the repository.

| Command   | What it does                                         |
| --------- | ---------------------------------------------------- |
| `start`   | Starts the server; creates the database on first run |
| `stop`    | Stops the server                                     |
| `status`  | Says whether it is running                           |
| `migrate` | Applies the migrations                               |
| `seed`    | Adds the invented organisation and conference        |
| `psql`    | Opens a `psql` shell on the database                 |
| `url`     | Prints the database URL                              |

To start again from nothing, stop the server, delete `~/.openconferences/redesign-postgres` and run `pnpm redesign:dev`.

### Seed data

The seed adds one organisation, "Example Research Society", and one conference, "Example Conference on Open Research", in draft with every setting at its default. Both are invented. It adds no users. Running it again changes nothing.

## Redis and object storage

Neither is needed for this phase. The API and the worker start without them, and the health page then shows Redis as not working.

When a later phase needs them, any local Redis on port 6379 and MinIO on port 9000 will do, for example `docker compose up -d redis minio`. The redesign uses Redis database 7 and its own bucket, `openconferences-redesign`, which has to be created in MinIO before the first upload.

## Tests

- `pnpm test` in a package runs its unit tests. The guard tests need no database.
- API tests that need Postgres run against the local test database, never the redesign database and never production: `infra/testing/local-test-db.sh test`.

## Continuous integration

`.github/workflows/redesign-ci.yml` runs on every pull request into `redesign`: lint, typecheck and tests, against throwaway containers on the runner. It builds no image and deploys nothing. The workflows that release `main` are separate files, limited to `main`, and unchanged.

Browser tests are not part of it yet. They are added when `apps/web-v2` has screens to test (Phase 4).
