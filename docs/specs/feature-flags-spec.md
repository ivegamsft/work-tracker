# Feature Flags Spec — E-CLAT

> **Status:** Proposed MVP Design  
> **Owner:** Daniels (Microservices Engineer)  
> **Date:** 2026-03-16  
> **Applies To:** `apps/api`, `apps/web`, `packages/shared`  
> **Companion Docs:** `docs/specs/service-architecture-spec.md`, `docs/ideas/ui-menu-architecture.md`, `docs/req/feature-flag-requirements.md`

## 1. Goal

Provide a simple, contract-first feature flag system that can:
- gate incomplete or risky backend routes,
- drive frontend menu and route visibility,
- support environment-specific defaults,
- provide kill switches,
- enable limited allowlist or percentage rollout later,
- avoid introducing a separate hosted flag service for MVP.

## 2. MVP Recommendation

### 2.1 Where flags live
Use a **repo-backed registry plus environment overrides**.

```text
packages/shared/src/contracts/feature-flags.ts   # schema + types
apps/api/src/config/feature-flags/base.ts        # authoritative registry
apps/api/src/config/feature-flags/dev.ts         # env overrides
apps/api/src/config/feature-flags/staging.ts
apps/api/src/config/feature-flags/prod.ts
```

Optional runtime override:
- `ECLAT_FLAG_OVERRIDES_JSON` environment variable for emergency changes in dev/staging.

### 2.2 Why this MVP
- Works with the current monorepo and Container App deployment model.
- Keeps flags in PR-reviewed source control.
- Avoids adding operational burden before multiple services exist.
- Makes frontend and backend share one schema.

## 3. Flag Schema

```ts
interface FeatureFlagDefinition {
  key: string;
  description: string;
  owner: 'platform' | 'workforce' | 'compliance' | 'records' | 'reference' | 'notifications' | 'web';
  type: 'release' | 'ops' | 'permission' | 'experiment';
  defaultValue: boolean;
  environments: Partial<Record<'dev' | 'staging' | 'prod' | 'test', boolean>>;
  allowedRoles?: string[];
  allowlist?: string[]; // employee ids or emails for MVP
  rolloutPercentage?: number; // optional; 0-100
  expiresOn?: string;
  clientVisible: boolean;
}
```

### Required fields
- `key`: stable dotted identifier, for example `records.hours-ui`.
- `description`: human-readable purpose.
- `owner`: service group accountable for the flag.
- `type`: distinguishes release flags from kill switches and experiments.
- `defaultValue`: fallback when no environment override exists.
- `clientVisible`: controls whether the flag is safe to expose to the web app.

## 4. Naming Standard

Use `{service-group}.{capability}`.

Examples:
- `workforce.team-directory`
- `compliance.templates`
- `compliance.template-review`
- `records.hours-ui`
- `records.document-extraction-corrections`
- `reference.labels-admin`
- `notifications.weekly-digest`
- `web.compliance-dashboard`

## 5. Backend Consumption Model

### 5.1 Resolution flow
1. Load base registry.
2. Merge environment override file.
3. Merge optional `ECLAT_FLAG_OVERRIDES_JSON`.
4. Resolve actor-specific checks (role, allowlist, rollout).
5. Expose final result through a typed flag service.

### 5.2 Backend integration points
- **Route registration:** do not mount unfinished route groups when a release flag is off.
- **Route guard middleware:** `requireFlag('compliance.templates')` for endpoints that stay mounted but must hard-disable.
- **Service guard:** critical kill switches inside service entry points, especially for writes or async workers.
- **Background jobs:** worker startup should skip disabled processors.

### 5.3 Suggested API

```ts
interface FeatureFlagService {
  isEnabled(key: string, context?: FlagContext): boolean;
  requireEnabled(key: string, context?: FlagContext): void;
  getClientFlags(context: FlagContext): Record<string, boolean>;
}

interface FlagContext {
  userId?: string;
  email?: string;
  role?: string;
  environment: 'dev' | 'staging' | 'prod' | 'test';
}
```

### 5.4 Backend behavior rules
- Read requests may return `404` for fully hidden features.
- Write requests blocked by a kill switch should return `409` or `503`, depending on whether the shutdown is operational or product-level.
- Health endpoints should report whether critical processors are disabled by ops flags.

## 6. Frontend Consumption Model

### 6.1 Source of truth for the web app
The web app should not maintain its own independent flag defaults at runtime.

Instead:
1. App bootstraps authenticated user.
2. App requests client-safe flags from a platform endpoint such as `GET /api/v1/platform/feature-flags`.
3. Menu registry and route registry consume those resolved flags.

### 6.2 Frontend usage points
- menu visibility,
- route registration,
- lazy-loaded domain bundles,
- quick actions,
- page sections and beta components.

### 6.3 Rules for UI behavior
- Hidden feature: do not show menu item or quick action.
- Disabled route: redirect to nearest valid landing page; do not show a dead end.
- Beta feature: optional badge and help text, but only when enabled.
- Client should never receive non-client-visible ops flags.

## 7. RBAC + Feature Flag Interaction

A feature is available only when both checks pass:
1. role/scope allows it,
2. flag allows it.

Formula:

```text
feature visible = hasRole && isFlagEnabled
```

Flags must not replace RBAC. They narrow availability; they do not grant permissions.

## 8. Rollout Strategy

### Phase A — Boolean only
- environment defaults
- client visibility
- role filtering
- allowlist support

### Phase B — Controlled rollout
- add `rolloutPercentage`
- hash on user ID or email for deterministic assignment
- only for low-risk UI experiments first

### Phase C — Remote management
- only after multiple services and operations teams need runtime edits without a code change
- can move to database-backed admin UI or external flag provider later

## 9. Flag Catalog to add immediately

| Flag | Default | Why |
|---|---|---|
| `records.hours-ui` | false in prod | hours APIs and UI are incomplete |
| `reference.labels-admin` | false in prod | labels service is scaffolded |
| `compliance.templates` | true in dev/staging, false in prod until review | templates are advanced and should roll out deliberately |
| `web.team-subnav` | false | enables new menu architecture gradually |
| `notifications.escalation-rules` | false | admin flows are partial |
| `platform.route-groups` | false | gates move from hard-coded routes to registries |

## 10. Suggested API Surface

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/platform/feature-flags` | client-safe resolved flags for current user |
| `GET` | `/api/v1/platform/feature-flags/health` | internal/admin visibility into active ops flags |

No write API is required for MVP. Source control plus environment overrides is sufficient.

## 11. Operational Rules
- Every new user-facing feature must declare a flag before implementation starts.
- Every release flag gets an owner and an expiry/removal date.
- Ops kill switches must be documented in runbooks.
- Stale flags should be removed within one release after full rollout.

## 12. Backlog Additions

| ID | Priority | Item |
|---|---|---|
| FF-01 | P0 | Add shared flag schema and server-side registry/resolver. |
| FF-02 | P0 | Add `GET /api/v1/platform/feature-flags` endpoint returning client-safe flags. |
| FF-03 | P0 | Gate hours, labels, escalation rules, and new menu sections with flags. |
| FF-04 | P1 | Add role + allowlist resolution helpers and deterministic rollout hashing. |
| FF-05 | P1 | Add audit/runbook documentation for ops kill switches. |
| FF-06 | P2 | Add admin UI or remote override storage only after multi-service operations demand it. |

## 13. Acceptance Criteria
- A single shared schema defines every flag.
- Backend and frontend read the same resolved keys.
- Incomplete routes and menus are hidden behind flags.
- Role checks and flags are evaluated together, never separately.
- There is a documented path from simple config flags to a future remote system without breaking key names.