# Feature Flag Requirements — E-CLAT

> **Status:** Proposed Requirements  
> **Owner:** Daniels (Microservices Engineer)  
> **Date:** 2026-03-16  
> **Scope:** backend gating, frontend routing/menu visibility, rollout safety

## 1. Objective

The platform shall use feature flags to control release risk, environment-specific availability, and menu visibility without weakening RBAC or requiring a hosted flag platform for MVP.

## 2. Functional Requirements

### FF-REQ-01 — Shared schema
All feature flags **MUST** be declared in a shared typed schema that both backend and frontend can consume.

### FF-REQ-02 — Stable naming
Feature flags **MUST** use stable dotted names by service group, for example `records.hours-ui` and `compliance.templates`.

### FF-REQ-03 — Owner metadata
Each flag **MUST** declare an owning service group or team.

### FF-REQ-04 — Environment defaults
Each flag **MUST** support environment-specific defaults for `dev`, `staging`, `prod`, and `test`.

### FF-REQ-05 — Backend enforcement
Backend routes and services **MUST** be able to reject or hide disabled features through typed flag checks.

### FF-REQ-06 — Frontend enforcement
Frontend navigation, route availability, quick actions, and feature sections **MUST** use the same resolved flag state.

### FF-REQ-07 — RBAC coexistence
Feature flags **MUST NOT** grant permissions. They may only narrow or hide features already controlled by RBAC.

### FF-REQ-08 — Client-safe exposure
Only explicitly client-visible flags **MAY** be returned to the web app.

### FF-REQ-09 — Kill switches
Operationally risky features **MUST** support immediate disablement through an override mechanism available in deployed environments.

### FF-REQ-10 — Expiry discipline
Temporary release and experiment flags **SHOULD** declare an expected removal date.

### FF-REQ-11 — Auditability
Flag changes **MUST** be traceable through source control or a future admin override audit trail.

### FF-REQ-12 — Bootstrap endpoint
The backend **MUST** expose a client-safe flag bootstrap response for authenticated shells.

## 3. Non-Functional Requirements

### FF-NFR-01 — Simple MVP
The initial implementation **SHOULD** use repo-backed config plus environment overrides rather than a separate hosted feature-flag service.

### FF-NFR-02 — Deterministic rollout
If percentage rollout is used, assignment **MUST** be deterministic per actor.

### FF-NFR-03 — Low leakage
Non-client-visible ops flags **MUST NOT** leak to browsers.

### FF-NFR-04 — Cross-service portability
Flag keys and semantics **SHOULD** survive future service extraction without renaming.

## 4. Acceptance Tests
- Disabled features do not appear in menus.
- Disabled backend routes return the documented behavior.
- Role-only access still fails when the flag is off.
- A client-safe bootstrap payload excludes server-only ops flags.
- Environment overrides change behavior without source changes in the shell.

## 5. Backlog Additions

| ID | Priority | Requirement-derived work |
|---|---|---|
| FF-BL-01 | P0 | Add shared flag schema and resolver. |
| FF-BL-02 | P0 | Add platform endpoint returning client-safe resolved flags. |
| FF-BL-03 | P0 | Gate hours, labels, escalation rules, and route-registry rollout behind flags. |
| FF-BL-04 | P1 | Add deterministic allowlist/percentage rollout support. |
| FF-BL-05 | P1 | Add stale-flag cleanup review to release checklist. |
| FF-BL-06 | P2 | Add admin override UI only after operational need is proven. |

## 6. Done Definition
A feature is flag-ready when:
- the key exists in the shared schema,
- backend enforcement is implemented,
- frontend visibility is implemented,
- the flag has an owner and environment defaults,
- client-safe exposure is defined,
- removal timing is documented.