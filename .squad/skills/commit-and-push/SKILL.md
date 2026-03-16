# Skill: Commit & Push

> Reusable safe commit workflow for finishing an implementation batch.

## Metadata

- **Confidence:** low
- **Created:** 2026-03-16
- **Last validated:** 2026-03-16
- **Domain:** git, validation, security

## When to Use

Use this skill whenever:
- Code or docs are ready to be committed after an implementation batch
- The user asks to commit, push, or "wrap this up"
- A branch needs a final safety gate before opening or updating a PR
- The team wants one repeatable workflow for commit hygiene

## Steps

Run these steps in order. Stop and report on first failure.

### Step 1 — Review the Staged Scope

```powershell
cd <repo-root>
git status --short --branch
git diff --cached --stat
git diff --cached --name-only --diff-filter=ACMRTUXB
```

**Pass criteria:** Current branch is clear, at least one intended file is staged, and no unexpected files are included.
**Fail criteria:** Nothing is staged, the branch is detached, or staged files do not match the intended batch.

### Step 2 — Scan Staged Files for Secrets

```powershell
cd <repo-root>
$pattern = '(?i)(api[_-]?key|secret|token|password|passwd|client_secret|connection string|tenant[_-]?id|subscription[_-]?id|-----BEGIN (RSA|EC|OPENSSH|DSA) PRIVATE KEY-----|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z\-_]{35}|gh[pousr]_[A-Za-z0-9_]{20,255}|xox[baprs]-[A-Za-z0-9-]{10,}|postgres(ql)?:\/\/|DefaultEndpointsProtocol=|AccountKey=|SharedAccessSignature=)'
$staged = git diff --cached --name-only --diff-filter=ACMRTUXB
$staged | ForEach-Object { if (Test-Path $_) { rg -n -I --color never $pattern -- $_ } }
$staged | Where-Object { $_ -match '(^|[\\/])\.env($|\.)' }
```

**Pass criteria:** No secret-like matches and no staged `.env*` files.
**Fail criteria:** Any secret-like value or `.env*` file is detected. Do not continue to commit or push.

### Step 3 — Run the Validation Gate

```powershell
cd <repo-root>
npm test 2>&1
npm run typecheck 2>&1
```

**Pass criteria:** Tests and typecheck both exit cleanly.
**Fail criteria:** Any failing test, type error, or missing dependency. Fix before commit.

### Step 4 — Create a Conventional Commit

```powershell
cd <repo-root>
git commit -m "type(scope): summary" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

**Pass criteria:** Commit succeeds with a conventional message (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`, etc.) and includes the required trailer.
**Fail criteria:** Commit hook failure, invalid commit message, or missing Co-authored-by trailer.

### Step 5 — Push and Verify Branch State

```powershell
cd <repo-root>
if (git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>$null) {
  git push
} else {
  git push --set-upstream origin $(git branch --show-current)
}
git status --short --branch
```

**Pass criteria:** Remote branch updates successfully and local branch is no longer ahead of upstream.
**Fail criteria:** Push rejection, auth failure, or branch still shows unpushed commits after push.

## Report Format

```
🚢 Commit & Push Report
━━━━━━━━━━━━━━━━━━━━━━━
✅ Staged scope:   {n} files reviewed
✅ Secret scan:    clear
✅ Validation:     tests + typecheck passed
✅ Commit:         {type(scope): summary}
✅ Push:           origin/{branch} updated

Result: PUSHED ✅  (or BLOCKED ❌ — see details above)
```

## Coordinator Usage

To trigger this from the coordinator, spawn Ralph with:

```
description: "🚢 Ralph: Commit & push"
prompt: |
  You are Ralph, the Work Monitor.
  TEAM ROOT: {team_root}
  
  Read .squad/skills/commit-and-push/SKILL.md and execute the full workflow on the current branch.
  Stop immediately if secret scan or validation fails. Use a conventional commit message and include the required Co-authored-by trailer.
  Report results using the format specified in the skill.
  
  ⚠️ RESPONSE ORDER: After ALL tool calls, write the commit report as FINAL output.
```

## Notes

- Prefer one coherent implementation batch per commit; do not mix unrelated fixes.
- If the batch touches `docker-compose.yml`, `data/`, auth, or multi-workspace flows, run `.squad/skills/test-and-rebuild/SKILL.md` in addition to the basic validation gate.
- Never use `--no-verify` unless the user explicitly authorizes bypassing hooks.
- Conventional commit examples: `feat(api): add readiness filters`, `fix(web): handle expired session`, `docs(squad): add reusable ops skills`.
