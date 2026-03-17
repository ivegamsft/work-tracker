# Multi-IdP Identity API — E-CLAT Platform

> **Status:** Specification  
> **Owner:** Bunk (Backend Dev)  
> **Created:** 2026-03-21  
> **Issue:** #94  
> **Applies To:** `apps/api/src/modules/auth`, `packages/shared/src/types`, `data/prisma/schema.prisma`  
> **Related Decisions:** Decision 2 (Multi-IdP + SCIM + profile merge), Decision 12 (Semi-anonymous profiles)  
> **Companion Docs:** [RBAC API Spec](./rbac-api-spec.md) · [Service Architecture](./service-architecture-spec.md)

---

## 1. Problem Statement

E-CLAT must support enterprises with **heterogeneous identity infrastructure**:

1. **Single enterprise, single IdP** (Entra ID / Azure AD)
2. **Multi-branch enterprise, multi-IdP** (Okta + Entra + legacy SAML)
3. **Federated B2B** (Partner orgs, external verifiers)
4. **Local accounts** (On-prem deployments, compliance labs)

Current gaps:

- **No provider abstraction** — Auth module hardcoded to JWT validation only
- **No SCIM support** — Employees auto-provisioned on hire; currently manual
- **No linked identities** — User logged in via Okta cannot access profile created under Entra
- **No provider config CRUD** — Admins cannot add/remove/update identity providers without code
- **No user invite flow** — Cannot bulk-invite employees from Active Directory

**Impact:** Customers cannot onboard; B2B workflows blocked; manual provisioning burden unsustainable.

---

## 2. Solution Overview

Implement **pluggable identity provider abstraction** with:

- **Provider registry** — CRUD endpoints to add/remove identity providers
- **Multi-IdP token validation** — Each provider has different JWKS endpoint, claims structure, etc.
- **Linked identities** — Multiple provider logins map to single E-CLAT user
- **Profile resolution** — Email-anchored merge; user sees unified profile across login origins
- **SCIM provisioning** — Azure AD → E-CLAT automated sync
- **Invite flow** — Bulk user invites (internal, B2B, local)
- **Semi-anonymous business APIs** — Backend returns `user_id` only; frontend resolves profile name at render time

**Design Principle:** Identity is a **service** (pluggable), not middleware. SCIM is a **backend-driven** pull model, not push.

---

## 3. API Endpoints

### 3.1 Provider Management (Admin only)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/v1/auth/providers` | GET | List identity providers |
| `POST /api/v1/auth/providers` | POST | Add identity provider |
| `GET /api/v1/auth/providers/:providerId` | GET | Get provider config |
| `PUT /api/v1/auth/providers/:providerId` | PUT | Update provider config |
| `DELETE /api/v1/auth/providers/:providerId` | DELETE | Remove provider (soft-delete) |
| `POST /api/v1/auth/providers/:providerId/test` | POST | Test provider connectivity |

#### Request/Response Schemas

**`POST /api/v1/auth/providers` (Create Provider)**

```json
{
  "name": "Entra ID",
  "type": "oidc",
  "jwks_uri": "https://login.microsoftonline.com/{tenant}/.well-known/openid-configuration",
  "client_id": "abc123...",
  "client_secret": "secret...",
  "issuer": "https://login.microsoftonline.com/{tenant}/v2.0",
  "scopes": ["openid", "profile", "email"],
  "claims_mapping": {
    "email": "email",
    "given_name": "given_name",
    "family_name": "family_name",
    "oid": "oid",
    "roles": "roles"
  },
  "is_active": true
}
```

**Response:**

```json
{
  "id": "provider_entra_001",
  "name": "Entra ID",
  "type": "oidc",
  "issuer": "https://login.microsoftonline.com/{tenant}/v2.0",
  "created_at": "2026-03-21T10:30:45Z",
  "created_by": "admin_user_id",
  "is_active": true,
  "metadata": {
    "jwks_cached_at": "2026-03-21T10:30:00Z",
    "last_test_at": "2026-03-21T10:28:00Z",
    "test_status": "OK"
  }
}
```

**`PUT /api/v1/auth/providers/:providerId` (Update Provider)**

```json
{
  "name": "Entra ID (Updated)",
  "is_active": true,
  "claims_mapping": {
    "email": "email",
    "given_name": "given_name",
    "family_name": "family_name",
    "oid": "oid",
    "roles": "roles",
    "department": "department"
  }
}
```

### 3.2 Token Validation Endpoint

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/v1/auth/validate` | POST | Validate token from any provider |

**Request:**

```json
{
  "token": "eyJhbGc...",
  "provider_id": "provider_entra_001"
}
```

**Response (Success):**

```json
{
  "valid": true,
  "user_id": "user_uuid_001",
  "email": "john@example.com",
  "given_name": "John",
  "family_name": "Doe",
  "tenant_id": "tenant_001",
  "role": "SUPERVISOR",
  "external_id": "oid_from_entra",
  "provider_id": "provider_entra_001",
  "token": "eyJhbGc... (JWT signed by API)"
}
```

**Response (Invalid):**

```json
{
  "valid": false,
  "error": "INVALID_SIGNATURE",
  "message": "Token signature does not match provider JWKS"
}
```

### 3.3 Linked Identities

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/v1/auth/identities` | GET | List linked identities for current user |
| `POST /api/v1/auth/identities/link` | POST | Link new identity to current user |
| `DELETE /api/v1/auth/identities/:externalId` | DELETE | Unlink identity |

**`POST /api/v1/auth/identities/link` (Link Okta ID to Entra profile)**

```json
{
  "provider_id": "provider_okta_001",
  "token": "eyJhbGc...",
  "link_code": "link_abc123..."
}
```

**Response:**

```json
{
  "user_id": "user_uuid_001",
  "linked_identities": [
    {
      "provider_id": "provider_entra_001",
      "external_id": "oid_entra",
      "email": "john@example.com",
      "linked_at": "2026-03-15T08:00:00Z"
    },
    {
      "provider_id": "provider_okta_001",
      "external_id": "oid_okta",
      "email": "john@example.com",
      "linked_at": "2026-03-21T10:30:45Z"
    }
  ]
}
```

### 3.4 Profile Resolution (Semi-Anonymous)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/v1/auth/profiles/:userId` | GET | Get user profile (name, avatar, etc.) |

**Request:** Header: `Authorization: Bearer {jwt}`

**Response:**

```json
{
  "user_id": "user_uuid_001",
  "email": "john@example.com",
  "given_name": "John",
  "family_name": "Doe",
  "avatar_url": "https://...",
  "department": "Engineering",
  "title": "Senior Engineer",
  "phone": "555-1234",
  "last_login": "2026-03-21T09:15:00Z"
}
```

**Note:** Business APIs (templates, qualifications, etc.) return only `user_id` in responses. Frontend calls this endpoint to resolve display names.

### 3.5 SCIM Endpoint (Azure AD Provisioning)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/v1/auth/scim/Users` | GET | List users (SCIM standard) |
| `GET /api/v1/auth/scim/Users/:id` | GET | Get user (SCIM standard) |
| `POST /api/v1/auth/scim/Users` | POST | Create user (SCIM standard) |
| `PATCH /api/v1/auth/scim/Users/:id` | PATCH | Update user (SCIM standard) |
| `DELETE /api/v1/auth/scim/Users/:id` | DELETE | Deactivate user (SCIM standard) |
| `GET /api/v1/auth/scim/.well-known/Schemas` | GET | SCIM schema discovery |

**`POST /api/v1/auth/scim/Users` (Azure AD creates employee)**

```json
{
  "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
  "userName": "john.doe@example.com",
  "name": {
    "givenName": "John",
    "familyName": "Doe"
  },
  "emails": [
    { "value": "john.doe@example.com", "primary": true }
  ],
  "active": true,
  "externalId": "oid_abc123..."
}
```

**Response:**

```json
{
  "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
  "id": "user_uuid_001",
  "userName": "john.doe@example.com",
  "name": {
    "givenName": "John",
    "familyName": "Doe"
  },
  "active": true,
  "externalId": "oid_abc123...",
  "meta": {
    "resourceType": "User",
    "created": "2026-03-21T10:30:45Z",
    "lastModified": "2026-03-21T10:30:45Z",
    "location": "/api/v1/auth/scim/Users/user_uuid_001"
  }
}
```

### 3.6 Invite Flow

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/v1/auth/invites` | POST | Create invite (internal/B2B/local) |
| `GET /api/v1/auth/invites/:inviteCode` | GET | Check invite validity |
| `POST /api/v1/auth/invites/:inviteCode/accept` | POST | Accept invite (for local accounts) |

**`POST /api/v1/auth/invites` (Bulk create internal invites)**

```json
{
  "invites": [
    { "email": "alice@example.com", "type": "internal", "role": "EMPLOYEE" },
    { "email": "bob@example.com", "type": "internal", "role": "SUPERVISOR" }
  ],
  "expires_at": "2026-04-21T00:00:00Z",
  "auto_approve": false
}
```

**Response:**

```json
{
  "created": [
    {
      "invite_code": "invite_abc123...",
      "email": "alice@example.com",
      "type": "internal",
      "role": "EMPLOYEE",
      "created_at": "2026-03-21T10:30:45Z",
      "expires_at": "2026-04-21T00:00:00Z",
      "accept_url": "https://app.example.com/auth/invite/invite_abc123..."
    }
  ]
}
```

---

## 4. Validation Schemas (Zod)

```typescript
// apps/api/src/modules/auth/validators.ts

import { z } from 'zod';

export const identityProviderTypeSchema = z.enum(['oidc', 'saml', 'local', 'custom']);
export const providerCreateSchema = z.object({
  name: z.string().min(1).max(100),
  type: identityProviderTypeSchema,
  jwks_uri: z.string().url().optional(),
  client_id: z.string(),
  client_secret: z.string(),
  issuer: z.string().url(),
  scopes: z.array(z.string()).default(['openid', 'profile', 'email']),
  claims_mapping: z.record(z.string()),
  is_active: z.boolean().default(true),
});

export const providerUpdateSchema = providerCreateSchema.partial();

export const tokenValidationSchema = z.object({
  token: z.string(),
  provider_id: z.string().uuid(),
});

export const linkedIdentitySchema = z.object({
  provider_id: z.string().uuid(),
  token: z.string(),
  link_code: z.string().optional(),
});

export const profileResolutionSchema = z.object({
  user_id: z.string().uuid(),
});

export const inviteCreateSchema = z.object({
  invites: z.array(z.object({
    email: z.string().email(),
    type: z.enum(['internal', 'b2b', 'local']),
    role: z.enum(['EMPLOYEE', 'SUPERVISOR', 'MANAGER', 'COMPLIANCE_OFFICER', 'ADMIN']),
  })),
  expires_at: z.string().datetime(),
  auto_approve: z.boolean().default(false),
});

export type ProviderCreateInput = z.infer<typeof providerCreateSchema>;
export type TokenValidationInput = z.infer<typeof tokenValidationSchema>;
export type InviteCreateInput = z.infer<typeof inviteCreateSchema>;
```

---

## 5. Data Model Changes (Prisma)

```prisma
// data/prisma/schema.prisma

model IdentityProvider {
  id              String   @id @default(uuid())
  tenantId        String
  name            String
  type            String   // oidc, saml, local, custom
  jwksUri         String?
  clientId        String
  clientSecret    String   // encrypted at rest
  issuer          String
  scopes          String[] @default(["openid", "profile", "email"])
  claimsMapping   Json     // { email: "email", oid: "oid", ... }
  
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  createdBy       String   // user_id
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?
  
  // Metadata
  jwksCachedAt    DateTime?
  lastTestAt      DateTime?
  lastTestStatus  String?  // OK, FAILED
  
  // Relations
  linkedIdentities LinkedIdentity[]
  
  @@unique([tenantId, type, issuer])
  @@index([tenantId, isActive])
}

model LinkedIdentity {
  id              String   @id @default(uuid())
  userId          String
  providerId      String
  externalId      String   // oid from IdP
  email           String
  
  linkedAt        DateTime @default(now())
  lastLoginAt     DateTime?
  
  // Relations
  user            User     @relation(fields: [userId], references: [id])
  provider        IdentityProvider @relation(fields: [providerId], references: [id])
  
  @@unique([userId, providerId])
  @@index([providerId, externalId])
  @@index([email])
}

// Update User model
model User {
  id              String   @id @default(uuid())
  tenantId        String
  email           String
  givenName       String?
  familyName      String?
  
  avatar          String?
  department      String?
  title           String?
  phone           String?
  
  role            String   // EMPLOYEE, SUPERVISOR, ...
  isActive        Boolean  @default(true)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?
  lastLoginAt     DateTime?
  
  // Relations
  linkedIdentities LinkedIdentity[]
  
  @@unique([tenantId, email])
  @@index([tenantId])
}

model UserInvite {
  id              String   @id @default(uuid())
  tenantId        String
  inviteCode      String   @unique
  email           String
  type            String   // internal, b2b, local
  role            String
  
  createdAt       DateTime @default(now())
  createdBy       String   // user_id
  expiresAt       DateTime
  acceptedAt      DateTime?
  acceptedBy      String?  // user_id
  
  autoApprove     Boolean  @default(false)
  
  @@index([tenantId, expiresAt])
  @@index([inviteCode])
}
```

---

## 6. RBAC Rules

### 6.1 Provider Management

| Endpoint | EMPLOYEE | SUPERVISOR | MANAGER | COMPLIANCE_OFFICER | ADMIN |
|----------|:---:|:---:|:---:|:---:|:---:|
| `GET /api/v1/auth/providers` | ✗ | ✗ | ✗ | ✓ | ✓ |
| `POST /api/v1/auth/providers` | ✗ | ✗ | ✗ | ✗ | ✓ |
| `PUT /api/v1/auth/providers/:providerId` | ✗ | ✗ | ✗ | ✗ | ✓ |
| `DELETE /api/v1/auth/providers/:providerId` | ✗ | ✗ | ✗ | ✗ | ✓ |
| `POST /api/v1/auth/providers/:providerId/test` | ✗ | ✗ | ✗ | ✗ | ✓ |

### 6.2 Token & Profile

| Endpoint | EMPLOYEE | SUPERVISOR | MANAGER | COMPLIANCE_OFFICER | ADMIN |
|----------|:---:|:---:|:---:|:---:|:---:|
| `POST /api/v1/auth/validate` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /api/v1/auth/profiles/:userId` | ✓ (any) | ✓ (any) | ✓ (any) | ✓ (any) | ✓ (any) |
| `GET /api/v1/auth/identities` | ✓ (self) | ✓ (self) | ✓ (self) | ✓ (self) | ✓ (any) |
| `POST /api/v1/auth/identities/link` | ✓ (self) | ✓ (self) | ✓ (self) | ✓ (self) | ✓ (any) |

### 6.3 Invites

| Endpoint | EMPLOYEE | SUPERVISOR | MANAGER | COMPLIANCE_OFFICER | ADMIN |
|----------|:---:|:---:|:---:|:---:|:---:|
| `POST /api/v1/auth/invites` | ✗ | ✗ | ✓ | ✓ | ✓ |
| `GET /api/v1/auth/invites/:inviteCode` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `POST /api/v1/auth/invites/:inviteCode/accept` | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## 7. Error Responses

```json
{
  "error": {
    "code": "IDENTITY_ERROR",
    "message": "Description",
    "details": {}
  }
}
```

| Scenario | HTTP Code | Error Code |
|----------|---|---|
| Provider not found | 404 | `PROVIDER_NOT_FOUND` |
| Invalid token signature | 401 | `INVALID_SIGNATURE` |
| Token expired | 401 | `TOKEN_EXPIRED` |
| Provider connection failed | 503 | `PROVIDER_UNAVAILABLE` |
| Identity already linked | 409 | `IDENTITY_ALREADY_LINKED` |
| Invite not found or expired | 404 | `INVITE_INVALID` |
| Email not found in provider | 404 | `EMAIL_NOT_FOUND` |
| Duplicate provider config | 409 | `PROVIDER_ALREADY_EXISTS` |

---

## 8. Security Considerations

### 8.1 Credential Management

- **Client secrets encrypted at rest** — Using AWS KMS / Azure Key Vault
- **JWKS caching** — Cached for 1 hour; stale cache rejected if provider responds
- **Token signing** — API signs returned JWT with RS256; frontend validates against API's public key
- **No secrets in logs** — Client IDs/secrets redacted from audit logs

### 8.2 Identity Linking

- **Email-anchored linking** — Only link if both tokens have same email address
- **Confirmation code required** — Prevent account takeover via social engineering
- **Unlink allowed anytime** — User can disconnect identity, but must maintain at least one provider
- **Audit trail** — Every link/unlink recorded in AuditLog

### 8.3 SCIM Security

- **Bearer token authentication** — Azure AD must provide shared secret
- **IP whitelisting** — Only Azure AD IPs allowed to POST to SCIM endpoint
- **Rate limiting** — 1000 req/min per Azure AD tenant
- **Soft deletes** — SCIM deletes mark `isActive = false`, never hard-delete (audit trail)

### 8.4 Multi-Tenancy

- **Provider isolation** — Each provider belongs to single tenant; queries always filtered by `tenantId`
- **Email uniqueness per tenant** — Multiple tenants can have user with email `john@example.com`; uniqueness is `(tenantId, email)`
- **Cross-tenant token rejection** — If token's issuer doesn't match a configured provider for that tenant, reject

---

## 9. Implementation Architecture

### 9.1 Token Validation Pipeline

```
POST /api/v1/auth/validate {token, provider_id}
  → 1. Load provider config (jwks_uri, issuer, claims_mapping)
  → 2. Fetch JWKS from provider (with caching)
  → 3. Verify signature using JWKS
  → 4. Validate issuer & audience claims
  → 5. Extract claims using claimsMapping
  → 6. Look up LinkedIdentity by (providerId, externalId)
  → 7. If not found, auto-create User + LinkedIdentity
  → 8. Return signed JWT + user metadata
```

### 9.2 Profile Resolution

**Behind the scenes (business logic):**

```typescript
// Frontend calls /api/v1/auth/profiles/:userId
// Backend returns: { user_id, email, given_name, family_name, ... }
// Frontend uses this to display "John Doe" next to user_id in tables/lists
```

**Why:** Avoids leaking full profiles in business API responses (templates, qualifications return `user_id` only).

### 9.3 SCIM Pull Strategy

```
1. Azure AD provisioning job runs: POST /api/v1/auth/scim/Users/{user_data}
2. E-CLAT receives, creates User + LinkedIdentity (provider=Entra, externalId=oid)
3. On update: PATCH /api/v1/auth/scim/Users/{id} updates User fields
4. On delete: DELETE /api/v1/auth/scim/Users/{id} sets isActive=false
5. No push: E-CLAT never calls Azure AD APIs (pull model only)
```

---

## 10. Phased Rollout

### Phase 1 (Sprint 5) — Foundation

- [ ] Create Prisma models (IdentityProvider, LinkedIdentity, UserInvite)
- [ ] Implement token validation endpoint with single provider (Entra)
- [ ] Add provider CRUD endpoints (list, get, create, update, soft-delete)
- [ ] Implement profile resolution endpoint
- [ ] Unit tests for token validation (Entra JWKS)
- **Success Criteria:** Can validate Entra tokens, profile endpoint works

### Phase 2 (Sprint 6) — Multi-IdP & Linking

- [ ] Add Okta + SAML provider types
- [ ] Implement linked identities (link/unlink endpoints)
- [ ] Email-anchored profile merge logic
- [ ] Integration tests with mock OIDC provider
- **Success Criteria:** User can login with Okta, link to Entra profile, see unified profile

### Phase 3 (Sprint 7) — SCIM & Invites

- [ ] Implement SCIM endpoint (Schemas, Users CRUD)
- [ ] Configure Azure AD provisioning integration
- [ ] Implement invite flow (create, accept, expire)
- [ ] Bulk invite endpoints
- **Success Criteria:** Azure AD provisioning syncs users, bulk invites work

### Phase 4 (Production, 2026-Q2) — Production Readiness

- [ ] Key Vault integration for client secrets
- [ ] Rate limiting on SCIM endpoint
- [ ] Provider health dashboard
- [ ] Multi-provider failover logic (if Entra down, fall back to Okta)
- **Success Criteria:** Multi-provider redundancy, zero downtime, full audit trail

---

## 11. Acceptance Criteria

✅ **Acceptance criteria for Phase 1:**

- [ ] Can POST token to `/api/v1/auth/validate`, get back signed JWT
- [ ] Invalid token signature returns 401
- [ ] Provider test endpoint validates JWKS connectivity
- [ ] Profile endpoint returns user name/email
- [ ] All provider operations logged to AuditLog
- [ ] Zero leakage of client secrets in responses/logs

---

## 12. Compliance Notes

- **Multi-tenancy audit** — Provider access strictly filtered by `tenantId` ✓
- **Identity lifecycle** — LinkedIdentity record is immutable once created ✓
- **Regulatory PII** — Profiles contain name/email; stored in Postgres with standard encryption ✓

---

## 13. Related Specs

- **RBAC API Spec:** `rbac-api-spec.md` (role enforcement)
- **Service Architecture:** `service-architecture-spec.md` (Decision 2, Decision 12)
- **App Spec:** `app-spec.md` (authentication flow diagram)

