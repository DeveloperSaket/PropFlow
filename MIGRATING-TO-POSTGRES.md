# PropFlow PostgreSQL setup and SQLite import

PropFlow's backend now uses PostgreSQL through `pg`. Ordered schema migrations
run at startup and through `npm run migrate`. The one-time SQLite tools are
separate: `npm run backup:sqlite` creates a consistent backup, and
`npm run migrate:sqlite` imports that backup into an empty PostgreSQL database.
The SQLite source is read-only during both operations.

The Compose file starts PostgreSQL 16 with a persistent named volume and
publishes its port to loopback only. The database is not intended to be exposed
to the public internet. Property images and KYC documents remain in
`backend/uploads/`; importing SQL does not copy those files.

## Local self-hosted PostgreSQL

From the repository root in PowerShell:

1. Copy `.env.example` to `.env`. Set unique random values for
   `POSTGRES_PASSWORD` (database administrator) and `POSTGRES_APP_PASSWORD`
   (application role). Keep this file private; it is ignored by Git.
2. Copy `backend/.env.example` to `backend/.env`. Set `DATABASE_URL` to use
   `POSTGRES_APP_USER`, `POSTGRES_APP_PASSWORD` (URL-encoded), and the same
   database. Set a unique `JWT_SECRET`. Keep this file private as well.
3. Start the database and wait for its health check:

   ```powershell
   docker compose up -d postgres
   docker compose ps
   ```

4. Apply the schema and start the application:

   ```powershell
   Set-Location backend
   npm install
   npm run migrate
   # For local development only; never run this against production:
   npm run seed
   npm run dev
   ```

The API health endpoint at `http://localhost:5112/api/health` checks its
PostgreSQL connection. In production, set `NODE_ENV=production`,
`DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`. The first
admin is created once if no admin exists; production startup fails rather than using development defaults when bootstrap
credentials are missing or still equal the documented demo values. Do not
run the demo seed in production.

For a remote self-hosted PostgreSQL server, use a dedicated database and
least-privilege application role, allow inbound connections only from the
backend host, enable TLS, and set `DATABASE_SSL=true`. The Compose init script
creates a separate app login with connect/schema privileges; it runs only when
initializing a fresh data volume. The application pool defaults to 10
connections; tune `DATABASE_POOL_SIZE` to the server's connection limit and
number of backend instances.

## Back up PostgreSQL

Take regular encrypted backups and store a copy away from the database host.
For the local Compose service, create a custom-format dump (replace `propflow`
with `POSTGRES_USER` and `POSTGRES_DB` if changed):

```powershell
New-Item -ItemType Directory -Force .\backups | Out-Null
cmd /c "docker compose exec -T postgres pg_dump -U propflow_admin -d propflow -Fc > backups\propflow.dump"
```

Test a restore into a separate empty database before relying on a backup. A
named Docker volume protects against container replacement, not disk failure,
operator error, ransomware, or host loss. Do not delete the volume as a way to
reset the app; that destroys the database.

## Import the existing SQLite database

The importer requires a **consistent, verified SQLite backup** and a clean
PostgreSQL application database. For production, first stop application
writes and take a final backup during a planned maintenance window. Rehearse
the process against a disposable PostgreSQL database before the production
cutover.

Create a SQLite backup from the backend directory. Set the source to the
existing database; the tool writes a new file and does not checkpoint or
overwrite the source:

```powershell
Set-Location backend
$env:SQLITE_SOURCE = (Resolve-Path .\data\propflow.db).Path
$env:SQLITE_BACKUP = (Join-Path $PWD 'data\propflow-migration-backup.db')
npm run backup:sqlite
```

Review the backup path and preserve a separate copy before proceeding. Point
the importer to that backup and run it against the configured PostgreSQL
database:

```powershell
$env:SQLITE_SOURCE = $env:SQLITE_BACKUP
npm run migrate:sqlite
```

The importer refuses to load into a PostgreSQL database that already contains
application records. It applies the schema, copies the records in dependency
order, preserves IDs/password hashes/role assignments, resets identity
sequences, restores missing Owner assignments for admin accounts, and checks
table row counts. If validation fails, stop and investigate; do not start the
application on an unverified result. The importer may remove the catalog roles
and permissions from a *clean* target before restoring the SQLite catalog.

Before going live:

- Compare source and target row counts plus representative values, account
  IDs, password hashes, role grants, timestamps, prices and foreign-key links.
- Confirm login, password change, permissions, listings, interests, viewings,
  KYC review, and audit history against the PostgreSQL copy.
- Copy `backend/uploads/properties/` and `backend/uploads/kyc/` to the new
  deployment while preserving the stored paths. KYC documents are private and
  must not be served as public static files.
- Keep the SQLite backup and original upload files until the new deployment
  and restore process have been accepted. Do not switch production traffic to
  PostgreSQL while the application can still write to SQLite.

## Schema and compatibility notes

- Migrations are in `backend/src/migrations/`; add a new numbered migration
  for future schema changes rather than editing one already applied.
- `BIGSERIAL` IDs preserve the existing integer identity and allow explicit
  ID import. `pg` returns 64-bit IDs and counts as JavaScript numbers; keep
  identifiers within JavaScript's safe integer range.
- Property prices and areas use `DOUBLE PRECISION` to preserve the existing
  SQLite `REAL` representation. Monetary arithmetic that requires exact
  decimal rounding should be migrated separately to a defined `NUMERIC`
  scale with API compatibility tests.
- Integer flags remain constrained to `0`/`1` to preserve existing API
  behavior. PostgreSQL timestamps are stored as `TIMESTAMPTZ`; the connection
  timezone is UTC, matching SQLite's `datetime('now')` convention.
- Search uses PostgreSQL `ILIKE` to retain SQLite's case-insensitive
  `LIKE` behavior for ordinary ASCII text.
- PostgreSQL DDL and migrations do not migrate or store uploaded file contents.
  Keep the database and upload backups coordinated.

## Restore example

Only restore into an explicitly selected empty database after verifying the
dump. For a local Compose test restore, create a separate database and restore
there (the app role is created by the Compose initialization script):

```powershell
docker compose exec postgres createdb -U propflow_admin propflow_restore
cmd /c "docker compose exec -T postgres pg_restore -U propflow_admin -d propflow_restore --no-owner < backups\propflow.dump"
```

Never restore test backups over the only production database.
