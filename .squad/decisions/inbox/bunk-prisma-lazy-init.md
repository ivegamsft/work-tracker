# Decision: Lazy Prisma Client Initialization

**Author:** Bunk  
**Date:** 2026-07-18  
**Issue:** #220  
**Branch:** squad/220-prisma-lazy-init  

## Context

Integration test suites (documents, employees, medical, notifications, qualifications, standards) failed because `apps/api/src/config/database.ts` instantiated PrismaClient at module evaluation time. When test files imported `createApp`, the import chain triggered PrismaClient creation before the test setup file (`apps/api/tests/setup.ts`) could set environment variables like `DATABASE_URL` and `JWT_SECRET`.

Similarly, `apps/api/src/config/env.ts` eagerly parsed and validated env vars at import time (line 42), which could call `process.exit(1)` before test env vars were set.

## Decision

1. **database.ts** — Replace eager `export const prisma = createPrismaClient()` with a `Proxy`-based lazy singleton. The Proxy defers PrismaClient instantiation to first property access. Export name `prisma` is preserved, so zero consumer changes are required.

2. **env.ts** — Remove eager `parseEnv()` call at module scope. The `env` Proxy now lazily validates on first property access. `loadEnv()` handles both keyvault and non-keyvault paths.

## Rationale

- **Proxy pattern** was chosen over function-based access (`getPrismaClient()`) to avoid touching 22+ consumer files. The Proxy transparently forwards all property access and method calls.
- **Lazy env validation** ensures test setup files can set env vars before validation runs, without changing the API for production code (which calls `loadEnv()` at startup).
- Both changes are backward-compatible — no consumer modifications needed.

## Impact

- All 6 affected integration test suites now load without initialization errors
- Production startup path unchanged (PrismaClient created on first use, env validated on first access or `loadEnv()`)
- Added `_resetPrismaClient()` utility for future test isolation needs
