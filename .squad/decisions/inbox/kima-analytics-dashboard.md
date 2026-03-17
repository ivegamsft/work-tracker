# Decision: Manager Analytics Dashboard Component Architecture

**Date:** 2026-03-19
**Author:** Kima (Frontend Dev)
**Issue:** #22
**Status:** Implemented

## Context

Managers need a single-page analytics view showing team compliance status, template assignment progress, and expiring items. This required deciding between embedding analytics into the existing Dashboard or creating a separate page.

## Decision

Created a dedicated `/dashboard/manager` route with SUPERVISOR+ RBAC gating, separate from the role-adaptive home dashboard at `/`. This keeps the home dashboard lightweight (personal workspace) and gives managers a purpose-built analytics view with higher information density.

## Reusable Components

Introduced 4 new reusable dashboard components under `components/dashboard/`:
- **StatCard** — Labeled value card with tone (healthy/warning/critical/neutral)
- **ProgressBar** — Accessible progress bar with label, fraction, and ARIA attributes
- **ComplianceStatusBadge** — Compliance status pill (compliant/at_risk/non_compliant)
- **ExpiryWarningList** — 30/60/90-day bucketed expiry warning panel

These are not dashboard-specific — they can be reused on any page that needs compliance visualization.

## Data Fetching

Uses `Promise.allSettled` across 4 endpoints with partial-failure UX. If some endpoints fail, available data is still shown with a notice. This is consistent with the existing DashboardPage pattern.

## Impact

- Layout nav gains "Analytics" link for supervisor+ roles
- No breaking changes to existing pages or tests
- All 145 web tests passing
