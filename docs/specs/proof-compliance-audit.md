# Proof Compliance Audit — E-CLAT

> **Author:** Pearlman (Compliance Specialist)
> **Date:** 2026-03-16
> **Scope:** `docs/specs/`, `data/prisma/schema.prisma`, `packages/shared/src/types/`, `apps/api/src/modules/{templates,hours,qualifications,medical,documents}/`

## Verdict

E-CLAT is **on the right track structurally**: the six proof types are sufficient at the top level, the four attestation levels are correctly framed, and the assignment → requirement → fulfillment model is the right compliance backbone. The main risks are not missing top-level concepts; they are **classification drift, audit-destructive expiration behavior, incomplete attestation policy constraints, and a zero-knowledge sharing contradiction**.

## ✅ Correct

| Area | Finding | Evidence |
|------|---------|----------|
| Proof taxonomy | The six top-level proof types are the right set: `hours`, `certification`, `training`, `clearance`, `assessment`, `compliance`. No seventh top-level proof type is required. Medical belongs under `clearance`, not as a separate proof type. | `docs/specs/proof-taxonomy.md`, `data/prisma/schema.prisma` |
| Attestation model | The four attestation levels are correctly named and ordered: `self_attest` (L1), `upload` (L2), `third_party` (L3), `validated` (L4). | `docs/specs/templates-attestation-spec.md`, `data/prisma/schema.prisma` |
| Lifecycle backbone | Template lifecycle `draft -> published -> archived` is correct for regulated change control. | `docs/specs/templates-attestation-spec.md`, `data/prisma/schema.prisma`, `apps/api/src/modules/templates/service.ts` |
| Fulfillment backbone | `TemplateAssignment` + `ProofRequirement` + `ProofFulfillment` is the correct decomposition for per-employee proof tracking. | `docs/specs/templates-attestation-spec.md`, `data/prisma/schema.prisma` |
| Existing service direction | The templates service already computes compound fulfillment status and supports publish/clone/assign flows, so the implementation direction is stronger than some older status docs imply. | `apps/api/src/modules/templates/service.ts`, `docs/implementation-status.md` |

## ⚠️ Needs Fix

| Finding | What is wrong now | What it should be | Files |
|---------|-------------------|-------------------|-------|
| Typed proof classification is too loose | `ProofRequirement.proofType` is nullable in Prisma; `proofSubType`, `thresholdUnit`, and `universalCategory` are free text in schema and validators. | Published templates should require explicit proof classification, and subtype/category/unit values should move toward enums or governed code lists. | `data/prisma/schema.prisma`, `apps/api/src/modules/templates/validators.ts`, `packages/shared/src/types/domain.ts`, `docs/specs/proof-taxonomy.md` |
| Expiration previously implied evidence reset | The spec previously described clearing fulfillment evidence on expiry, which is not audit-safe. | Expired proofs must remain immutable historical records; renewal creates the next cycle instead of deleting prior evidence. | `docs/specs/templates-attestation-spec.md`; later implementation in templates services/jobs |
| Terminology drift | Specs mix `qualification`, `certification`, `renewal`, `recertification`, and `requalification` too loosely. | Use qualification for the internal employee record, certification for the external credential proof type, and separate renewal vocabulary explicitly. | `docs/specs/templates-attestation-spec.md`, `docs/specs/rbac-api-spec.md`, `packages/shared/src/types/domain.ts` |
| RBAC is split across specs | Template and fulfillment permissions were defined in the template spec but not carried into the RBAC authority doc. | RBAC authority must include templates/fulfillments resources and permissions. | `docs/specs/rbac-api-spec.md` |
| Vault sharing contradicted zero-knowledge | Sharing spec allowed raw share-link decryption of vault content, which weakens the zero-knowledge position. | External links should operate on explicit evidence packages, not raw vault artifacts. | `docs/specs/sharing-spec.md`, future vault/share models |

## ❌ Invalid / Missing

| Missing concept | Why it matters | Added artifact |
|-----------------|----------------|----------------|
| Recertification / requalification lifecycle | Regulated programs need next-cycle tracking, not just expiration flags. | `docs/ideas/recertification-lifecycle.md` |
| Issuer / registry verification strategy | L3 verification is underspecified without source hierarchy, integration patterns, and failure handling. | `docs/ideas/issuer-registry-integrations.md` |
| Evidence-package sharing model | External disclosure needs a controlled model compatible with zero-knowledge storage. | `docs/ideas/evidence-package-sharing.md` |
| Attestation policy constraints | The platform needs a normative matrix for allowed combinations, separation of duties, and proof-type-specific minimums. | `docs/req/attestation-policy-constraints.md` |
| Audit retention and revocation rules | Regulated industries require immutable evidence history, retention windows, and revocation propagation. | `docs/req/audit-trail-retention-and-revocation.md` |

## 💡 Enhancement

| Enhancement | Why it helps |
|------------|--------------|
| Add shared proof-domain types to `packages/shared/src/types/` | The shared type layer currently has no `ProofTemplate`, `ProofRequirement`, `TemplateAssignment`, or `ProofFulfillment` types. |
| Add validator-level attestation policy checks | `templates/validators.ts` should reject invalid combinations like L1-only clearance and normalize compound levels before persistence. |
| Add proof-type-aware hours progress APIs | Hours service supports operational entry, but not threshold / rolling-window compliance progress. |
| Refresh implementation status docs | `docs/implementation-status.md` understates the current templates service implementation and should be regenerated after the proof work stabilizes. |

## Implementation Drift Observed

### Shared types
- `packages/shared/src/types/domain.ts` still models qualifications, hours, documents, and medical, but **not** the proof-template domain.
- This means proof-domain correctness currently lives in Prisma + service code, not in shared contracts.

### Validators
- `apps/api/src/modules/templates/validators.ts` correctly constrains the six proof types and four attestation levels, but still allows free-text `proofSubType`, `thresholdUnit`, and `universalCategory`.
- No validator currently enforces proof-type-specific policy, such as prohibiting `self_attest`-only clearance.

### Services
- `apps/api/src/modules/templates/service.ts` already has meaningful logic for compound attestations, status computation, publishing, cloning, assignment creation, and fulfillment review.
- `apps/api/src/modules/qualifications/service.ts` and `medical/service.ts` calculate expiration state, but they do not open renewal cycles.
- `apps/api/src/modules/hours/service.ts` captures attestations/reasons in validators for manual entries and conflict resolution, but the proof-domain rollup logic is still absent.
- `apps/api/src/modules/documents/service.ts` supports operational review, but not issuer-trust classification or proof-vault/evidence-package linkage.

## Backlog Additions

1. **P0 — Attestation policy constraints**
   - Implement policy matrix for allowed attestation combinations by proof type.
   - Enforce separation of duties for Level 4 validation.
2. **P0 — Audit-safe expiration and revocation**
   - Preserve expired evidence, add renewal-cycle creation, and propagate revocations/suspensions.
3. **P1 — Issuer verification framework**
   - Define verification providers, trust tiers, canonical responses, and webhook/audit behavior.
4. **P1 — Evidence-package sharing**
   - Separate internal re-encrypted sharing from external disclosure packages.
5. **P1 — Typed proof metadata governance**
   - Move subtypes, universal categories, and threshold units out of uncontrolled free text.

## Recommended Next Moves

1. Update Prisma, shared types, and Zod validators so published templates cannot remain untyped.
2. Treat expiration as a historical status change plus next-cycle creation, never as evidence erasure.
3. Land the attestation-policy requirement before more template UI/API work ships.
4. Keep proof-vault external sharing behind evidence-package semantics rather than raw vault links.
5. Reconcile implementation-status reporting with the actual templates service so delivery tracking stays credible.
