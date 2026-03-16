# Parallel Deployment and Feature Flag Test Plan — E-CLAT

> **Status:** Proposed test plan for implementation follow-through  
> **Owner:** Daniels (architecture) / Sydnor (execution)  
> **Date:** 2026-03-16

## 1. Purpose

Define the minimum verification needed once subsystem pipelines, feature flags, and menu architecture are implemented.

## 2. Test Tracks

### Track A — Change detection
1. Change `apps/api/src/modules/hours/**` only.
   - Expected: `records-service` lane runs; unrelated service lanes do not.
2. Change `apps/api/src/modules/templates/**` only.
   - Expected: `compliance-service` lane runs.
3. Change `packages/shared/**`.
   - Expected: all dependent API/web/admin lanes run.
4. Change `infra/modules/compute-records/**` only.
   - Expected: infra compute plan and records deploy lane run; workforce/compliance deploy lanes do not.

### Track B — Deploy target isolation
1. Deploy only `reference-data` to dev.
   - Expected: only reference target updates.
2. Promote only `notifications-service` to staging.
   - Expected: artifact hash matches dev artifact; unrelated services are untouched.
3. Reject prod approval for `records-service`.
   - Expected: no other subsystem is blocked from promotion.

### Track C — Feature flags
1. Turn `records.hours-ui` off.
   - Expected: hours menu entries and routes disappear or redirect safely.
2. Turn `reference.labels-admin` off.
   - Expected: admin labels flows are hidden and APIs reject writes.
3. Turn `compliance.templates` on for allowlist users only.
   - Expected: allowlisted users see templates menu and routes; others do not.
4. Verify platform bootstrap payload.
   - Expected: client-visible flags only; server-only ops flags absent.

### Track D — Menu architecture
1. Employee login.
   - Expected: only Home, My Work, Reference, and allowed notifications links appear.
2. Supervisor login.
   - Expected: Team section appears with scoped sub-navigation.
3. Manager login.
   - Expected: Reviews section appears when relevant flags are enabled.
4. Compliance officer login.
   - Expected: Compliance overview routes appear only when enabled.

## 3. Automation Targets
- contract tests for feature-flag bootstrap payload,
- UI tests for menu visibility by role and flag state,
- workflow tests for path filter routing,
- smoke deploy tests for health endpoints.

## 4. Exit Criteria
- targeted path filter behavior is proven,
- subsystem promotion is independent,
- flags behave the same in API and UI,
- disabled features are invisible and safe,
- deployment metadata is traceable per subsystem.