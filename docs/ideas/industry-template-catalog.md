# Industry Template Catalog — E-CLAT

> **Status:** Proposed  
> **Author:** Izzy  
> **Created:** 2026-03-17

## Problem

E-CLAT currently supports generic qualification templates. Real-world customers need pre-built templates for common industry certifications, licenses, and credentials — ready to assign out of the box with correct proof requirements, renewal periods, and attestation levels.

## Proposed Template Catalog

### Education
- **Teaching Certificate** — State-issued, typically renewed every 3-5 years. Requires background check, coursework hours, and praxis exam scores. L3 (third-party) attestation minimum.

### Logistics & Warehousing
- **Forklift Operator Certification** — OSHA-required, renewed every 3 years. Requires hands-on evaluation + written test. L2 (supervisor) attestation with L3 for initial cert.
- **Commercial Driver's License (CDL)** — DOT-regulated, Class A/B/C with endorsements (hazmat, tanker, doubles). Medical exam every 2 years. L4 (validated) — must verify with state DMV.

### Safety & Environmental
- **HAZWOPER 40-Hour Card** — EPA/OSHA 29 CFR 1910.120. Initial 40-hour training + 8-hour annual refresher. L3 (third-party training provider). No expiration but refresher required annually.
- **CPR / First Aid Certification** — American Red Cross or AHA. Renewed every 2 years. L3 (third-party). Common across nearly all industries.

### Food Service
- **Food Handler's Certificate** — State/county regulated (ServSafe, local health dept). Renewed every 2-5 years depending on jurisdiction. L3 (third-party exam).

### Financial Services
- **Loan Officer License (NMLS)** — Nationwide Multistate Licensing System. Annual renewal with 8 hours CE. L4 (validated) — must verify against NMLS Consumer Access.

### Healthcare
- **Nursing License (RN/LPN/CNA)** — State Board of Nursing. Renewed every 1-2 years. CE requirements vary by state. L4 (validated) — must verify with state board.

### Travel & Immigration
- **Passport** — Federal government issued, renewed every 10 years (adult). L4 (validated) — document scan + expiration tracking. No attestation — proof is the document itself.
- **Work Visa** — Immigration authority issued (H-1B, L-1, TN, etc.). Expiration tracking critical for compliance. L4 (validated) — legal team verification required.

### Technology
- **Software User Certifications** — Vendor-issued (Microsoft, AWS, Google, Salesforce, etc.). Renewal varies (1-3 years). L3 (third-party) — verify via vendor credential portal (Credly, Acclaim, etc.).

## Template Schema Considerations

Each catalog template should pre-populate:

| Field | Example (CDL) |
|-------|---------------|
| `name` | Commercial Driver's License |
| `category` | Logistics & Warehousing |
| `regulatoryBody` | DOT / FMCSA |
| `renewalPeriodMonths` | 24 (medical), 48 (license) |
| `minAttestationLevel` | L4 (validated) |
| `proofTypes` | upload (license scan), third_party (DMV verification) |
| `gracePeriodDays` | 30 |
| `requirements` | [ medical_exam, written_test, road_test, endorsements ] |
| `jurisdictionScope` | state (varies by issuing state) |
| `verificationUrl` | (state DMV lookup URL, if available) |
| `tags` | [ "DOT", "FMCSA", "CDL", "driving", "commercial" ] |

## Implementation Path

1. **Seed data** — Ship as JSON/YAML catalog in `data/seeds/templates/`
2. **Admin browse** — Industry catalog browser (already specced in template-management-ux.md)
3. **One-click adopt** — Admin selects template → clones into their tenant with local customization
4. **Community contributions** — Later: marketplace where customers share custom templates
5. **Verification integrations** — L4 templates link to external verification APIs (NMLS, state boards, Credly)

## Dependencies

- Spec: `docs/specs/template-management-strategy.md` — template lifecycle
- Spec: `docs/specs/qualification-engine.md` — attestation levels L1-L4
- Spec: `docs/specs/issuer-verification-framework.md` — trust tiers for third-party verification
- Decision #5: L1-L4 Attestation — template defines minimum level
- Decision #7: Catalog + Inheritance — industry profiles auto-flow to groups

## Open Questions

1. How do we handle jurisdiction-specific variants (e.g., nursing license requirements differ by state)?
2. Should we ship a "starter pack" per industry or let admins pick individual templates?
3. How do we keep renewal periods current as regulations change?
4. Should L4 (validated) templates auto-trigger verification API calls, or is it manual?
