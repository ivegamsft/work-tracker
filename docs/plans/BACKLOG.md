# E-CLAT Backlog — Issue Creation Summary

**Created:** 2026-03-16  
**Lead:** Freamon  
**Total Issues:** 51 (including 5 epics)

---

## Quick Stats

- **Epics:** 5
- **P0 Issues:** 14 (critical blockers)
- **P1 Issues:** 25 (this sprint/release)
- **P2 Issues:** 13 (future work)
- **Squad Distribution:** Bunk 16, Kima 13, Daniels 12, Pearlman 7, Freamon 3, Sydnor 1
- **Release Distribution:** v0.4.0 (16), v0.5.0 (19), v0.6.0 (10), backlog (5)

---

## Epics

| # | Epic | Priority | Release | Owner | Child Issues |
|---|------|----------|---------|-------|--------------|
| [#1](https://github.com/ivegamsft/work-tracker/issues/1) | Compliance Hardening | P0 | v0.5.0 | Pearlman | 7 issues (#30-#34, #47-#48) |
| [#2](https://github.com/ivegamsft/work-tracker/issues/2) | Architecture Foundation | P0 | v0.5.0 | Daniels | 11 issues (#23-#29, #39-#41, #49) |
| [#3](https://github.com/ivegamsft/work-tracker/issues/3) | Template UI Screens | P1 | v0.4.0 | Kima | 13 issues (#11-#22) |
| [#4](https://github.com/ivegamsft/work-tracker/issues/4) | Pipeline & DevOps | P1 | v0.5.0 | Daniels | 6 issues (#35-#38, #50) |
| [#5](https://github.com/ivegamsft/work-tracker/issues/5) | Bug Fixes & Stabilization | P0 | v0.4.0 | Bunk | 5 issues (#6-#10) |

---

## v0.4.0 — Bug Fixes & Template UI (16 issues)

### Critical Bugs (P0)
- [#6](https://github.com/ivegamsft/work-tracker/issues/6) — Fix template validation errors (500 → 400) [Bunk]
- [#7](https://github.com/ivegamsft/work-tracker/issues/7) — Fix npm run lint failures [Bunk]
- [#8](https://github.com/ivegamsft/work-tracker/issues/8) — Apply Prisma migration for templates [Bunk]
- [#10](https://github.com/ivegamsft/work-tracker/issues/10) — Fix deploy.yml output mismatch [Daniels]

### Template UI Screens (P1)
- [#11](https://github.com/ivegamsft/work-tracker/issues/11) — W-30: My Templates page [Kima]
- [#12](https://github.com/ivegamsft/work-tracker/issues/12) — W-31: Template Fulfillment [Kima]
- [#13](https://github.com/ivegamsft/work-tracker/issues/13) — W-32: Template Library [Kima]
- [#14](https://github.com/ivegamsft/work-tracker/issues/14) — W-33: Template Detail [Kima]
- [#15](https://github.com/ivegamsft/work-tracker/issues/15) — W-34: Template Editor [Kima]
- [#16](https://github.com/ivegamsft/work-tracker/issues/16) — W-35: Template Assign [Kima]
- [#17](https://github.com/ivegamsft/work-tracker/issues/17) — W-36: Team Templates [Kima]
- [#18](https://github.com/ivegamsft/work-tracker/issues/18) — W-37: Fulfillment Review Queue [Kima]
- [#19](https://github.com/ivegamsft/work-tracker/issues/19) — W-38: Fulfillment Review Detail [Kima]
- [#20](https://github.com/ivegamsft/work-tracker/issues/20) — Remove "coming soon" from hours pages [Kima]
- [#21](https://github.com/ivegamsft/work-tracker/issues/21) — Dashboard redesign [Kima]

---

## v0.5.0 — Architecture & Compliance (19 issues)

### Architecture Foundation (P0)
- [#23](https://github.com/ivegamsft/work-tracker/issues/23) — SA-01: Create shared contracts [Daniels]
- [#24](https://github.com/ivegamsft/work-tracker/issues/24) — SA-02: Repository interfaces [Bunk]
- [#39](https://github.com/ivegamsft/work-tracker/issues/39) — Feature flags foundation [Daniels]
- [#40](https://github.com/ivegamsft/work-tracker/issues/40) — Feature flags bootstrap endpoint [Bunk]
- [#41](https://github.com/ivegamsft/work-tracker/issues/41) — Gate incomplete features [Bunk/Kima]

### Compliance Hardening (P0)
- [#30](https://github.com/ivegamsft/work-tracker/issues/30) — Attestation policy constraints [Pearlman]
- [#31](https://github.com/ivegamsft/work-tracker/issues/31) — Audit-safe expiration/renewal [Pearlman]

### Architecture Foundation (P1)
- [#25](https://github.com/ivegamsft/work-tracker/issues/25) — SA-04: Query services [Bunk]
- [#26](https://github.com/ivegamsft/work-tracker/issues/26) — SA-05: Terraform compute stubs [Daniels]
- [#27](https://github.com/ivegamsft/work-tracker/issues/27) — SA-06: API v1 namespace plan [Freamon, spike]
- [#49](https://github.com/ivegamsft/work-tracker/issues/49) — Admin shell decision [Freamon, spike]

### Compliance Hardening (P1)
- [#34](https://github.com/ivegamsft/work-tracker/issues/34) — Typed proof metadata [Pearlman]
- [#47](https://github.com/ivegamsft/work-tracker/issues/47) — Shared proof-domain types [Pearlman]

### Pipeline & DevOps (P0-P1)
- [#35](https://github.com/ivegamsft/work-tracker/issues/35) — Change detection [Daniels, P0]
- [#36](https://github.com/ivegamsft/work-tracker/issues/36) — Parallel validation lanes [Daniels, P1]
- [#37](https://github.com/ivegamsft/work-tracker/issues/37) — Artifact promotion [Daniels, P1]
- [#38](https://github.com/ivegamsft/work-tracker/issues/38) — Smoke deploy checks [Sydnor, P1]

### Other
- [#22](https://github.com/ivegamsft/work-tracker/issues/22) — Manager analytics dashboard [Kima, P1]
- [#51](https://github.com/ivegamsft/work-tracker/issues/51) — Refresh implementation-status.md [Freamon, P2]

---

## v0.6.0 — Service Extraction & Advanced Features (10 issues)

### Service Extraction (P2)
- [#28](https://github.com/ivegamsft/work-tracker/issues/28) — SA-07: Extract Reference/Notification services [Daniels]
- [#29](https://github.com/ivegamsft/work-tracker/issues/29) — SA-08: Event contracts [Daniels]

### Compliance (P1)
- [#32](https://github.com/ivegamsft/work-tracker/issues/32) — Issuer verification (L3) [Pearlman]
- [#33](https://github.com/ivegamsft/work-tracker/issues/33) — Evidence-package sharing [Pearlman]
- [#48](https://github.com/ivegamsft/work-tracker/issues/48) — Proof-aware hours APIs [Bunk]

### Infrastructure (P2)
- [#42](https://github.com/ivegamsft/work-tracker/issues/42) — UI menu architecture [Kima]
- [#50](https://github.com/ivegamsft/work-tracker/issues/50) — Preview environments [Daniels]

---

## Backlog — Future Enhancements (5 issues, P2)

- [#43](https://github.com/ivegamsft/work-tracker/issues/43) — Hour capture and reconciliation [Bunk]
- [#44](https://github.com/ivegamsft/work-tracker/issues/44) — Label taxonomy versioning [Bunk]
- [#45](https://github.com/ivegamsft/work-tracker/issues/45) — AI-assisted document extraction [Bunk]
- [#46](https://github.com/ivegamsft/work-tracker/issues/46) — Access visibility and notifications [Bunk]

---

## Critical Path for v0.4.0

**Blockers (must complete first):**
1. #8 — Prisma migration (blocks all template work)
2. #6, #7, #10 — Bug fixes (stabilization)

**Parallel Tracks:**
- **Kima:** Template UI screens (#11-#19) after #8 completes
- **Kima:** Hours pages (#20), Dashboard (#21) can start immediately
- **Daniels:** Deploy fix (#10) can start immediately

---

## Critical Path for v0.5.0

**Foundation (must complete first):**
1. #23 — Shared contracts (unlocks most other work)
2. #39 — Feature flags foundation (enables safe rollout)

**Parallel Tracks After Foundation:**
- **Compliance:** #30, #31, #34, #47 (Pearlman)
- **Architecture:** #24, #25, #26 (Bunk, Daniels)
- **Pipeline:** #35, #36, #37, #38 (Daniels, Sydnor)
- **Spikes:** #27, #49 (Freamon)

---

## How to Use This Backlog

### For Squad Leads
1. Review issues assigned to your squad
2. Refine acceptance criteria if needed
3. Break large issues into tasks if needed
4. Update estimates in issue comments

### For Contributors
1. Filter by your squad label (e.g., `squad:kima`)
2. Filter by `go:yes` for ready-to-implement work
3. Check dependencies in issue body before starting
4. Update issue with progress/blockers

### For Planning
1. Filter by release milestone (e.g., `release:v0.4.0`)
2. Sort by priority (P0 → P1 → P2)
3. Review epic progress (#1-#5)
4. Identify blocked work (`go:needs-research`)

---

## Sources

**Specifications:**
- proof-compliance-audit.md
- service-architecture-spec.md
- feature-flags-spec.md
- pipeline-architecture-spec.md
- templates-attestation-spec.md

**Requirements:**
- attestation-policy-constraints.md
- audit-trail-retention-and-revocation.md
- feature-flag-requirements.md
- parallel-deployment-requirements.md

**Ideas:**
- ui-menu-architecture.md
- recertification-lifecycle.md
- evidence-package-sharing.md
- issuer-registry-integrations.md
- document-uploads-ai-review.md
- hour-capture-reconciliation.md
- label-taxonomy-mapping.md
- access-visibility-notifications.md

---

**Last Updated:** 2026-03-16  
**View All Issues:** https://github.com/ivegamsft/work-tracker/issues
