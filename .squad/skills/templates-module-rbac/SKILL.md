# Templates module RBAC pattern

## When to use
- Building a backend module that spans multiple route prefixes (e.g., `/api/templates`, `/api/assignments`, `/api/fulfillments`) but shares a single service layer.
- Enforcing mixed RBAC rules where some endpoints are role-gated while others require ownership checks.

## Steps
1. Export dedicated routers per base path and mount them independently in `apps/api/src/index.ts`.
2. Pass an `{ id, role }` actor object into the service and enforce ownership checks there (e.g., employees can only read their own assignments/fulfillments).
3. Centralize status computation helpers (e.g., `computeFulfillmentStatus`) so each endpoint update recalculates fulfillment state consistently.
4. Use Prisma relation names to disambiguate Employee ↔ Assignment/ Fulfillment dual relations, then add the matching relation arrays on `Employee`.

## Reference
- `apps/api/src/modules/templates/{router,service}.ts`
