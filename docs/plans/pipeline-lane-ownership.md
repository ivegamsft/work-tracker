# Parallel Validation Lanes — Ownership & Responsibilities

## Overview

The CI pipeline is organized into parallel validation lanes per subsystem. Each lane validates only the code it owns, enabling faster feedback and independent development velocity.

## Subsystem Lanes

### 1. Shared Quality Lane
**Path:** `packages/shared/**`, `data/prisma/**`
**Responsibilities:** Typecheck, build, lint shared package
**Trigger:** Always runs when shared or schema changes

### 2-8. Backend Service Lanes
- **Identity Platform** (`auth`)
- **Workforce Core** (`employees`)
- **Compliance Service** (`qualifications`, `medical`, `templates`)
- **Records Service** (`documents`, `hours`)
- **Reference Data** (`standards`, `labels`)
- **Notifications Service** (`notifications`)

Each lane:
- Runs typecheck for that module
- Runs module-specific tests
- Builds service artifacts
- Triggers when that module OR shared/schema changes

### 9-10. Frontend Lanes
- **Web Shell** (`apps/web`)
- **Admin Shell** (`apps/admin`)

Each lane:
- Typechecks frontend app
- Lints and tests
- Builds production bundle
- Triggers when that app OR shared changes

## Workflow Files

- **`.github/workflows/parallel-lanes.yml`**: Main parallel validation workflow (based on existing ci.yml)
- **`.github/workflows/_shared-node-setup.yml`**: Reusable Node.js setup
- **`.github/workflows/_quality-checks.yml`**: Reusable quality validation
- **`.github/workflows/_build-service-image.yml`**: Reusable container builds

## Change Detection

Uses existing `dorny/paths-filter` action to detect which subsystems changed, then runs only affected lanes in parallel.

## Merge Requirements

All lanes that run must pass. Framework in place for future per-lane Docker image builds and artifact promotion integration (#37).

## Related Issues

- #36: Parallel validation lanes per subsystem (this implementation)
- #37: Immutable artifact promotion (next step)
- #38: Smoke deploy checks (validation gates)
