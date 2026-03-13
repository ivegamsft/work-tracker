---
name: "contract-first-mvp-planning"
description: "How to sequence MVP work when a repo has API contracts and schema defined but service implementations are still stubs"
domain: "architecture"
confidence: "high"
source: "observed"
---

## Context
This skill applies when a codebase already has routers, validators, shared DTOs, and a database schema, but the service layer still returns placeholder or `NOT_IMPLEMENTED` responses. In that state, the repository can describe the product surface without yet delivering the workflows. Planning should start from the contracts and schema, not from the empty services.

## Patterns

### 1. Treat the route layer and schema as the current source of truth
- Read module routers, validators, shared types, and the schema before judging scope.
- Assume the service layer tells you little if it only throws placeholders.
- Use the schema to identify which workflows are structurally ready versus merely imagined.

### 2. Make foundation a real phase, not a footnote
Before selecting domain modules, lock down:
- real auth
- Prisma/data access wiring
- audit logging primitives
- row-level RBAC helpers
- test harness and CI gates
- minimum deployable infrastructure

If those are not real, domain-module progress is mostly fake progress.

### 3. Pick the first MVP loop by implementation risk, not by feature count
Prefer modules that:
- map directly to the existing schema
- have deterministic CRUD/state rules
- do not require unresolved external integrations
- do not depend on ambiguous algorithms

Defer modules that hinge on conflict engines, background orchestration, taxonomy migration semantics, or third-party processing until the core loop is proven.

### 4. Separate enabling modules from operational modules
A good MVP often needs one enabling module (for example standards/rules) and 2-3 operational modules (for example employees, qualifications, medical). Count them differently in planning so the operational value remains clear.

### 5. Call out contract hazards early
Fix path/route ordering bugs and namespace inconsistencies before service work accelerates. Otherwise the team starts implementing against a moving or broken contract.

### 6. Capture mapping problems before coding spreads
If shared DTO values and database enums use different vocabularies or casing, create an explicit translation layer early. Do not let every module invent its own conversion logic.

## Examples
- E-CLAT pattern: use Phase 0 for auth + Prisma + audit + tests + infra minimum, Phase 1 for Employees + Standards + Qualifications + Medical, then Phase 2 for Documents-lite + Notifications-lite, while deferring Hours, Labels lifecycle, and full OCR automation.
- E-CLAT contract hazards: labels mounted at `/api` instead of `/api/labels`; documents router defines `/:id` before `/review-queue`.
- E-CLAT mapping hazard: Prisma role/status enums are uppercase while shared API/UI types are lowercase strings.

## Anti-Patterns
- Starting with the biggest workflow because it sounds central, even when its semantics are still undefined.
- Treating audit logging and row-level RBAC as follow-up work in a compliance product.
- Assuming stubbed service files represent real implementation progress.
- Building the frontend before auth contracts and status vocabularies are stable.
- Mixing deploy-time infrastructure hardening with MVP domain scope without identifying what is truly blocking the first demo release.
