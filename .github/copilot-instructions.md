# Copilot Instructions — E-CLAT

E-CLAT (Employee Compliance and Lifecycle Activity Tracker) is a workforce readiness and qualification management platform for regulated industries. It's an npm workspaces monorepo targeting Azure.

## Build, Test, Lint

```bash
# All commands from repo root
npm install                                  # Install all workspaces
npm run dev                                  # API dev server (hot-reload)
npm run build                                # Build API
npm run typecheck                            # Typecheck shared + API
npm run lint                                 # Lint API
npm run lint -- --fix                        # Auto-fix lint issues

# Tests
npm test                                     # Full test suite
npm test -- --testPathPattern=hours          # Single test file by pattern
npm test -- --watch                          # Watch mode

# Database
npm run db:migrate:dev -w @e-clat/data       # Run migrations
```

Typecheck order matters: `@e-clat/shared` must typecheck before `@e-clat/api`. The root `typecheck` script handles this.

## Architecture

### Workspaces

| Package | Path | Purpose |
|---------|------|---------|
| `@e-clat/api` | `apps/api/` | Express REST API — 9 domain modules, 64 endpoints |
| `@e-clat/shared` | `packages/shared/` | Domain types, error classes, role constants |
| `@e-clat/data` | `data/` | Prisma schema, migrations, seeds |
| `@e-clat/web` | `apps/web/` | Frontend (scaffold) |
| `@e-clat/admin` | `apps/admin/` | Admin app (scaffold) |

### API Module Structure

Each module in `apps/api/src/modules/{module}/` follows this layout:

```
modules/{module}/
├── router.ts       # Express route definitions with inline handlers
├── service.ts      # Business logic (stateless, called by handlers)
└── validators.ts   # Zod schemas + inferred TypeScript types
```

The 9 modules are: `auth`, `employees`, `hours`, `documents`, `qualifications`, `medical`, `standards`, `notifications`, `labels`.

### Request Flow

```
Request → authenticate middleware → requireRole/requireMinRole → route handler
  → zodSchema.parse(req.body/query)  → service method → response
  → on error: next(err) → errorHandler middleware
```

Route handlers are defined inline (no controller classes). Every handler follows this pattern:

```typescript
router.post("/path", authenticate, requireMinRole(Roles.SUPERVISOR), async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = someSchema.parse(req.body);
    const result = await someService.doThing(input);
    res.status(201).json(result);
  } catch (err) { next(err); }
});
```

### RBAC

Five roles with a numeric hierarchy — higher number = more access:

```
EMPLOYEE(0) < SUPERVISOR(1) < MANAGER(2) < COMPLIANCE_OFFICER(3) < ADMIN(4)
```

- `requireRole(Roles.ADMIN)` — exact match
- `requireMinRole(Roles.SUPERVISOR)` — that role or higher

Roles, hierarchy, and types are defined in `@e-clat/shared` and imported everywhere.

### Error Handling

All errors extend `AppError` from `@e-clat/shared`:

- `NotFoundError(resource, id?)` → 404
- `UnauthorizedError(message?)` → 401
- `ForbiddenError(message?)` → 403
- `ValidationError(message, details?)` → 400
- `ConflictError(message)` → 409

The centralized `errorHandler` middleware catches these and returns `{ error: { code, message, details? } }`. Zod parse errors flow through the same path via `next(err)`.

### Validation Conventions

Zod schemas live in each module's `validators.ts`. Key patterns:
- Use `z.coerce.date()` and `z.coerce.number()` for query params
- Export inferred types: `export type ManualEntryInput = z.infer<typeof manualEntrySchema>`
- Pagination defaults: `page` defaults to 1, `limit` defaults to 50 (max 100)
- UUIDs validated with `z.string().uuid()`

### Database

PostgreSQL via Prisma. Schema at `data/prisma/schema.prisma`. Key patterns:
- All IDs are UUIDs (`@id @default(uuid())`)
- Soft deletes via `isDeleted` boolean (not Prisma middleware)
- Composite indexes on common query patterns (e.g., `@@index([employeeId, date])`)
- Status fields use Prisma enums matching domain state machines

### Environment Config

Env vars are validated with Zod at startup (`apps/api/src/config/env.ts`). Required vars are documented in `apps/api/.env.example`. The app exits immediately if validation fails.

### Infrastructure

Azure-targeted. Terraform modules in `infra/` for compute, database, and storage. Bootstrap scripts in `bootstrap/` handle one-time Azure setup (Terraform state storage, Entra service principals, GitHub OIDC).

## Conventions

- Prefix unused parameters with underscore: `_req`, `_res`, `_next`
- Use `param(req, "id")` helper from `common/utils` for safe route param extraction
- Logging via `winston` logger from `common/utils`
- Test files go in `apps/api/tests/` (not alongside source), split into `unit/` and `integration/`
- Jest uses path aliases matching tsconfig: `@config/`, `@modules/`, `@middleware/`, `@common/`
- Every write path must produce an audit trail (compliance requirement)
- Status transitions must be explicit and validated

## CI Pipeline

GitHub Actions on push/PR to `main`: Typecheck → Test → Build (sequential). All scoped to `@e-clat/shared` and `@e-clat/api` workspaces.

## Squad AI Team

This repo uses Squad (`.squad/`) for AI-assisted development. When working on issues:

1. Check `.squad/team.md` for team roles and routing rules
2. Check `.squad/routing.md` for which agent handles what domain
3. Check `.squad/decisions.md` for active architectural decisions
4. Agent charters in `.squad/agents/{name}/charter.md` define expertise and voice per agent
5. Branch naming: `squad/{issue-number}-{kebab-case-slug}`

## Documentation

- Architecture decisions: `docs/adrs/`
- Product requirements: `docs/prds/` (split by domain — platform foundation, workforce ops, compliance evidence, governance taxonomy, frontend/admin)
