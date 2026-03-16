# Skill: Docker Reset

> Reusable nuclear reset for recovering the local stack from a bad state.

## Metadata

- **Confidence:** low
- **Created:** 2026-03-16
- **Last validated:** 2026-03-16
- **Domain:** Docker, recovery, local environment

## When to Use

Use this skill whenever:
- The local Docker stack is wedged, stale, or behaving inconsistently
- Prisma, dependency, or volume state looks corrupted
- The user asks for a clean rebuild from scratch
- Normal `docker compose up` recovery is not enough

## Steps

Run these steps in order. Stop and report on first failure.

### Step 1 — Tear Down the Project Stack Completely

```powershell
cd <repo-root>
docker compose down --volumes --remove-orphans 2>&1
docker compose ps 2>&1
```

**Pass criteria:** Project containers are stopped and Compose no longer shows running services for this stack.
**Fail criteria:** Any project service refuses to stop or volumes cannot be removed.

### Step 2 — Rebuild and Start Fresh Containers

```powershell
cd <repo-root>
docker compose build --no-cache 2>&1
docker compose up -d postgres azurite api web 2>&1
Start-Sleep -Seconds 15
docker compose ps 2>&1
```

**Pass criteria:** `postgres`, `azurite`, `api`, and `web` are all up after the rebuild.
**Fail criteria:** Build errors, exited containers, or restart loops.

### Step 3 — Regenerate Prisma Client, Apply Migrations, Seed Data

```powershell
cd <repo-root>
docker compose exec api npm run db:generate -w @e-clat/data 2>&1
docker compose exec api npm run db:migrate:deploy -w @e-clat/data 2>&1
docker compose exec api npm run db:seed -w @e-clat/data 2>&1
```

**Pass criteria:** Prisma client generation, migration deployment, and seed all complete successfully.
**Fail criteria:** Prisma generation errors, migration failures, or seed failures.

### Step 4 — Verify Service Health

```powershell
cd <repo-root>
docker compose exec postgres pg_isready -U postgres -d eclat 2>&1
(Invoke-WebRequest http://localhost:3000/health -UseBasicParsing).StatusCode
(Invoke-WebRequest http://localhost:5173 -UseBasicParsing).StatusCode
docker compose ps 2>&1
```

**Pass criteria:** PostgreSQL reports ready, API returns 200 from `/health`, web returns 200, and Azurite remains up in Compose status.
**Fail criteria:** Any dependency is unavailable, any health check is non-200, or any container has exited.

## Report Format

```
🐳 Docker Reset Report
━━━━━━━━━━━━━━━━━━━━━
✅ Teardown:       stack removed
✅ Rebuild:        containers rebuilt from scratch
✅ Prisma:         generate + migrate + seed passed
✅ Health:         postgres ready, API 200, Web 200, Azurite up

Result: RESET COMPLETE ✅  (or FAILED ❌ — see details above)
```

## Coordinator Usage

To trigger this from the coordinator, spawn Sydnor with:

```
description: "🐳 Sydnor: Docker reset"
prompt: |
  You are Sydnor, the Tester.
  TEAM ROOT: {team_root}
  
  Read .squad/skills/docker-reset/SKILL.md and execute the full reset workflow.
  Treat this as the nuclear option: tear down the stack, rebuild it, reapply Prisma state, reseed demo data, and verify health before reporting back.
  Report results using the format specified in the skill.
  
  ⚠️ RESPONSE ORDER: After ALL tool calls, write the docker reset report as FINAL output.
```

## Notes

- This skill only resets the E-CLAT Compose project; do not use global Docker prune commands in shared environments.
- `db:migrate:deploy` is the right reset choice here because the stack should come back using checked-in migrations, not ad hoc schema pushes.
- If health checks pass but feature flows still fail, escalate to `.squad/skills/test-and-rebuild/SKILL.md` for the fuller validation cycle.
- Seed data comes from `data/src/seed.ts`; treat a seed failure as a reset failure, not a warning.
