# Skill: Test & Rebuild

> Reusable validation cycle for confirming the stack is green.

## Metadata

- **Confidence:** medium
- **Created:** 2026-03-16
- **Last validated:** 2026-03-16
- **Domain:** testing, CI, Docker

## When to Use

Use this skill whenever:
- Code changes have been made and need validation before commit/push
- The user asks "did you test?", "rebuild", "run tests", or "is it green?"
- After any implementation batch before presenting results to the user
- As a post-merge sanity check

## The Validation Cycle

Run these steps in order. Stop and report on first failure.

### Step 1 — Unit/Component Tests

```bash
cd <repo-root>
npm test 2>&1
```

**Pass criteria:** All test suites pass. Report: `✅ Tests: {passed}/{total} passed`
**Fail criteria:** Any test failure. Report full error output.

### Step 2 — TypeScript Check

```bash
cd apps/web && npx tsc --noEmit 2>&1
cd apps/api && npx tsc --noEmit 2>&1
```

**Pass criteria:** Zero type errors in both workspaces.
**Fail criteria:** Any type error. Report the file and error.

### Step 3 — Docker Rebuild

```bash
docker compose build --no-cache 2>&1
docker compose up -d 2>&1
```

Wait 10-15 seconds for services to stabilize.

**Pass criteria:** All containers running (api, web, postgres, azurite).
**Fail criteria:** Any container exited or restart-looping.

### Step 4 — Smoke Test

```bash
# API health
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health

# Web app
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
```

**Pass criteria:** Both return 200.
**Fail criteria:** Non-200 status or connection refused.

### Step 5 — E2E Tests (if available)

Check for `playwright.config.ts`, `cypress.config.ts`, or test scripts in `package.json`.
Run if found. Skip if not configured.

## Report Format

```
🧪 Validation Report
━━━━━━━━━━━━━━━━━━━━
✅ Unit tests:    {X}/{Y} passed
✅ TypeScript:    clean (web + api)
✅ Docker:        all containers healthy
✅ Smoke test:    API 200, Web 200
✅ E2E:           {X}/{Y} passed (or "skipped — not configured")

Result: ALL GREEN ✅  (or FAILED ❌ — see details above)
```

## Coordinator Usage

To trigger this from the coordinator, spawn Sydnor with:

```
description: "🧪 Sydnor: Test & rebuild validation"
prompt: |
  You are Sydnor, the Tester.
  TEAM ROOT: {team_root}
  
  Read .squad/skills/test-and-rebuild/SKILL.md and execute the full validation cycle.
  Report results using the format specified in the skill.
  
  ⚠️ RESPONSE ORDER: After ALL tool calls, write the validation report as FINAL output.
```

## Notes

- Docker rebuild uses `--no-cache` to catch stale layer issues
- If the Docker stack isn't running, start it fresh rather than rebuilding
- TypeScript checks both `apps/web` and `apps/api` separately — they have different tsconfigs
- Smoke tests use curl, not browser — just checking the services respond
