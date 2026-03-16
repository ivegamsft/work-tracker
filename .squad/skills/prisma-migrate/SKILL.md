# Skill: Prisma Migrate

> Reusable safe migration workflow for turning Prisma schema changes into verified local database updates.

## Metadata

- **Confidence:** low
- **Created:** 2026-03-16
- **Last validated:** 2026-03-16
- **Domain:** Prisma, database, migrations

## When to Use

Use this skill whenever:
- `data/prisma/schema.prisma` has changed and a real migration is required
- The user asks to add, fix, or verify a Prisma migration
- API work depends on new tables, columns, enums, indexes, or relations
- The team needs a repeatable migration workflow that catches drift early

## Steps

Run these steps in order. Stop and report on first failure.

### Step 1 — Preflight the Schema Change

```powershell
cd <repo-root>
docker compose up -d postgres 2>&1
git diff -- data/prisma/schema.prisma
```

**Pass criteria:** Local Postgres is available and the intended schema diff is understood before generating a migration.
**Fail criteria:** Postgres is unavailable or the schema diff is unclear/unreviewed.

### Step 2 — Generate Prisma Client and Create the Migration

```powershell
cd <repo-root>
npm run db:generate -w @e-clat/data 2>&1
npm run db:migrate:dev -w @e-clat/data -- --name <migration-name> 2>&1
```

**Pass criteria:** Prisma client generation succeeds and a new migration is created under `data/prisma/migrations/`.
**Fail criteria:** Client generation fails, migration creation fails, or Prisma reports an invalid schema.

### Step 3 — Verify the Database Is in Sync

```powershell
cd <repo-root>
npx prisma db push --schema data/prisma/schema.prisma --skip-generate 2>&1
```

**Pass criteria:** Prisma reports the database is in sync, with no unexpected drift or destructive warnings.
**Fail criteria:** Drift remains, Prisma refuses the push, or destructive changes appear unexpectedly.

### Step 4 — Refresh Seed Data When the Change Affects Demo Data

```powershell
cd <repo-root>
npm run db:seed -w @e-clat/data 2>&1
```

**Pass criteria:** Seed succeeds, or the report explicitly states why reseeding was safely skipped.
**Fail criteria:** Seed data is required but fails, or the migration leaves local demo data unusable.

### Step 5 — Run the Regression Gate and API Health Check

```powershell
cd <repo-root>
npm test 2>&1
npm run typecheck 2>&1
docker compose up -d postgres azurite api 2>&1
(Invoke-WebRequest http://localhost:3000/health -UseBasicParsing).StatusCode
```

**Pass criteria:** Tests pass, typecheck is clean, and the API returns 200 from `/health` after the migration.
**Fail criteria:** Any regression, type error, or non-200 API health result.

## Report Format

```
🧬 Prisma Migration Report
━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Preflight:      schema diff reviewed
✅ Migration:      {migration-name} created
✅ Drift check:    db push clean
✅ Seed:           {ran | skipped with reason}
✅ Regression:     tests + typecheck passed, API 200

Result: MIGRATION VERIFIED ✅  (or FAILED ❌ — see details above)
```

## Coordinator Usage

To trigger this from the coordinator, spawn Bunk with:

```
description: "🧬 Bunk: Prisma migrate"
prompt: |
  You are Bunk, the Backend Dev.
  TEAM ROOT: {team_root}
  
  Read .squad/skills/prisma-migrate/SKILL.md and execute the safe migration workflow.
  Generate a properly named Prisma migration from the current schema changes, verify drift with prisma db push, reseed if needed, and prove the API still responds afterward.
  Report results using the format specified in the skill.
  
  ⚠️ RESPONSE ORDER: After ALL tool calls, write the Prisma migration report as FINAL output.
```

## Notes

- Use kebab-case migration names that describe the schema intent, e.g. `add-proof-template-models` or `rename-hour-status-enum`.
- `prisma migrate dev` is the authoritative step for creating checked-in migrations; `prisma db push` is only a verification step here, not the source of truth.
- If the change modifies auth, seed identities, or demo workflows, reseeding should be treated as mandatory.
- If the migration passes but Docker-backed flows are still suspect, escalate to `.squad/skills/test-and-rebuild/SKILL.md`.
