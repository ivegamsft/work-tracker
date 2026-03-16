# Copilot Instructions — E-CLAT

E-CLAT (Employee Compliance and Lifecycle Activity Tracker) is a workforce readiness and qualification management platform for regulated industries. It's an npm workspaces monorepo targeting Azure.

This file is the primary memory file for the GitHub Copilot coding agent (`@copilot`) in this repository.

## Build, Test, Lint

```bash
# All commands from repo root
npm install                                  # Install all workspaces
npm run dev                                  # API dev server (hot-reload)
npm run build                                # Build shared, API, and web
npm run typecheck                            # Typecheck shared + API + web
npm run lint                                 # Lint API
npm run lint -- --fix                        # Auto-fix lint issues

# Tests
npm test                                     # Root suite (current documented target: 242 tests)
npm run test -w @e-clat/web                 # Web-only tests
npm test -- --watch                          # Watch mode

# Database
npm run db:migrate:dev -w @e-clat/data       # Run migrations
```

Typecheck order matters: `@e-clat/shared` must typecheck before `@e-clat/api`. The root `typecheck` script handles this.

## Architecture

### Workspaces

| Package | Path | Purpose |
|---------|------|---------|
| `@e-clat/api` | `apps/api/` | Express REST API — 10 domain modules including templates |
| `@e-clat/shared` | `packages/shared/` | Domain types, error classes, role constants |
| `@e-clat/data` | `data/` | Prisma schema, migrations, seeds |
| `@e-clat/web` | `apps/web/` | Frontend SPA |
| `@e-clat/admin` | `apps/admin/` | Admin app scaffold |

### API Module Structure

Each module in `apps/api/src/modules/{module}/` follows this layout:

```
modules/{module}/
├── router.ts       # Express route definitions with inline handlers
├── service.ts      # Business logic (stateless, called by handlers)
├── validators.ts   # Zod schemas + inferred TypeScript types
└── index.ts        # Optional barrel for multi-router modules
```

The 10 modules are: `auth`, `employees`, `hours`, `documents`, `qualifications`, `medical`, `standards`, `notifications`, `labels`, `templates`.

### Templates Module

`apps/api/src/modules/templates/` is now a first-class module with:
- `router.ts`
- `service.ts`
- `validators.ts`
- `index.ts`
- 25 endpoints across `/api/templates`, `/api/assignments`, and `/api/fulfillments`

### Request Flow

```
Request → authenticate middleware → requireRole/requireMinRole → route handler
  → zodSchema.parse(req.body/query) → service method → Prisma/data access → response
  → on error: next(err) → errorHandler middleware
```

Route handlers are defined inline (no controller classes).

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

The centralized `errorHandler` middleware returns `{ error: { code, message, details? } }`.

### Validation Conventions

Zod schemas live in each module's `validators.ts`. Key patterns:
- Use `z.coerce.date()` and `z.coerce.number()` for query params
- Export inferred types from validators
- Pagination defaults: `page` defaults to 1, `limit` defaults to 50 (max 100)
- UUIDs validated with `z.string().uuid()`
- Status transitions must be explicit and validated

### Database

PostgreSQL via Prisma. Schema at `data/prisma/schema.prisma`.

#### Prisma Model Map

The schema now contains 24+ models, including:

- **Core:** `Employee`, `ComplianceStandard`, `StandardRequirement`, `Qualification`, `MedicalClearance`
- **Records:** `Document`, `DocumentProcessing`, `ExtractionResult`, `ReviewQueueItem`, `HourRecord`, `HourConflict`, `HourConflictRecord`
- **Templates:** `ProofTemplate`, `ProofRequirement`, `TemplateAssignment`, `ProofFulfillment`
- **System:** `AuditLog`, `Notification`, `NotificationPreference`, `EscalationRule`, `Label`, `LabelMapping`, `TaxonomyVersion`

Modeling conventions:
- All IDs are UUIDs (`@id @default(uuid())`)
- Soft deletes use explicit booleans/metadata, not hidden middleware magic
- Composite indexes are added for common compliance queries
- Status fields map to explicit Prisma enums that back domain state machines

### Compliance Context

This system supports regulated-industry workflows. Treat these as hard constraints:
- Every write path must produce an audit trail
- Never expose connection strings directly; use Key Vault-backed secret resolution only
- RBAC only: managed identity preferred, no access keys
- Use Private Link for non-public endpoints
- Never check in secrets
- Status transitions must be explicit and validated

Proof model vocabulary:
- **Proof types:** `hours`, `certification`, `training`, `clearance`, `assessment`, `compliance`
- **Attestation levels:** `self_attest` (L1), `upload` (L2), `third_party` (L3), `validated` (L4)

### Environment Config

Env vars are validated with Zod at startup (`apps/api/src/config/env.ts`). Required vars are documented in `apps/api/.env.example`. The app exits immediately if validation fails.

### Infrastructure Context

- Terraform layers progress `00-foundation` → `10-data` → `20-compute`
- Azure Container Apps is the compute target
- GitHub Actions handles CI/CD
- Local development is organized around Docker Compose with API, Postgres, and Redis in the loop
- Infra modules live under `infra/`; bootstrap scripts handle one-time Azure setup and identity wiring

## Docs-to-Code Pipeline

Use the canonical docs pipeline when planning or implementing work:

| Path | Purpose |
|------|---------|
| `docs/ideas/` | Raw ideas and proposals |
| `docs/req/` | Requirements documents |
| `docs/specs/` | Technical specifications |
| `docs/tests/` | Test plans |
| `docs/plans/` | Implementation plans and execution steps |
| `docs/guides/` | User guides and runbooks |

## Conventions

- Prefix unused parameters with underscore: `_req`, `_res`, `_next`
- Use `param(req, "id")` helper from `common/utils` for safe route param extraction
- Logging via `winston` logger from `common/utils`
- Test files go in `apps/api/tests/` (not alongside source), split into `unit/` and `integration/` where practical
- Jest/Vitest path aliases should match tsconfig aliases
- Squad working branches use `squad/{issue-number}-{slug}`
- Preferred Copilot working branches use `copilot/{issue-number}-{slug}`; GitHub currently only guarantees `copilot/*`, so preserve issue number + slug when the branch can be named or renamed

## CI Pipeline

GitHub Actions CI/CD runs on push and PR to `main`. The CI workflow is organized as:
1. `Typecheck`
2. `API Tests`
3. `Web Tests`
4. `Build`
5. `Docker Build`

These are the expected status checks for protected branch workflows.

## Squad AI Team

This repo uses Squad (`.squad/`) for AI-assisted development. The current team is:
- Freamon — Lead
- Bunk — Backend
- Kima — Frontend
- Sydnor — Tester
- Pearlman — Compliance Specialist
- Daniels — Microservices Engineer
- Scribe — Session Logger
- Ralph — Work Monitor

When working on issues:
1. Check `.squad/team.md` for team roles and routing rules
2. Check `.squad/routing.md` for which agent handles what domain
3. Check `.squad/decisions.md` for active architectural decisions
4. Agent charters in `.squad/agents/{name}/charter.md` define expertise and voice per agent
5. Issues labeled `squad:copilot` are candidates for `@copilot`

## Key File Paths

- `.github/copilot-instructions.md` — primary Copilot memory file
- `.github/agents/squad.agent.md` — Squad coordinator governance
- `apps/api/src/modules/templates/` — templates module routers, service, validators, barrel
- `data/prisma/schema.prisma` — Prisma model source of truth
- `infra/layers/` — layered Terraform stack
