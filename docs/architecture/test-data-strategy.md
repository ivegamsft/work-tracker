# Test Data Seeding Strategy for E-CLAT

> **Author:** Freamon (Lead/Architect)  
> **Status:** Final — integrated with Entra auth architecture  
> **Date:** 2026-03-16  
> **Scope:** Design reproducible test data strategy across local dev, CI/CD, and deployed environments

---

## Executive Summary

Test data in E-CLAT has two independent layers: **Entra directory data** (test users, groups, app roles) and **application data** (PostgreSQL: employees, qualifications, standards, medical clearances). These layers exist in three environments with different constraints:

| Environment | Auth | DB | Strategy |
|-------------|------|----|----|
| **Local dev (Docker)** | Mock (no Entra) | Ephemeral Postgres | Prisma seed script only |
| **CI/CD** | Mock (no Entra) | Ephemeral Postgres | Prisma seed script only |
| **Deployed (dev/staging)** | Real Entra ID | Real Postgres | Terraform (Entra) + API bootstrap (DB) |

**Recommendation:** Use a **layered approach**:
1. **Prisma seed script** (`data/src/seed.ts`) — application data for local + CI/CD
2. **Terraform `05-identity` layer** — Entra directory data (test users, groups, app roles) for deployed environments
3. **Bootstrap API endpoint** (Phase 2+) — optional convenience for staging environments

---

## 1. Problem Analysis

### 1.1 Two Data Layers with Different Lifecycles

#### Layer 1: Entra Directory Data (Identity Plane)
- **What:** Test users, security groups, app role assignments
- **Where created:** Entra ID tenant
- **Who needs it:** Real Entra deployments only (dev/staging/prod)
- **Lifecycle:** Created once, persists across app redeployments
- **Constraints:** Cannot mock locally without Entra tenant; requires Graph API or az CLI

#### Layer 2: Application Data (Data Plane)
- **What:** Employees, qualifications, standards, medical clearances, labels, audit logs
- **Where created:** PostgreSQL via Prisma
- **Who needs it:** All environments (local, CI/CD, deployed)
- **Lifecycle:** Ephemeral in CI/CD; persistent in dev/staging, can be reset
- **Constraints:** Must idempotently coexist with production data; must respect app schema

### 1.2 Three Environment Contexts

**Local Development (Docker Compose)**
- No Entra tenant access — uses `AUTH_MODE=mock`
- Mock token validator produces tokens with hardcoded test users
- Prisma seed runs on `npm run seed` or Docker Compose startup
- Test data IDs must match mock token claims (`oid`, `email`)

**CI/CD Pipeline**
- Ephemeral Postgres spun up for each test run
- No Entra access — uses `AUTH_MODE=mock`
- Tests expect reproducible seed state
- Fast teardown required (avoid expensive migrations)

**Deployed Environments (Azure)**
- Real Entra ID tenant with real test users
- Real PostgreSQL with persistent data
- Terraform manages Entra resources; App handles DB
- Seed idempotency critical — running twice must be safe

### 1.3 Constraints and Requirements

| Requirement | Rationale |
|-------------|-----------|
| **No test data in production** | Regulatory/audit trail integrity; must prevent accidental leakage |
| **Idempotency** | Safe to run multiple times; enables re-seeding without manual cleanup |
| **Integration with Entra auth design** | Test users must match app role assignments; claim structure must align |
| **Local-first DX** | Developers should not need Azure subscriptions to run tests locally |
| **Terraform-managed identity** | App registrations, groups, test users all via IaC; no portal clicks |
| **Minimal secrets in code** | Test user passwords only in Entra; API never stores test credentials |

---

## 2. Recommended Design

### 2.1 Approach: Three-Tier Strategy

#### Tier 1: Prisma Seed Script (Application Data — All Environments)

**File:** `data/src/seed.ts` (already exists; enhance it)

**When to use:**
- Local Docker Compose: `npm run seed`
- CI/CD: `npm run seed` during test setup
- Deployed environments: Run manually after DB provisioning (one-time)

**What it does:**
- Upserts 5 test employees (employee, supervisor, manager, compliance officer, admin)
- Upserts 3 compliance standards (FAA-147-RT, OSHA-30-GI, HAZCOM-1910)
- Upserts 3 labels (AIRFRAME, POWERPLANT, SAFETY)
- Creates qualifications and medical clearances linked to test employees
- Idempotent: uses `upsert` where key collisions possible

**Constraints & Notes:**
- Test employee **emails must match** mock token `email` claims in local/CI
- In deployed Entra mode, test employee emails must match real Entra test user emails
- No passwords stored (local mock auth has hardcoded tokens; Entra owns real passwords)
- Audit logs created automatically by API; not seeded

**Connection Strategy:**
- Local: Prisma uses `DATABASE_URL` from `.env` or Docker `postgres` service
- CI: Prisma uses ephemeral `DATABASE_URL` set by test setup
- Deployed: Prisma uses `DATABASE_URL` from Key Vault (via `DefaultAzureCredential`)

#### Tier 2: Terraform `05-identity` Layer (Entra Directory Data — Deployed Only)

**Filesystem:**
```
infra/layers/05-identity/
  ├── main.tf          (root module: app registrations, scopes, roles, groups)
  ├── test-users.tf    (test user resources; optional, can live in main.tf)
  ├── variables.tf     (env-specific inputs)
  ├── outputs.tf       (exported app IDs, group IDs for downstream use)
  └── terraform.tfvars (generated from env config; see bootstrap)
```

**What it creates (Entra side):**
1. **5 Security Groups** (one per E-CLAT role)
   - `eclat-{env}-employees`
   - `eclat-{env}-supervisors`
   - `eclat-{env}-managers`
   - `eclat-{env}-compliance-officers`
   - `eclat-{env}-admins`

2. **Test Users** (5 users, each in a corresponding group)
   - Email: `eclat-test-employee@{tenant}.onmicrosoft.com`
   - Email: `eclat-test-supervisor@{tenant}.onmicrosoft.com`
   - Email: `eclat-test-manager@{tenant}.onmicrosoft.com`
   - Email: `eclat-test-compliance@{tenant}.onmicrosoft.com`
   - Email: `eclat-test-admin@{tenant}.onmicrosoft.com`
   - Password: Randomized + stored in Key Vault (not in code)

3. **Group → App Role Assignment**
   - Each group assigned to one of 5 app roles on the API app registration
   - App role assignment via `azuread_app_role_assignment`

**When to use:**
- Terraform workflow for dev/staging environments only
- Run once per new environment; idempotent (Terraform state manages updates)
- `terraform apply -target=azuread_user.test_* ` can re-seed users if needed

**Execution:**
```bash
# Deploy 05-identity layer
cd infra/layers/05-identity
terraform init -backend-config="key=identity.tfstate"
terraform plan -var-file="../../environments/dev.tfvars"
terraform apply -var-file="../../environments/dev.tfvars"
```

**Idempotency Notes:**
- Terraform resource IDs are deterministic (based on email, group name)
- User passwords are randomized; old passwords discarded
- Group membership idempotent: re-apply is safe
- Group ↔ App Role assignment idempotent

#### Tier 3: Bootstrap API Endpoint (Optional — Deployed Environments, Phase 2+)

**Purpose:** Convenience for manual staging resets; not required for MVP.

**Endpoint:** `POST /api/admin/seed-test-data` (admin-only)

**When to use:**
- Staging environment: reset test data to known state without re-running Terraform
- Not for local dev (Prisma seed is simpler)
- Not for CI (ephemeral DB; no need to reset)
- Not for production (must be disabled via feature flag)

**What it does:**
- Calls Prisma seed logic (reuse Tier 1 script)
- Returns count of upserted records

**Example Endpoint:**
```typescript
// apps/api/src/modules/admin/router.ts
router.post('/seed-test-data', requireMinRole('admin'), async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Seeding disabled in production' });
  }
  const result = await seedTestData(prisma);
  res.json({ seeded: result });
});
```

**Security:**
- Admin-only endpoint
- Requires real Entra token (cannot seed in mock auth mode)
- Logged via audit system
- Feature-flagged: disabled in production via `NODE_ENV` check

---

## 3. Integration with Entra Auth Architecture

### 3.1 Token Claims Alignment

**Local/CI Mode (`AUTH_MODE=mock`):**
- Mock validator produces hardcoded tokens for each test user
- Token claims: `email`, `oid` (UUID), `tid` (tenant ID), `roles`, `groups`
- **Prisma seed must use same email addresses** to create employees with matching IDs

**Deployed Mode (`AUTH_MODE=entra`):**
- Entra issues real tokens for test users created by Terraform
- Token claims: real Entra user object ID, real group IDs, real app role assignments
- **Terraform test users must have email addresses that match Prisma seed**

**Critical Requirement:**
Test employee **email addresses must be identical** across:
- `data/src/seed.ts` (Prisma employeeSeeds)
- `infra/layers/05-identity/test-users.tf` (Entra users)
- Mock token validator (if creating mock tokens)

### 3.2 Example Data Mapping

```typescript
// Prisma seed (works in all environments)
const employeeSeeds = [
  {
    email: "eclat-test-employee@example.onmicrosoft.com",
    role: Role.EMPLOYEE,
    // ...
  },
  // ...
];

// Terraform (Entra, deployed only)
resource "azuread_user" "test_employee" {
  user_principal_name = "eclat-test-employee@example.onmicrosoft.com"
  display_name        = "Test Employee"
  password           = random_password.test_user_passwords["employee"].result
  // ...
}

resource "azuread_group_member" "test_employee_group" {
  group_object_id  = azuread_group.employees.object_id
  member_object_id = azuread_user.test_employee.object_id
}

// Mock validator (local, uses hardcoded claims)
function generateMockToken(role: 'employee' | 'supervisor' | ...) {
  return {
    iss: 'https://login.microsoftonline.com/...',
    aud: 'api://eclat-api-dev/...',
    email: 'eclat-test-employee@example.onmicrosoft.com',
    oid: uuidv5('eclat-test-employee@example.onmicrosoft.com', NAMESPACE),
    roles: ['Employee'],  // matches app role from Entra
    // ...
  };
}
```

---

## 4. File & Directory Layout

```
work-tracker/
├── data/
│   ├── src/
│   │   ├── seed.ts              ← Enhanced with test data for all environments
│   │   └── seed-config.ts       ← Centralized test data constants (emails, names, etc.)
│   └── package.json             (already has Prisma + seed script)
│
├── infra/
│   ├── layers/
│   │   └── 05-identity/         ← NEW: Entra directory layer
│   │       ├── main.tf
│   │       ├── test-users.tf
│   │       ├── variables.tf
│   │       ├── outputs.tf
│   │       └── terraform.tfvars (env-specific, generated)
│   │
│   └── modules/
│       ├── identity/            ← NEW: Module for app regs, groups, roles
│       │   ├── main.tf
│       │   ├── variables.tf
│       │   └── outputs.tf
│       └── identity-test-users/ ← Optional: Encapsulate user creation
│           ├── main.tf
│           ├── variables.tf
│           └── outputs.tf
│
├── scripts/
│   ├── seed-test-data.sh        ← NEW: Convenience script (calls npm run seed)
│   └── terraform-apply.sh       ← Existing; will invoke 05-identity
│
├── .github/
│   └── workflows/
│       ├── seed-test-data.yml   ← Optional: Dispatch workflow to seed staging
│       └── ci.yml               (existing; calls npm run seed in test setup)
│
└── docs/
    ├── architecture/
    │   ├── entra-auth-design.md (existing, auth flow)
    │   └── test-data-strategy.md (this file)
    └── guides/
        └── test-data-management.md ← NEW: Operational guide
```

---

## 5. Execution Runbook

### 5.1 Local Development

```bash
# Start stack with test data
cd work-tracker
docker-compose up

# Postgres starts; Node app runs npm install + npm run seed automatically
# → Creates 5 test employees + standards + labels in local Postgres
# → Mock auth validator produces tokens for these users

# Or, seed a running stack manually
npm run seed
```

### 5.2 CI/CD Test Setup

```bash
# In GitHub Actions workflow (ci.yml)
- name: Seed test database
  run: |
    npm ci --workspace=data
    npm run seed --workspace=data
```

### 5.3 Deployed Environment (dev/staging)

**First-time deployment (after Postgres provisioned):**

```bash
# 1. Deploy 05-identity layer (Entra test users + groups)
cd infra/layers/05-identity
terraform init -backend-config="key=identity.tfstate"
terraform apply -var-file="../../environments/dev.tfvars"
# → Creates test users, groups, app role assignments in Entra

# 2. Seed application database (PostgreSQL)
# Option A: Direct Prisma seed (if you have direct DB access)
npm run seed --workspace=data

# Option B: Via deployed API endpoint (Phase 2+, requires admin token)
curl -X POST https://api-dev.eclat.example.com/api/admin/seed-test-data \
  -H "Authorization: Bearer $(az account get-access-token --resource api://eclat-api-dev --query accessToken -o tsv)" \
  -H "Content-Type: application/json"

# Option C: Via GitHub Actions dispatch workflow (see 5.4)
```

**Re-seed after environment reset:**

```bash
# Re-create Entra test users + groups
cd infra/layers/05-identity
terraform apply -var-file="../../environments/dev.tfvars"

# Re-seed PostgreSQL via API endpoint
curl -X POST https://api-dev.eclat.example.com/api/admin/seed-test-data ...
```

### 5.4 GitHub Actions Dispatch Workflow (Optional — Phase 2+)

**File:** `.github/workflows/seed-test-data.yml`

```yaml
name: Seed Test Data

on:
  workflow_dispatch:
    inputs:
      environment:
        description: "Target environment"
        required: true
        type: choice
        options: [dev, staging]

jobs:
  seed:
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Azure Login
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
      
      - name: Seed Database
        run: |
          # Call API endpoint or run Prisma seed against deployed DB
          az container exec \
            --resource-group eclat-${{ github.event.inputs.environment }} \
            --name api \
            --command "/bin/sh -c 'npm run seed --workspace=data'"
```

---

## 6. Idempotency & Safety Guarantees

### 6.1 Prisma Seed Idempotency

All Prisma seed operations use `upsert`:

```typescript
await prisma.employee.upsert({
  where: { email: employee.email },  // ← Unique key
  update: { /* refresh data */ },
  create: { /* create if new */ }
});
```

**Guarantees:**
- Running seed twice = idempotent (second run updates, doesn't duplicate)
- Safe to run against persistent database
- Safe to add new test data without deleting old data (only overwrites matching emails)

### 6.2 Terraform Idempotency

Terraform state file manages Entra resource creation:

```hcl
resource "azuread_user" "test_employee" {
  user_principal_name = "eclat-test-employee@example.onmicrosoft.com"
  # ...
}
```

**Guarantees:**
- `terraform apply` idempotent; re-apply is safe
- State file prevents duplicate user creation
- Changing user attributes (display name, etc.) works on re-apply
- User passwords are regenerated and stored in Key Vault on each apply

### 6.3 Production Safety

**Entra layer:**
- `05-identity` layer includes variable `enable_test_users` (default: `false`)
- Production Terraform includes `enable_test_users = false`
- No test users created in production

**Database layer:**
- Prisma seed includes check: `if (NODE_ENV === 'production') { throw new Error(...) }`
- API admin endpoint checks `NODE_ENV` before seeding
- Test data marked in database (optional: add `isTestData` flag to Employee model)

---

## 7. Execution Table (Quick Reference)

| Scenario | Command | Layer | Output |
|----------|---------|-------|--------|
| **Local dev: First start** | `docker-compose up` | Prisma | 5 employees + standards in local Postgres |
| **Local dev: Reseed** | `npm run seed` | Prisma | Updates existing test data |
| **Local tests** | `npm test` | Prisma (setup) | Ephemeral Postgres + seeded data |
| **Deployed dev: First time** | `terraform apply` (05-identity) + `npm run seed` | Terraform + Prisma | Entra users + DB employees |
| **Deployed staging: Reseed** | `curl POST /api/admin/seed-test-data` | API endpoint | Refreshes DB (Entra unchanged) |
| **Deployed staging: Full reset** | `terraform apply` + API endpoint | Terraform + Prisma | Recreates Entra users + DB |

---

## 8. Future Enhancements (Phase 2+)

1. **Bootstrap API endpoint** — Expose `POST /api/admin/seed-test-data` for convenience resets in staging
2. **GitHub Actions workflow** — Dispatch workflow to trigger seeding without direct Terraform access
3. **Test data markers** — Add `isTestData` flag to Employee model for audit filtering
4. **Entra test user rotation** — Automated periodic password rotation for security
5. **Seeded state snapshots** — Export/import database snapshots for consistent CI testing
6. **Data anonymization** — Tools to sanitize production data for safe use in lower environments

---

## 9. Dependencies & Prerequisites

### 9.1 For Local Development
- Docker Compose (pulls Postgres image)
- npm workspace setup (already configured)
- Node.js 18+ with TypeScript support

### 9.2 For CI/CD
- GitHub Actions with `ubuntu-latest` runner
- npm workspace access (repo checkout)
- No Azure/Entra access required

### 9.3 For Deployed Environments
- Azure CLI (`az`) for Terraform + admin access
- Terraform 1.0+ with `azurerm` and `azuread` providers
- Service Principal with permissions: `Application.ReadWrite.OwnedBy`, `Group.ReadWrite.All`
- Key Vault access for test user password storage
- PostgreSQL connection string in Key Vault

---

## 10. Migration Checklist

To implement this strategy:

- [ ] Enhance `data/src/seed.ts` with comprehensive test data constants
- [ ] Create `infra/layers/05-identity/` with Terraform for Entra resources
- [ ] Extract test data emails/names to `data/src/seed-config.ts` (single source of truth)
- [ ] Update Docker Compose to run `npm run seed` on startup (already done?)
- [ ] Add safety check to Prisma seed: prevent running in production
- [ ] Document test user credentials in team wiki (not in code)
- [ ] Test Terraform layer against dev environment
- [ ] Test Prisma seed against fresh Postgres instance
- [ ] Test local Docker Compose stack end-to-end
- [ ] (Optional Phase 2) Implement `POST /api/admin/seed-test-data` endpoint
- [ ] (Optional Phase 2) Create GitHub Actions dispatch workflow

---

## 11. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| Test data leaks into production | Low | Critical | IaC controls + `NODE_ENV` checks + variable validation |
| Entra test users not matching Prisma seed | Medium | High | Single source of truth (`seed-config.ts`) + tests to validate alignment |
| Forgotten to disable seeding in production | Low | Critical | Default `enable_test_users = false` + automated checks in CI |
| Terraform state collision (multiple devs applying) | Low | Medium | Use unique Terraform state keys per environment + state locking |
| Prisma migration failures block seeding | Medium | Medium | Explicit migration step before seed; separate CI stages |

