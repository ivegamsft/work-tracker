---
name: "architecture-spec-pattern"
description: "Template for writing comprehensive architecture specifications for E-CLAT platform features"
domain: "api-design, documentation"
confidence: "high"
source: "earned through templates-attestation-spec, proof-vault-spec, sharing-spec authoring"
---

## Context

When designing new E-CLAT platform features that require:
- New Prisma models
- New API endpoints
- New permissions
- New UI screens

This pattern ensures consistency with existing specs and provides a complete implementation contract.

## Patterns

### 1. Spec Header

```markdown
# Feature Name — E-CLAT Platform

> **Status:** Authoritative Reference  
> **Owner:** Freamon (Lead / Architect)  
> **Created:** YYYY-MM-DD  
> **Applies To:** `apps/api` (module), `apps/web` (UI), `packages/shared` (types)  
> **Companion Docs:** Links to related specs  
> **Triggered By:** User directive or requirement
```

### 2. Standard Table of Contents

1. Overview — What it is, key concepts, value proposition
2. Core Design — Main domain concepts and rules
3. Data Model — Prisma schema with design rationale table
4. Lifecycle — State machines with diagrams
5. Workflows — User flows with ASCII diagrams
6. API Endpoints — Numbered catalog (T-01, V-01, etc.) with request/response examples
7. RBAC Permissions — New permissions + role matrix
8. UI Screens — Numbered (W-XX, A-XX) with wireframes
9. Integration — How it connects to existing modules
10. Phase Recommendation — When to ship relative to roadmap
11. Implementation Notes — For Bunk (API) and Kima (UI)

### 3. Endpoint Catalog Pattern

| # | Method | Path | Description | Min Role | Scope |
|---|--------|------|-------------|----------|-------|
| T-01 | `POST` | `/api/resource` | Create | Role | Scope |

Use prefixes: T- (templates), V- (vault), D- (documents), etc.

### 4. Screen Numbering

- Web screens: W-XX (check existing highest number)
- Admin screens: A-XX
- Current highest: W-29, A-10

### 5. Permission Syntax

```
{resource}:{action}
```

Examples: `templates:create`, `fulfillments:submit`, `vault:read`

### 6. Prisma Model Pattern

```prisma
model ResourceName {
  id          String    @id @default(uuid())
  // ... fields
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  // Relations
  relatedItems RelatedItem[]
  
  @@index([commonQueryField])
  @@map("table_name")
}
```

### 7. Design Rationale Table

| Decision | Rationale |
|----------|-----------|
| Why X | Because Y |

### 8. Phase Recommendation

| Feature | Complexity | Dependencies | Priority |
|---------|:----------:|--------------|:--------:|
| Core CRUD | Medium | None | P0 |
| Integration | High | Other module | P2 |

## Examples

- `docs/architecture/templates-attestation-spec.md` — 13 sections, 25 endpoints, 4 models
- `docs/architecture/proof-vault-spec.md` — 12 sections, 12 endpoints, 2 models
- `docs/architecture/sharing-spec.md` — Full sharing/vault integration

## Anti-Patterns

1. **Skipping the design rationale** — Decisions without rationale create confusion later
2. **Not numbering endpoints/screens** — Makes cross-referencing impossible
3. **Missing integration section** — New features must connect to existing modules
4. **Forgetting RBAC** — Every endpoint needs permission and scope definition
5. **No phase recommendation** — Specs without timing guidance stall implementation
6. **Embedded code without types** — API examples should include TypeScript signatures
