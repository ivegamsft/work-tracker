# Multi-Tenant Architecture Specification — E-CLAT

> **Status:** Proposed Architecture Spec  
> **Owner:** Freamon (Lead / Architect)  
> **Date:** 2026-03-21  
> **Applies To:** `apps/api`, `data/prisma`, `infra/layers`  
> **Issue:** #105 (MultiTenant-01)  
> **Related Docs:** `docs/specs/identity-architecture.md`, `docs/specs/service-architecture-spec.md`, `docs/specs/data-layer-architecture.md`

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Tiered Isolation Model](#2-tiered-isolation-model)
3. [Tenant Hierarchy (L0→L1→L2→L3)](#3-tenant-hierarchy-l0l1l2l3)
4. [Modular Monolith with Independent Versioning](#4-modular-monolith-with-independent-versioning)
5. [Ring-Based Deployment](#5-ring-based-deployment)
6. [Tenant-Aware Connection Resolver](#6-tenant-aware-connection-resolver)
7. [Group-Based Mapping + Claim-Driven Assignment](#7-group-based-mapping--claim-driven-assignment)
8. [Environment Cloning for Test/Dev](#8-environment-cloning-for-testdev)
9. [Data Model Changes](#9-data-model-changes)
10. [API Contracts](#10-api-contracts)
11. [Security & Data Isolation](#11-security--data-isolation)
12. [Phased Rollout Plan](#12-phased-rollout-plan)
13. [Locked Decisions](#13-locked-decisions)

---

## 1. Problem Statement

E-CLAT is currently single-tenant (one instance = one organization). Scaling to multi-tenant requires:

1. **Tiered isolation:** Some tenants (SMB) share infrastructure; others (enterprise) get dedicated resources
2. **Nested environments:** Prod, staging, dev per tenant; plus shared reference data
3. **Module independence:** Each module (auth, qualifications, etc.) versioned separately; feature flags control rollout
4. **Ring deployment:** Canary → Beta → Stable rings; different tenants adopt at different speeds
5. **Data isolation:** Tenant A cannot see Tenant B's data; environment isolation adds another layer
6. **Identity claim mapping:** Auto-assign users to groups + templates based on IdP claims (e.g., department from Entra ID)

**Objective:** Design a multi-tenant architecture supporting both shared (SaaS) and dedicated (enterprise) deployments, with nested environments, independent module versioning, and ring-based deployment.

---

## 2. Tiered Isolation Model

### 2.1 Tenant Tiers

| Tier | Name | Data Model | Compute | Use Case | Cost |
|------|------|-----------|---------|----------|------|
| **Shared** | SMB SaaS | Rows in shared DB | Shared API + Postgres | Startup, small team | $99–$299/mo |
| **Dedicated** | Enterprise | Dedicated Postgres DB | Dedicated Container App | Fortune 500, healthcare, fintech | Custom pricing |

### 2.2 Pricing Tier → Deployment Architecture

**Shared (SaaS):**
```
┌─────────────────────────────────┐
│  E-CLAT SaaS Tenant 1           │ (row-level isolation)
├─────────────────────────────────┤
│  E-CLAT SaaS Tenant 2           │ (row-level isolation)
├─────────────────────────────────┤
│  E-CLAT SaaS Tenant 3           │ (row-level isolation)
└─────────────────────────────────┘
         ↓
  ┌─────────────┐
  │ Shared DB   │ (Postgres)
  │ tenantId    │ (indexed)
  │ indexed on  │
  │ all queries │
  └─────────────┘
```

**Dedicated (Enterprise):**
```
┌────────────────────────┐
│ Acme Corp Tenant       │
│ (Private DB instance)  │
└────────────────────────┘
         ↓
  ┌─────────────────────────────┐
  │ Acme Private DB             │
  │ (Azure SQL Managed Instance)│
  │ Zero row-level filtering    │
  │ (all data is Acme's)        │
  └─────────────────────────────┘
```

### 2.3 Isolation Enforcement

**Shared tier:**
- Every query filters by `tenantId` (enforced at service layer)
- No query returns cross-tenant data
- Foreign keys prevent cross-tenant references
- Composite indexes on (tenantId, otherField) for performance

**Dedicated tier:**
- Separate Postgres instance per enterprise tenant
- Connection string includes tenant-specific host
- No row-level filtering needed (all data belongs to tenant)
- Can remove tenantId filtering in future (separate codepath)

---

## 3. Tenant Hierarchy (L0→L1→L2→L3)

### 3.1 Nesting Levels

```
┌──────────────────────────────────────────────────────┐
│ L0: Platform (System level)                          │
│ - Master Tenant (E-CLAT infrastructure)              │
│ - Billing, licensing, audit logs, feature flags      │
└──────────────────────────────────────────────────────┘
             ↓
┌──────────────────────────────────────────────────────┐
│ L1: Tenant (Organization level)                      │
│ - Acme Corp                                          │
│ - ABAC controls, IdP config, role definitions        │
└──────────────────────────────────────────────────────┘
    ↓           ↓            ↓
┌─────────┐ ┌─────────┐ ┌─────────┐
│ L2: Env │ │ L2: Env │ │ L2: Env │
│ Prod    │ │ Staging │ │ Dev     │
│         │ │         │ │         │
└─────────┘ └─────────┘ └─────────┘
    ↓
┌──────────────────────────────────────┐
│ L3: Workspace (Team level)           │
│ - Engineering, Finance, HR           │
│ - Team-scoped templates, overrides   │
└──────────────────────────────────────┘
```

### 3.2 Data Scoping Rules

| Level | Owns | Shared With | Examples |
|-------|------|------------|----------|
| **L0** | Feature flags, billing, platform audit | All tenants | Canary ring control, SLA metrics |
| **L1** | Tenant config, IdP, users, roles | All environments within tenant | Compliance standards, org policies |
| **L2** | Environment config, data isolation | Cannot cross (prod/staging separate) | Production qualifications vs test data |
| **L3** | Workspace data, team templates | Within environment only | Dept-specific overrides, group templates |

### 3.3 Example Data Path

**Query:** "Get all employees in Finance dept, Prod env, Acme Corp"

```
Filter stack:
1. tenantId = acme_corp_id
2. environmentId = prod_env_id
3. workspaceId = finance_workspace_id

Result: Only Finance employees in Acme Prod environment
Cross-checks prevent:
- Getting Acme Staging data (different env)
- Getting OtherCorp data (different tenant)
- Getting non-Finance employees (workspace scope)
```

---

## 4. Modular Monolith with Independent Versioning

### 4.1 Module Versions

Each module has independent `version` + `releaseChannel`:

```
Module: qualifications
├── v0.5.0
│   ├── releaseChannel: STABLE
│   ├── features: basic attestation (L1-L4)
│   └── deployedTo: [prod-ring-stable, staging-ring-beta]
│
├── v0.6.0-rc1
│   ├── releaseChannel: BETA
│   ├── features: basic + customization layering
│   └── deployedTo: [staging-ring-beta, prod-ring-canary]
│
└── v0.7.0-dev
    ├── releaseChannel: CANARY
    ├── features: + exemption workflows
    └── deployedTo: [dev-env, prod-ring-canary]

Module: templates
├── v0.4.0
│   ├── releaseChannel: STABLE
│   ├── features: CRUD, L1-L4 validation
│   └── deployedTo: [prod-ring-stable, staging-ring-beta]
│
└── v0.5.0
    ├── releaseChannel: BETA
    ├── features: + industry catalog, versioning
    └── deployedTo: [staging-ring-beta]
```

### 4.2 Feature Flags (DB-Backed)

**Feature flags live in DB; evaluated per-request:**

```
FeatureFlag {
  id: 'qualifications:customization-layer'
  enabled: true
  rolloutPercentage: 30  // 30% of users see new feature
  targetTenants: ['acme_corp', 'beta_test_org']  // Explicit opt-in
  releaseChannel: BETA
}

Evaluation in code:
if (featureFlags.isEnabled('qualifications:customization-layer', req.tenant.id)) {
  // Use new customization endpoint
} else {
  // Use legacy endpoint
}
```

### 4.3 Ring-Based Deployment

**Same code, different feature flag settings per ring:**

```
Deployment: "qualifications v0.6.0"

1. Code deploys to shared infrastructure (all rings)
2. Feature flags control visibility per ring:

   Canary Ring (5% prod traffic):
   ├── NEW features enabled (customization layer, exemptions)
   ├── All modules at latest version
   ├── Early detection of bugs
   └── Auto-rollback if error rate > threshold

   Beta Ring (20% prod traffic):
   ├── BETA features enabled (proven safe from canary)
   ├── Mix of stable + beta module versions
   ├── 24-hour dwell time after canary success
   └── Explicit tenant opt-in for features

   Stable Ring (75% prod traffic):
   ├── Only STABLE features enabled
   ├── All modules at LTS versions
   ├── No breaking changes
   └── Default for all new signups
```

---

## 5. Tenant-Aware Connection Resolver

### 5.1 Connection Strategy

**At app startup, resolve tenant → connection:**

```typescript
// apps/api/src/config/tenant-resolver.ts

export async function resolveTenantConnection(tenantId: string): Promise<PrismaClient> {
  const tenantConfig = await getTenantConfig(tenantId);
  
  if (tenantConfig.tier === 'SHARED') {
    // Return shared Prisma client; queries will include tenantId filter
    return sharedPrismaClient;
  } else if (tenantConfig.tier === 'DEDICATED') {
    // Resolve dedicated connection from Key Vault
    const dbHost = await keyVault.getSecret(`tenant-${tenantId}-db-host`);
    const dbPassword = await keyVault.getSecret(`tenant-${tenantId}-db-password`);
    
    return new PrismaClient({
      datasources: {
        db: {
          url: `postgresql://admin:${dbPassword}@${dbHost}:5432/eclat`,
        },
      },
    });
  }
}

// Middleware: Attach client to request
app.use(async (req, res, next) => {
  if (req.tenant?.id) {
    req.db = await resolveTenantConnection(req.tenant.id);
  }
  next();
});

// Service layer uses tenant-specific client
export async function getEmployee(tenantId, employeeId) {
  const db = await resolveTenantConnection(tenantId);
  return db.employee.findUnique({
    where: { id: employeeId },
    // Shared tier: implicit tenantId filter via data layer
    // Dedicated tier: all data belongs to tenant (filter included for safety)
  });
}
```

### 5.2 Cache Strategy

**Connection pool warmth matters:**

```
// Warm up dedicated connections on tenant load
onTenantCreated(async (tenantId) => {
  // Trigger lazy connection creation
  const client = await resolveTenantConnection(tenantId);
  // Keep pool warm; auto-close on idle timeout
});

// Shared tier: Single connection pool (always warm)
// Dedicated tier: Per-tenant pools; auto-create on first request
```

---

## 6. Group-Based Mapping + Claim-Driven Assignment

### 6.1 Group-to-Template Mapping

**Admin defines: "If department = 'Finance', auto-assign these templates"**

```
GroupTemplateMapping {
  id: 'mapping-finance-compliance'
  tenantId
  groupId: 'finance_department'
  templates: [
    'SOC2-audit-training',
    'Financial-reporting-policy',
    'AML-compliance'
  ]
  source: 'MANUAL' | 'INDUSTRY_PROFILE' | 'AI_RECOMMENDED'
}
```

### 6.2 Claim-Driven Auto-Assignment from IdP

**SCIM or IdP claims: "John's department = 'Finance'"**

```
1. User logs in via Entra ID
2. Token claims include: department='Finance'
3. System looks up GroupMapping where idpClaimPath='department' && claimValue='Finance'
4. Gets groupId='finance_department'
5. Auto-assigns all templates from GroupTemplateMapping
6. User sees Finance compliance templates on dashboard
```

**Config:**

```
IdPClaimGroupMapping {
  tenantId
  idpId: 'entra_config'
  claimPath: 'department'  // Path in JWT: claims.department
  claimValue: 'Finance'
  mappedGroupId: 'finance_department'
}
```

---

## 7. Environment Cloning for Test/Dev

### 7.1 Environment Cloning Workflow

**Admin: "Clone Prod environment to Staging for testing"**

```
1. Admin clicks: "Clone Prod → Staging"
2. System:
   - Copies all qualifications, templates, standards (but reset status→DRAFT)
   - Copies employee + team structure
   - Zeroes expiry dates (extends 12 months)
   - Resets all overrides (no exemptions in test env)
   - Copies feature flags
   - Creates new environment record (staging_env)
3. Result:
   - Staging has identical data structure to Prod
   - All employees get test accounts (prefixed @staging.eclat)
   - No real PII duplicated
   - Ready for compliance testing
```

### 7.2 Data Masking During Clone

**PII handling:**

```
Prod Profile (real data):
├── email: john@acme.com
├── firstName: John
└── lastName: Doe

Staging Profile (cloned):
├── email: john+staging@acme.com  (masked)
├── firstName: [Firstname-Masked]
└── lastName: [Lastname-Masked]

(Or: Full deletion of PII; use UUIDs only in staging)
```

### 7.3 Environment Modes

| Mode | Purpose | Data | Config | Access |
|------|---------|------|--------|--------|
| **Prod** | Live, real employees | Real PII, encrypted | Feature flags @ STABLE | Limited (RBAC) |
| **Staging** | Pre-prod testing | Masked/cloned PII | Feature flags @ BETA | Dev teams + QA |
| **Dev** | Local development | Fixtures + seeds | Feature flags @ CANARY + DEV | Developers |

---

## 8. Data Model Changes

### 8.1 New Tables

```prisma
model TenantTier {
  // Configuration: How is this tenant deployed?
  id                String    @id @default(uuid())
  tenantId          String
  tier              String    // SHARED | DEDICATED
  
  // For DEDICATED tier
  dbInstanceName    String?   // Azure SQL instance name
  containerAppName  String?   // Container App name
  
  maxUsers          Int?      // License limit
  maxEnvironments   Int?      // Environments limit (default: 3)
  features          String[]  @db.Text // JSON: enabled features
  
  billingPlan       String    // STARTER, PROFESSIONAL, ENTERPRISE
  billingCycle      String    // MONTHLY, ANNUAL
  
  createdAt         DateTime  @default(now())
  
  @@unique([tenantId])
  @@index([tier])
}

model Environment {
  // L2: Prod, Staging, Dev per tenant
  id                String    @id @default(uuid())
  tenantId          String
  
  name              String    // prod, staging, dev
  slug              String
  mode              String    // PRODUCTION, STAGING, DEVELOPMENT
  
  // Connection info (for dedicated tier)
  dbUri             String?   // Encrypted; resolved at runtime
  
  clonedFrom        String?   // env_id of source (if cloned)
  clonedAt          DateTime?
  
  featureFlags      FeatureFlag[] // Environment-specific overrides
  
  createdAt         DateTime  @default(now())
  
  @@unique([tenantId, slug])
  @@index([tenantId])
}

model Workspace {
  // L3: Teams, departments, cost centers
  id                String    @id @default(uuid())
  tenantId          String
  environmentId     String
  
  name              String    // Engineering, Finance, HR
  slug              String
  description       String?
  
  parentWorkspaceId String?   // Nested hierarchy
  
  createdAt         DateTime  @default(now())
  
  @@unique([environmentId, slug])
  @@index([tenantId, environmentId])
}

model FeatureFlag {
  id                String    @id @default(uuid())
  tenantId          String?   // NULL = platform-wide
  environmentId     String?   // NULL = all environments
  
  name              String    // 'qualifications:customization-layer'
  enabled           Boolean   @default(false)
  rolloutPercentage Int       @default(0)  // 0-100
  
  targetTenants     String[]  @db.Text // JSON: explicit opt-in
  releaseChannel    String    // STABLE, BETA, CANARY, DEV
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  @@index([name])
  @@index([tenantId])
  @@index([releaseChannel])
}

model IdPClaimGroupMapping {
  id                String    @id @default(uuid())
  tenantId          String
  
  idpId             String    // Reference to IdPConfig
  claimPath         String    // 'department', 'jobTitle', etc.
  claimValue        String    // 'Finance', 'Manager', etc.
  
  mappedGroupId     String    // EmployeeGroup to assign to
  mappedGroupName   String    // For audit trail
  
  createdAt         DateTime  @default(now())
  
  @@unique([tenantId, idpId, claimPath, claimValue])
  @@index([tenantId])
}

// MODIFY existing models to add environmentId
model Employee {
  // Add environment scoping
  id                String    @id
  tenantId          String
  environmentId     String    // NEW: which environment
  
  firstName         String
  lastName          String
  status            String
  
  @@unique([tenantId, environmentId, id])
  @@index([tenantId, environmentId])
}

model Qualification {
  // Add environment scoping
  id                String    @id
  tenantId          String
  environmentId     String    // NEW
  employeeId        String
  
  @@index([tenantId, environmentId])
}

// (Apply environmentId to ALL data models)
```

---

## 9. API Contracts

### 9.1 Tenant Tier Routes (Admin Only)

```
POST /api/v1/auth/tenant/tier
  Requires: ADMIN role
  Body: { tier: 'SHARED' | 'DEDICATED', maxUsers?, maxEnvironments? }
  Response: { tenantId, tier, billingPlan, features: [...] }

GET /api/v1/auth/tenant/tier
  Requires: ADMIN role
  Response: { id, tenantId, tier, maxUsers, features, billingPlan, ... }

PATCH /api/v1/auth/tenant/tier
  Requires: ADMIN role
  Body: { billingPlan?, features? }
  Response: { updated tier info }
```

### 9.2 Environment Routes

```
POST /api/v1/platform/environments
  Requires: ADMIN role
  Body: { name, slug, mode: 'PRODUCTION' | 'STAGING' | 'DEVELOPMENT' }
  Response: { id, tenantId, name, slug, mode, ... }

GET /api/v1/platform/environments
  Requires: ADMIN role
  Response: { environments: [...] }

POST /api/v1/platform/environments/:id/clone
  Requires: ADMIN role
  Body: { sourceId, maskPii: true | false }
  Response: { newEnvironmentId, cloneJobId, status: 'QUEUED' }

DELETE /api/v1/platform/environments/:id
  Requires: ADMIN role
  Cannot delete PRODUCTION
  Response: { ok: true }
```

### 9.3 Workspace Routes

```
POST /api/v1/platform/workspaces
  Requires: ADMIN role
  Body: { name, slug, environmentId, parentWorkspaceId? }
  Response: { id, tenantId, environmentId, name, ... }

GET /api/v1/platform/workspaces
  Query: { environmentId? }
  Response: { workspaces: [...] }

PATCH /api/v1/platform/workspaces/:id
  Requires: ADMIN role
  Body: { name?, parentWorkspaceId? }
  Response: { id, ... }
```

### 9.4 Feature Flag Routes

```
GET /api/v1/platform/feature-flags
  Requires: ADMIN role
  Response: { flags: [...] }

POST /api/v1/platform/feature-flags
  Requires: ADMIN role
  Body: { name, enabled, rolloutPercentage, releaseChannel }
  Response: { id, name, enabled, ... }

PATCH /api/v1/platform/feature-flags/:id
  Requires: ADMIN role
  Body: { enabled?, rolloutPercentage?, targetTenants? }
  Response: { id, ... }
```

---

## 10. Security & Data Isolation

### 10.1 Tenant Boundary Enforcement

**Every service layer query enforces tenant scoping:**

```typescript
// BAD (cross-tenant leak):
await db.employee.findMany({ where: { status: 'ACTIVE' } });

// GOOD:
await db.employee.findMany({
  where: {
    tenantId: req.tenant.id,
    environmentId: req.environment.id,
    status: 'ACTIVE',
  },
});
```

### 10.2 Dedicated Tier: Separate DBs

- Enterprise tenant gets isolated Postgres instance
- Connection string from Key Vault (never in code)
- No row-level filtering needed (all data = tenant's data)
- Automatic failover + backups per instance

### 10.3 Shared Tier: Row-Level Isolation

- Single shared Postgres
- ALL queries must include `tenantId` filter
- Foreign keys prevent cross-tenant references
- Indexes on (tenantId, ...) for performance
- Audit logs every cross-tenant query attempt (security alert)

### 10.4 Environment Isolation

- Prod ≠ Staging ≠ Dev (separate isolation boundaries)
- Data cannot cross environments (different environment UUIDs)
- Feature flags + ring deployment prevent cross-environment code runs

---

## 11. Phased Rollout Plan

### 11.1 Sprint 5 (1 week): Schema + Tier Config
- [x] Add TenantTier, Environment, Workspace, FeatureFlag models
- [x] Add environmentId to all data tables
- [x] Create default environment per tenant
- **Deliverable:** Schema ready; single-env mode works

### 11.2 Sprint 6 (2 weeks): Multi-Environment + Cloning
- [x] Implement environment CRUD routes
- [x] Implement environment cloning (with PII masking)
- [x] Update all queries to scope by environmentId
- [x] Add environment-specific feature flags
- **Deliverable:** Multi-environment + cloning working

### 11.3 Sprint 7 (1 week): Tier Switching + Connection Resolver
- [x] Implement TenantTier routes
- [x] Implement connection resolver (shared vs dedicated)
- [x] Add Key Vault integration for dedicated DB URIs
- **Deliverable:** Dedicated-tier provisioning ready

### 11.4 Sprint 8 (1 week): Workspace + Group Mapping
- [x] Implement Workspace CRUD
- [x] Implement IdPClaimGroupMapping
- [x] Implement claim-driven template auto-assignment
- **Deliverable:** Group mapping + auto-assignment working

### 11.5 Sprint 9+ (Ongoing)
- [ ] Ring-based deployment orchestration
- [ ] Canary → Beta → Stable promotion pipeline
- [ ] Performance optimization (connection pooling, caching)
- [ ] Enterprise SLA monitoring + reporting

---

## 12. Locked Decisions

### 12.1 Decision #1: Tiered Isolation
- **Relevance:** Shared vs dedicated tiers; shared uses row-level filtering, dedicated uses separate DBs.
- **Implementation:** TenantTier model; connection resolver picks strategy per tier.

### 12.2 Decision #3: Modular Monolith
- **Relevance:** Independent module versioning + feature flags control deployment.
- **Implementation:** FeatureFlag DB model; ring-based flag values (STABLE, BETA, CANARY).

### 12.3 Decision #11: Logical Environments
- **Relevance:** Environments are rows; cheap to create (L2 nesting level).
- **Implementation:** Environment model; cloning workflow for test/dev setup.

### 12.4 Decision #8: Group Mapping + Claims
- **Relevance:** IdP claims drive group assignment; groups auto-assign templates.
- **Implementation:** IdPClaimGroupMapping; SCIM provisioning syncs group membership.

---

## Next Steps

1. **Sprint 5:** Implement schema + single-environment mode
2. **Sprint 6:** Implement multi-environment + cloning
3. **Sprint 7:** Implement tier switching + connection resolver
4. **Sprint 8:** Implement workspace + claim-driven assignment
5. **Sprint 9+:** Ring-based deployment + enterprise SLA

**Completion Target:** v0.5.0–v0.6.0 (full multi-tenant, dedicated + shared tiers, ring deployment ready)
