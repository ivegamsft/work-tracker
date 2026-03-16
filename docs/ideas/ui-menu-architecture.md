# UI Menu Architecture Idea — E-CLAT

> **Status:** Proposed  
> **Owner:** Daniels (Microservices Engineer)  
> **Date:** 2026-03-16  
> **Applies To:** `apps/web/src/App.tsx`, `apps/web/src/components/Layout.tsx`, `apps/web/src/pages/**`

## 1. Problem

The route taxonomy is already domain-shaped, but the visible menu is still a flat hard-coded array in `Layout.tsx`. That creates three issues:
- hidden sub-routes are hard to discover,
- incomplete features cannot be rolled out safely,
- menu ownership does not map cleanly to service groups.

## 2. Proposed Navigation Model

### Top-level sections
1. **Home**
2. **My Work**
3. **Team**
4. **Compliance**
5. **Reviews**
6. **Reference**
7. **Admin** (future `apps/admin` or admin shell link)

### Section ownership
| Section | Owner | Typical routes |
|---|---|---|
| Home | web shell | `/` |
| My Work | workforce + records + compliance | `/me`, `/me/qualifications`, `/me/medical`, `/me/documents`, `/me/hours`, `/me/notifications` |
| Team | workforce core | `/team`, `/team/:id/*` |
| Compliance | compliance service | `/compliance`, `/templates`, `/me/templates`, `/team/:id/compliance/:standardId` |
| Reviews | records + compliance | `/reviews`, `/reviews/:id`, `/reviews/templates` |
| Reference | reference data | `/standards`, `/standards/:id` |
| Admin | platform/admin shell | external admin app or `/admin/*` |

## 3. Registry Pattern

Replace hard-coded menu entries with a route/menu registry.

```ts
interface FeatureRegistration {
  id: string;
  section: 'home' | 'my-work' | 'team' | 'compliance' | 'reviews' | 'reference' | 'admin';
  label: string;
  icon?: string;
  minRole?: string;
  featureFlag?: string;
  order: number;
  routes: RouteDefinition[];
  navItems: NavItemDefinition[];
  loader?: () => Promise<unknown>;
}
```

Each domain registers:
- routes,
- menu items,
- breadcrumbs,
- optional tabs,
- role and feature-flag requirements.

## 4. RBAC + Feature Flag Rules

A menu item is visible only when:
- the user has the required role,
- the feature flag is enabled,
- the route group is registered in the current shell.

```text
visible = roleCheck && flagCheck && appCheck
```

## 5. Lazy-Loaded Route Groups

Suggested bundle layout:

```text
apps/web/src/features/
├─ home/
├─ my-work/
├─ team/
├─ compliance/
├─ reviews/
├─ reference/
└─ admin-link/
```

`App.tsx` should lazy-load route groups by section instead of importing every page up front.

## 6. Sub-navigation Rules

### My Work
Expose tab navigation under `/me`:
- Profile
- Qualifications
- Medical
- Documents
- Hours
- Notifications
- Templates (flagged)
- Vault (flagged)

### Team
Expose scoped tabs under `/team/:id`:
- Overview
- Qualifications
- Medical
- Documents
- Hours
- Compliance Check

### Reviews
Split review queues by domain when enabled:
- Documents
- Templates
- Conflicts

## 7. Plugin-Style Registration Pattern

Each feature bundle exports a registration object:

```ts
export const teamFeature: FeatureRegistration = {
  id: 'team',
  section: 'team',
  label: 'Team',
  minRole: 'supervisor',
  featureFlag: 'workforce.team-directory',
  order: 20,
  routes: [...],
  navItems: [...],
};
```

The shell composes all registrations into:
- route tree,
- side navigation,
- breadcrumbs,
- quick actions.

## 8. Quick Actions

Quick actions should also be registry-driven, not hard-coded in individual pages.

Example actions:
- Employee: `Clock In`, `Upload Document`, `View My Qualifications`
- Supervisor: `View Team`, `Add Qualification`
- Manager: `Review Documents`, `Resolve Conflicts`
- Compliance Officer: `Compliance Overview`, `Export Report`

## 9. Incremental Adoption Plan

### Step 1
- keep current routes,
- introduce registry as metadata only,
- generate menu from registry.

### Step 2
- move `/me/*` and `/team/:id/*` tabs into shared nav components.

### Step 3
- add feature-flag filtering.

### Step 4
- lazy-load sections.

### Step 5
- allow `apps/admin` or future plugin packages to register external links and route groups.

## 10. Backlog Additions

| ID | Priority | Item |
|---|---|---|
| UIA-01 | P0 | Replace hard-coded sidebar array in `Layout.tsx` with a typed registry. |
| UIA-02 | P0 | Add shared tab/breadcrumb support for `/me/*` and `/team/:id/*`. |
| UIA-03 | P0 | Drive menu visibility from role + feature flags. |
| UIA-04 | P1 | Lazy-load route groups by section. |
| UIA-05 | P1 | Add plugin registration contract for admin shell and future domains. |

## 11. Acceptance Criteria
- Menu sections align with service groups and route groups.
- Hidden or incomplete features do not appear in navigation.
- Users can discover all valid sub-pages without typing URLs.
- New domains can register themselves without editing a hard-coded sidebar array.