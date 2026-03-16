# Decision: Integration Test Strategy for Real Router Coverage

**Author:** Sydnor (Tester)
**Date:** 2026-03-16
**Status:** Proposed
**PR:** #62

## Context

Existing tests used two patterns: test-harness (in-memory Maps with custom routes) and service-spy (`vi.spyOn` on real service exports). The test-harness misses real Zod validators, middleware wiring, and error handling.

## Decision

Adopt the service-spy pattern as the standard for integration tests. Each module gets a `{module}-integration.test.ts` file that tests through the real Express router with mocked service methods.

### Why
- Tests real Zod validation
- Tests real RBAC middleware wiring
- Tests real error handler
- Complements test-harness pattern for complex workflow logic

### Coverage priority
1. RBAC boundaries (every role tier for every endpoint)
2. Zod validation edge cases (empty, invalid, boundary values)
3. Error handling (404, 400, 403, 409)
4. Happy path through real middleware
