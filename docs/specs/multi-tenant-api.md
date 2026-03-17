# Multi-Tenant API — E-CLAT Platform

> **Status:** Specification  
> **Owner:** Bunk (Backend Dev)  
> **Created:** 2026-03-21  
> **Issue:** #106  
> **Applies To:** `apps/api` (all modules), `packages/shared/src/types`, `data/prisma/schema.prisma`  
> **Related Decisions:** Decision 1 (Tiered isolation), Decision 8 (Group mapping + claim-driven), Decision 11 (Logical environments)  
> **Companion Docs:** [Service Architecture](./service-architecture-spec.md) · [Identity API](./identity-api.md) · [RBAC API](./rbac-api-spec.md)

---

## 1. Problem Statement

E-CLAT must isolate data between customers (tenants) while supporting logical environments (dev/staging/prod per tenant):

1. **No tenant context** — Requests don't carry tenant ID; assumes single-tenant
2. **No environment abstraction** — Staging and prod share same database
3. **No connection pooling per tenant** — Cannot route to dedicated vs shared DB
4. **No group-to-role mapping** — Azure AD groups → E-CLAT roles hardcoded
5. **No claim-driven auto-assignment** — Templates cannot auto-assign based on Azure AD claims
6. **Cross-tenant data leak risk** — Queries don't filter by tenant; one query returns all orgs' data
7. **No dashboard for multi-tenant admins** — Tenant admin cannot see own tenant's health/metrics

**Impact:** Cannot scale to SaaS multi-tenant; security audit findings; no organizational isolation.

---

## 2. Solution Overview

Implement **true multi-tenancy with environment & group awareness**:

- **Tenant resolution** — Extract from JWT claims or request header
- **Tenant-aware middleware** — Attach to all requests; validate tenant membership
- **Environment CRUD** — Create/clone/configure logical environments (dev/staging/prod)
- **Connection resolver** — Route to shared vs dedicated DB per tenant/environment
- **Group management** — CRUD for Azure AD groups → E-CLAT role mappings
- **Claim-driven rules** — Templates auto-assign based on user claims (department, office, etc.)
- **Cross-environment dashboard** — Tenant admin views unified health across all environments

---

## 3. API Endpoints

### 3.1 Tenant Management (Admin only)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/v1/admin/tenants` | GET | List all tenants (super-admin) |
| `POST /api/v1/admin/tenants` | POST | Create tenant |
| `GET /api/v1/admin/tenants/:tenantId` | GET | Get tenant details |
| `PUT /api/v1/admin/tenants/:tenantId` | PUT | Update tenant config |
| `DELETE /api/v1/admin/tenants/:tenantId` | DELETE | Soft-delete tenant |

**`POST /api/v1/admin/tenants` (Create Tenant)**

```json
{
  "name": "ACME Corporation",
  "slug": "acme",
  "industry": "Construction",
  "billing_email": "billing@acme.example.com",
  "region": "us-east-1",
  "tier": "professional"
}
```

**Response:**

```json
{
  "id": "tenant_abc123",
  "name": "ACME Corporation",
  "slug": "acme",
  "status": "active",
  "created_at": "2026-03-21T10:30:45Z",
  "created_by": "super_admin_001",
  "region": "us-east-1",
  "tier": "professional",
  "features": {
    "template_library": true,
    "multi_idp": true,
    "advanced_reporting": false
  },
  "connection_strings": {
    "shared": "present",
    "dedicated": null
  }
}
```

### 3.2 Environment Management

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/v1/admin/tenants/:tenantId/environments` | GET | List environments |
| `POST /api/v1/admin/tenants/:tenantId/environments` | POST | Create environment |
| `GET /api/v1/admin/tenants/:tenantId/environments/:envId` | GET | Get environment config |
| `PATCH /api/v1/admin/tenants/:tenantId/environments/:envId` | PATCH | Update environment |
| `POST /api/v1/admin/tenants/:tenantId/environments/:envId/clone` | POST | Clone environment |
| `DELETE /api/v1/admin/tenants/:tenantId/environments/:envId` | DELETE | Delete environment |

**`POST /api/v1/admin/tenants/{tenantId}/environments` (Create Environment)**

```json
{
  "name": "Staging",
  "type": "staging",
  "connection_mode": "shared",
  "features": {
    "read_only": false,
    "auto_sync_from": "production",
    "data_sync_interval_hours": 24
  }
}
```

**Response:**

```json
{
  "id": "env_staging_001",
  "tenant_id": "tenant_abc123",
  "name": "Staging",
  "type": "staging",
  "connection_mode": "shared",
  "connection_string": "postgresql://...",
  "created_at": "2026-03-21T10:30:45Z",
  "features": {
    "read_only": false,
    "auto_sync_from": "production",
    "data_sync_interval_hours": 24
  }
}
```

**`POST /api/v1/admin/tenants/{tenantId}/environments/{envId}/clone` (Clone Prod to Staging)**

```json
{
  "source_env_id": "env_prod_001",
  "include_data": true,
  "anonymize_pii": true
}
```

**Response:**

```json
{
  "clone_job_id": "job_xyz789",
  "status": "in_progress",
  "estimated_completion": "2026-03-21T12:30:45Z"
}
```

### 3.3 Group Management & Role Mapping

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/v1/admin/tenants/:tenantId/groups` | GET | List groups |
| `POST /api/v1/admin/tenants/:tenantId/groups` | POST | Create group → role mapping |
| `PUT /api/v1/admin/tenants/:tenantId/groups/:groupId` | PUT | Update group mapping |
| `DELETE /api/v1/admin/tenants/:tenantId/groups/:groupId` | DELETE | Delete group |
| `POST /api/v1/admin/tenants/:tenantId/groups/:groupId/sync` | POST | Sync Azure AD group membership |

**`POST /api/v1/admin/tenants/{tenantId}/groups` (Map Azure AD Group to Role)**

```json
{
  "source_type": "azure_ad",
  "source_id": "group_engineers_aad_id",
  "source_name": "Engineers",
  "role": "MANAGER",
  "description": "All engineers get Manager role",
  "auto_provision": true
}
```

**Response:**

```json
{
  "id": "group_map_001",
  "tenant_id": "tenant_abc123",
  "source_type": "azure_ad",
  "source_id": "group_engineers_aad_id",
  "source_name": "Engineers",
  "role": "MANAGER",
  "auto_provision": true,
  "created_at": "2026-03-21T10:30:45Z",
  "last_synced_at": null,
  "member_count": 0
}
```

**`POST /api/v1/admin/tenants/{tenantId}/groups/{groupId}/sync`**

Response:

```json
{
  "sync_job_id": "sync_abc123",
  "status": "in_progress",
  "members_to_add": 12,
  "members_to_remove": 2
}
```

### 3.4 Claim-Driven Assignment Rules

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/v1/admin/tenants/:tenantId/assignment-rules` | GET | List rules |
| `POST /api/v1/admin/tenants/:tenantId/assignment-rules` | POST | Create rule |
| `PUT /api/v1/admin/tenants/:tenantId/assignment-rules/:ruleId` | PUT | Update rule |
| `DELETE /api/v1/admin/tenants/:tenantId/assignment-rules/:ruleId` | DELETE | Delete rule |

**`POST /api/v1/admin/tenants/{tenantId}/assignment-rules` (Auto-assign based on claim)**

```json
{
  "name": "Assign OSHA to Construction Workers",
  "template_id": "template_osha_001",
  "condition": {
    "claim_path": "department",
    "operator": "equals",
    "value": "Construction"
  },
  "due_date_offset_days": 30,
  "enabled": true
}
```

**Response:**

```json
{
  "id": "rule_001",
  "tenant_id": "tenant_abc123",
  "name": "Assign OSHA to Construction Workers",
  "template_id": "template_osha_001",
  "condition": {
    "claim_path": "department",
    "operator": "equals",
    "value": "Construction"
  },
  "due_date_offset_days": 30,
  "enabled": true,
  "created_at": "2026-03-21T10:30:45Z",
  "matched_employees": 45
}
```

### 3.5 Tenant User Invite & Provisioning

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/v1/admin/tenants/:tenantId/users` | GET | List users in tenant |
| `POST /api/v1/admin/tenants/:tenantId/users/invite` | POST | Invite users (bulk) |
| `GET /api/v1/admin/tenants/:tenantId/users/:userId` | GET | Get user in tenant context |

**`POST /api/v1/admin/tenants/{tenantId}/users/invite` (Bulk internal invites)**

```json
{
  "emails": ["alice@acme.com", "bob@acme.com"],
  "role": "EMPLOYEE",
  "invite_method": "internal",
  "expires_at": "2026-04-21T00:00:00Z",
  "notify": true
}
```

**Response:**

```json
{
  "tenant_id": "tenant_abc123",
  "invites_created": 2,
  "invites": [
    {
      "email": "alice@acme.com",
      "invite_code": "invite_abc123",
      "accept_url": "https://...",
      "expires_at": "2026-04-21T00:00:00Z"
    }
  ]
}
```

### 3.6 Cross-Tenant Admin Dashboard

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/v1/admin/dashboard` | GET | Admin dashboard metrics (all tenants) |
| `GET /api/v1/admin/tenants/:tenantId/dashboard` | GET | Tenant-specific dashboard |

**`GET /api/v1/admin/tenants/{tenantId}/dashboard`**

Response:

```json
{
  "tenant_id": "tenant_abc123",
  "name": "ACME Corporation",
  "status": "active",
  "metrics": {
    "total_users": 450,
    "active_users_30d": 380,
    "templates_published": 12,
    "compliance_score": 0.92,
    "proofs_pending_review": 23,
    "overdue_assignments": 8
  },
  "environments": {
    "production": {
      "user_count": 450,
      "health": "healthy",
      "api_p99_latency_ms": 125
    },
    "staging": {
      "user_count": 120,
      "health": "healthy",
      "api_p99_latency_ms": 110
    }
  },
  "recent_events": [
    {
      "timestamp": "2026-03-21T10:30:45Z",
      "event": "template_published",
      "actor": "user_001",
      "resource": "OSHA 10-Hour"
    }
  ]
}
```

---

## 4. Validation Schemas (Zod)

```typescript
// apps/api/src/config/tenancy.ts (new file)

import { z } from 'zod';

export const tenantIdSchema = z.string().uuid();

export const environmentTypeSchema = z.enum(['development', 'staging', 'production']);

export const connectionModeSchema = z.enum(['shared', 'dedicated']);

export const createTenantSchema = z.object({
  name: z.string().min(3).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  industry: z.string().optional(),
  billing_email: z.string().email(),
  region: z.enum(['us-east-1', 'eu-west-1', 'ap-southeast-1']),
  tier: z.enum(['starter', 'professional', 'enterprise']).default('professional'),
});

export const createEnvironmentSchema = z.object({
  name: z.string().min(1).max(100),
  type: environmentTypeSchema,
  connection_mode: connectionModeSchema,
  features: z.object({
    read_only: z.boolean().default(false),
    auto_sync_from: z.string().optional(),
    data_sync_interval_hours: z.number().int().positive().optional(),
  }).optional(),
});

export const groupMappingSchema = z.object({
  source_type: z.enum(['azure_ad', 'okta', 'ldap', 'custom']),
  source_id: z.string(),
  source_name: z.string(),
  role: z.enum(['EMPLOYEE', 'SUPERVISOR', 'MANAGER', 'COMPLIANCE_OFFICER', 'ADMIN']),
  description: z.string().optional(),
  auto_provision: z.boolean().default(true),
});

export const claimConditionSchema = z.object({
  claim_path: z.string(), // e.g., "department", "office", "cost_center"
  operator: z.enum(['equals', 'contains', 'starts_with', 'in']),
  value: z.union([z.string(), z.array(z.string())]),
});

export const assignmentRuleSchema = z.object({
  name: z.string().min(1).max(200),
  template_id: z.string().uuid(),
  condition: claimConditionSchema,
  due_date_offset_days: z.number().int().positive(),
  enabled: z.boolean().default(true),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type CreateEnvironmentInput = z.infer<typeof createEnvironmentSchema>;
export type GroupMappingInput = z.infer<typeof groupMappingSchema>;
export type AssignmentRuleInput = z.infer<typeof assignmentRuleSchema>;
```

---

## 5. Data Model Changes (Prisma)

```prisma
// data/prisma/schema.prisma

model Tenant {
  id              String   @id @default(uuid())
  name            String
  slug            String   @unique
  status          String   @default("active")
  
  industry        String?
  billingEmail    String
  region          String   // us-east-1, eu-west-1, etc.
  tier            String   @default("professional")
  
  // Feature flags per tier
  features        Json     @default("{}")
  
  // Connections
  sharedConnectionString String?
  dedicatedConnectionString String?
  
  createdAt       DateTime @default(now())
  createdBy       String?
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?
  
  // Relations
  environments    Environment[]
  groupMappings   GroupMapping[]
  assignmentRules AssignmentRule[]
  users           User[]
  
  @@index([status])
  @@index([slug])
}

model Environment {
  id              String   @id @default(uuid())
  tenantId        String
  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  name            String
  type            String   // development, staging, production
  
  connectionMode  String   @default("shared")
  connectionString String?
  
  features        Json     @default("{}")
  
  createdAt       DateTime @default(now())
  createdBy       String?
  updatedAt       DateTime @updatedAt
  
  syncJobsFrom    String?  // environment ID to auto-sync from
  lastSyncAt      DateTime?
  
  @@unique([tenantId, type])
  @@index([tenantId])
}

model GroupMapping {
  id              String   @id @default(uuid())
  tenantId        String
  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  sourceType      String   // azure_ad, okta, ldap, custom
  sourceId        String
  sourceName      String
  role            String   // EMPLOYEE, SUPERVISOR, ...
  
  description     String?
  autoProvision   Boolean  @default(true)
  
  createdAt       DateTime @default(now())
  lastSyncedAt    DateTime?
  memberCount     Int      @default(0)
  
  @@unique([tenantId, sourceId])
  @@index([tenantId, sourceType])
}

model AssignmentRule {
  id              String   @id @default(uuid())
  tenantId        String
  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  name            String
  templateId      String
  
  conditionClaimPath String
  conditionOperator  String  // equals, contains, starts_with, in
  conditionValue     String
  
  dueDateOffsetDays Int
  
  enabled         Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  lastEvaluatedAt DateTime?
  matchedCount    Int      @default(0)
  
  @@index([tenantId, enabled])
  @@index([templateId])
}

// Update User model to reference Tenant
model User {
  id              String   @id @default(uuid())
  tenantId        String
  tenant          Tenant   @relation(fields: [tenantId], references: [id])
  
  email           String
  givenName       String?
  familyName      String?
  
  role            String
  isActive        Boolean  @default(true)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?
  
  @@unique([tenantId, email])
  @@index([tenantId])
}
```

---

## 6. RBAC Rules

### 6.1 Tenant Admin Endpoints

| Endpoint | Role Required |
|----------|---|
| `GET /api/v1/admin/tenants` | Super-Admin only |
| `POST /api/v1/admin/tenants` | Super-Admin only |
| `GET /api/v1/admin/tenants/:tenantId/*` | Tenant Admin + Super-Admin |
| `POST /api/v1/admin/tenants/:tenantId/*` | Tenant Admin + Super-Admin |
| `PUT /api/v1/admin/tenants/:tenantId/*` | Tenant Admin + Super-Admin |

**Role Hierarchy (new):**

```
EMPLOYEE(0) 
  < SUPERVISOR(1) 
  < MANAGER(2) 
  < COMPLIANCE_OFFICER(3) 
  < ADMIN(4)
  < TENANT_ADMIN(5)
  < SUPER_ADMIN(6)
```

---

## 7. Tenant Middleware

```typescript
// apps/api/src/middleware/tenant.ts

import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError, ForbiddenError } from '@e-clat/shared';

export async function tenantMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // 1. Extract tenant from JWT claims or header
  const tenantIdFromClaims = req.user?.tenant_id; // from JWT
  const tenantIdFromHeader = req.headers['x-tenant-id'] as string;
  
  const tenantId = tenantIdFromClaims || tenantIdFromHeader;
  if (!tenantId) {
    return next(new UnauthorizedError('Missing tenant context'));
  }
  
  // 2. Validate tenant membership
  const user = req.user;
  if (user.tenant_id !== tenantId && user.role !== 'SUPER_ADMIN') {
    return next(new ForbiddenError('Access denied to this tenant'));
  }
  
  // 3. Load tenant config (features, environment, connection)
  req.tenant = {
    id: tenantId,
    // ... other tenant props
  };
  
  // 4. Set up database connection for this tenant/environment
  const environment = req.query.env || 'production';
  req.db = getConnectionForTenant(tenantId, environment);
  
  next();
}

export function requireTenantAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user.role < 5) { // TENANT_ADMIN = 5
    return next(new ForbiddenError('Tenant admin required'));
  }
  next();
}
```

---

## 8. Connection Resolver

```typescript
// apps/api/src/config/connection-resolver.ts

export async function getConnectionForTenant(
  tenantId: string,
  environment: string = 'production'
) {
  const env = await prisma.environment.findUnique({
    where: { tenantId_type: { tenantId, type: environment } },
  });
  
  if (!env) {
    throw new Error(`Environment ${environment} not found for tenant ${tenantId}`);
  }
  
  // Return connection string based on mode
  const connectionString = env.connectionString || 
    (env.connectionMode === 'shared' 
      ? process.env.DATABASE_URL 
      : process.env.DATABASE_DEDICATED_URL);
  
  return new PrismaClient({
    datasources: {
      db: { url: connectionString },
    },
  });
}
```

---

## 9. Error Responses

```json
{
  "error": {
    "code": "TENANCY_ERROR",
    "message": "Description",
    "details": {}
  }
}
```

| Scenario | HTTP Code | Error Code |
|----------|---|---|
| Tenant not found | 404 | `TENANT_NOT_FOUND` |
| Insufficient permissions | 403 | `TENANT_ADMIN_REQUIRED` |
| Environment not found | 404 | `ENVIRONMENT_NOT_FOUND` |
| Cross-tenant access | 403 | `CROSS_TENANT_DENIED` |
| Group sync failed | 500 | `GROUP_SYNC_FAILED` |

---

## 10. Phased Rollout

### Phase 1 (Sprint 5) — Tenant Foundations

- [ ] Create Tenant & Environment models
- [ ] Implement tenant middleware (JWT claim extraction)
- [ ] Tenant CRUD endpoints
- [ ] Environment CRUD (create, list)
- [ ] Connection resolver
- **Success Criteria:** Each request carries tenant context; queries filter by tenant

### Phase 2 (Sprint 6) — Groups & Auto-Provision

- [ ] GroupMapping model & CRUD endpoints
- [ ] Azure AD sync job (pull group membership)
- [ ] Group → role auto-provisioning
- [ ] Bulk user sync from Azure AD
- **Success Criteria:** Users provisioned from Azure AD groups, assigned correct roles

### Phase 3 (Sprint 7) — Claim-Driven Rules

- [ ] AssignmentRule model & CRUD
- [ ] Claim evaluation engine (evaluate conditions at login)
- [ ] Auto-assignment trigger on rule match
- [ ] Rule audit trail
- **Success Criteria:** User's claim triggers auto-assignment of appropriate template

### Phase 4 (Sprint 8) — Dashboard & Observability

- [ ] Tenant admin dashboard API
- [ ] Cross-environment health view
- [ ] Tenant-scoped metrics
- [ ] Environment cloning feature
- **Success Criteria:** Tenant admin can see unified health across dev/staging/prod

---

## 11. Acceptance Criteria

✅ **Phase 1 Acceptance:**

- [ ] Requests without tenant context rejected with 401
- [ ] Tenant context extracted from JWT claims
- [ ] All queries filtered by tenant_id automatically
- [ ] Zero cross-tenant data leakage
- [ ] Can create multiple environments per tenant

---

## 12. Compliance Notes

- **Data residency** — Tenant selection determines connection string; data stays in assigned region ✓
- **Multi-tenancy audit** — All operations logged per tenant; audit trail cannot be shared ✓
- **Environment isolation** — Dev/staging/prod completely separated at DB level ✓

---

## 13. Related Specs

- **Service Architecture:** `service-architecture-spec.md` (Decision 1, Decision 11)
- **Identity API:** `identity-api.md` (multi-IdP per tenant)
- **RBAC API:** `rbac-api-spec.md` (role enforcement with tenant context)

