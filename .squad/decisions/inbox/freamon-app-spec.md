# Decision: Application Specification — Screen Inventory, Navigation, and Employee UX

**Author:** Freamon (Lead / Architect)  
**Date:** 2026-03-17  
**Status:** Proposed  
**Affects:** Kima (Frontend), Bunk (Backend), all team members

## Context

User feedback on the current dashboard: "this screen is really confusing. no quick actions. employees should be trimmed. what is the directory?" The existing UI has 4 screens, broken employee UX (shows links that 403), and a nav that exposes features to roles that can't use them.

## Decisions

1. **"Employees" → "Team":** The employee directory is renamed "Team" in the sidebar and is hidden entirely from the Employee role. Employees have no reason to see other employees.

2. **Employee dashboard = personal readiness + quick actions:** The dashboard for employees shows their compliance status, upcoming expirations, and actionable buttons (clock in/out, upload document, view profile/hours/qualifications). No employee counts. No dead links.

3. **`/me/*` route family for self-service:** All roles get `/me`, `/me/qualifications`, `/me/medical`, `/me/documents`, `/me/hours`, `/me/notifications` for their own data. This is distinct from `/team/:id/*` which is for managing others.

4. **Self-service cannot create compliance records:** Employees view their qualifications and medical clearances but cannot create or edit them. Those are managed by Supervisors+ through `/team/:id/*` views. Deliberate for regulated industries.

5. **Document review is Manager+, not Supervisor+:** Aligns with RBAC spec — Supervisors can view team documents but lack `documents:review` and `documents:approve` permissions.

6. **Standards read-only in `apps/web`:** All roles can browse standards to understand requirements. CRUD is admin-only via `apps/admin`.

7. **Three API gaps identified:**
   - P0: `GET /api/documents/employee/:employeeId` (missing — qualifications and medical have this pattern, documents should match)
   - P1: Batch readiness endpoint for dashboard widgets (N+1 problem)
   - P2: Compliance report endpoint for CO Overview page

8. **5-phase implementation order:** Employee UX first (dashboard rewrite + `/me/*` pages), then Team Management, then Manager Operations, then Compliance/Standards, then Admin App.

## Consequences

- Kima needs to restructure routes, sidebar, and dashboard before building new screens
- Bunk needs to add `GET /api/documents/employee/:employeeId` before Phase 1 frontend can complete
- All future UI work traces back to the spec at `docs/architecture/app-spec.md`

## Reference

Full specification: `docs/architecture/app-spec.md`
