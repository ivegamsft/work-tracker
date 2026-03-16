# Admin Application — Dormant Status

**Status:** Scaffold only — not actively developed in MVP (v0.4.0–v0.6.0)  
**Target Release:** v0.7.0+ (post-service extraction)  
**Decision Date:** 2026-03-19  
**Decision Owner:** Freamon (Lead)

## Why Dormant?

The `apps/admin` workspace exists as a scaffold for future administrative functionality, but it is not part of the current MVP scope (releases v0.4.0 through v0.6.0). Admin features defined in the App Spec (A-01 through A-09) will initially be implemented in `apps/web` with RBAC-gated routes for the Admin role.

## What Exists Now

- `package.json` with placeholder scripts
- `README.md` with planned features
- No actual source code, routes, or components
- No build, test, or deployment pipeline

## What Happens Next

### Phase 1: MVP Admin in Web App (v0.4.0–v0.6.0)

Admin screens will be implemented in `apps/web` under RBAC-protected routes:
- Employee Management → `/admin/employees`
- Standards Management → `/admin/standards`
- Label Management → `/admin/labels`
- Notification Config → `/admin/notifications`
- Escalation Rules → `/admin/escalation-rules`
- Audit Logs → `/admin/audit`

These routes will be accessible only to users with the `Admin` role (Level 4).

### Phase 2: Extract Admin App (v0.7.0+)

When service extraction begins (per `docs/specs/service-architecture-spec.md`), the admin application will be extracted as a separate SPA:
1. Copy admin-scoped routes/components from `apps/web`
2. Add dedicated admin pipeline (build, test, deploy)
3. Configure separate Azure Container App for admin shell
4. Wire admin app to extracted backend services via API gateway
5. Implement separate Entra ID app registration for admin SSO

## CI/CD Implications

The CI pipeline (`ci.yml`) already includes path detection for `admin-shell`, but there is **no validation lane** for it because there is no code to validate. When admin extraction begins:
- Add `test-admin` job (parallel with `test-api` and `test-web`)
- Add admin build step to `build` job
- Add admin container to `docker` job
- Add admin deployment to `deploy.yml`

## References

- **App Spec:** `docs/specs/app-spec.md` § 2.2 (9 admin screens)
- **Service Architecture:** `docs/specs/service-architecture-spec.md` (extraction roadmap)
- **Pipeline Spec:** `docs/specs/pipeline-architecture-spec.md` (subsystem map includes `admin-shell`)
- **Issue #49:** [Pipeline] Add admin-shell pipeline or mark dormant (decision + implementation)

---

**For Developers:**  
If you need to implement an admin feature, add it to `apps/web` with `requireRole(Roles.ADMIN)` guards. Do not add code to `apps/admin` until the extraction phase begins.
