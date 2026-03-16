---
name: "proof-compliance-audit"
description: "Review proof/compliance specs, schema, and validators for taxonomy, attestation, lifecycle, and audit gaps"
domain: "compliance-review"
confidence: "medium"
source: "earned"
---

## Context
Use this skill when the repo contains proof templates, attestation levels, compliance workflows, or regulated-industry evidence handling. It is most useful when specs, Prisma models, Zod validators, and service logic may have drifted apart.

## Patterns
- Review the proof cluster together: `templates-attestation-spec.md`, `proof-taxonomy.md`, `proof-vault-spec.md`, `sharing-spec.md`, `rbac-api-spec.md`, and `app-spec.md`.
- Confirm the six top-level proof types before looking for missing concepts. Most gaps are subtype, lifecycle, or policy gaps rather than missing top-level types.
- Treat attestation as **how** proof is established and proof taxonomy as **what** is being proven.
- Check whether schema optionality undermines regulated behavior. Nullable or free-text proof classification is usually a compliance risk.
- Treat expiration as an immutable historical event plus next-cycle work, never as evidence erasure.
- Require separation of duties for Level 4 validation and prohibit proof-type-invalid attestation combinations.
- Reconcile proof-vault sharing with zero-knowledge guarantees; external disclosure should use explicit evidence packages.

## Examples
- `docs/specs/proof-compliance-audit.md`
- `docs/req/attestation-policy-constraints.md`
- `docs/req/audit-trail-retention-and-revocation.md`
- `docs/ideas/recertification-lifecycle.md`

## Anti-Patterns
- Adding a seventh proof type when the real gap is subtype or lifecycle coverage.
- Defaulting unclassified legacy proofs to `compliance` without review.
- Clearing fulfillment evidence when a proof expires.
- Treating `qualification` and `certification` as interchangeable terms.
- Allowing external share links to bypass the vault's zero-knowledge posture.
