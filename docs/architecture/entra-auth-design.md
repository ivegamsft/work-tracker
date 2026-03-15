# Entra ID Authentication Architecture for E-CLAT

> **Author:** Freamon (Lead/Architect)  
> **Status:** Draft — awaiting team review  
> **Date:** 2026-03-16  
> **Scope:** Replace mock JWT/bcrypt auth with Microsoft Entra ID across all layers

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Identity Architecture](#2-identity-architecture)
3. [Token Flows](#3-token-flows)
4. [Terraform Layer Design](#4-terraform-layer-design)
5. [Bootstrap Script Changes](#5-bootstrap-script-changes)
6. [Backend Auth Overhaul](#6-backend-auth-overhaul)
7. [Frontend Auth Overhaul](#7-frontend-auth-overhaul)
8. [Local Dev Mock Strategy](#8-local-dev-mock-strategy)
9. [Migration Path](#9-migration-path)
10. [Phased Implementation Plan](#10-phased-implementation-plan)

---

## 1. Design Principles

These principles are non-negotiable and flow from the existing security directives plus the user requirements:

| # | Principle | Rationale |
|---|-----------|-----------|
| P1 | **Entra is the sole identity provider** | No self-signed JWTs in production. All user authentication flows through Entra ID. |
| P2 | **Tokens validated, not re-signed** | The API validates Entra-issued access tokens directly. We do NOT exchange them for app-signed JWTs. This eliminates a trust boundary and aligns with Zero Trust. |
| P3 | **Mock auth is a compile-time strategy, not a runtime toggle** | `AUTH_MODE=mock` vs `AUTH_MODE=entra` selects which token validator runs. Mock mode produces tokens with the same claims structure as real Entra tokens. |
| P4 | **Managed identity everywhere** | API-to-database, API-to-Key Vault, API-to-Storage — all use `DefaultAzureCredential`. No connection strings leak into config. |
| P5 | **Entra groups ARE the RBAC source of truth** | The 5 existing roles map 1:1 to Entra security groups. Group membership claims in the token drive authorization decisions. |
| P6 | **IaC owns identity resources** | App registrations, groups, roles, and permissions are Terraform-managed. No portal click-ops. |
| P7 | **Additive migration** | New auth layers alongside old ones. Feature flag (`AUTH_MODE`) controls cutover. Old mock auth stays functional until team confirms parity. |

---

## 2. Identity Architecture

### 2.1 App Registrations

Four Entra app registrations are needed:

| App Registration | Purpose | Type | Token Config |
|------------------|---------|------|--------------|
| **eclat-api-{env}** | Backend API — exposes scopes, validates tokens | Web API | Access tokens: v2.0, `groupMembershipClaims: "SecurityGroup"` |
| **eclat-web-{env}** | Employee/manager SPA — acquires tokens | SPA | Auth Code + PKCE, no client secret |
| **eclat-admin-{env}** | Admin SPA — acquires tokens | SPA | Auth Code + PKCE, no client secret |
| **eclat-{env}-deploy** | Deployment SPN (exists) | Application | Client Credentials, needs expanded Graph permissions |

**Why separate web and admin app regs?**
- Different redirect URIs and consent scopes
- Admin app may require additional scopes (e.g., `Application.ReadWrite.OwnedBy`) for managing standards/taxonomy
- Independent revocation — compromised admin app reg doesn't affect employee access
- Aligns with existing `apps/web` / `apps/admin` split

### 2.2 OAuth 2.0 Scopes

The API app registration **exposes** custom scopes. The SPA app registrations **consume** them.

#### API-Exposed Scopes (on `eclat-api-{env}`)

| Scope | Description | Who Consumes |
|-------|-------------|--------------|
| `Employees.Read` | Read employee records | web, admin |
| `Employees.ReadWrite` | Create/update employee records | web, admin |
| `Qualifications.Read` | Read qualification data | web, admin |
| `Qualifications.ReadWrite` | Manage qualifications | web, admin |
| `Medical.Read` | Read medical clearances | web, admin |
| `Medical.ReadWrite` | Manage medical clearances | web, admin |
| `Standards.Read` | Read compliance standards | web, admin |
| `Standards.ReadWrite` | Manage compliance standards | admin |
| `Documents.Read` | Read documents | web, admin |
| `Documents.ReadWrite` | Upload/manage documents | web, admin |
| `Admin.Full` | Full administrative access | admin |

**Scope URI format:** `api://eclat-api-{env}/{scope}`

#### Permissions on SPA App Registrations

| SPA App | Required Scopes | Grant Type |
|---------|-----------------|------------|
| eclat-web-{env} | `Employees.Read`, `Employees.ReadWrite`, `Qualifications.Read`, `Qualifications.ReadWrite`, `Medical.Read`, `Medical.ReadWrite`, `Documents.Read`, `Documents.ReadWrite`, `Standards.Read` | Delegated (user consent) |
| eclat-admin-{env} | All API scopes including `Admin.Full`, `Standards.ReadWrite` | Delegated (admin consent) |

### 2.3 App Roles (on API Registration)

App roles enable role-based claims in the token. These map 1:1 to the existing E-CLAT roles:

| App Role Value | Display Name | Allowed Member Types |
|---------------|--------------|---------------------|
| `Employee` | Employee | Users/Groups |
| `Supervisor` | Supervisor | Users/Groups |
| `Manager` | Manager | Users/Groups |
| `ComplianceOfficer` | Compliance Officer | Users/Groups |
| `Admin` | Admin | Users/Groups |

**Why app roles AND groups?**
- App roles appear in the `roles` claim of the access token — no Graph call needed at request time
- Groups appear in the `groups` claim — useful for fine-grained authorization
- App roles are the primary authorization mechanism; groups are the assignment mechanism
- Assigning an Entra group to an app role means: "all members of this group get this role in the token"

### 2.4 Entra Security Groups

| Group Name | Assigned App Role | Maps to E-CLAT Role |
|------------|------------------|---------------------|
| `eclat-{env}-employees` | `Employee` | `employee` (level 0) |
| `eclat-{env}-supervisors` | `Supervisor` | `supervisor` (level 1) |
| `eclat-{env}-managers` | `Manager` | `manager` (level 2) |
| `eclat-{env}-compliance-officers` | `ComplianceOfficer` | `compliance_officer` (level 3) |
| `eclat-{env}-admins` | `Admin` | `admin` (level 4) |

**Group → App Role → Token `roles` claim → Middleware authorization**

This means the existing `requireRole()` and `requireMinRole()` middleware patterns survive unchanged — they just read from `roles` in the Entra token instead of from a self-signed JWT payload.

### 2.5 Role Claim Mapping

The mapping between Entra app role values and the internal `Role` type:

```typescript
// packages/shared/src/types/entra-roles.ts
import { Role, Roles } from './roles';

export const EntraAppRoleToRole: Record<string, Role> = {
  'Employee':          Roles.EMPLOYEE,
  'Supervisor':        Roles.SUPERVISOR,
  'Manager':           Roles.MANAGER,
  'ComplianceOfficer': Roles.COMPLIANCE_OFFICER,
  'Admin':             Roles.ADMIN,
};

export function mapEntraRolesToHighestRole(entraRoles: string[]): Role {
  // User may have multiple roles; return the highest-level one
  let highest: Role = Roles.EMPLOYEE;
  let highestLevel = 0;
  for (const er of entraRoles) {
    const mapped = EntraAppRoleToRole[er];
    if (mapped && RoleHierarchy[mapped] > highestLevel) {
      highest = mapped;
      highestLevel = RoleHierarchy[mapped];
    }
  }
  return highest;
}
```

---

## 3. Token Flows

### 3.1 User Authentication — Authorization Code + PKCE

This is the primary flow for both SPAs (web and admin).

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Browser  │     │  Entra ID    │     │  E-CLAT API  │     │  PostgreSQL  │
│  (SPA)    │     │  (IdP)       │     │  (Express)   │     │              │
└─────┬─────┘     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
      │                  │                    │                    │
      │  1. Login click  │                    │                    │
      │─────────────────>│                    │                    │
      │  (Auth Code+PKCE │                    │                    │
      │   to /authorize) │                    │                    │
      │                  │                    │                    │
      │  2. User authn   │                    │                    │
      │<─────────────────│                    │                    │
      │  (redirect with  │                    │                    │
      │   auth code)     │                    │                    │
      │                  │                    │                    │
      │  3. Exchange code│                    │                    │
      │─────────────────>│                    │                    │
      │  (code + verifier│                    │                    │
      │   to /token)     │                    │                    │
      │                  │                    │                    │
      │  4. Tokens       │                    │                    │
      │<─────────────────│                    │                    │
      │  (access_token,  │                    │                    │
      │   refresh_token, │                    │                    │
      │   id_token)      │                    │                    │
      │                  │                    │                    │
      │  5. API call with Bearer token        │                    │
      │──────────────────────────────────────>│                    │
      │                  │                    │                    │
      │                  │   6. Validate token│                    │
      │                  │   (JWKS from Entra)│                    │
      │                  │<───────────────────│                    │
      │                  │───────────────────>│                    │
      │                  │                    │                    │
      │                  │                    │  7. DB query       │
      │                  │                    │  (managed identity)│
      │                  │                    │───────────────────>│
      │                  │                    │<───────────────────│
      │                  │                    │                    │
      │  8. API response │                    │                    │
      │<──────────────────────────────────────│                    │
```

**Key points:**
- MSAL.js handles steps 1–4 entirely in the browser (no backend involvement)
- The API never sees user credentials — only the Entra-signed access token
- Token validation uses Entra's JWKS endpoint (public keys), cached in-process
- The `roles` claim in the access token drives authorization

### 3.2 On-Behalf-Of (OBO) Flow

For when the API needs to call downstream services **as the user** (e.g., Microsoft Graph for user profile sync, or future APIM-fronted microservices).

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Browser  │     │  E-CLAT API  │     │  Entra ID    │     │  Downstream  │
│  (SPA)    │     │  (Express)   │     │  (IdP)       │     │  Service     │
└─────┬─────┘     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
      │                  │                    │                    │
      │  1. API call     │                    │                    │
      │  (Bearer token)  │                    │                    │
      │─────────────────>│                    │                    │
      │                  │                    │                    │
      │                  │  2. OBO exchange   │                    │
      │                  │  (user's token +   │                    │
      │                  │   API's credential)│                    │
      │                  │───────────────────>│                    │
      │                  │                    │                    │
      │                  │  3. New token for  │                    │
      │                  │  downstream scope  │                    │
      │                  │<───────────────────│                    │
      │                  │                    │                    │
      │                  │  4. Call downstream│                    │
      │                  │  with new token    │                    │
      │                  │────────────────────────────────────────>│
      │                  │<────────────────────────────────────────│
      │                  │                    │                    │
      │  5. Response     │                    │                    │
      │<─────────────────│                    │                    │
```

**OBO use cases in E-CLAT:**
- **User profile sync:** API calls Microsoft Graph (`User.Read`) to populate employee records from Entra directory
- **Future APIM integration:** API-to-API calls through Azure API Management
- **Document storage operations:** If storage access needs user-level audit trails

**OBO requirements:**
- The API app registration needs a client secret or certificate (stored in Key Vault)
- The API app must have `User.Read` delegated permission pre-consented
- OBO tokens are cached per-user per-scope (use `@azure/msal-node` `ConfidentialClientApplication`)

### 3.3 Client Credentials Flow (Service-to-Service)

For background jobs, scheduled tasks, or system-level operations that don't have a user context.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Background  │     │  Entra ID    │     │  E-CLAT API  │
│  Job / SPN   │     │  (IdP)       │     │  (Express)   │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │  1. Request token  │                    │
       │  (client creds)    │                    │
       │───────────────────>│                    │
       │                    │                    │
       │  2. App-only token │                    │
       │<───────────────────│                    │
       │                    │                    │
       │  3. API call with app token            │
       │───────────────────────────────────────>│
       │                    │                    │
       │                    │  4. Validate: check│
       │                    │  `roles` claim for │
       │                    │  app role (not user)│
       │                    │                    │
```

**Client credentials use cases:**
- Notification batch processing (system sends compliance alerts)
- Scheduled compliance status recalculation
- Audit log archival
- Future: integration with external systems

---

## 4. Terraform Layer Design

### 4.1 Decision: New `05-identity` Layer

**Recommendation:** Create a new `infra/layers/05-identity` layer between foundation and data.

**Why not in foundation?**
- Foundation owns Azure platform primitives (RG, Key Vault, ACR, networking)
- Identity resources are Entra ID (Azure AD) resources — different API provider (`azuread` vs `azurerm`)
- Identity has its own lifecycle: app registrations change when auth requirements change, not when infrastructure scales
- Foundation is already the most loaded layer; adding 15+ Entra resources would make it unwieldy
- The deployment SPN needs `Application.ReadWrite.All` to create app regs — this permission should be scoped to the identity layer, not granted to all foundation changes

**Why between foundation and data?**
- Data layer doesn't depend on identity (database auth is managed identity, not app regs)
- Compute layer DOES depend on identity (needs API app registration client ID and scopes for env vars)
- Identity depends on foundation (puts secrets in Key Vault)

**Updated deployment order:**
```
bootstrap/01-tf-state-storage.sh
bootstrap/02-entra-spns.sh          ← updated: expanded permissions
bootstrap/03-gh-oidc.sh
infra/layers/00-foundation           ← unchanged
infra/layers/05-identity             ← NEW: app regs, groups, roles, scopes
infra/layers/10-data                 ← unchanged
infra/layers/20-compute              ← reads identity outputs for env config
```

### 4.2 Terraform Resources in `05-identity`

```hcl
# infra/layers/05-identity/main.tf (conceptual)

# ── API App Registration ──────────────────────────────────────────
resource "azuread_application" "api" {
  display_name = "eclat-api-${var.environment}"
  identifier_uris = ["api://eclat-api-${var.environment}"]
  
  # v2.0 tokens with group claims
  group_membership_claims = ["SecurityGroup"]
  
  # Exposed API scopes
  api {
    oauth2_permission_scope { value = "Employees.Read"          ... }
    oauth2_permission_scope { value = "Employees.ReadWrite"     ... }
    oauth2_permission_scope { value = "Qualifications.Read"     ... }
    oauth2_permission_scope { value = "Qualifications.ReadWrite"... }
    oauth2_permission_scope { value = "Medical.Read"            ... }
    oauth2_permission_scope { value = "Medical.ReadWrite"       ... }
    oauth2_permission_scope { value = "Standards.Read"          ... }
    oauth2_permission_scope { value = "Standards.ReadWrite"     ... }
    oauth2_permission_scope { value = "Documents.Read"          ... }
    oauth2_permission_scope { value = "Documents.ReadWrite"     ... }
    oauth2_permission_scope { value = "Admin.Full"              ... }
  }
  
  # App roles (appear in token `roles` claim)
  app_role { value = "Employee"          display_name = "Employee"           ... }
  app_role { value = "Supervisor"        display_name = "Supervisor"         ... }
  app_role { value = "Manager"           display_name = "Manager"            ... }
  app_role { value = "ComplianceOfficer" display_name = "Compliance Officer" ... }
  app_role { value = "Admin"             display_name = "Admin"              ... }
}

resource "azuread_service_principal" "api" {
  client_id = azuread_application.api.client_id
  app_role_assignment_required = true  # Users must be assigned a role
}

resource "azuread_application_password" "api" {
  application_id = azuread_application.api.id
  display_name   = "eclat-api-${var.environment}-secret"
}

# Store API client secret in Key Vault
resource "azurerm_key_vault_secret" "api_client_secret" {
  name         = "entra-api-client-secret"
  value        = azuread_application_password.api.value
  key_vault_id = data.terraform_remote_state.foundation.outputs.key_vault_id
}

# ── Web SPA App Registration ─────────────────────────────────────
resource "azuread_application" "web" {
  display_name = "eclat-web-${var.environment}"
  
  single_page_application {
    redirect_uris = [
      "http://localhost:5173/auth/callback",
      "https://${var.web_hostname}/auth/callback",
    ]
  }
  
  required_resource_access {
    resource_app_id = azuread_application.api.client_id
    # Delegated scopes for employee/manager workflows
    resource_access { id = <scope_ids> type = "Scope" }
  }
}

resource "azuread_service_principal" "web" {
  client_id = azuread_application.web.client_id
}

# ── Admin SPA App Registration ────────────────────────────────────
resource "azuread_application" "admin" {
  display_name = "eclat-admin-${var.environment}"
  
  single_page_application {
    redirect_uris = [
      "http://localhost:5174/auth/callback",
      "https://${var.admin_hostname}/auth/callback",
    ]
  }
  
  required_resource_access {
    resource_app_id = azuread_application.api.client_id
    # All scopes including Admin.Full
    resource_access { id = <scope_ids> type = "Scope" }
  }
}

resource "azuread_service_principal" "admin" {
  client_id = azuread_application.admin.client_id
}

# ── Security Groups ───────────────────────────────────────────────
resource "azuread_group" "roles" {
  for_each     = toset(["employees", "supervisors", "managers", "compliance-officers", "admins"])
  display_name = "eclat-${var.environment}-${each.key}"
  security_enabled = true
}

# ── Group → App Role Assignments ──────────────────────────────────
resource "azuread_app_role_assignment" "group_roles" {
  for_each = {
    employees           = { group = "employees",           role = "Employee" }
    supervisors         = { group = "supervisors",         role = "Supervisor" }
    managers            = { group = "managers",            role = "Manager" }
    compliance_officers = { group = "compliance-officers", role = "ComplianceOfficer" }
    admins              = { group = "admins",              role = "Admin" }
  }
  
  principal_object_id = azuread_group.roles[each.value.group].object_id
  resource_object_id  = azuread_service_principal.api.object_id
  app_role_id         = <lookup from app_role>
}
```

### 4.3 Remote State Dependencies

```
05-identity reads FROM:
  ├── 00-foundation.key_vault_id        (to store API client secret)
  └── 00-foundation.key_vault_uri       (for secret reference)

05-identity exports TO 20-compute:
  ├── api_client_id                     (Application/Client ID of API app reg)
  ├── api_tenant_id                     (Entra tenant ID)
  ├── web_client_id                     (Web SPA client ID — for CORS/audience validation)
  ├── admin_client_id                   (Admin SPA client ID)
  ├── api_client_secret_name            (Key Vault secret name for OBO flow)
  ├── api_scope_uri                     (api://eclat-api-{env})
  └── group_ids                         (map of role name → group object ID)

20-compute passes to Container App env:
  ├── AZURE_TENANT_ID                   = identity.api_tenant_id
  ├── AZURE_CLIENT_ID                   = identity.api_client_id
  ├── ENTRA_API_CLIENT_SECRET_NAME      = identity.api_client_secret_name
  ├── ENTRA_API_SCOPE_URI               = identity.api_scope_uri
  └── AUTH_MODE                         = "entra" (or "mock" for dev)
```

### 4.4 Terraform Provider Requirements

```hcl
# 05-identity needs both providers
terraform {
  required_providers {
    azuread = {
      source  = "hashicorp/azuread"
      version = "~> 2.47"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.85"
    }
  }
}
```

---

## 5. Bootstrap Script Changes

### 5.1 Current State

`bootstrap/02-entra-spns.sh` creates `eclat-{env}-deploy` SPNs with `Contributor` role on the subscription. These SPNs currently only run Terraform for Azure resources (`azurerm` provider).

### 5.2 Required Changes

The deployment SPN needs additional Microsoft Graph API permissions to manage Entra resources in the `05-identity` layer:

| Permission | Type | Purpose |
|------------|------|---------|
| `Application.ReadWrite.All` | Application | Create and manage app registrations |
| `Group.ReadWrite.All` | Application | Create and manage security groups |
| `AppRoleAssignment.ReadWrite.All` | Application | Assign groups to app roles |
| `DelegatedPermissionGrant.ReadWrite.All` | Application | Pre-consent API permissions for SPAs |

### 5.3 Updated Script: `02-entra-spns.sh`

Add a section after SPN creation that grants Graph API permissions:

```bash
# ── Grant Microsoft Graph permissions for identity management ──
GRAPH_APP_ID="00000003-0000-0000-c000-000000000000"  # Microsoft Graph

# Required application permissions
PERMISSIONS=(
  "1bfefb4e-e0b5-418b-a88f-73c46d2cc8e9"  # Application.ReadWrite.All
  "62a82d76-70ea-41e2-9197-370581804d09"  # Group.ReadWrite.All
  "06b708a9-e830-4db3-a914-8e69da51d44f"  # AppRoleAssignment.ReadWrite.All
  "8e8e4742-1d95-4f68-9d56-6ee75648c72a"  # DelegatedPermissionGrant.ReadWrite.All
)

for PERM_ID in "${PERMISSIONS[@]}"; do
  az ad app permission add \
    --id "$APP_ID" \
    --api "$GRAPH_APP_ID" \
    --api-permissions "${PERM_ID}=Role"
done

# Grant admin consent (requires Global Admin or Privileged Role Admin)
az ad app permission admin-consent --id "$APP_ID"
```

### 5.4 Security Considerations

⚠️ **`Application.ReadWrite.All` is a high-privilege permission.** Mitigations:

1. **Scope to owned apps only if possible:** Consider `Application.ReadWrite.OwnedBy` instead. The SPN would only manage app registrations it created. This is sufficient if the SPN creates all app regs in the identity layer.
2. **Time-bound grant:** In production, consider using Privileged Identity Management (PIM) to make this permission just-in-time.
3. **Separate identity SPN:** If security policy prohibits giving the deployment SPN Graph permissions, create a dedicated `eclat-{env}-identity` SPN with only Graph permissions, used only for the `05-identity` layer. The existing `eclat-{env}-deploy` SPN continues to handle `azurerm` layers.

**Recommended approach for MVP:** Use `Application.ReadWrite.OwnedBy` + `Group.ReadWrite.All` on the existing deployment SPN. Escalate to `Application.ReadWrite.All` only if `OwnedBy` proves insufficient for cross-app permission grants.

### 5.5 Admin Consent Requirement

Graph API application permissions require **admin consent** from a tenant admin. This is a one-time operation per environment:

```bash
# Must be run by a user with Global Administrator or
# Privileged Role Administrator role
az ad app permission admin-consent --id "$APP_ID"
```

**This cannot be automated in CI/CD.** It requires a human with sufficient Entra directory privileges.

---

## 6. Backend Auth Overhaul

### 6.1 Library Choice

**Recommended:** `@azure/msal-node` + `jsonwebtoken` + `jwks-rsa`

| Library | Purpose |
|---------|---------|
| `@azure/msal-node` | OBO token exchange, confidential client operations |
| `jwks-rsa` | Fetch and cache Entra's JWKS public keys |
| `jsonwebtoken` | Verify JWT signature against JWKS keys |
| `@azure/identity` | `DefaultAzureCredential` for managed identity (already in use) |

**Why NOT `passport-azure-ad`?**
- It's in maintenance mode; Microsoft recommends MSAL directly
- It adds Express-specific abstractions that complicate the mock strategy
- Direct JWT validation with `jwks-rsa` is simpler and more testable

### 6.2 Token Validation Module

Replace `apps/api/src/modules/auth/tokens.ts` with a strategy-based validator:

```typescript
// apps/api/src/modules/auth/token-validator.ts

export interface TokenValidator {
  validate(token: string): Promise<ValidatedUser>;
}

export interface ValidatedUser {
  id: string;           // Entra: oid claim; Mock: uuid
  email: string;        // Entra: preferred_username; Mock: from payload
  role: Role;           // Mapped from roles claim
  roles: Role[];        // All roles (user may have multiple)
  name: string;         // Entra: name claim
  tenantId?: string;    // Entra: tid claim
  rawClaims: Record<string, unknown>;
}
```

#### Entra Validator

```typescript
// apps/api/src/modules/auth/entra-validator.ts

import jwksClient from 'jwks-rsa';
import jwt from 'jsonwebtoken';

export class EntraTokenValidator implements TokenValidator {
  private jwksClient: jwksClient.JwksClient;
  
  constructor(private config: {
    tenantId: string;
    clientId: string;    // API app registration client ID (audience)
    issuer: string;      // https://login.microsoftonline.com/{tenant}/v2.0
  }) {
    this.jwksClient = jwksClient({
      jwksUri: `https://login.microsoftonline.com/${config.tenantId}/discovery/v2.0/keys`,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 600000, // 10 minutes
    });
  }

  async validate(token: string): Promise<ValidatedUser> {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded) throw new AuthError('Invalid token');
    
    const key = await this.jwksClient.getSigningKey(decoded.header.kid);
    
    const payload = jwt.verify(token, key.getPublicKey(), {
      audience: this.config.clientId,
      issuer: this.config.issuer,
      algorithms: ['RS256'],
    }) as EntraTokenPayload;
    
    const entraRoles = payload.roles || [];
    const mappedRoles = entraRoles
      .map(r => EntraAppRoleToRole[r])
      .filter(Boolean);
    
    return {
      id: payload.oid,
      email: payload.preferred_username,
      role: mapEntraRolesToHighestRole(entraRoles),
      roles: mappedRoles,
      name: payload.name,
      tenantId: payload.tid,
      rawClaims: payload,
    };
  }
}
```

#### Mock Validator (see Section 8)

### 6.3 Middleware Changes

The middleware pattern stays almost identical. Only the token verification call changes:

```typescript
// apps/api/src/middleware/auth.ts (updated)

import { getTokenValidator } from '../modules/auth/token-validator-factory';

export async function authenticate(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization header' });
    return;
  }

  const token = authHeader.substring(7);
  
  try {
    const validator = getTokenValidator(); // Returns Entra or Mock based on AUTH_MODE
    const user = await validator.validate(token);
    (req as AuthenticatedRequest).user = user;
    next();
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
    } else {
      res.status(401).json({ error: 'Invalid token' });
    }
  }
}

// requireRole and requireMinRole remain UNCHANGED
// They read from req.user.role which is populated by the validator
```

**Key change:** `authenticate` becomes `async` because JWKS key fetching is asynchronous.

### 6.4 OBO Flow Implementation

```typescript
// apps/api/src/modules/auth/obo-client.ts

import { ConfidentialClientApplication } from '@azure/msal-node';

export class OboClient {
  private msalClient: ConfidentialClientApplication;
  
  constructor(config: {
    tenantId: string;
    clientId: string;
    clientSecret: string; // Fetched from Key Vault at startup
  }) {
    this.msalClient = new ConfidentialClientApplication({
      auth: {
        clientId: config.clientId,
        authority: `https://login.microsoftonline.com/${config.tenantId}`,
        clientSecret: config.clientSecret,
      },
    });
  }

  async getTokenOnBehalfOf(
    userAccessToken: string,
    scopes: string[]
  ): Promise<string> {
    const result = await this.msalClient.acquireTokenOnBehalfOf({
      oboAssertion: userAccessToken,
      scopes,
    });
    
    if (!result) throw new Error('OBO token acquisition failed');
    return result.accessToken;
  }
}
```

**Endpoints requiring OBO:**
| Endpoint | Downstream | Scope | Reason |
|----------|-----------|-------|--------|
| `GET /api/employees/me/profile` | Microsoft Graph | `User.Read` | Sync Entra profile data |
| `POST /api/documents/upload` | Azure Storage (future) | Storage scopes | User-attributed uploads |
| Future APIM calls | Downstream APIs | Custom scopes | Service-to-service on behalf of user |

### 6.5 Managed Identity for Database

Replace the connection string with Entra-authenticated PostgreSQL access:

```typescript
// apps/api/src/config/database.ts

import { DefaultAzureCredential } from '@azure/identity';

async function getDatabaseUrl(): Promise<string> {
  if (process.env.AUTH_MODE === 'mock') {
    // Local dev: use standard connection string
    return process.env.DATABASE_URL!;
  }
  
  // Production: use managed identity token for PostgreSQL
  const credential = new DefaultAzureCredential();
  const token = await credential.getToken(
    'https://ossrdbms-aad.database.windows.net/.default'
  );
  
  const host = process.env.POSTGRES_HOST;
  const database = process.env.POSTGRES_DATABASE;
  const user = process.env.POSTGRES_USER; // Managed identity name
  
  return `postgresql://${user}:${token.token}@${host}/${database}?sslmode=require`;
}
```

**Terraform changes for managed identity DB access:**
```hcl
# In 10-data or 20-compute
resource "azurerm_postgresql_flexible_server_active_directory_administrator" "api" {
  server_name         = azurerm_postgresql_flexible_server.this.name
  resource_group_name = var.resource_group_name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  object_id           = azurerm_container_app.api.identity[0].principal_id
  principal_name      = "eclat-api-${var.environment}"
  principal_type      = "ServicePrincipal"
}
```

### 6.6 Auth Service Changes

The current `authService` with mock users and bcrypt is replaced by a thin delegation layer:

```typescript
// apps/api/src/modules/auth/service.ts (new shape)

export interface AuthService {
  // No more login/register — Entra handles user authentication
  // Keep refresh for OBO token cache management
  getUserProfile(userId: string): Promise<UserProfile>;
  syncEntraProfile(entraUser: ValidatedUser): Promise<Employee>;
}
```

**What gets removed:**
- `login()` — Entra handles authentication; the SPA gets tokens directly
- `register()` — Users are created in Entra directory, not in our system
- `buildTokens()` / `signAccessToken()` / `signRefreshToken()` — No more self-signed tokens
- bcrypt dependency — No password handling

**What stays:**
- Token refresh is handled by MSAL.js in the frontend (silent token renewal)
- `oauthCallback()` becomes irrelevant — MSAL.js handles the entire flow client-side

**What's new:**
- `syncEntraProfile()` — On first API call, create/update the Employee record from Entra claims
- `getUserProfile()` — Return the mapped user profile from our database

### 6.7 Auth Router Changes

```typescript
// apps/api/src/modules/auth/router.ts (new shape)

// REMOVED: POST /login, POST /register, POST /refresh, POST /change-password
// REMOVED: GET /oauth/callback

// NEW endpoints:
router.get('/me',
  authenticate,
  async (req, res) => {
    // Return current user profile from token claims + DB
    const user = (req as AuthenticatedRequest).user;
    const profile = await authService.getUserProfile(user.id);
    res.json(profile);
  }
);

router.post('/sync-profile',
  authenticate,
  async (req, res) => {
    // Sync Entra profile data to Employee record (called on login)
    const user = (req as AuthenticatedRequest).user;
    const employee = await authService.syncEntraProfile(user);
    res.json(employee);
  }
);

// Health/config endpoint for frontend to discover auth settings
router.get('/config',
  async (req, res) => {
    res.json({
      authMode: env.AUTH_MODE,
      tenantId: env.AUTH_MODE === 'entra' ? env.AZURE_TENANT_ID : undefined,
      clientId: env.AUTH_MODE === 'entra' ? env.WEB_CLIENT_ID : undefined,
      apiScope: env.AUTH_MODE === 'entra' ? env.ENTRA_API_SCOPE_URI : undefined,
    });
  }
);
```

---

## 7. Frontend Auth Overhaul

### 7.1 Library Choice

**Use `@azure/msal-react`** (built on `@azure/msal-browser`).

- Official Microsoft library for React SPAs
- Handles token caching, silent refresh, redirect/popup flows
- Provides React hooks: `useMsal`, `useAccount`, `useMsalAuthentication`
- Supports Auth Code + PKCE out of the box

### 7.2 MSAL Configuration

```typescript
// apps/web/src/auth/msal-config.ts

import { Configuration, LogLevel } from '@azure/msal-browser';

export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_ENTRA_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_ENTRA_TENANT_ID}`,
    redirectUri: import.meta.env.VITE_AUTH_REDIRECT_URI || '/auth/callback',
    postLogoutRedirectUri: '/',
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: 'sessionStorage', // More secure than localStorage
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
    },
  },
};

// Scopes the web app requests
export const loginRequest = {
  scopes: [
    `api://eclat-api-${import.meta.env.VITE_ENVIRONMENT}/Employees.Read`,
    `api://eclat-api-${import.meta.env.VITE_ENVIRONMENT}/Qualifications.Read`,
    `api://eclat-api-${import.meta.env.VITE_ENVIRONMENT}/Medical.Read`,
    `api://eclat-api-${import.meta.env.VITE_ENVIRONMENT}/Documents.Read`,
  ],
};

// Additional scopes for write operations (incremental consent)
export const writeScopes = {
  scopes: [
    `api://eclat-api-${import.meta.env.VITE_ENVIRONMENT}/Employees.ReadWrite`,
    `api://eclat-api-${import.meta.env.VITE_ENVIRONMENT}/Qualifications.ReadWrite`,
    `api://eclat-api-${import.meta.env.VITE_ENVIRONMENT}/Medical.ReadWrite`,
    `api://eclat-api-${import.meta.env.VITE_ENVIRONMENT}/Documents.ReadWrite`,
  ],
};
```

### 7.3 Auth Provider Integration

```tsx
// apps/web/src/main.tsx

import { MsalProvider } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { msalConfig } from './auth/msal-config';

const msalInstance = new PublicClientApplication(msalConfig);

// For mock mode, use a mock MSAL instance (see Section 8)
const authMode = import.meta.env.VITE_AUTH_MODE || 'entra';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {authMode === 'entra' ? (
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    ) : (
      <MockAuthProvider>
        <App />
      </MockAuthProvider>
    )}
  </React.StrictMode>
);
```

### 7.4 Token Acquisition Pattern

**Use redirect flow (not popup):**
- More reliable across browsers and mobile
- Better UX for enterprise users (familiar redirect to Microsoft login)
- Popup blockers are a real problem in enterprise environments

```typescript
// apps/web/src/auth/useAuthenticatedApi.ts

import { useMsal } from '@azure/msal-react';
import { InteractionRequiredAuthError } from '@azure/msal-browser';

export function useAuthenticatedApi() {
  const { instance, accounts } = useMsal();
  
  async function getAccessToken(scopes: string[]): Promise<string> {
    const account = accounts[0];
    if (!account) throw new Error('No authenticated account');
    
    try {
      // Try silent token acquisition first (from cache)
      const response = await instance.acquireTokenSilent({
        scopes,
        account,
      });
      return response.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        // Token expired or new consent needed — redirect to Entra
        await instance.acquireTokenRedirect({ scopes });
        throw new Error('Redirecting to login');
      }
      throw error;
    }
  }
  
  async function apiCall(path: string, options?: RequestInit): Promise<Response> {
    const token = await getAccessToken(loginRequest.scopes);
    return fetch(`${import.meta.env.VITE_API_URL}${path}`, {
      ...options,
      headers: {
        ...options?.headers,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  }
  
  return { getAccessToken, apiCall };
}
```

### 7.5 Silent Token Refresh

MSAL.js handles refresh automatically:

1. **On page load:** `handleRedirectPromise()` processes any pending auth redirect
2. **On API call:** `acquireTokenSilent()` returns cached token if valid, or uses refresh token to get a new one
3. **On refresh failure:** Falls back to `acquireTokenRedirect()` (full re-authentication)
4. **Token lifetime:** Entra access tokens are typically 60–90 minutes; MSAL refreshes them proactively

**No custom refresh logic needed** — MSAL manages the entire lifecycle.

### 7.6 Auth Context for Components

```tsx
// apps/web/src/auth/AuthContext.tsx

import { useIsAuthenticated, useMsal } from '@azure/msal-react';

export function useAuth() {
  const isAuthenticated = useIsAuthenticated();
  const { accounts } = useMsal();
  
  const user = accounts[0] ? {
    id: accounts[0].localAccountId,
    email: accounts[0].username,
    name: accounts[0].name || '',
    // Roles from ID token claims
    roles: (accounts[0].idTokenClaims?.roles as string[]) || [],
  } : null;
  
  return { isAuthenticated, user };
}

// Usage in components:
function EmployeeDashboard() {
  const { isAuthenticated, user } = useAuth();
  
  if (!isAuthenticated) return <LoginPrompt />;
  if (!user?.roles.includes('Manager')) return <AccessDenied />;
  
  return <Dashboard />;
}
```

---

## 8. Local Dev Mock Strategy

### 8.1 Design Goals

1. Docker dev stack works with **zero Entra configuration**
2. Mock tokens have the **exact same claims structure** as real Entra tokens
3. Switching between mock and Entra requires **only environment variables** — no code changes
4. Mock mode is the **default** for local development

### 8.2 Environment Variable Toggle

```bash
# .env (local development — default)
AUTH_MODE=mock
MOCK_USER_ROLE=admin        # Default role for mock user
MOCK_USER_EMAIL=dev@eclat.local
MOCK_USER_NAME=Dev User

# .env.entra (real Entra — used for integration testing)
AUTH_MODE=entra
AZURE_TENANT_ID=<tenant-id>
AZURE_CLIENT_ID=<api-client-id>
ENTRA_API_CLIENT_SECRET_NAME=entra-api-client-secret
ENTRA_API_SCOPE_URI=api://eclat-api-dev
```

### 8.3 Mock Token Provider (Backend)

```typescript
// apps/api/src/modules/auth/mock-validator.ts

import jwt from 'jsonwebtoken';
import { TokenValidator, ValidatedUser } from './token-validator';

const MOCK_SIGNING_KEY = 'eclat-local-dev-mock-key-do-not-use-in-production';

export class MockTokenValidator implements TokenValidator {
  async validate(token: string): Promise<ValidatedUser> {
    // Verify with the known mock signing key
    const payload = jwt.verify(token, MOCK_SIGNING_KEY) as MockEntraPayload;
    
    // Map to ValidatedUser using the same logic as Entra validator
    return {
      id: payload.oid,
      email: payload.preferred_username,
      role: mapEntraRolesToHighestRole(payload.roles || []),
      roles: (payload.roles || []).map(r => EntraAppRoleToRole[r]).filter(Boolean),
      name: payload.name,
      tenantId: payload.tid,
      rawClaims: payload,
    };
  }
}

// Mock token generator — used by dev tools and tests
export function generateMockEntraToken(overrides: Partial<MockEntraPayload> = {}): string {
  const now = Math.floor(Date.now() / 1000);
  
  const payload: MockEntraPayload = {
    // Standard Entra v2.0 claims
    iss: 'https://login.microsoftonline.com/mock-tenant-id/v2.0',
    sub: overrides.sub || 'mock-subject-id',
    aud: overrides.aud || 'mock-api-client-id',
    exp: overrides.exp || now + 3600,
    iat: now,
    nbf: now,
    
    // Entra-specific claims
    oid: overrides.oid || 'mock-user-oid',
    tid: overrides.tid || 'mock-tenant-id',
    preferred_username: overrides.preferred_username || 'dev@eclat.local',
    name: overrides.name || 'Dev User',
    
    // App roles — this is the critical claim for authorization
    roles: overrides.roles || ['Admin'],
    
    // Group IDs (if needed)
    groups: overrides.groups || [],
    
    // Standard v2.0 fields
    ver: '2.0',
    azp: 'mock-web-client-id',
    scp: overrides.scp || 'Employees.Read Employees.ReadWrite',
    
    ...overrides,
  };
  
  return jwt.sign(payload, MOCK_SIGNING_KEY, { algorithm: 'HS256' });
}
```

### 8.4 Mock Token Provider (Frontend)

```typescript
// apps/web/src/auth/MockAuthProvider.tsx

import React, { createContext, useContext, useState } from 'react';

interface MockUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
}

const MOCK_USERS: Record<string, MockUser> = {
  employee: {
    id: 'mock-oid-employee',
    email: 'employee@eclat.local',
    name: 'Jane Employee',
    roles: ['Employee'],
  },
  supervisor: {
    id: 'mock-oid-supervisor',
    email: 'supervisor@eclat.local',
    name: 'Sam Supervisor',
    roles: ['Supervisor'],
  },
  manager: {
    id: 'mock-oid-manager',
    email: 'manager@eclat.local',
    name: 'Maria Manager',
    roles: ['Manager'],
  },
  compliance: {
    id: 'mock-oid-compliance',
    email: 'compliance@eclat.local',
    name: 'Chris Compliance',
    roles: ['ComplianceOfficer'],
  },
  admin: {
    id: 'mock-oid-admin',
    email: 'admin@eclat.local',
    name: 'Alex Admin',
    roles: ['Admin'],
  },
};

// MockAuthProvider exposes the same interface as the real AuthContext
// Frontend code doesn't know (or care) which provider is active
```

### 8.5 Mock Token in Docker Compose

```yaml
# docker-compose.yml additions
services:
  api:
    environment:
      AUTH_MODE: mock
      MOCK_USER_ROLE: admin
      MOCK_USER_EMAIL: dev@eclat.local
      MOCK_USER_NAME: Dev User
```

### 8.6 Developer Workflow

```bash
# Local dev (default — no Entra needed)
docker compose up                  # AUTH_MODE=mock by default
# Frontend shows role switcher dropdown
# All API calls use mock tokens automatically

# Integration test against real Entra
cp .env.entra .env.local
docker compose up                  # AUTH_MODE=entra
# Frontend redirects to Microsoft login
# Real Entra tokens flow through the system
```

### 8.7 Mock Strategy for Tests

```typescript
// Test helper
import { generateMockEntraToken } from '../modules/auth/mock-validator';

// Generate tokens with specific roles for test scenarios
const adminToken = generateMockEntraToken({ roles: ['Admin'] });
const employeeToken = generateMockEntraToken({ roles: ['Employee'] });
const multiRoleToken = generateMockEntraToken({ roles: ['Manager', 'ComplianceOfficer'] });

// Use in supertest
request(app)
  .get('/api/employees')
  .set('Authorization', `Bearer ${adminToken}`)
  .expect(200);
```

---

## 9. Migration Path

### 9.1 Strategy: Additive, Not Replacement

The migration is designed so that:
- Mock auth remains the default throughout development
- Entra auth is layered on top, never replaces mock until proven
- Each phase is independently deployable and testable
- Breaking changes are isolated behind the `AUTH_MODE` flag

### 9.2 What's Breaking vs Additive

| Change | Type | Impact |
|--------|------|--------|
| Token validator interface | **Additive** | New interface wraps existing verify logic |
| `authenticate` middleware becomes async | **Breaking** (minor) | Express handles async middleware; existing tests need token format update |
| Remove `POST /login`, `POST /register` | **Breaking** | Frontend must use MSAL login flow instead |
| Remove bcrypt dependency | **Breaking** | No more password-based auth |
| Add `GET /auth/config` | **Additive** | Frontend discovers auth mode |
| Add `POST /auth/sync-profile` | **Additive** | Syncs Entra claims to Employee record |
| MSAL.js in frontend | **Breaking** | Login flow completely different |
| Mock token format change | **Breaking** | Tests must use `generateMockEntraToken` instead of old `createMockToken` |
| New env vars (`AZURE_TENANT_ID`, etc.) | **Additive** | Only needed when `AUTH_MODE=entra` |
| `05-identity` Terraform layer | **Additive** | New layer, doesn't modify existing layers |
| DB managed identity | **Additive** | Only in `AUTH_MODE=entra`; connection string still works in mock |

### 9.3 Phased Cutover

```
Phase A: Both auth modes coexist
  ├── AUTH_MODE=mock  → MockTokenValidator (current-compatible)
  └── AUTH_MODE=entra → EntraTokenValidator (new)

Phase B: Mock becomes test-only
  ├── Production/staging: AUTH_MODE=entra (mandatory)
  ├── Local dev: AUTH_MODE=mock (default)
  └── CI: AUTH_MODE=mock (fast tests)

Phase C: Remove legacy
  ├── Delete old login/register endpoints
  ├── Remove bcrypt from dependencies
  └── Mock stays for testing, but is no longer the "real" auth
```

---

## 10. Phased Implementation Plan

### Phase 1: Foundation (Week 1) — No Entra Dependency

**Owner:** Bunk (backend)  
**Depends on:** Nothing — can start immediately  
**Parallelizable:** Yes, with Phase 2

| Task | Description | Estimate |
|------|-------------|----------|
| 1a. Token validator interface | Create `TokenValidator` interface, `ValidatedUser` type, factory function | 2h |
| 1b. Mock validator | Implement `MockTokenValidator` with Entra-shaped claims | 3h |
| 1c. Mock token generator | `generateMockEntraToken()` function for tests | 2h |
| 1d. Update middleware | Make `authenticate` async, use `TokenValidator` | 2h |
| 1e. Update tests | Migrate existing tests to use new mock token format | 4h |
| 1f. Entra role mapping | `EntraAppRoleToRole` mapping in shared package | 1h |
| 1g. Auth config endpoint | `GET /auth/config` returns auth mode and settings | 1h |

**Deliverable:** Backend accepts Entra-shaped mock tokens. All existing tests pass. No Entra tenant needed.

### Phase 2: Terraform Identity Layer (Week 1–2) — Requires Tenant Access

**Owner:** Bunk (infra)  
**Depends on:** Tenant ID and subscription access from ivegamsft  
**Parallelizable:** Yes, with Phase 1

| Task | Description | Estimate |
|------|-------------|----------|
| 2a. Create `05-identity` layer | Terraform scaffolding, providers, backend config | 2h |
| 2b. API app registration | `azuread_application`, scopes, app roles | 4h |
| 2c. SPA app registrations | Web and admin app regs with redirect URIs | 2h |
| 2d. Security groups | 5 groups + app role assignments | 2h |
| 2e. Key Vault secrets | Store API client secret | 1h |
| 2f. Layer outputs | Export client IDs, tenant ID, scope URI | 1h |
| 2g. Update `20-compute` | Pass identity outputs as container env vars | 2h |

**Deliverable:** `terraform apply` for `05-identity` creates all Entra resources. Compute layer has the config it needs.

**⚠️ Blocked on:** Tenant ID, admin consent for bootstrap SPN permissions.

### Phase 3: Bootstrap Updates (Week 2) — Requires Admin

**Owner:** Bunk (infra)  
**Depends on:** Phase 2 design, admin access  
**Parallelizable:** No — must be done before Phase 2 apply

| Task | Description | Estimate |
|------|-------------|----------|
| 3a. Update `02-entra-spns.sh` | Add Graph API permissions | 2h |
| 3b. Admin consent | Coordinate with tenant admin for consent grant | 1h |
| 3c. Documentation | Update bootstrap README with new prerequisites | 1h |

**Deliverable:** Deployment SPN can create app registrations and groups.

### Phase 4: Backend Entra Validator (Week 2–3)

**Owner:** Bunk (backend)  
**Depends on:** Phase 1 (interface), Phase 2 (client IDs for config)  
**Parallelizable:** With Phase 5

| Task | Description | Estimate |
|------|-------------|----------|
| 4a. Install packages | `@azure/msal-node`, `jwks-rsa` | 0.5h |
| 4b. Entra token validator | `EntraTokenValidator` with JWKS validation | 4h |
| 4c. OBO client | `OboClient` for downstream Graph calls | 3h |
| 4d. Profile sync | `syncEntraProfile()` service method | 3h |
| 4e. Managed identity DB | Entra-authenticated PostgreSQL connection | 4h |
| 4f. Integration tests | Test against real Entra tenant (manual) | 4h |

**Deliverable:** Backend can validate real Entra tokens when `AUTH_MODE=entra`.

### Phase 5: Frontend MSAL Integration (Week 2–3)

**Owner:** Kima (frontend)  
**Depends on:** Phase 2 (client IDs), Phase 4 (API accepts Entra tokens)  
**Parallelizable:** With Phase 4 (against mock API)

| Task | Description | Estimate |
|------|-------------|----------|
| 5a. Install MSAL | `@azure/msal-browser`, `@azure/msal-react` | 0.5h |
| 5b. MSAL config | Configuration, scopes, redirect URIs | 2h |
| 5c. Auth provider | `MsalProvider` + `MockAuthProvider` wrapper | 3h |
| 5d. Login/logout flow | Redirect-based auth flow | 3h |
| 5e. API client | `useAuthenticatedApi` hook with token attachment | 3h |
| 5f. Role-based UI | Show/hide based on token roles | 2h |
| 5g. Mock auth UI | Role switcher dropdown for mock mode | 2h |

**Deliverable:** Frontend handles login via MSAL or mock provider. API calls include proper Bearer tokens.

### Phase 6: Remove Legacy Auth (Week 3–4)

**Owner:** Bunk (backend)  
**Depends on:** Phases 4+5 confirmed working  
**Not parallelizable:** Must wait for Entra auth proven

| Task | Description | Estimate |
|------|-------------|----------|
| 6a. Remove old endpoints | Delete `/login`, `/register`, `/change-password` | 1h |
| 6b. Remove bcrypt | Uninstall bcrypt, remove password logic | 1h |
| 6c. Remove old tokens.ts | Delete self-signed JWT logic | 1h |
| 6d. Update all tests | Ensure all tests use new mock format | 4h |
| 6e. Documentation | Update API docs, auth guide | 2h |

**Deliverable:** Clean auth codebase with no legacy paths.

### Dependency Graph

```
Phase 1 (Foundation)     ─────────────────────────────────┐
    │                                                      │
    │   Phase 2 (Terraform) ──── Phase 3 (Bootstrap) ─────┤
    │       │                                              │
    │       │                                              ▼
    │       └──────────── Phase 4 (Backend Entra) ──── Phase 6
    │                         │                        (Remove Legacy)
    │                         │                            ▲
    └──────────────── Phase 5 (Frontend MSAL) ─────────────┘
```

### What Needs User Input

| Item | Who Provides | When Needed |
|------|-------------|-------------|
| Azure Tenant ID | ivegamsft | Phase 2 (Terraform) |
| Subscription ID (per env) | ivegamsft | Phase 2 (Terraform) |
| Admin consent approval | ivegamsft or tenant admin | Phase 3 (Bootstrap) |
| Custom domain hostnames (web, admin) | ivegamsft | Phase 2 (redirect URIs) |
| Test user accounts in Entra | ivegamsft | Phase 4 (integration testing) |
| Group membership assignments | ivegamsft | Phase 4 (testing role claims) |

---

## Appendix A: Entra Token Claims Reference

A real Entra v2.0 access token for E-CLAT will contain these claims:

```json
{
  "iss": "https://login.microsoftonline.com/{tenant-id}/v2.0",
  "sub": "user-subject-id",
  "aud": "api://eclat-api-dev",
  "exp": 1710600000,
  "iat": 1710596400,
  "nbf": 1710596400,
  "oid": "user-object-id-in-entra",
  "tid": "tenant-id",
  "preferred_username": "jane.doe@contoso.com",
  "name": "Jane Doe",
  "roles": ["Manager", "ComplianceOfficer"],
  "groups": ["group-oid-1", "group-oid-2"],
  "scp": "Employees.Read Employees.ReadWrite Qualifications.Read",
  "azp": "web-client-id",
  "ver": "2.0"
}
```

The mock token generator produces tokens with this exact structure (Section 8.3).

## Appendix B: Environment Variables Summary

### Backend (`apps/api`)

| Variable | Mock Mode | Entra Mode | Source |
|----------|-----------|------------|--------|
| `AUTH_MODE` | `mock` | `entra` | `.env` / container config |
| `AZURE_TENANT_ID` | — | `{tenant-id}` | Terraform output → container env |
| `AZURE_CLIENT_ID` | — | `{api-client-id}` | Terraform output → container env |
| `ENTRA_API_CLIENT_SECRET_NAME` | — | `entra-api-client-secret` | Terraform output → container env |
| `ENTRA_API_SCOPE_URI` | — | `api://eclat-api-{env}` | Terraform output → container env |
| `KEY_VAULT_URI` | — | `https://{kv}.vault.azure.net/` | Terraform output → container env |
| `MOCK_USER_ROLE` | `admin` | — | `.env` |
| `MOCK_USER_EMAIL` | `dev@eclat.local` | — | `.env` |
| `DATABASE_URL` | `postgresql://...` | — (managed identity) | `.env` |
| `POSTGRES_HOST` | — | `{server}.postgres.database.azure.com` | Terraform output |
| `POSTGRES_DATABASE` | — | `eclat` | Terraform output |

### Frontend (`apps/web`, `apps/admin`)

| Variable | Mock Mode | Entra Mode |
|----------|-----------|------------|
| `VITE_AUTH_MODE` | `mock` | `entra` |
| `VITE_ENTRA_TENANT_ID` | — | `{tenant-id}` |
| `VITE_ENTRA_CLIENT_ID` | — | `{web-client-id}` or `{admin-client-id}` |
| `VITE_ENVIRONMENT` | `dev` | `dev`/`staging`/`prod` |
| `VITE_API_URL` | `http://localhost:3000` | `https://api.eclat.example.com` |
| `VITE_AUTH_REDIRECT_URI` | `/auth/callback` | `/auth/callback` |

## Appendix C: Security Checklist

- [ ] No client secrets in frontend code (SPAs use PKCE, no secrets)
- [ ] API client secret stored in Key Vault, not in Terraform state
- [ ] `app_role_assignment_required = true` — users must be assigned a role to get tokens
- [ ] Token validation checks `aud` (audience), `iss` (issuer), `exp` (expiration)
- [ ] JWKS keys cached with reasonable TTL (10 minutes)
- [ ] Mock signing key (`MOCK_SIGNING_KEY`) is a compile-time constant, never used outside `AUTH_MODE=mock`
- [ ] Mock mode cannot be enabled in production (`AUTH_MODE=mock` blocked when `NODE_ENV=production`)
- [ ] OBO client secret fetched from Key Vault, not from environment variables
- [ ] Database connection uses managed identity (no connection string in config)
- [ ] CORS configured to allow only known SPA origins
- [ ] Refresh tokens handled by MSAL.js (no custom refresh endpoint)
- [ ] Group membership claims limited to security groups (not distribution lists)
