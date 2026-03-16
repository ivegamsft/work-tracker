# Admin Shell Status — E-CLAT

> **Status:** Decision Record  
> **Owner:** Freamon (Lead)  
> **Date:** 2026-03-19  
> **Related Issue:** #49 — [Pipeline] Add admin-shell pipeline or mark dormant (decision + implementation)  
> **Related Spec:** `docs/specs/app-spec.md` § 2.2 (Admin screens), `docs/specs/service-architecture-spec.md` (service extraction roadmap)

---

## Decision

**Mark `apps/admin` as dormant for MVP releases (v0.4.0–v0.6.0).** Admin functionality will be implemented in `apps/web` with RBAC role guards during the MVP phase, then extracted to a dedicated admin app during service extraction (v0.7.0+).

## Context

Issue #49 asked whether to add a CI/CD pipeline for `apps/admin` or mark it as dormant. Investigation revealed:

### What Exists
- `apps/admin/package.json` — placeholder workspace with echo scripts
- `apps/admin/README.md` — planned features list
- **No actual code:** no routes, components, or tests
- **CI awareness:** `ci.yml` includes path detection for `admin-shell` but no validation lane
- **Not in build:** root `package.json` build script excludes admin
- **Not in compose:** `docker-compose.yml` does not include admin service

### What Was Specified
The App Spec (`docs/specs/app-spec.md` § 2.2) defines 9 admin screens:
- A-01: Admin Login
- A-02: Admin Dashboard
- A-03: Employee Management (CRUD)
- A-04: Employee Create/Edit
- A-05: Standards Management
- A-06: Standard Editor
- A-07: Label Management
- A-08: Escalation Rules
- A-09: Notification Testing

All are marked "🆕 New" (not implemented). The spec explicitly states:

> **1.2.5: Two apps, clear boundary.** `apps/web` serves roles Employee through Compliance Officer. `apps/admin` serves Admin for platform configuration. Admins can access `apps/web` too — they just get the management view.

## Options Considered

### Option A: Add Pipeline Now
**Pros:**
- Enforces separation early
- CI lane validates admin changes independently
- Matches spec's "two apps" principle

**Cons:**
- Zero code to validate → wasted CI cycles
- Adds complexity before value is delivered
- Delays MVP by introducing a second deployment target
- Requires second Azure Container App, second app registration, second routing rule

### Option B: Mark Dormant, Implement Admin in Web App (CHOSEN)
**Pros:**
- MVP admin features ship faster (single build/deploy)
- No wasted CI cycles on empty scaffold
- RBAC already enforces Admin-only access
- Extraction can happen later when service boundaries stabilize
- Aligns with incremental service extraction strategy

**Cons:**
- Temporary deviation from "two apps" principle
- Must migrate admin features later during extraction

## Decision Rationale

**Choose Option B** because:
1. **Speed to MVP:** Admin features are part of v0.5.0–v0.6.0 scope. Implementing them in `apps/web` with `requireRole(Roles.ADMIN)` guards delivers value immediately without setting up a second deployment target.
2. **No waste:** There is zero code in `apps/admin`. Adding a CI lane would validate nothing.
3. **Extraction alignment:** The service architecture spec (`docs/specs/service-architecture-spec.md`) already plans incremental extraction starting v0.7.0. Admin app extraction can happen then, when backend service boundaries are stable.
4. **RBAC is sufficient:** The security boundary is the `Admin` role (Level 4), not the application shell. Role guards provide the same protection as a separate app during MVP.

## Implementation

### 1. Mark `apps/admin` as Dormant
Created `apps/admin/DORMANT.md` documenting:
- Why it's dormant (MVP not ready for extraction)
- Where admin features will live (in `apps/web` with RBAC)
- When extraction will happen (v0.7.0+)
- What needs to happen for extraction (9 steps)

### 2. No CI Lane for Admin
The CI pipeline (`ci.yml`) already includes path detection for `admin_shell` but no validation job. This is correct — no code means nothing to validate. When extraction begins, add:
- `test-admin` job
- Admin build step in `build` job
- Admin container in `docker` job

### 3. Document Admin Route Strategy
Updated `docs/specs/app-spec.md` (if needed) to clarify that admin screens (A-01 to A-09) will initially be implemented in `apps/web` under `/admin/*` routes with `requireRole(Roles.ADMIN)` guards.

### 4. Prevent Accidental Admin Development
Developers looking to add admin features should be directed to `apps/web`, not `apps/admin`. The `DORMANT.md` file serves as a clear signal.

## Migration Plan (v0.7.0+)

When service extraction begins, follow these steps to activate `apps/admin`:

1. **Create admin app scaffold:**
   - Choose frontend framework (likely React + Vite to match `apps/web`)
   - Add TypeScript config, Vitest config, ESLint/Prettier
   - Add package.json with real scripts (not echo stubs)

2. **Extract admin routes from `apps/web`:**
   - Move `/admin/*` routes to `apps/admin/src/pages/`
   - Move admin-specific components to `apps/admin/src/components/`
   - Update imports and routing

3. **Add CI lane:**
   - Add `test-admin` job to `ci.yml` (parallel with `test-api` and `test-web`)
   - Add admin build step to `build` job
   - Add admin Docker container to `docker` job

4. **Add deployment pipeline:**
   - Create Dockerfile for admin app
   - Add Azure Container App for admin shell in `infra/layers/20-compute/`
   - Add admin deployment to `deploy.yml`

5. **Configure Entra ID:**
   - Create separate Entra ID app registration for admin SSO
   - Configure app roles (Admin only)
   - Wire admin app to API gateway

6. **Update documentation:**
   - Remove `DORMANT.md`
   - Update `docs/specs/app-spec.md` to reflect separate admin app
   - Update `README.md` with admin app setup instructions

7. **Test end-to-end:**
   - Verify admin SSO flow
   - Verify admin routes are accessible only to Admin role
   - Verify admin API calls respect RBAC

8. **Remove admin routes from `apps/web`:**
   - Delete `/admin/*` routes
   - Remove admin-specific components
   - Add redirect from `/admin` to admin app URL

9. **Deploy and validate:**
   - Deploy admin app to dev environment
   - Smoke test all 9 admin screens
   - Promote to staging/prod

## References

- **Issue #49:** [Pipeline] Add admin-shell pipeline or mark dormant (decision + implementation)
- **App Spec:** `docs/specs/app-spec.md` § 2.2 (9 admin screens)
- **Service Architecture:** `docs/specs/service-architecture-spec.md` (extraction roadmap)
- **Pipeline Spec:** `docs/specs/pipeline-architecture-spec.md` (subsystem map)
- **RBAC Spec:** `docs/specs/rbac-api-spec.md` (Admin role permissions)

---

## Status

✅ **Implemented** — `apps/admin` marked dormant, decision documented, no CI lane added.

Admin features will be implemented in `apps/web` during MVP (v0.4.0–v0.6.0) and extracted to `apps/admin` during service extraction (v0.7.0+).
