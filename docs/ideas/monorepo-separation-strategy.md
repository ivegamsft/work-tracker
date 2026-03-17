# Monorepo Separation Strategy — E-CLAT

> **Status:** Proposed  
> **Author:** Izzy  
> **Created:** 2026-03-17

## Problem

E-CLAT is currently a flat npm-workspaces monorepo. As we move toward microservices and multi-tenant deployment, each subsystem will need its own deployment dependencies, CI pipeline, and release cadence. The current layout mixes concerns:

- `node_modules/` at root is shared — but each subsystem will have its own deployment dependencies
- `infra/` (Terraform) lives alongside application code — but deploys independently
- `tests/` at root mixes unit, integration, e2e, and smoke — different subsystems own different test scopes
- Docker artifacts (`docker-compose.yml`, `.dockerignore`) are collocated with source — but belong with deployment config
- `apps/`, `packages/`, `data/` are the application layer — they ship together today but may not tomorrow

## Vision

Evolve from a flat monorepo to a **subsystem-oriented monorepo** where each top-level directory is a self-contained deployment unit. Later, these can split into separate repos if needed.

### Proposed Subsystem Layout

```
e-clat/
├── subsystems/
│   ├── api/                    # Express REST API
│   │   ├── src/
│   │   ├── tests/
│   │   ├── package.json        # Own dependencies
│   │   ├── Dockerfile
│   │   └── tsconfig.json
│   ├── web/                    # Frontend SPA
│   │   ├── src/
│   │   ├── tests/
│   │   ├── package.json
│   │   ├── Dockerfile
│   │   └── vite.config.ts
│   ├── admin/                  # Admin app
│   │   └── ...
│   └── shared/                 # Shared types, errors, constants
│       ├── src/
│       ├── tests/
│       └── package.json
├── infra/                      # Terraform layers (deploys independently)
│   ├── layers/
│   ├── modules/
│   └── environments/
├── deploy/                     # Docker, Helm, CI/CD configs
│   ├── docker-compose.yml
│   ├── docker-compose.dev.yml
│   ├── Dockerfiles/
│   └── .dockerignore
├── data/                       # Prisma schema, migrations, seeds
│   ├── prisma/
│   └── package.json
├── tests/                      # Cross-subsystem tests only
│   ├── e2e/
│   ├── smoke/
│   └── integration/
├── docs/                       # Documentation pipeline
├── .squad/                     # Squad AI team state
├── package.json                # Minimal root (scripts only, no deps)
└── README.md
```

### Key Principles

1. **Each subsystem owns its `node_modules/`** — no shared root dependencies except dev tooling (linters, formatters)
2. **Root `package.json` is a script runner**, not a dependency manifest — uses npm workspaces for orchestration only
3. **Infra deploys independently** — Terraform has no Node.js dependency
4. **Docker configs live in `deploy/`** — not scattered across root
5. **Cross-subsystem tests are separate** — e2e/smoke tests that span services live in root `tests/`, unit tests live in each subsystem
6. **Each subsystem is extractable** — can become its own repo with minimal effort

## Migration Path

### Phase A — Restructure (non-breaking)
- Move Docker files → `deploy/`
- Move cross-subsystem tests → `tests/`
- Keep npm workspaces but tighten `package.json` boundaries
- Each workspace gets explicit dependencies (no hoisting reliance)

### Phase B — Isolate Dependencies
- Each subsystem gets its own `node_modules/` via `--install-strategy=nested` or independent installs
- Root `package.json` drops runtime dependencies
- CI builds each subsystem independently

### Phase C — Separate Repos (optional, future)
- Extract subsystems into individual repos
- Use git submodules, package registry, or artifact references
- Shared types published as `@e-clat/shared` package to npm/GitHub Packages

## Considerations

- **Breaking change scope:** Moving files breaks imports and CI. Do it once, do it right.
- **CI/CD impact:** Each subsystem needs its own build/test/deploy pipeline step
- **Local dev:** `docker-compose` needs to reference correct paths for volume mounts
- **Prisma location:** `data/` stays central — all subsystems reference the same schema (for now)
- **Shared package:** Must be publishable (build artifact, not source import) for repo separation

## Dependencies

- Decision: Lock down subsystem boundaries before restructuring
- Decision: Choose npm workspaces vs pnpm workspaces vs turborepo for monorepo tooling
- Spec: `docs/specs/service-extraction-plan.md` — related microservices extraction spec
- Spec: `docs/specs/multi-tenant-architecture.md` — tenant isolation affects deployment topology

## Open Questions

1. Do we keep npm workspaces or switch to pnpm/turborepo for better isolation?
2. When do we split repos — at what team size or deployment complexity?
3. How do we handle schema migrations when `data/` is shared across subsystems?
4. Should `@e-clat/shared` be a published package or a linked workspace?
