# Skill: Spec Review

> Reusable architecture review pass for finding cross-spec drift before implementation.

## Metadata

- **Confidence:** low
- **Created:** 2026-03-16
- **Last validated:** 2026-03-16
- **Domain:** architecture, specifications, review

## When to Use

Use this skill whenever:
- A new or revised spec needs Freamon's review before implementation starts
- The user asks whether a spec is complete, consistent, or conflicting
- A document changes API contracts, RBAC, data models, workflows, or screen mappings
- Multiple architecture docs may now disagree and the team needs one verdict

## Steps

Run these steps in order. Stop and report on first failure.

### Step 1 — Establish the Review Set

```powershell
cd <repo-root>
$target = "docs/architecture/<spec>.md"
$references = @(
  "docs/prds/eclat-spec.md",
  "docs/architecture/rbac-api-spec.md",
  "docs/architecture/app-spec.md",
  "docs/architecture/proof-vault-spec.md",
  "docs/architecture/sharing-spec.md",
  "docs/architecture/templates-attestation-spec.md",
  "docs/architecture/proof-taxonomy.md"
)
git diff --word-diff -- $target
```

**Pass criteria:** The target document is identified and the canonical hierarchy is loaded for comparison.
**Fail criteria:** The target spec is missing, the wrong tier is being reviewed, or the document cannot be mapped against the hierarchy.

### Step 2 — Check Structural Completeness

```powershell
cd <repo-root>
$target = "docs/architecture/<spec>.md"
rg -n "^## |TODO|TBD|FIXME|\?\?\?" $target
```

**Pass criteria:** The spec has clear sections, no unresolved placeholders, and covers the contracts it claims to define.
**Fail criteria:** Missing major sections, TODO/TBD placeholders in required behavior, or ambiguous ownership/scope.

### Step 3 — Cross-Reference Contracts and Terminology

```powershell
cd <repo-root>
$target = "docs/architecture/<spec>.md"
$references = @(
  "docs/prds/eclat-spec.md",
  "docs/architecture/rbac-api-spec.md",
  "docs/architecture/app-spec.md",
  "docs/architecture/proof-vault-spec.md",
  "docs/architecture/sharing-spec.md",
  "docs/architecture/templates-attestation-spec.md",
  "docs/architecture/proof-taxonomy.md"
)
rg -n "permission|role|endpoint|route|screen|workflow|state|status|model|schema|phase|proof|vault|template|taxonomy" $target $references
```

**Pass criteria:** Roles, endpoints, models, state machines, UI references, and terminology align with the canonical docs.
**Fail criteria:** Any contradiction, drift, duplicate source of truth, or terminology mismatch across the review set.

### Step 4 — Rank and Write Findings

```text
For each finding, capture:
- severity: critical | warning | observation
- target section/path
- conflicting reference section/path (if any)
- why it matters to implementation or review
- exact recommendation
```

**Pass criteria:** Every finding is evidence-backed, severity-ranked, and tied to a concrete section or path.
**Fail criteria:** Findings are vague, unranked, or not traceable to source material.

## Report Format

```
🧭 Spec Review Report
━━━━━━━━━━━━━━━━━━━━
Document: {target-spec}
Hierarchy checked: eclat-spec → rbac-api-spec → app-spec → proof-vault/sharing/templates/proof-taxonomy

🔴 Critical
- {finding}

🟠 Warning
- {finding}

🔵 Observation
- {finding}

Result: READY ✅  (or REVISE ❌ — see findings above)
```

## Coordinator Usage

To trigger this from the coordinator, spawn Freamon with:

```
description: "🧭 Freamon: Spec review"
prompt: |
  You are Freamon, the Lead / Architect.
  TEAM ROOT: {team_root}
  
  Read .squad/skills/spec-review/SKILL.md and review the requested spec document.
  Cross-reference it against docs/prds/eclat-spec.md, docs/architecture/rbac-api-spec.md, docs/architecture/app-spec.md, docs/architecture/proof-vault-spec.md, docs/architecture/sharing-spec.md, docs/architecture/templates-attestation-spec.md, and docs/architecture/proof-taxonomy.md.
  Report severity-ranked findings using the format specified in the skill.
  
  ⚠️ RESPONSE ORDER: After ALL tool calls, write the spec review report as FINAL output.
```

## Notes

- `docs/prds/eclat-spec.md` is the product intent anchor; architecture docs must not quietly override it without calling out a deliberate delta.
- `docs/architecture/rbac-api-spec.md` is the authority for endpoint/permission contracts; `docs/architecture/app-spec.md` is the authority for screen inventory and role-facing UX.
- Proof-related documents must be read as one cluster: `proof-vault-spec.md`, `sharing-spec.md`, `templates-attestation-spec.md`, and `proof-taxonomy.md`.
- Critical findings should block implementation; warnings may allow progress with explicit follow-up; observations are improvement notes only.
