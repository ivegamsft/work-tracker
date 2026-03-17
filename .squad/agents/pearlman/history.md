# Pearlman — History

## Project Context

- **Project:** E-CLAT — Employee Compliance and Lifecycle Activity Tracker
- **Owner:** Israel (Izzy)
- **Stack:** Node.js, TypeScript, Express, Zod, PostgreSQL, Prisma, JWT/bcrypt RBAC
- **Structure:** Monorepo — apps/api, apps/web, apps/admin, packages/shared, data (Prisma)
- **Domain:** Workforce readiness and qualification management for regulated industries

## Core Context

### Compliance Architecture & Proof Taxonomy
- **Proof model (two-axis):** Type (hours, certification, training, clearance, assessment, compliance) × Attestation Level (L1 self_attest, L2 upload, L3 third_party, L4 validated)
- **Compound attestation:** Multiple levels required simultaneously; L3 satisfies L2, L4 satisfies all lower
- **Template lifecycle:** draft → published → archived; published = immutable (clone to edit)
- **Fulfillment workflow:** Template assignment creates ProofFulfillment records per requirement per employee; validates against attestation floors
- **Override framework:** 4 types (extension, proof_override, waiver, grace_period); dual-approval for regulatory; supervisor confined to reporting chain
- **RBAC:** EMPLOYEE < SUPERVISOR < MANAGER < COMPLIANCE_OFFICER < ADMIN; separation of duties enforced (cannot self-approve regulatory actions)

### Regulatory Alignment & Design Principles
- **Standards customization:** 4-layer hierarchy (Regulatory locked → Org → Dept → Individual exempt); regulatory requirements immutable in code
- **Audit trail:** Immutable, append-only, hash-chained (SHA256); 7-year retention default, 10-year for medical/HIPAA; quarterly integrity checks + cold storage archival
- **GDPR compliance:** Article 5 (integrity), 15 (SAR export), 17 (right to erasure via redaction), 20 (data portability JSON/CSV/PDF)
- **Design guidance:** PII isolation (semi-anonymous profiles), SCIM deprovisioning audit, issuer trust tiers (T1 authoritative → T4 manual), evidence packages (not raw vault links)

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

## 📌 Wave 3: Compliance/Regulatory Decomposition (2026-03-17T04:30:00Z)

**Mission:** Decompose 5 compliance/regulatory specifications into 12 implementation GitHub issues.

**Specs decomposed:**
1. proof-taxonomy.md — 2-axis model validation (6 types × 4 levels), compound attestation rules, GDPR alignment
2. templates-attestation-spec.md — Compound attestation rules, regulatory dual-approval flows, override framework
3. proof-vault-spec.md — 7-year audit retention, hash-chaining, SCIM deprovisioning, GDPR SAR export
4. sharing-spec.md — Issuer trust tiers (T1 authoritative → T4 manual), evidence package governance, external access audit
5. rbac-api-spec.md — Separation of duties enforcement, dual-approval for regulatory actions, non-self-approval constraints

**Issues created:** 12 (Audit trail hash-chaining, regulatory form validation, issuer trust tier enforcement, override approval workflows, GDPR SAR export, data retention policies (7-year default, 10-year medical/HIPAA), compliance reporting dashboards, escalation rules, non-blocking audit logging, sensitive field redaction, proof evidence preservation, recertification workflows)

**Result:** All issues linked to GitHub Project #2; regulatory constraints mapped to enforcement points.

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

## 📌 Team Update (2026-03-16T073200Z — Freamon's Backlog Decomposition)

Freamon decomposed the full E-CLAT backlog into **51 GitHub issues** across 5 epics and 4 releases.

This affects all squad work planning:
- **Bunk:** 16 backend issues assigned (architecture, bugs, stabilization)
- **Kima:** 13 frontend issues assigned (template UI screens W-30 to W-38, navigation)
- **Sydnor:** 1 testing issue assigned
- **Pearlman:** 7 compliance issues assigned (attestation, proof audit findings)
- **Daniels:** 12 architecture/DevOps issues assigned (contracts, feature flags, pipeline)
- **Freamon:** 3 spike/research issues (dependency critical path)

Key metrics:
- Priority split: P0 14, P1 25, P2 13
- Release targets: v0.4.0 (16), v0.5.0 (19), v0.6.0 (10), backlog (5)
- Go/No-Go: go:yes 29, go:needs-research 22

All 18 source documents (specs, requirements, ideas, known bugs) have corresponding issues with cross-references and traceability links. Squad leads should review assigned issues and refine acceptance criteria.

Decision file: \.squad/decisions/inbox/freamon-backlog-decomposition.md\`n

## 📌 Team Update (2026-03-16T073200Z — Daniels' Copilot Instructions & Docs Update)

Daniels updated core team memory files for better agent and copilot coordination:

**Files Updated:**
- \.github/copilot-instructions.md\ — Added templates module context (242 tests, docs pipeline, compliance guardrails, 8-member squad roster, service architecture, parallel deployment strategy)
- \docs/README.md\ — Reorganized docs taxonomy into category-based structure (specs/, requirements/, decisions/, guides/, plans/, ideas/, tests/, prompts/)
- \.github/agents/squad.agent.md\ — Refined agent charters and responsibilities

This affects all squad planning and copilot context:
- All agents now have clearer service architecture context (6 logical backend service groups)
- Copilot instructions include templates module spec (policy constraints, attestation 4-level system)
- Docs are now organized for better cross-referencing and discovery
- Branch naming standard documented: \copilot/{issue-number}-{slug}\ (cannot enforce server-side on private repo due to GitHub plan limit)

Decision files: \.squad/decisions/inbox/daniels-service-architecture.md\, \.squad/decisions/inbox/daniels-branch-rulesets.md\`n

## 📌 Design Spike (2026-03-20) — Issuer Verification Framework & Evidence Package Sharing

Completed design spikes for two P1 compliance issues:

**Issue #32 — Issuer Verification Framework (L3 Attestation):**
- Designed issuer registry with 6 categories and 4 trust tiers (authoritative T1 → manual T4)
- Trust tiers multiply against base L3 weight (0.85) for differentiated readiness scoring
- Verification request lifecycle with retry, escalation, and manual resolution paths
- Canonical verification response normalizes all issuer outputs; subject match confidence scoring
- Key guardrail: clearance/license proof types require minimum T2 trust tier
- Prisma models: `IssuerRegistry`, `VerificationRequest` with 6 new enums

**Issue #33 — Evidence Package Sharing Model:**
- Evidence packages replace raw vault share links for external disclosure
- Package lifecycle: DRAFT → PENDING_APPROVAL → APPROVED → SHARED → EXPIRED
- Approval gates by content sensitivity; separation of duties enforced
- Sealing: fulfillment snapshots, document re-encryption, SHA-256 manifest checksums
- External access via time-limited tokens; only CO+ can generate links
- Redaction support at field level with audit documentation
- Prisma models: `EvidencePackage`, `PackageItem`, `PackageAccessLink`, `PackageAccessLog`

**Key Learnings:**
- Sharing-spec §2.4 has architectural tension between raw vault links and zero-knowledge guarantees — evidence packages resolve this
- Issuer trust tiers interact with attestation floors per proof type
- Both designs require careful notification system integration

Decision file: `.squad/decisions/inbox/pearlman-compliance-spikes.md`
Spec files: `docs/specs/issuer-verification-framework.md`, `docs/specs/evidence-package-sharing.md`

## 📌 Team Update (2026-03-21T10:30:00Z) — Five Compliance Specifications Complete

Pearlman completed **5 comprehensive compliance spec documents** addressing audit trail governance, identity compliance, template lifecycle, standards customization, and nudge system controls.

**Completed Specs:**

1. **docs/specs/compliance-audit-events.md** (Issue #92)
   - Audit event taxonomy (12 categories, 50+ event types)
   - Before/after snapshots + hash-chain integrity (blockchain-style)
   - Retention policies (7 years default, 10 years for medical/regulatory)
   - GDPR data subject access requests (SAR) workflow
   - Quarterly integrity checks + cold storage archival
   - 450+ lines; covers tamper-evidence, RBAC, risk assessment

2. **docs/specs/identity-compliance.md** (Issue #96)
   - Multi-IdP compliance review (Entra ID primary, GitHub secondary)
   - Group membership audit trail via SCIM 2.0 sync
   - Quarterly access certification workflow (SOX § 404)
   - GDPR data portability export (Article 20)
   - PII breach notification process (72-hour GDPR, 60-day HIPAA)
   - Semi-anonymous profile security review (PII isolation validation)
   - SCIM deprovisioning audit + verification checklist
   - 500+ lines; locked decisions 2 and 12

3. **docs/specs/template-governance.md** (Issue #100)
   - Template state machine (DRAFT → PUBLISHED → DEPRECATED → RETIRED)
   - 4-eyes change control (manager submit, CO approve)
   - Regulatory catalog alignment (quarterly scan for OSHA/FAA/JCO updates)
   - Version control & immutability (published templates read-only)
   - Template retirement & migration workflow (90-day grace period)
   - Diff viewer (v1 ↔ v2 regulatory comparison)
   - 450+ lines; locked decisions 5 and 7

4. **docs/specs/standards-customization.md** (Issue #103)
   - Four-layer hierarchy (Regulatory → Org → Dept → Individual)
   - Lock regulatory / flex custom (regulatory immutable, custom flexible)
   - Authority matrix (who can approve what override)
   - Layered audit trail (all 4 levels logged per requirement change)
   - Exemption classification (6 valid types + supporting docs)
   - Dual-approval for regulatory overrides (CO + ADMIN required)
   - Override expiration & annual review cycles
   - 550+ lines; locked decisions 4, 5, 6

5. **docs/specs/nudge-compliance.md** (Issue #112)
   - Nudge lifecycle (DRAFT → SENT → AWAITING_RESPONSE → RESOLVED/ESCALATED)
   - Audit trail for all nudge events (50+ event types)
   - Rate limiting (1 nudge/supervisor/employee/day; 3 nudges/employee/week)
   - Harassment escalation workflow (employee flag → CO review within 48h)
   - Nudge as compliance evidence (constructive notice doctrine)
   - Notification consent management (GDPR/CCPA legal basis)
   - Data retention (7 years) + cold storage archival
   - 450+ lines; locked decision 9

**Technical Highlights:**
- All 5 specs enforce audit trail principles (immutable, hash-chained, tamper-evident)
- All 5 address RBAC implications + separation of duties
- All 5 include risk assessment + mitigation controls
- All 5 define phased rollout (5-6 month delivery timeline)
- Total: 2,400+ lines of compliance specification
- Regulatory scope: SOX, GDPR, HIPAA, OSHA, FAA, Joint Commission, CCPA, LGPD

**Key Cross-Cutting Patterns:**
- Immutable, append-only audit logs (no DELETE allowed)
- Dual-approval for high-risk actions (regulatory changes, overrides)
- Quarterly review cycles (certification, regulatory alignment, override renewal)
- Cold storage archival after 6 years (immutable blob containers)
- Right to erasure / data portability (GDPR Articles 17, 20)
- Rate limiting + anti-harassment controls (nudges, access requests)

**Decision Files Created:**
- `.squad/decisions/inbox/pearlman-compliance-specs.md` (overview + linking)

**Next for Pearlman:** Implementation planning for Phase 1 of audit events (months 1-2 delivery); integration with API service architecture
