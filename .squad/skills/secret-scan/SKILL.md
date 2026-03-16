# Skill: Secret Scan

> Reusable pre-push scan for blocking secrets before they leave the branch.

## Metadata

- **Confidence:** low
- **Created:** 2026-03-16
- **Last validated:** 2026-03-16
- **Domain:** security, git, validation

## When to Use

Use this skill whenever:
- Any staged work is about to be committed or pushed
- The user asks for a secret check, security sweep, or push safety pass
- Infra, auth, Docker, or environment files were touched
- The team wants a standalone blocker before sending code upstream

## Steps

Run these steps in order. Stop and report on first failure.

### Step 1 — Build the Scan Scope

```powershell
cd <repo-root>
$staged = git diff --cached --name-only --diff-filter=ACMRTUXB
$recentFiles = if (git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>$null) {
  git diff --name-only '@{u}'..HEAD
} else {
  git log -n 5 --name-only --pretty=format:
}
$staged
$recentFiles
```

**Pass criteria:** There is a clear scan scope from staged files and recent/unpushed commit files.
**Fail criteria:** Git scope cannot be determined or the branch state is too broken to inspect safely.

### Step 2 — Scan Staged Files for Secret-Like Content

```powershell
cd <repo-root>
$pattern = '(?i)(api[_-]?key|secret|token|password|passwd|client_secret|connection string|tenant[_-]?id|subscription[_-]?id|-----BEGIN (RSA|EC|OPENSSH|DSA) PRIVATE KEY-----|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z\-_]{35}|gh[pousr]_[A-Za-z0-9_]{20,255}|xox[baprs]-[A-Za-z0-9-]{10,}|postgres(ql)?:\/\/|DefaultEndpointsProtocol=|AccountKey=|SharedAccessSignature=)'
$staged | ForEach-Object { if (Test-Path $_) { rg -n -I --color never $pattern -- $_ } }
$staged | Where-Object { $_ -match '(^|[\\/])\.env($|\.)' }
```

**Pass criteria:** No secret-like matches are found and no `.env*` files are staged.
**Fail criteria:** Any match appears. Report every hit with file:line references and block the push.

### Step 3 — Scan Recent or Unpushed Commit Files

```powershell
cd <repo-root>
$pattern = '(?i)(api[_-]?key|secret|token|password|passwd|client_secret|connection string|tenant[_-]?id|subscription[_-]?id|-----BEGIN (RSA|EC|OPENSSH|DSA) PRIVATE KEY-----|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z\\-_]{35}|gh[pousr]_[A-Za-z0-9_]{20,255}|xox[baprs]-[A-Za-z0-9-]{10,}|postgres(ql)?:\\/\\/|DefaultEndpointsProtocol=|AccountKey=|SharedAccessSignature=)'
$recentFiles = if (git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>$null) {
  git diff --name-only '@{u}'..HEAD
} else {
  git log -n 5 --name-only --pretty=format:
}
$recentFiles | Sort-Object -Unique | ForEach-Object { if ($_ -and (Test-Path $_)) { rg -n -I --color never $pattern -- $_ } }
$recentFiles | Sort-Object -Unique | Where-Object { $_ -match '(^|[\\/])\.env($|\.)' }
```

**Pass criteria:** No secret-like matches are found in files touched by recent or unpushed commits.
**Fail criteria:** Any match appears. Report every hit with file:line references and block the push.

### Step 4 — Issue the Push Verdict

```text
If any finding exists:
- mark result as BLOCKED
- include every finding with file:line
- do not allow commit/push to continue
```

**Pass criteria:** Verdict is explicit: clear to push or blocked.
**Fail criteria:** Ambiguous verdict, hidden findings, or allowing a push after positive matches.

## Report Format

```
🔐 Secret Scan Report
━━━━━━━━━━━━━━━━━━━━
✅ Staged files:    {n} checked
✅ Recent commits:  {n} files checked
✅ Findings:        none

Result: CLEAR ✅  (or BLOCKED ❌)

If blocked:
- {file}:{line} — {match summary}
- {file}:{line} — {match summary}
```

## Coordinator Usage

To trigger this from the coordinator, spawn Ralph with:

```
description: "🔐 Ralph: Secret scan"
prompt: |
  You are Ralph, the Work Monitor.
  TEAM ROOT: {team_root}
  
  Read .squad/skills/secret-scan/SKILL.md and execute the full scan before any push.
  Check both staged files and recent/unpushed commit files. If you find anything secret-like, block the push and report every finding with file:line references.
  Report results using the format specified in the skill.
  
  ⚠️ RESPONSE ORDER: After ALL tool calls, write the secret scan report as FINAL output.
```

## Notes

- Treat passwords, tenant IDs, subscription IDs, usernames, tokens, API keys, connection strings, private keys, and `.env` contents as secrets unless clearly proven otherwise.
- False positives still require human judgment, but the default action is to block first and clear second.
- Do not sanitize by editing history inside this skill; this skill only detects and blocks. Cleanup is a separate workflow.
- `commit-and-push` should call this logic every time, but this skill must also work standalone before a manual push.
