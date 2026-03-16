# Parallel Validation Lanes Architecture

**Date:** 2026-03-16  
**Author:** Daniels (Microservices Engineer)  
**Related Issues:** #36, #37, #38  
**Status:** Implemented

## Decision

Implemented parallel validation lanes in CI pipeline, splitting monolithic builds into 8 subsystem-specific lanes that run concurrently based on change detection.

## Context

The existing CI workflow (`ci.yml`) ran all validation (typecheck, tests, builds) serially for the entire monorepo, taking 5-7 minutes even for single-module changes. With 8+ logical subsystems forming in the codebase, we needed faster feedback for targeted changes.

## Implementation

### Parallel Lanes Structure

Created `.github/workflows/parallel-lanes.yml` with:

1. **Change Detection Job**: Uses `dorny/paths-filter` to detect which subsystems changed
2. **Shared Quality Lane**: Runs first, validates `packages/shared` and Prisma schema
3. **8 Parallel Subsystem Lanes**: Run concurrently after shared quality passes
   - Identity Platform (`auth`)
   - Workforce Core (`employees`)
   - Compliance Service (`qualifications`, `medical`, `templates`)
   - Records Service (`documents`, `hours`)
   - Reference Data (`standards`, `labels`)
   - Notifications Service (`notifications`)
   - Web Shell (`apps/web`)
   - Admin Shell (`apps/admin`)
4. **Summary Gate**: Ensures all active lanes pass before merge

### Reusable Workflows

Created composable building blocks:
- `_shared-node-setup.yml`: Node.js setup with caching
- `_quality-checks.yml`: Parameterized typecheck/lint/test/build
- `_build-service-image.yml`: Docker image builds with artifact output

### Cascade Logic

- **Shared/schema changes** → All subsystem lanes run (shared contract change affects everyone)
- **Module-specific changes** → Only that lane runs (plus shared quality)
- **Multi-module changes** → Affected lanes run in parallel

## Benefits

- **Faster feedback**: Module-only changes validate in ~3 min vs. 5-7 min full build
- **Parallel execution**: Multiple subsystems validate simultaneously
- **Clear ownership**: Each lane maps to a logical service boundary
- **Incremental validation**: Only changed subsystems are validated
- **Future-ready**: Prepares for per-service containerization and deployment

## Trade-offs

- **Workflow complexity**: More jobs to maintain vs. single monolithic workflow
- **Partial CI runs**: Not all code is validated on every push (by design)
- **Dependency management**: Shared changes still trigger full validation

## Next Steps

1. Add module-specific test filtering (currently runs full test suite per lane)
2. Integrate with artifact promotion pipeline (#37)
3. Add per-lane Docker image builds for deployable services
4. Implement smoke check integration (#38)

## Related Files

- `.github/workflows/parallel-lanes.yml`
- `.github/workflows/_shared-node-setup.yml`
- `.github/workflows/_quality-checks.yml`
- `.github/workflows/_build-service-image.yml`
- `docs/pipeline-lane-ownership.md`
- `infra/layers/30-promotion/` (promotion infrastructure stub)
