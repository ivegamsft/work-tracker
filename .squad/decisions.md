# Squad Decisions

## Active Decisions

### PRD Structure for E-CLAT (2026-03-13)

**Decision:** Document E-CLAT planning as a **PRD set** under `squad/prds/` instead of a single monolithic PRD.

**Structure:**
- `squad/prds/README.md`
- `squad/prds/platform-foundation-prd.md`
- `squad/prds/workforce-operations-prd.md`
- `squad/prds/compliance-evidence-prd.md`
- `squad/prds/governance-taxonomy-prd.md`
- `squad/prds/frontend-admin-prd.md`

**Rationale:**
- The codebase is already split into nine backend modules plus two app scaffolds.
- Cross-cutting platform concerns (RBAC, audit logging, validation, infra, background jobs) need one authoritative document.
- Domain teams need narrower, executable documents they can implement against without paging through unrelated modules.
- Frontend/admin requirements need their own product framing because those apps are still scaffolds.

**Expected Use:**
- Freamon owns sequencing and architectural alignment from the platform PRD.
- Kima can execute backend work from the three domain PRDs.
- Bunk can execute UI work from the frontend/admin PRD.
- Sydnor can derive test plans and quality gates from the acceptance criteria across the set.

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
