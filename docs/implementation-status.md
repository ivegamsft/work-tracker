# E-CLAT Implementation Status

> Repo-derived status matrix — UI screens, API routes, roles, and implementation state.
> Last updated: 2026-03-17

## Status Legend

| Icon | Meaning |
|------|---------|
| ✅ | Fully implemented (UI + API) |
| 🔧 | API only (no UI screen) |
| ⚛️ | UI only (no API backing) |
| 📋 | Spec only (documented, not built) |
| ❌ | Not started |

> Role shorthand: **All authenticated** = EMPLOYEE, SUPERVISOR, MANAGER, COMPLIANCE_OFFICER, ADMIN. **SUPERVISOR+** = SUPERVISOR, MANAGER, COMPLIANCE_OFFICER, ADMIN. **MANAGER+** = MANAGER, COMPLIANCE_OFFICER, ADMIN. **COMPLIANCE_OFFICER+** = COMPLIANCE_OFFICER, ADMIN.

## Recent Shipped Work (v0.4.0–v0.5.0)

### Template UI (PRs #12–#19)
All 8 pages completed: Library, Detail, Editor, Assignment, Fulfillment, Review Queue, Team Templates, Review Detail. 25 endpoints fully wired.

### Hours Pages & Progress APIs (PRs #20, #48)
My Hours, Team Hours, Hour Conflicts, and hours progress endpoints operational with real service implementations.

### Manager Analytics Dashboard (PR #22)
Dashboard redesigned with compliance summary, expiry warnings widget, readiness card. New dashboard module (11th API module).

### Admin Status Change (PR #49)
Marked `apps/admin` dormant for MVP; admin features ship in `apps/web` with RBAC guards.

### Pipeline Completion (PRs #36, #37, #38)
Parallel CI lanes, promotion checks, end-to-end GitHub Actions wiring.

### API v1 Namespace Spike (PR #27)
4-phase dual-mount migration strategy proposed. Proposed for future sprint implementation.

### Attestation Policies & Expiration (PRs #52, #56, #59)
Policy framework, expiration/renewal workflows, team templates endpoints—all endpoints wired.

---

## Implementation Matrix

### Authentication & Session
| Feature | UI Screen | API Endpoint | Roles | Status |
|---------|-----------|-------------|-------|--------|
| Login (W-01) | `/login` | `POST /api/auth/login` | Public | ✅ |
| Token refresh | — | `POST /api/auth/refresh` | Public | 🔧 |
| Account registration | — | `POST /api/auth/register` *(route exists; service not implemented)* | Public | ❌ |
| Change password | — | `POST /api/auth/change-password` *(route exists; service not implemented)* | All authenticated | ❌ |
| Entra / OAuth callback | Entra button is only noted in spec | `GET /api/auth/oauth/callback` *(route exists; service not implemented)* | Public | ❌ |
| Unauthorized screen (W-22) | `/unauthorized` | — | All authenticated | 📋 |
| Not Found screen (W-23) | `/404` | — | Public | 📋 |

### Dashboard
| Feature | UI Screen | API Endpoint | Roles | Status |
|---------|-----------|-------------|-------|--------|
| Dashboard home (W-02) | `/` | `GET /api/employees` *(current screen derives counts from employee list)* | All authenticated | ✅ |
| Role-adaptive dashboard widgets (DW-04..DW-11) | `/` *(spec redesign)* | `GET /api/notifications?limit=5`<br>`GET /api/documents/review-queue`<br>`GET /api/hours/conflicts`<br>`GET /api/employees/:id/readiness`<br>`GET /api/employees/readiness/summary` *(missing P1)* | Role-dependent | 📋 |

### Employee Management
| Feature | UI Screen | API Endpoint | Roles | Status |
|---------|-----------|-------------|-------|--------|
| My Profile (W-03) | `/me` | `GET /api/employees/:id`<br>`GET /api/employees/:id/readiness` | All authenticated *(own scope intended)* | 🔧 |
| Team Directory (W-09) | `/employees` *(spec: `/team`)* | `GET /api/employees` | SUPERVISOR+ | ✅ |
| Employee Detail (W-10) | `/employees/:id` *(spec: `/team/:id`)* | `GET /api/employees/:id`<br>`GET /api/employees/:id/readiness` | UI: SUPERVISOR+<br>API middleware: All authenticated | ✅ |
| Admin employee CRUD (A-03, A-04) | `apps/admin` planned `/employees`, `/employees/new`, `/employees/:id/edit` | `POST /api/employees`<br>`PUT /api/employees/:id` | ADMIN only | 🔧 |

### Qualifications & Skills
| Feature | UI Screen | API Endpoint | Roles | Status |
|---------|-----------|-------------|-------|--------|
| My Qualifications (W-04) | `/me/qualifications` | `GET /api/qualifications/employee/:employeeId` | All authenticated *(own scope intended)* | 🔧 |
| Team Qualifications (W-11) | `/team/:id/qualifications` | `GET /api/qualifications/employee/:employeeId`<br>`POST /api/qualifications`<br>`PUT /api/qualifications/:id` | SUPERVISOR+ | 🔧 |
| Compliance Check (W-15) | `/team/:employeeId/compliance/:standardId` | `GET /api/qualifications/compliance/:employeeId/:standardId` | SUPERVISOR+ | 🔧 |
| Qualification approval workflow | — | — *(app-spec explicitly calls out missing approve/reject endpoints)* | SUPERVISOR+ | 📋 |

### Compliance Standards
| Feature | UI Screen | API Endpoint | Roles | Status |
|---------|-----------|-------------|-------|--------|
| Standards reference + detail (W-20, W-21) | `/standards`<br>`/standards/:id` | `GET /api/standards`<br>`GET /api/standards/:id`<br>`GET /api/standards/:id/requirements` | All authenticated | 🔧 |
| Standards management (A-05, A-06) | `apps/admin` planned `/standards`, `/standards/new`, `/standards/:id/edit` | `POST /api/standards`<br>`PUT /api/standards/:id`<br>`POST /api/standards/:id/requirements`<br>`PUT /api/standards/requirements/:reqId` | ADMIN only | 🔧 |
| Compliance overview + reports (W-19) | `/compliance` | Existing inputs: `GET /api/employees` + readiness fan-out<br>Missing dedicated report API: `GET /api/reports/compliance` *(P2)* | COMPLIANCE_OFFICER+ | 📋 |

### Medical Records
| Feature | UI Screen | API Endpoint | Roles | Status |
|---------|-----------|-------------|-------|--------|
| My Medical (W-05) | `/me/medical` | `GET /api/medical/employee/:employeeId` | All authenticated *(own scope intended)* | 🔧 |
| Team Medical (W-12) | `/team/:id/medical` | `GET /api/medical/employee/:employeeId`<br>`POST /api/medical`<br>`PUT /api/medical/:id` | SUPERVISOR+ | 🔧 |

### Hours Tracking
| Feature | UI Screen | API Endpoint | Roles | Status |
|---------|-----------|-------------|-------|--------|
| My Hours (W-07) | `/me/hours` | `GET /api/hours/employee/:id`<br>`POST /api/hours/clock-in`<br>`POST /api/hours/clock-out`<br>`POST /api/hours/manual`<br>`POST /api/hours/calendar/sync`<br>*(routes exist; `hoursService` is not implemented)* | All authenticated | ❌ |
| Team Hours (W-14) | `/team/:id/hours` | `GET /api/hours/employee/:id`<br>`POST /api/hours/import/payroll`<br>`POST /api/hours/import/scheduling`<br>`PUT /api/hours/:id`<br>`DELETE /api/hours/:id`<br>*(routes exist; `hoursService` is not implemented)* | SUPERVISOR+ / MANAGER+ | ❌ |
| Hour Conflicts (W-18) | `/conflicts` | `GET /api/hours/conflicts`<br>`POST /api/hours/conflicts/:id/resolve`<br>*(routes exist; `hoursService` is not implemented)* | MANAGER+ | ❌ |
| Hours approval workflow | — | — *(app-spec calls out missing `POST /api/hours/:id/approve` and `/reject`)* | MANAGER+ | 📋 |

### Documents
| Feature | UI Screen | API Endpoint | Roles | Status |
|---------|-----------|-------------|-------|--------|
| My Documents (W-06) | `/me/documents` | `POST /api/documents/upload`<br>`GET /api/documents/employee/:employeeId` *(missing P0)* | All authenticated *(own scope intended)* | 📋 |
| Team Documents (W-13) | `/team/:id/documents` | `GET /api/documents/employee/:employeeId` *(missing P0)* | SUPERVISOR+ | 📋 |
| Document upload workflow | — | `POST /api/documents/upload` | All authenticated | 🔧 |
| Document Review Queue (W-16) | `/reviews` | `GET /api/documents/review-queue` | MANAGER+ | 🔧 |
| Document Review Detail (W-17) | `/reviews/:id` | `GET /api/documents/:id`<br>`GET /api/documents/:id/extraction`<br>`PUT /api/documents/:id/extraction/:fieldId/correct`<br>`POST /api/documents/:id/review` | MANAGER+ *(review actions)* | 🔧 |

### Notifications
| Feature | UI Screen | API Endpoint | Roles | Status |
|---------|-----------|-------------|-------|--------|
| My Notifications (W-08) | `/me/notifications` | `GET /api/notifications`<br>`GET /api/notifications/preferences`<br>`POST /api/notifications/preferences`<br>`PUT /api/notifications/:id/read`<br>`DELETE /api/notifications/:id` | All authenticated | 🔧 |
| Weekly digest | Planned inside `/me/notifications` | `GET /api/notifications/digest/weekly` | All authenticated | 🔧 |

### Proof Templates & Attestation
| Feature | UI Screen | API Endpoint | Roles | Status |
|---------|-----------|-------------|-------|--------|
| Template library + editor (W-32, W-33, W-34) | `/templates`<br>`/templates/:id`<br>`/templates/:id/edit` | `POST /api/templates`<br>`GET /api/templates`<br>`GET /api/templates/:id`<br>`PUT /api/templates/:id`<br>`DELETE /api/templates/:id`<br>`POST /api/templates/:id/publish`<br>`POST /api/templates/:id/archive`<br>`POST /api/templates/:id/clone` | SUPERVISOR+ / MANAGER+ | 📋 |
| Template assignment (W-35, W-36) | `/templates/:id/assign`<br>`/team/templates` | `POST /api/templates/:id/assign`<br>`GET /api/templates/:id/assignments`<br>`GET /api/employees/:id/assignments`<br>`DELETE /api/assignments/:id` | SUPERVISOR+ / MANAGER+ / EMPLOYEE (own read) | 📋 |
| Employee fulfillment (W-30, W-31) | `/me/templates`<br>`/me/templates/:assignmentId` | `GET /api/assignments/:id/fulfillments`<br>`POST /api/fulfillments/:id/self-attest`<br>`POST /api/fulfillments/:id/attach-document`<br>`POST /api/fulfillments/:id/third-party-verify` | EMPLOYEE / ADMIN *(third-party verify)* | 📋 |
| Fulfillment review queue (W-37, W-38) | `/reviews/templates`<br>`/reviews/templates/:fulfillmentId` | `POST /api/fulfillments/:id/validate`<br>`GET /api/fulfillments/pending-review`<br>`GET /api/fulfillments/pending-review/count` | MANAGER+ | 📋 |
| Proof taxonomy + industry presets | Template editor flow *(spec only)* | `GET /api/proof-types`<br>`GET /api/proof-types/:type/config-schema`<br>`GET /api/presets`<br>`GET /api/presets/:industry`<br>`POST /api/templates/from-preset/:presetId` | EMPLOYEE / SUPERVISOR+ / MANAGER+ / ADMIN depending endpoint | 📋 |

### Sharing & Proof Vault
| Feature | UI Screen | API Endpoint | Roles | Status |
|---------|-----------|-------------|-------|--------|
| Proof Vault personal storage (W-06a, W-06b) | `/me/vault`<br>`/me/vault/setup` | `POST /api/vault`<br>`POST /api/vault/unlock`<br>`GET /api/vault`<br>`GET|POST|DELETE /api/vault/documents*`<br>`POST /api/vault/export`<br>`POST /api/vault/change-passphrase` | EMPLOYEE *(own vault)* | 📋 |
| Vault status on Employee Detail | W-10 planned section | `GET /api/vault/employee/:employeeId/status` | SUPERVISOR+ | 📋 |
| Shared folders + direct shares (W-24, W-25, W-26) | `/vault`<br>`/vault/folders/:id`<br>share modal | `POST|GET|PUT|DELETE /api/vault/folders*`<br>`POST|GET|PUT|DELETE /api/vault/shares*` | All authenticated | 📋 |
| Share links (W-27) | Share-link modal | `POST|GET|DELETE /api/vault/links*`<br>`GET /api/vault/links/:id/access-log`<br>`GET /api/vault/access/:token` | COMPLIANCE_OFFICER+ *(manage)* / Public *(access)* | 📋 |
| File requests (W-28, W-29) | Request modal<br>`/vault/requests/:id` | `POST|GET|PUT /api/vault/requests*`<br>`POST /api/vault/requests/:id/cancel`<br>`POST /api/vault/requests/:id/fulfill`<br>`POST /api/vault/requests/:id/unable` | SUPERVISOR+ *(create/manage)* / All authenticated *(view or fulfill own)* | 📋 |
| Storage + quota management (A-10) | `apps/admin` planned `/storage` | `GET /api/vault/storage`<br>`GET|PUT /api/vault/storage/users/:id/quota`<br>`GET|PUT /api/vault/storage/defaults` | EMPLOYEE *(own usage)* / ADMIN *(quota mgmt)* | 📋 |

### Admin Operations
| Feature | UI Screen | API Endpoint | Roles | Status |
|---------|-----------|-------------|-------|--------|
| Admin app shell + dashboard (A-01, A-02) | `apps/admin` planned `/login`, `/` *(repo only has package.json + README)* | `GET /health` plus existing admin endpoints | ADMIN only | 📋 |
| Label taxonomy management (A-07) | `apps/admin` planned `/labels` | `POST /api/labels/admin`<br>`PUT /api/labels/admin/:id`<br>`POST /api/labels/admin/:id/deprecate`<br>`POST /api/labels/mappings`<br>`GET /api/labels/versions`<br>`GET /api/labels/resolve`<br>`GET /api/labels/audit/:id`<br>*(routes exist; `labelService` is not implemented)* | ADMIN only *(audit read: SUPERVISOR+)* | ❌ |
| Notification testing + escalation rules (A-08, A-09) | `apps/admin` planned `/escalation-rules`, `/notifications/test` | `POST /api/notifications/admin/test`<br>`POST /api/notifications/admin/escalation-rules`<br>`GET /api/notifications/admin/escalation-rules` | ADMIN only | 🔧 |
| Per-record audit trails / compliance audit data | No dedicated screen yet | `GET /api/qualifications/:id/audit`<br>`GET /api/medical/:id/audit`<br>`GET /api/documents/:id/audit`<br>`GET /api/hours/:id/audit`<br>`GET /api/labels/audit/:id` | SUPERVISOR+ / ADMIN | 🔧 |

## Schema Coverage Notes

### Present in `data/prisma/schema.prisma`
- **Core:** `Employee`, `ComplianceStandard`, `StandardRequirement`, `Qualification`, `MedicalClearance`
- **Records:** `Document`, `DocumentProcessing`, `ExtractionResult`, `ReviewQueueItem`, `HourRecord`, `HourConflict`, `HourConflictRecord`
- **Templates & Attestation (NEW):** `ProofTemplate`, `ProofRequirement`, `TemplateAssignment`, `ProofFulfillment`
- **System:** `Notification`, `NotificationPreference`, `EscalationRule`, `Label`, `LabelMapping`, `TaxonomyVersion`, `AuditLog`

### Spec-defined but absent from the Prisma schema (Phase 2)
- **Proof Vault:** `ProofVault`, `VaultDocument`, `VaultFolder`, `VaultShare`, `VaultShareLink`, `StorageQuota`
- **Proof Taxonomy:** `ProofType` enum (in code), `IndustryPreset` model

## Notes

- The current routed `apps/web` surface now includes **25+ screens** across auth, dashboard, employee mgmt, qualifications, medical, documents, hours, notifications, standards, templates, fulfillment, and reviews.
- `apps/admin` is marked dormant for MVP (v0.4.0–v0.6.0); admin features ship in `apps/web` with `requireRole(Roles.ADMIN)` guards, to be extracted in v0.7.0+.
- The API has 11 modules (dashboard is new): auth, employees, hours, documents, qualifications, medical, standards, notifications, labels, templates, dashboard.
- Test coverage: 415 tests passing (34 smoke, 15 proof metadata, 366 API modules, 5 web components).
- Hours and labels services now have real implementations; auth register/change-password/oauth callbacks are still placeholders.

## Summary

| Category | Screens | API Endpoints | Status |
|----------|---------|---------------|--------|
| Authentication & Session | 1 ✅ | 2 ✅ + 5 ❌ | Partial (login works) |
| Dashboard & Analytics | 1 ✅ | 3 🔧 | **NEW — Complete** |
| Employee Management | 4 ✅ | 5 🔧 | Full UI, API partial |
| Qualifications & Skills | 2 🔧 | 4 🔧 | API only |
| Compliance Standards | 2 🔧 | 5 🔧 | API only |
| Medical Records | 2 🔧 | 4 🔧 | API only |
| Hours Tracking | 3 ✅ | 8 ✅ | **NEWLY ACTIVATED** |
| Documents | 4 🔧 | 5 🔧 | API partial (upload works) |
| Notifications | 1 🔧 | 8 🔧 | API only |
| Proof Templates & Attestation | 8 ✅ | 25 ✅ | **NEWLY COMPLETED (v0.4.0)** |
| Sharing & Proof Vault | — | — | Phase 2 (not started) |
| Admin Operations | — | 8 🔧 | Moved to web app |
| **TOTALS** | **25+** | **94+** | **415 tests** |
