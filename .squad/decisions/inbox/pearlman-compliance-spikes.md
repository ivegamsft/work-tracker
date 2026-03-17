# Decision: Compliance Design Spikes — Issuer Verification & Evidence Packages

**Date:** 2026-03-20  
**Author:** Pearlman (Compliance Specialist)  
**Status:** Proposed  
**Issues:** #32, #33  
**Branch:** `squad/32-33-compliance-design-spikes`

---

## Context

Two P1 compliance issues require design work before implementation can begin:

1. **#32 — Issuer Verification Framework (L3 Attestation):** The current L3 attestation has no systemic validation of third-party claims. Without an issuer registry and verification lifecycle, L3's 0.85 trust weight is unearned.

2. **#33 — Evidence Package Sharing Model:** The sharing spec allows raw vault content via share links, contradicting the vault's zero-knowledge guarantees. Evidence packages provide controlled, auditable external disclosure.

## Decisions

### 1. Issuer Trust Tier System

Four trust tiers (T1 authoritative → T4 manual) multiply against the base L3 attestation weight to produce differentiated readiness impact. This prevents a phone call from carrying the same weight as an official registry lookup.

- T1 (authoritative) assignment requires ADMIN role
- Clearance and license proof types require minimum T2 trust tier
- All tier changes produce audit entries

### 2. Evidence Packages Replace Raw Vault Share Links

External disclosure of compliance evidence MUST use evidence packages, not raw vault share links. Packages are:

- Curated (specific items selected and optionally redacted)
- Versioned (immutable after seal; revisions create new versions)
- Approval-gated (sensitivity determines required approver role)
- Time-limited (mandatory expiration, max 90 days)
- Audited (every creation, access, and revocation logged)

### 3. Separation of Duties

Both designs enforce separation of duties:
- Verification: employee cannot resolve their own manual escalation
- Packages: creator cannot approve their own package
- External sharing: only CO+ can generate external access links

### 4. Phased Implementation

Both features follow a foundation-first approach:
- Phase 1: Schema + CRUD + manual workflows
- Phase 2: Sealing, checksums, retry logic
- Phase 3: Real integrations and external access
- Phase 4: Advanced features (batch, analytics, digital signatures)

## Impact

- **Bunk:** New Prisma models and API endpoints to implement (~36 total endpoints across both features)
- **Kima:** Package builder UI and issuer management screens (future sprints)
- **Sydnor:** Test plans for verification scenarios and package lifecycle
- **Daniels:** Key Vault integration for issuer credentials and package encryption keys

## Spec Documents

- `docs/specs/issuer-verification-framework.md` — Full design for #32
- `docs/specs/evidence-package-sharing.md` — Full design for #33
