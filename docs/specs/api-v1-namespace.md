# API v1 Namespace Migration Spec — E-CLAT

> **Status:** Spike / Proposed  
> **Owner:** Freamon (Lead) + Bunk (Backend Dev)  
> **Date:** 2026-03-19  
> **Applies To:** `apps/api`, `apps/web`, `packages/shared`  
> **Companion Docs:** `docs/specs/service-architecture-spec.md`, `docs/specs/feature-flags-spec.md`  
> **Related Issue:** [#27](https://github.com/ivegamsft/work-tracker/issues/27)

---

## 1. Purpose

Define the migration path from the current flat `/api/*` namespace to a versioned, service-grouped `/api/v1/*` structure that:
- Supports future API versioning (v2, v3)
- Aligns routes with logical service boundaries
- Maintains backward compatibility during migration
- Prepares for service extraction without breaking clients

---

## 2. Current State

### 2.1 Current Route Structure

The API currently exposes **98 endpoints** across **11 modules**:

| Current Path | Module | Endpoints | Status |
|--------------|--------|-----------|--------|
| `/api/auth` | auth | 5 | Unversioned |
| `/api/employees` | employees | 6 | Unversioned |
| `/api/qualifications` | qualifications | 7 | Unversioned |
| `/api/medical` | medical | 5 | Unversioned |
| `/api/documents` | documents | 9 | Unversioned |
| `/api/hours` | hours | 12 | Unversioned |
| `/api/standards` | standards | 7 | Unversioned |
| `/api/labels` | labels | 7 | Unversioned |
| `/api/notifications` | notifications | 10 | Unversioned |
| `/api/templates` | templates | 16 | Unversioned |
| `/api/assignments` | assignments | 2 | Unversioned |
| `/api/fulfillments` | fulfillments | 7 | Unversioned |
| `/api/v1/platform` | platform | 1 | **Already versioned ✓** |

**Key Observations:**
- **Platform module** already uses `/api/v1/platform` prefix (inconsistency with others)
- Template-related routes are split across 4 mount points (`/api/templates`, `/api/assignments`, `/api/fulfillments`, plus `/api/employees/:id/assignments`)
- Employee assignments router is dual-mounted at `/api/employees` (creates namespace coupling)
- All routes are publicly exposed at top level with no service grouping

### 2.2 Client Dependencies

**Frontend (`apps/web`):**
- API client at `apps/web/src/lib/api.ts` makes direct fetch calls to unversioned endpoints
- Approximately **45-50 API calls** across 20+ page components
- No abstraction layer between UI and API paths

**Expected future clients:**
- Mobile apps (planned Phase 3)
- Third-party integrations (proof vault sharing)
- Internal automation scripts

---

## 3. Proposed v1 Namespace Structure

### 3.1 Service Group Mapping

Align routes with the 6 logical service groups from [service-architecture-spec.md](./service-architecture-spec.md):

#### **Identity Platform** → `/api/v1/auth`
Current routes under `/api/auth`:
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/change-password`
- `GET /api/v1/auth/oauth/callback`

**Rationale:** Identity is the foundation; no further grouping needed.

---

#### **Workforce Core** → `/api/v1/workforce/*`

| New Path | Current Path | Notes |
|----------|--------------|-------|
| `POST /api/v1/workforce/employees` | `/api/employees` | Create employee |
| `GET /api/v1/workforce/employees` | `/api/employees` | List employees |
| `GET /api/v1/workforce/employees/:id` | `/api/employees/:id` | Get employee |
| `PUT /api/v1/workforce/employees/:id` | `/api/employees/:id` | Update employee |
| `GET /api/v1/workforce/employees/:id/readiness` | `/api/employees/:id/readiness` | Readiness dashboard |
| `GET /api/v1/workforce/employees/:id/assignments` | `/api/employees/:id/assignments` | Template assignments |

**Rationale:** 
- Groups employee-centric operations under `workforce` to distinguish from compliance artifacts
- Prepares for future team and organization endpoints
- Removes dual-mounting issue (employee assignments now clearly part of workforce surface)

---

#### **Compliance Service** → `/api/v1/compliance/*`

| New Path | Current Path | Notes |
|----------|--------------|-------|
| **Qualifications** | | |
| `POST /api/v1/compliance/qualifications` | `/api/qualifications` | Create |
| `GET /api/v1/compliance/qualifications` | `/api/qualifications` | List |
| `GET /api/v1/compliance/qualifications/:id` | `/api/qualifications/:id` | Get |
| `PUT /api/v1/compliance/qualifications/:id` | `/api/qualifications/:id` | Update |
| `GET /api/v1/compliance/qualifications/:id/audit` | `/api/qualifications/:id/audit` | Audit trail |
| `GET /api/v1/compliance/qualifications/employee/:employeeId` | `/api/qualifications/employee/:employeeId` | By employee |
| `GET /api/v1/compliance/qualifications/check/:employeeId/:standardId` | `/api/qualifications/compliance/:employeeId/:standardId` | Compliance check |
| **Medical Clearances** | | |
| `POST /api/v1/compliance/medical` | `/api/medical` | Create |
| `GET /api/v1/compliance/medical/:id` | `/api/medical/:id` | Get |
| `PUT /api/v1/compliance/medical/:id` | `/api/medical/:id` | Update |
| `GET /api/v1/compliance/medical/:id/audit` | `/api/medical/:id/audit` | Audit trail |
| `GET /api/v1/compliance/medical/employee/:employeeId` | `/api/medical/employee/:employeeId` | By employee |
| **Templates** | | |
| `POST /api/v1/compliance/templates` | `/api/templates` | Create |
| `GET /api/v1/compliance/templates` | `/api/templates` | List |
| `GET /api/v1/compliance/templates/:id` | `/api/templates/:id` | Get |
| `PUT /api/v1/compliance/templates/:id` | `/api/templates/:id` | Update |
| `DELETE /api/v1/compliance/templates/:id` | `/api/templates/:id` | Delete |
| `POST /api/v1/compliance/templates/:id/publish` | `/api/templates/:id/publish` | Publish |
| `POST /api/v1/compliance/templates/:id/archive` | `/api/templates/:id/archive` | Archive |
| `POST /api/v1/compliance/templates/:id/clone` | `/api/templates/:id/clone` | Clone |
| `POST /api/v1/compliance/templates/:id/assign` | `/api/templates/:id/assign` | Assign |
| `GET /api/v1/compliance/templates/:id/assignments` | `/api/templates/:id/assignments` | List assignments |
| `GET /api/v1/compliance/templates/:id/audit` | `/api/templates/:id/audit` | Audit trail |
| **Template Requirements** | | |
| `POST /api/v1/compliance/templates/:id/requirements` | `/api/templates/:id/requirements` | Add requirement |
| `PUT /api/v1/compliance/templates/:id/requirements/:reqId` | `/api/templates/:id/requirements/:reqId` | Update requirement |
| `DELETE /api/v1/compliance/templates/:id/requirements/:reqId` | `/api/templates/:id/requirements/:reqId` | Remove requirement |
| `PUT /api/v1/compliance/templates/:id/requirements/reorder` | `/api/templates/:id/requirements/reorder` | Reorder requirements |
| **Assignments** | | |
| `GET /api/v1/compliance/assignments/:id/fulfillments` | `/api/assignments/:id/fulfillments` | List fulfillments |
| `DELETE /api/v1/compliance/assignments/:id` | `/api/assignments/:id` | Deactivate |
| **Fulfillments** | | |
| `GET /api/v1/compliance/fulfillments/pending-review` | `/api/fulfillments/pending-review` | List pending |
| `GET /api/v1/compliance/fulfillments/pending-review/count` | `/api/fulfillments/pending-review/count` | Count pending |
| `POST /api/v1/compliance/fulfillments/:id/self-attest` | `/api/fulfillments/:id/self-attest` | Self-attest |
| `POST /api/v1/compliance/fulfillments/:id/attach-document` | `/api/fulfillments/:id/attach-document` | Attach document |
| `POST /api/v1/compliance/fulfillments/:id/validate` | `/api/fulfillments/:id/validate` | Validate |
| `POST /api/v1/compliance/fulfillments/:id/third-party-verify` | `/api/fulfillments/:id/third-party-verify` | Third-party verify |
| `GET /api/v1/compliance/fulfillments/:id/audit` | `/api/fulfillments/:id/audit` | Audit trail |

**Rationale:**
- **Consolidates 4 scattered mount points** (`/api/templates`, `/api/assignments`, `/api/fulfillments`, `/api/employees/:id/assignments`) into one logical group
- Qualifications + Medical + Templates all represent proof/attestation evidence — they belong together
- Prepares for unified compliance reporting and readiness queries
- 33 endpoints under one service boundary

---

#### **Records Service** → `/api/v1/records/*`

| New Path | Current Path | Notes |
|----------|--------------|-------|
| **Documents** | | |
| `POST /api/v1/records/documents/upload` | `/api/documents/upload` | Upload |
| `GET /api/v1/records/documents` | `/api/documents` | List (review queue) |
| `GET /api/v1/records/documents/review-queue` | `/api/documents/review-queue` | Pending review |
| `GET /api/v1/records/documents/:id` | `/api/documents/:id` | Get |
| `GET /api/v1/records/documents/:id/audit` | `/api/documents/:id/audit` | Audit trail |
| `GET /api/v1/records/documents/:id/extraction` | `/api/documents/:id/extraction` | AI extraction data |
| `PUT /api/v1/records/documents/:id/extraction/:fieldId/correct` | `/api/documents/:id/extraction/:fieldId/correct` | Correct extraction |
| `POST /api/v1/records/documents/:id/review` | `/api/documents/:id/review` | Approve/reject |
| `GET /api/v1/records/documents/employee/:employeeId` | `/api/documents/employee/:employeeId` | By employee |
| **Hours** | | |
| `POST /api/v1/records/hours/clock-in` | `/api/hours/clock-in` | Clock in |
| `POST /api/v1/records/hours/clock-out` | `/api/hours/clock-out` | Clock out |
| `POST /api/v1/records/hours/manual` | `/api/hours/manual` | Manual entry |
| `GET /api/v1/records/hours/employee/:id` | `/api/hours/employee/:id` | Get employee hours |
| `PUT /api/v1/records/hours/:id` | `/api/hours/:id` | Edit record |
| `DELETE /api/v1/records/hours/:id` | `/api/hours/:id` | Soft-delete |
| `GET /api/v1/records/hours/:id/audit` | `/api/hours/:id/audit` | Audit trail |
| `POST /api/v1/records/hours/import/payroll` | `/api/hours/import/payroll` | Payroll import |
| `POST /api/v1/records/hours/import/scheduling` | `/api/hours/import/scheduling` | Job-ticket sync |
| `POST /api/v1/records/hours/calendar/sync` | `/api/hours/calendar/sync` | Calendar sync |
| `GET /api/v1/records/hours/conflicts` | `/api/hours/conflicts` | List conflicts |
| `POST /api/v1/records/hours/conflicts/:id/resolve` | `/api/hours/conflicts/:id/resolve` | Resolve conflict |

**Rationale:**
- Documents + Hours both involve ingestion, review, and conflict resolution
- Shared operational concerns: storage, AI processing, audit trails
- Future: extraction workers and job-ticket reconciliation belong here
- 21 endpoints under one operational boundary

---

#### **Reference Data Service** → `/api/v1/reference/*`

| New Path | Current Path | Notes |
|----------|--------------|-------|
| **Standards** | | |
| `POST /api/v1/reference/standards` | `/api/standards` | Create |
| `GET /api/v1/reference/standards` | `/api/standards` | List |
| `GET /api/v1/reference/standards/:id` | `/api/standards/:id` | Get |
| `PUT /api/v1/reference/standards/:id` | `/api/standards/:id` | Update |
| `POST /api/v1/reference/standards/:id/requirements` | `/api/standards/:id/requirements` | Create requirement |
| `GET /api/v1/reference/standards/:id/requirements` | `/api/standards/:id/requirements` | List requirements |
| `PUT /api/v1/reference/standards/requirements/:reqId` | `/api/standards/requirements/:reqId` | Update requirement |
| **Labels** | | |
| `POST /api/v1/reference/labels/admin` | `/api/labels/admin` | Create label |
| `PUT /api/v1/reference/labels/admin/:id` | `/api/labels/admin/:id` | Update label |
| `POST /api/v1/reference/labels/admin/:id/deprecate` | `/api/labels/admin/:id/deprecate` | Deprecate |
| `GET /api/v1/reference/labels/versions` | `/api/labels/versions` | List versions |
| `POST /api/v1/reference/labels/mappings` | `/api/labels/mappings` | Create mapping |
| `GET /api/v1/reference/labels/resolve` | `/api/labels/resolve` | Resolve label |
| `GET /api/v1/reference/labels/audit/:id` | `/api/labels/audit/:id` | Audit trail |

**Rationale:**
- Standards + Labels are read-mostly reference data curated by admins
- Both support taxonomy and requirement catalogs
- Future: Can be extracted early as a standalone service
- 14 endpoints under reference boundary

---

#### **Notification Service** → `/api/v1/notifications/*`

| New Path | Current Path | Notes |
|----------|--------------|-------|
| `GET /api/v1/notifications` | `/api/notifications` | List |
| `PUT /api/v1/notifications/:id/read` | `/api/notifications/:id/read` | Mark read |
| `DELETE /api/v1/notifications/:id` | `/api/notifications/:id` | Dismiss |
| `GET /api/v1/notifications/preferences` | `/api/notifications/preferences` | Get preferences |
| `POST /api/v1/notifications/preferences` | `/api/notifications/preferences` | Set preferences |
| `GET /api/v1/notifications/digest/weekly` | `/api/notifications/digest/weekly` | Weekly digest |
| `POST /api/v1/notifications/admin/test` | `/api/notifications/admin/test` | Send test |
| `POST /api/v1/notifications/admin/escalation-rules` | `/api/notifications/admin/escalation-rules` | Create rule |
| `GET /api/v1/notifications/admin/escalation-rules` | `/api/notifications/admin/escalation-rules` | List rules |

**Rationale:**
- Notification routes already well-organized; straightforward prefix addition
- Future: event-driven notification generation after service extraction
- 9 endpoints remain grouped together

---

#### **Platform Service** → `/api/v1/platform/*`

| New Path | Current Path | Notes |
|----------|--------------|-------|
| `GET /api/v1/platform/feature-flags` | `/api/v1/platform/feature-flags` | **Already v1 ✓** |

Future additions:
- `GET /api/v1/platform/health` → comprehensive health check
- `GET /api/v1/platform/version` → API version info
- `GET /api/v1/platform/admin/*` → system admin endpoints

**Rationale:**
- Platform module already follows the v1 pattern
- Will host cross-cutting operational endpoints

---

### 3.2 Summary: Route Migration Map

| Service Group | Old Prefix | New Prefix | Endpoints | Complexity |
|---------------|------------|------------|-----------|------------|
| **Identity Platform** | `/api/auth` | `/api/v1/auth` | 5 | Low |
| **Workforce Core** | `/api/employees` | `/api/v1/workforce/employees` | 6 | Low |
| **Compliance Service** | `/api/{qualifications,medical,templates,assignments,fulfillments}` | `/api/v1/compliance/*` | 37 | High (consolidation) |
| **Records Service** | `/api/{documents,hours}` | `/api/v1/records/*` | 21 | Medium |
| **Reference Data** | `/api/{standards,labels}` | `/api/v1/reference/*` | 14 | Low |
| **Notifications** | `/api/notifications` | `/api/v1/notifications` | 10 | Low |
| **Platform** | `/api/v1/platform` | `/api/v1/platform` | 1 | None (already done) |
| **TOTAL** | — | — | **94** | — |

---

## 4. Migration Strategy

### 4.1 Phased Dual-Mount Approach

**Phase 0: Preparation** (Sprint 4, v0.5.0)
- [ ] Document this spec and get team buy-in
- [ ] Create v1 router factory in `apps/api/src/routes/v1/`
- [ ] Update shared types to include version constants
- [ ] Add integration tests for dual-route scenarios

**Phase 1: Non-Breaking Addition** (Sprint 5, v0.6.0)
- [ ] Mount all v1 routes **in parallel** with existing routes
- [ ] Both `/api/auth/login` and `/api/v1/auth/login` work identically
- [ ] No existing clients break
- [ ] Update API documentation to show v1 routes as **preferred**
- [ ] Frontend continues using old routes (no changes yet)

**Phase 2: Client Migration** (Sprint 6-7, v0.7.0)
- [ ] Update `apps/web` API client to use v1 routes
- [ ] Add deprecation warnings to unversioned routes (via middleware)
- [ ] Monitor usage with audit logs to identify external clients
- [ ] Communicate migration timeline to stakeholders

**Phase 3: Deprecation** (Sprint 8+, v0.8.0+)
- [ ] Add HTTP 301 redirects from old routes to v1 routes
- [ ] Log deprecation warnings for 2 sprints
- [ ] Remove old route mounts after confirming zero usage

**Phase 4: Service Extraction** (Future, v1.0.0+)
- [ ] Extract reference data service as first candidate
- [ ] Extract notification service as worker + API pair
- [ ] Compliance and Records remain co-located longer

---

### 4.2 Implementation Pattern: Dual Mount with Shared Handlers

```typescript
// apps/api/src/routes/v1/index.ts
import { Router } from "express";
import { authRouter } from "../../modules/auth";
import { employeesRouter } from "../../modules/employees";
// ... other routers

export function createV1Router(): Router {
  const v1Router = Router();

  // Identity
  v1Router.use("/auth", authRouter);

  // Workforce
  v1Router.use("/workforce/employees", employeesRouter);

  // Compliance (consolidate 4 mount points)
  v1Router.use("/compliance/qualifications", qualificationsRouter);
  v1Router.use("/compliance/medical", medicalRouter);
  v1Router.use("/compliance/templates", templatesRouter);
  v1Router.use("/compliance/assignments", assignmentsRouter);
  v1Router.use("/compliance/fulfillments", fulfillmentsRouter);

  // Records
  v1Router.use("/records/documents", documentsRouter);
  v1Router.use("/records/hours", hoursRouter);

  // Reference
  v1Router.use("/reference/standards", standardsRouter);
  v1Router.use("/reference/labels", labelsRouter);

  // Notifications
  v1Router.use("/notifications", notificationsRouter);

  // Platform (already mounted at v1)
  v1Router.use("/platform", platformRouter);

  return v1Router;
}
```

```typescript
// apps/api/src/index.ts (updated)
import { createV1Router } from "./routes/v1";

// Existing routes (unchanged during Phase 1)
app.use("/api/auth", authRouter);
app.use("/api/employees", employeesRouter);
// ... all existing mounts

// NEW: v1 routes (dual-mount)
app.use("/api/v1", createV1Router());
```

**Key Points:**
- **Same router instances** used for both old and v1 paths (no code duplication)
- **No breaking changes** to existing modules
- **Middleware stack identical** for both paths
- **Audit logs distinguish** between v1 and legacy paths

---

### 4.3 Deprecation Middleware

```typescript
// apps/api/src/middleware/deprecation.ts
import { Request, Response, NextFunction } from "express";
import { logger } from "../common/utils";

export function deprecationWarning(newPath: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const warningMessage = `DEPRECATED: ${req.path} — Use ${newPath} instead`;
    
    // Log to monitoring
    logger.warn("Deprecated API usage", {
      oldPath: req.path,
      newPath,
      userId: req.user?.id,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });

    // Set response header (visible to clients)
    res.set("X-API-Deprecation-Warning", warningMessage);
    res.set("X-API-Deprecation-Date", "2026-06-01"); // 3 months after v1 launch
    res.set("Sunset", "Mon, 01 Jun 2026 00:00:00 GMT"); // RFC 8594

    next();
  };
}
```

Apply during Phase 2:
```typescript
// Apply to old routes only
app.use("/api/auth", deprecationWarning("/api/v1/auth"), authRouter);
app.use("/api/employees", deprecationWarning("/api/v1/workforce/employees"), employeesRouter);
// ... etc
```

---

### 4.4 Redirect Strategy (Phase 3)

```typescript
// apps/api/src/middleware/redirect.ts
import { Request, Response, NextFunction } from "express";

export function permanentRedirect(newPath: (req: Request) => string) {
  return (req: Request, res: Response, _next: NextFunction) => {
    const target = newPath(req);
    res.redirect(301, target);
  };
}
```

Example:
```typescript
app.use("/api/auth/*", permanentRedirect(req => 
  req.path.replace("/api/auth", "/api/v1/auth")
));
```

---

## 5. Backward Compatibility Approach

### 5.1 Compatibility Guarantees

| Phase | Old Routes | v1 Routes | Client Impact |
|-------|------------|-----------|---------------|
| **Phase 1** | ✅ Fully functional | ✅ Fully functional | Zero impact |
| **Phase 2** | ⚠️ Functional + deprecation warnings | ✅ Recommended | Logs + headers only |
| **Phase 3** | 🔀 Redirect to v1 (301) | ✅ Standard | Clients auto-follow redirects |
| **Phase 4** | ❌ Removed | ✅ Only path | Breaking for unmigrated clients |

**Timeline:** 3-6 months between Phase 1 and Phase 4 (depending on client adoption)

---

### 5.2 Frontend Migration Path

**Current state:**
```typescript
// apps/web/src/lib/api.ts
const API_BASE = "/api";

export async function login(credentials: LoginRequest) {
  return fetch(`${API_BASE}/auth/login`, { ... });
}
```

**Migrated state (Phase 2):**
```typescript
const API_VERSION = "v1";
const API_BASE = `/api/${API_VERSION}`;

export async function login(credentials: LoginRequest) {
  return fetch(`${API_BASE}/auth/login`, { ... });
}
```

**Benefits of centralized API_BASE:**
- One-line change to migrate entire frontend
- Feature flag gating if needed: `API_VERSION = env.API_VERSION ?? "v1"`
- Easy rollback during incidents

---

### 5.3 Version Negotiation (Future Enhancement)

For v2+ migrations, consider content negotiation:

```http
GET /api/qualifications
Accept: application/vnd.eclat.v2+json
```

Response header:
```http
Content-Type: application/vnd.eclat.v2+json
X-API-Version: 2
```

**Not needed for v1 migration** (no breaking changes), but document for future.

---

## 6. Documentation for API Consumers

### 6.1 OpenAPI Spec Updates

**Current:** No OpenAPI spec exists

**Proposed:**
1. Generate OpenAPI 3.1 spec from Zod validators (`zod-to-openapi`)
2. Host at `/api/v1/docs` (Swagger UI)
3. Include deprecation notices in old route descriptions
4. Mark v1 routes with `"x-stable": true` tag

**Tools:**
- `@asteasolutions/zod-to-openapi` for schema generation
- `swagger-ui-express` for interactive docs
- CI pipeline to validate spec on PR

---

### 6.2 Migration Guide for External Clients

Create `docs/api-v1-migration-guide.md`:

```markdown
# API v1 Migration Guide

## Quick Start
Change your base URL from `/api` to `/api/v1`.

## Route Changes
| Old Route | New Route |
|-----------|-----------|
| POST /api/auth/login | POST /api/v1/auth/login |
| GET /api/employees | GET /api/v1/workforce/employees |
| ... | ... |

## Deprecation Timeline
- **2026-03-30:** v1 routes available (dual-mount)
- **2026-04-15:** Old routes show deprecation warnings
- **2026-05-15:** Old routes redirect to v1 (301)
- **2026-06-01:** Old routes removed

## Breaking Changes
None. All v1 routes behave identically to old routes.
```

---

## 7. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **External clients break during Phase 4** | High | Medium | 3-month deprecation period + redirect phase + usage monitoring |
| **Frontend breaks during v1 cutover** | High | Low | Comprehensive integration tests + feature flag gating + rollback plan |
| **Compliance namespace too broad** | Medium | Medium | Clear sub-grouping (qualifications/medical/templates) + future refinement allowed |
| **Performance regression from dual-mount** | Low | Low | Shared router instances (no duplication) + benchmark tests |
| **Route explosion as services extract** | Medium | High | Namespace design allows incremental extraction without further breaking changes |
| **Documentation drift** | Medium | High | Auto-generated OpenAPI spec + CI validation + mandatory docs updates |

---

## 8. Open Questions

1. **Should we version health and auth endpoints?**
   - ✅ **Recommendation:** Yes for consistency, but `/health` (no prefix) remains unversioned for load balancers

2. **How do we handle WebSocket routes (future)?**
   - ✅ **Recommendation:** `/api/v1/ws/{group}` namespace when WebSockets are added

3. **Should we split templates further (templates vs assignments vs fulfillments)?**
   - ✅ **Recommendation:** Keep under `/api/v1/compliance/*` with clear sub-paths; consolidation is the goal

4. **Do we need API keys or client ID tracking?**
   - ⚠️ **Needs discussion:** Not in MVP, but add `X-Client-ID` optional header for future tracking

5. **What happens to employee assignments dual-mount at `/api/employees/:id/assignments`?**
   - ✅ **Recommendation:** Unified under `/api/v1/workforce/employees/:id/assignments` (workforce owns employee views)

6. **Should we enforce versioning in middleware (reject `/api/*` after Phase 4)?**
   - ✅ **Recommendation:** Yes, return `410 Gone` with migration guide link

---

## 9. Success Criteria

- [ ] All 94 endpoints successfully dual-mounted at v1 paths
- [ ] Zero failing tests after v1 routes added
- [ ] Frontend migration requires ≤ 5 lines changed (centralized base URL)
- [ ] Deprecation warnings logged for all old route usage
- [ ] OpenAPI spec generated and hosted at `/api/v1/docs`
- [ ] External client migration guide published
- [ ] Usage monitoring dashboard shows v1 adoption > 95% before Phase 4

---

## 10. Next Steps

### Immediate (Sprint 4)
1. **Get stakeholder buy-in** on this spec
2. **Create backlog issues** for Phase 1 implementation:
   - [SA-06-1] Create v1 router factory and dual-mount infrastructure
   - [SA-06-2] Add deprecation middleware and logging
   - [SA-06-3] Generate OpenAPI spec from Zod validators
   - [SA-06-4] Write integration tests for dual-mount scenarios
3. **Update `docs/specs/service-architecture-spec.md`** to reference this namespace design

### Phase 1 (Sprint 5)
1. Implement v1 router factory
2. Dual-mount all routes
3. Add integration tests
4. Update API documentation

### Phase 2 (Sprint 6-7)
1. Migrate frontend to v1 routes
2. Add deprecation warnings to old routes
3. Monitor usage and communicate timeline

---

## 11. Appendices

### A. Full Route Inventory

See section 3.1 for complete mapping of all 94 routes.

### B. Router Code Examples

See section 4.2 for implementation patterns.

### C. Related Decisions

- **Service Architecture Spec:** [docs/specs/service-architecture-spec.md](./service-architecture-spec.md)
- **Feature Flags Spec:** [docs/specs/feature-flags-spec.md](./feature-flags-spec.md)
- **Squad Decision on Service Groupings:** `.squad/decisions/inbox/daniels-service-architecture.md`

---

**End of Spike Document**
