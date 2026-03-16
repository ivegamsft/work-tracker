# Skill: Git Status Report

> Reusable snapshot for answering “where are we?” on the branch and local stack.

## Metadata

- **Confidence:** low
- **Created:** 2026-03-16
- **Last validated:** 2026-03-16
- **Domain:** git, status, operations

## When to Use

Use this skill whenever:
- The user asks for current branch status or a quick project snapshot
- Work is paused and the team needs a handoff-ready summary
- Before starting a new batch, PR, or recovery action
- Docker/test state may have drifted and needs a concise readout

## Steps

Run these steps in order. Stop and report on first failure.

### Step 1 — Capture Branch and Working Tree State

```powershell
cd <repo-root>
git status --short --branch
```

**Pass criteria:** Branch name, ahead/behind state, and working tree changes are visible.
**Fail criteria:** Git status cannot be read or the repository is not in a usable state.

### Step 2 — Capture Unpushed Commits and Recent History

```powershell
cd <repo-root>
if (git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>$null) {
  git cherry -v
} else {
  Write-Output "(no upstream configured)"
}
git --no-pager log --oneline -5
```

**Pass criteria:** Unpushed commits (if any) and the last five commits are captured.
**Fail criteria:** Git history cannot be read.

### Step 3 — Capture Docker Stack Status

```powershell
cd <repo-root>
docker compose ps 2>&1
```

**Pass criteria:** Current status of `api`, `web`, `postgres`, and `azurite` is visible, even if some are down.
**Fail criteria:** Docker Compose cannot report status.

### Step 4 — Count Test Files and Test Cases

```powershell
cd <repo-root>
$testFiles = Get-ChildItem -Recurse -File apps,tests,packages -Include *.test.ts,*.test.tsx,*.spec.ts,*.spec.tsx,*.test.js,*.test.jsx,*.spec.js,*.spec.jsx
$testCases = if ($testFiles) { Select-String -Path $testFiles.FullName -Pattern '^\s*(it|test)\(' } else { @() }
$testFiles.Count
$testCases.Count
```

**Pass criteria:** Test inventory count is captured as files and test cases.
**Fail criteria:** Test locations cannot be enumerated.

## Report Format

```
📋 Git Status Report
━━━━━━━━━━━━━━━━━━━
🌿 Branch:         {branch} ({ahead/behind state})
📝 Changes:        {clean | n modified / n staged / n untracked}
🚀 Unpushed:       {n} commit(s)
🕓 Recent log:
- {sha} {message}
- {sha} {message}
- {sha} {message}
- {sha} {message}
- {sha} {message}
🐳 Docker:         {api/web/postgres/azurite status summary}
🧪 Tests:          {file-count} files / {case-count} cases detected

Result: SNAPSHOT READY ✅
```

## Coordinator Usage

To trigger this from the coordinator, spawn Ralph with:

```
description: "📋 Ralph: Git status report"
prompt: |
  You are Ralph, the Work Monitor.
  TEAM ROOT: {team_root}
  
  Read .squad/skills/git-status-report/SKILL.md and produce the full snapshot.
  Include branch state, local changes, unpushed commits, recent history, Docker status, and test inventory.
  Report results using the format specified in the skill.
  
  ⚠️ RESPONSE ORDER: After ALL tool calls, write the git status report as FINAL output.
```

## Notes

- This is a snapshot skill, not a fix-it skill; report what you see without mutating the branch.
- `git cherry -v` is the quickest way to show what is ahead of upstream when an upstream exists.
- Docker being down is still valid status information; only command failure is a hard failure.
- Test count is inventory only. Use `.squad/skills/test-and-rebuild/SKILL.md` when the team needs execution results.
