# Pearlman — History

## Project Context

- **Project:** E-CLAT — Employee Compliance and Lifecycle Activity Tracker
- **Owner:** Israel (Izzy)
- **Stack:** Node.js, TypeScript, Express, Zod, PostgreSQL, Prisma, JWT/bcrypt RBAC
- **Structure:** Monorepo — apps/api, apps/web, apps/admin, packages/shared, data (Prisma)
- **Domain:** Workforce readiness and qualification management for regulated industries

## Key Domain Concepts

- **Proof Taxonomy:** Two-axis model — Type (what) × Attestation Level (how)
  - 6 Proof Types: hours, certification, training, clearance, assessment, compliance
  - 4 Attestation Levels: self_attest (L1), upload (L2), third_party (L3), validated (L4)
  - Compound attestation: multiple levels required simultaneously
- **Template Lifecycle:** draft → published → archived (published = immutable, must clone to edit)
- **Fulfillment:** Assignment creates ProofFulfillment records per requirement per employee
- **RBAC Levels:** EMPLOYEE < SUPERVISOR < MANAGER < ADMIN (permissions escalate)

## Learnings

- Proof domain review set lives in `docs/specs/templates-attestation-spec.md`, `docs/specs/proof-taxonomy.md`, `docs/specs/proof-vault-spec.md`, `docs/specs/sharing-spec.md`, `docs/specs/rbac-api-spec.md`, and `docs/specs/app-spec.md`.
- The six top-level proof types are sufficient; the bigger compliance risks are ungoverned subtypes/categories, missing recertification workflows, and weak attestation-policy constraints.
- `apps/api/src/modules/templates/service.ts` is materially ahead of older status docs: it already handles publish/clone/assign/compound-status flows, so spec and tracking docs can drift behind implementation.
- `packages/shared/src/types/domain.ts` still lacks proof-template domain types, making Prisma/service code the de facto source of truth for proofs today.
- In regulated workflows, expiration must preserve prior proof evidence and open next-cycle work; clearing expired fulfillment evidence is not acceptable.
- Proof Vault sharing must stay compatible with zero-knowledge guarantees; external access should use explicit evidence packages rather than raw vault decryption links.
- Israel (Izzy) asked for missing concepts to be captured as `docs/ideas/*` and `docs/req/*` artifacts and for findings to be written in human compliance terms.

---

## 📌 Team Update (2026-03-16T07:06:00Z) — Phase 3 Backend Foundation Ready

**Proof Templates Schema & API Live (Agent-83, Bunk):**
- Prisma models: ProofTemplate, ProofRequirement, TemplateAssignment, ProofFulfillment with full CRUD routers
- 25 endpoints across `/api/templates`, `/api/assignments`, `/api/fulfillments` + `/api/employees/:id/assignments`
- Enums: TemplateStatus, AttestationLevel, FulfillmentStatus, ProofType (uppercase in schema, lowercase in DTOs)
- Employee relations: assignedTemplateAssignments, validatedFulfillments
- Fulfillment status rules: validated-only requirements set to pending_review on assignment; approval blocks until all other required levels satisfied
- **Impact on Pearlman:** Template routers ready for audit hooks; Proof Vault sharing spec can now call stable assignment + fulfillment endpoints

**Hours Service & Documents Listing Live (Agent-84, Bunk):**
- HoursService: 12 Prisma methods (getAll, getById, create, update, delete, getByEmployee, getRange, getTotalByEmployee, getByDateRange, getEmployeePeriodSummary, recordClockIn, recordClockOut)
- Documents: listByEmployee service + `GET /api/documents/employee/:employeeId` endpoint
- Clock design: createdAt = event timestamp; date = calendar day (no separate clock fields)
- RBAC: employees read own documents; supervisors+ read all
- **Impact on Pearlman:** Audit trail lookups can consume both HourRecord names and /api/hours entity type; document listing RBAC matches proof access patterns

**Integration Tests 242/242 Green (Agent-85, Sydnor):**
- Phase 3: 63 new tests (templates: 40, hours: 20, documents: +3)
- Two-path contract testing: test-only routes for unmounted modules; service spies for mounted incomplete routers
- RBAC assertions strict; route precedence preserved
- **Impact on Pearlman:** API contracts locked; Proof Vault audit requirements can build on stable base

**Next for Compliance:** Proof Vault encryption (AES-256-GCM + PBKDF2) + Sharing specification (42 endpoints, 6 screens, 8 RBAC permissions) ready for Phase 3 Batch 2
