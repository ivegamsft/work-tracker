# Identity Architecture Specification — E-CLAT

> **Status:** Proposed Architecture Spec  
> **Owner:** Freamon (Lead / Architect)  
> **Date:** 2026-03-21  
> **Applies To:** `apps/api/src/modules/auth`, `apps/web`, `packages/shared`, `data/prisma`  
> **Issue:** #93 (Identity-01)  
> **Related Docs:** `docs/specs/entra-auth-design.md`, `docs/specs/multi-tenant-architecture.md`, `docs/requirements/eclat-spec.md`

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Current-State Assessment](#2-current-state-assessment)
3. [Multi-IdP Architecture](#3-multi-idp-architecture)
4. [Bootstrap Flow](#4-bootstrap-flow)
5. [Profile Isolation (Semi-Anonymous)](#5-profile-isolation-semi-anonymous)
6. [Data Model Changes](#6-data-model-changes)
7. [API Contracts](#7-api-contracts)
8. [Security Considerations](#8-security-considerations)
9. [Migration Path](#9-migration-path)
10. [Phased Rollout Plan](#10-phased-rollout-plan)
11. [Locked Decisions](#11-locked-decisions)

---

## 1. Problem Statement

E-CLAT currently uses **local JWT authentication** with hardcoded credentials. Three gaps prevent enterprise deployment:

1. **No multi-provider support:** GitHub-style IdP federation (primary + additional providers) not possible; no B2B invite flows.
2. **No PII isolation:** All user business data (name, email, qualifications) stored alongside sensitive records. Breach exposes compliance history.
3. **No profile merge:** Users with multiple identities (corporate email + personal provider) create duplicate records; no email-anchored deduplication.

**Objective:** Implement GitHub-style multi-IdP architecture with:
- First-user bootstrap (sign-up creates tenant + admin account)
- Primary + additional provider configuration per tenant
- B2B invite flow (admin invites user by email; user picks IdP at first login)
- SCIM provisioning for directory sync
- Semi-anonymous PII isolation (UUIDs in business tables; PII in encrypted Profile)
- Linked identities model (one email → multiple IdP credentials)

---

## 2. Current-State Assessment

### 2.1 Authentication Today
- `apps/api/src/modules/auth/` implements local JWT:
  - `POST /api/auth/login` — username/password → JWT
  - `POST /api/auth/register` — create user locally
  - `POST /api/auth/refresh` — refresh token
  - No IdP backing; hardcoded users in seed
- `apps/web` uses `AuthContext` + JWT in localStorage
- No identity linking; no federation

### 2.2 User Data Today
- `Employee` table contains: firstName, lastName, email, role, status
- No separate profile/identity tables
- No PII separation
- No soft delete on user (if deleted, historical qualifications expose name)

### 2.3 Compliance Gaps
- **No multi-tenancy:** Single app instance = single tenant today
- **No SCIM:** Cannot sync Entra ID / Google Workspace
- **No IdP audit:** No log of which provider user logged in with
- **No profile merge:** Duplicate accounts if user has 2 email addresses

---

## 3. Multi-IdP Architecture

### 3.1 IdP Registration Model

Each tenant configures one **primary** IdP + zero-or-more **additional** IdPs:

```
Tenant
├── primaryIdP (required)
│   ├── type: 'ENTRA_ID' | 'GOOGLE' | 'GITHUB' | 'OKTA' | 'CUSTOM_OIDC'
│   ├── clientId
│   ├── clientSecret (encrypted at rest)
│   ├── redirectUri
│   └── metadata (discovery endpoint, etc.)
└── additionalIdPs (optional)
    ├── [GitHubIdP]
    │   ├── type: 'GITHUB'
    │   ├── clientId
    │   └── ...
    └── [GoogleIdP]
        ├── type: 'GOOGLE'
        ├── clientId
        └── ...
```

### 3.2 Identity Binding Model

**LinkedIn-style identity model:**
- One **Profile** (email-addressed, PII) → multiple **IdentityCredentials** (one per provider)
- Example: user@company.com has credentials from:
  - Entra ID (`oid: abc123`)
  - GitHub (`id: github/user123`)
  - (Optional) Google (`sub: google-def456`)

```
Profile
├── id (UUID)
├── email (unique, immutable)
├── firstName (encrypted)
├── lastName (encrypted)
├── phone (encrypted)
├── createdAt
├── deletedAt (soft delete)
└── IdentityCredentials
    ├── [Entra ID]
    │   ├── providerId: 'entra'
    │   ├── providerUserId: 'oid'
    │   └── verifiedAt
    ├── [GitHub]
    │   ├── providerId: 'github'
    │   ├── providerUserId: 'id'
    │   └── verifiedAt
    └── [Google]
        ├── providerId: 'google'
        ├── providerUserId: 'sub'
        └── verifiedAt
```

### 3.3 User → Profile → Employee → Role

**Logical flow:**
1. **IdP login** → IdentityCredential matched (by provider + providerUserId)
2. **Credential lookup** → Profile (email + PII)
3. **Tenant scope** → TenantMember (join table: tenant_id + profile_id)
4. **Role** → TenantMember.role (EMPLOYEE, SUPERVISOR, MANAGER, CO, ADMIN)
5. **Business identity** → Employee (id = UUID, no PII, just firstName/lastName aliases for UI)

### 3.4 Role-Hierarchy in Multi-Tenant

Roles are tenant-scoped:
- User may be ADMIN in Tenant-A, EMPLOYEE in Tenant-B
- Session token includes `tenantId` + `role`
- All data queries scoped by `tenantId`

---

## 4. Bootstrap Flow

### 4.1 First-User Signup (Tenant Creation)

**Scenario:** Company XYZ signs up; John (john@xyz.com) is first user.

```
1. John visits app
2. "Sign Up" → Select primary IdP (e.g., "Entra ID")
3. Redirect to Entra ID consent screen
4. Entra ID returns: { oid, email: john@xyz.com, given_name, family_name }
5. App detects no Profile with john@xyz.com
6. Create: Tenant(name: "XYZ Corp") + Profile(email) + IdentityCredential + TenantMember(role: ADMIN)
7. JWT issued: { sub: profileId, tenant: tenantId, role: ADMIN }
8. Dashboard loaded; John becomes tenant admin
```

**Result:**
- ✓ Tenant created
- ✓ Profile created
- ✓ Entra credential linked
- ✓ John is ADMIN in XYZ Corp

### 4.2 B2B Invite Flow (Existing Tenant)

**Scenario:** John invites jane@xyz.com (colleague) to XYZ Corp.

```
1. John (ADMIN) calls: POST /api/v1/auth/invitations
   { email: jane@xyz.com, role: MANAGER, expiresIn: 7d }
2. App creates Invitation(token, email, tenantId, expiresIn)
3. Email sent: "You're invited to XYZ Corp. Click here: {invite_link}?token={token}"
4. Jane clicks link
5. App verifies token, detects no existing Invitation
6. "You're logging in with..." → Jane picks Entra ID (or Google if configured)
7. Entra ID returns jane@xyz.com (matches invitation)
8. App checks: exists Profile(jane@xyz.com)?
   - If NO: create Profile + IdentityCredential + TenantMember(role: MANAGER)
   - If YES: add IdentityCredential to existing Profile + TenantMember(role: MANAGER)
9. Jane is now MANAGER in XYZ Corp
```

**Result:**
- ✓ Invitation consumed
- ✓ Profile created (or linked)
- ✓ Jane added to tenant with correct role
- ✓ Invitation token invalidated

### 4.3 Additional IdP Link (LinkedIn-style)

**Scenario:** Jane (Entra ID) wants to also log in with GitHub.

```
1. Jane goes to Settings → "Link GitHub Account"
2. Redirect to GitHub OAuth
3. GitHub returns: { id: github/jane123, login: jane, email: jane@example.com }
4. App detects: GitHub email ≠ Entra email (jane@example.com ≠ jane@xyz.com)
5. Conflict: Ask Jane to confirm identity ("These emails differ; confirm you own both")
6. Jane confirms
7. Create IdentityCredential(providerId: github, providerUserId: github/jane123) linked to existing Profile
8. Jane can now login with either Entra or GitHub
```

**Result:**
- ✓ GitHub credential linked to existing Profile
- ✓ Email mismatch detected + confirmed
- ✓ Jane can use either IdP at login
- ✓ Session always scoped to same Profile

---

## 5. Profile Isolation (Semi-Anonymous)

### 5.1 PII Encryption Strategy

**Sensitive fields** (firstName, lastName, email, phone) stored **encrypted** in `Profile` table:

```sql
-- Profile table (encrypted columns)
CREATE TABLE Profile (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,  -- searchable, encrypted at-rest, indexed
  firstName TEXT NOT NULL,      -- encrypted
  lastName TEXT NOT NULL,       -- encrypted
  phone TEXT,                   -- encrypted (optional)
  createdAt TIMESTAMP,
  deletedAt TIMESTAMP
);

-- Business data uses UUID only, no PII
CREATE TABLE Employee (
  id UUID PRIMARY KEY,  -- same as Profile.id (but stored as FK to TenantMember)
  tenantId UUID NOT NULL,
  firstName TEXT,       -- NOT THE REAL NAME; display alias only
  lastName TEXT,        -- NOT THE REAL NAME; display alias only
  role TEXT,            -- stored locally for quick lookup
  status TEXT,
  createdAt TIMESTAMP
);
```

**Key principle:**
- Compliance records (Qualification, HourRecord, Document) reference `Employee.id`
- `Employee` table has no real PII
- Real name + email lookup goes: `Employee.id` → `Profile.id` → `Profile` (requires decryption)
- Decryption only happens when explicitly needed (profile view, audit export)

### 5.2 Encryption & Key Management

**At-rest encryption:**
- Use **Azure Key Vault** (or on-prem equivalent: Hashicorp Vault)
- Profile table uses Transparent Data Encryption (TDE) at DB layer
- PII columns also application-encrypted with per-tenant keys

**Keys:**
- Master key: Stored in Key Vault, never touches application
- Per-tenant key: Derived from master + tenantId (HKDF)
- On app startup: Fetch master key, keep in memory (cleared on graceful shutdown)

**Example (pseudocode):**
```typescript
// Encrypt when creating Profile
const clearName = 'Jane';
const tenantKey = await keyVault.deriveKey(tenantId); // Master key + tenantId
const encrypted = encrypt(clearName, tenantKey);      // AES-256-GCM
await db.profile.create({ firstName: encrypted });

// Decrypt when reading Profile (rare path)
const profile = await db.profile.findUnique({ id: profileId });
const tenantKey = await keyVault.deriveKey(tenantId);
const realName = decrypt(profile.firstName, tenantKey);
```

### 5.3 Breach-Resistant Design

**Scenario:** Database leaked.

- **Without PII isolation:** Attacker sees all names, emails, AND compliance history (who's certified, who's medically cleared)
- **With PII isolation:** 
  - Attacker sees Employee table (UUIDs, statuses) — no names
  - Attacker sees Qualification/HourRecord tables (UUIDs, evidence) — no link to real people
  - Real names locked in encrypted Profile + separate keys in Key Vault
  - Attacker must also breach Key Vault to decrypt

**Consequence:** Compliance data is pseudonymized; regulatory impact reduced.

---

## 6. Data Model Changes

### 6.1 New & Modified Prisma Models

```prisma
// ============ IDENTITY MODELS ============

model Tenant {
  id                String    @id @default(uuid())
  name              String    @unique
  slug              String    @unique
  logoUrl           String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  deletedAt         DateTime?
  
  // Relations
  primaryIdPId      String
  primaryIdP        IdPConfig @relation("primaryIdP", fields: [primaryIdPId], references: [id])
  additionalIdPs    IdPConfig[] @relation("additionalIdPs")
  members           TenantMember[]
  invitations       Invitation[]
  scimTokens        SCIMToken[]
}

model IdPConfig {
  id                String    @id @default(uuid())
  tenantId          String
  tenant            Tenant    @relation("primaryIdP", fields: [tenantId], references: [id], onDelete: Cascade)
  
  // Secondary relation for additional IdPs
  tenantAdditional  Tenant?   @relation("additionalIdPs")
  tenantIdAdditional String?
  
  type              String    // ENTRA_ID, GOOGLE, GITHUB, OKTA, CUSTOM_OIDC
  displayName       String    // "Sign in with Microsoft" / "Sign in with GitHub"
  clientId          String
  clientSecret      String    @db.Text // Encrypted at rest
  discoveryUrl      String?   // OIDC discovery endpoint
  redirectUri       String
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  @@unique([tenantId, type]) // One IdP type per tenant
  @@index([tenantId])
}

model Profile {
  id                String    @id @default(uuid())
  email             String    @unique
  firstName         String    // Encrypted
  lastName          String    // Encrypted
  phone             String?   // Encrypted
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  deletedAt         DateTime?
  
  // Relations
  identityCredentials IdentityCredential[]
  tenantMembers     TenantMember[]
}

model IdentityCredential {
  id                String    @id @default(uuid())
  profileId         String
  profile           Profile   @relation(fields: [profileId], references: [id], onDelete: Cascade)
  
  providerId        String    // 'entra', 'github', 'google', etc.
  providerUserId    String    // OID, GitHub ID, Google SUB, etc.
  providerEmail     String?   // May differ from Profile.email
  verifiedAt        DateTime
  
  metadata          String?   @db.Text // JSON: token info, claims, etc.
  lastUsedAt        DateTime?
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  @@unique([profileId, providerId]) // One credential per provider per profile
  @@unique([providerId, providerUserId]) // Prevent duplicate provider claims
  @@index([profileId])
  @@index([providerId, providerUserId])
}

model TenantMember {
  id                String    @id @default(uuid())
  tenantId          String
  tenant            Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  profileId         String
  profile           Profile   @relation(fields: [profileId], references: [id], onDelete: Cascade)
  
  role              String    // EMPLOYEE, SUPERVISOR, MANAGER, CO, ADMIN (tenant-scoped)
  status            String    // ACTIVE, INACTIVE, PENDING_INVITE
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  @@unique([tenantId, profileId])
  @@index([tenantId])
  @@index([profileId])
}

model Invitation {
  id                String    @id @default(uuid())
  tenantId          String
  tenant            Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  email             String
  token             String    @unique // Cryptographically random
  role              String    // Role granted if accepted
  
  createdBy         String    // Profile ID of inviter
  expiresAt         DateTime
  acceptedAt        DateTime?
  
  createdAt         DateTime  @default(now())
  
  @@index([tenantId])
  @@index([email])
}

// SCIM provisioning support
model SCIMToken {
  id                String    @id @default(uuid())
  tenantId          String
  tenant            Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  token             String    @unique // Bearer token for SCIM requests
  createdBy         String    // Profile ID (ADMIN)
  revokedAt         DateTime?
  
  createdAt         DateTime  @default(now())
  
  @@index([tenantId])
}

// ============ EXISTING MODELS (MODIFIED) ============

model Employee {
  // Was:
  // id, firstName, lastName, email, role, status, createdAt, updatedAt, deletedAt
  //
  // Now:
  id                String    @id // Same as Profile.id (foreign key)
  tenantId          String
  
  firstName         String    // Display alias (NOT the real name)
  lastName          String    // Display alias (NOT the real name)
  status            String    // ACTIVE, INACTIVE
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  deletedAt         DateTime?
  
  // Relations
  qualifications    Qualification[]
  medical           MedicalClearance[]
  documents         Document[]
  hourRecords       HourRecord[]
  notifications     Notification[]
  
  @@index([tenantId])
  @@index([tenantId, status])
}

model AuditLog {
  // Was: id, userId, action, resourceType, resourceId, timestamp, details
  // Now: Add profileId (for trace-back to real identity)
  id                String    @id @default(uuid())
  tenantId          String
  profileId         String?   // May be null if system action
  userId            String    // Employee.id (FK; immutable ref)
  action            String    // CREATE, READ, UPDATE, DELETE
  resourceType      String    // Employee, Qualification, Document, etc.
  resourceId        String
  timestamp         DateTime  @default(now())
  details           String    @db.Text // JSON
  ipAddress         String?
  
  @@index([tenantId, timestamp])
  @@index([profileId])
  @@index([userId])
}

// ALL OTHER MODELS (Qualification, MedicalClearance, etc.)
// Add: tenantId @index everywhere for multi-tenant scoping
```

### 6.2 Migration Steps

1. Add new tables (Tenant, IdPConfig, Profile, IdentityCredential, TenantMember, Invitation, SCIMToken)
2. Create default Tenant (for v0.4.0MVP, single-tenant mode)
3. Migrate existing Employee records:
   - For each employee: Create Profile (email extracted, PII encrypted), IdentityCredential (local), TenantMember
4. Backfill tenantId on all tables
5. Add foreign keys + constraints
6. Update Employee model (firstName/lastName become display aliases; real names go to Profile)

---

## 7. API Contracts

### 7.1 Auth Routes (Redesigned)

**Removed (old JWT):**
- ~~`POST /api/auth/login`~~
- ~~`POST /api/auth/register`~~

**New OAuth/OIDC:**

```
GET /api/v1/auth/providers
  Response: { primaryIdP: {...}, additionalIdPs: [...] }

POST /api/v1/auth/authorize
  Body: { providerId: 'entra', tenantSlug: 'xyz-corp' }
  Response: { redirectUri: '...' }
  Redirects to IdP login

POST /api/v1/auth/callback
  Body: { code, state, tenantSlug, providerId }
  Verifies code with IdP
  Response: { accessToken, refreshToken, expiresIn }
  Sets secure httpOnly cookie

POST /api/v1/auth/refresh
  (Unchanged behavior; uses refresh token)
  Response: { accessToken, expiresIn }

POST /api/v1/auth/logout
  Clears cookie
  Response: { ok: true }
```

### 7.2 Invitation Routes (New)

```
POST /api/v1/auth/invitations
  Requires: ADMIN role
  Body: { email, role, expiresIn }
  Response: { invitationId, token, expiresAt }
  Side effect: Email sent with invite link

GET /api/v1/auth/invitations/:token
  (Unauthenticated)
  Response: { email, role, tenantName, expiresAt }

POST /api/v1/auth/invitations/:token/accept
  Body: { providerId, email }
  Verifies token + email match
  Calls IdP authorization
  Response: { accessToken, redirectUri }

GET /api/v1/auth/invitations
  Requires: ADMIN role
  Response: { invitations: [{ email, role, createdAt, status }] }

DELETE /api/v1/auth/invitations/:invitationId
  Requires: ADMIN role
  Response: { ok: true }
```

### 7.3 Profile Routes (New)

```
GET /api/v1/auth/profile
  Requires: Authenticated
  Response: { id, email, firstName, lastName, phone, identityCredentials: [...] }

PATCH /api/v1/auth/profile
  Requires: Authenticated
  Body: { firstName?, lastName?, phone? }
  Response: { id, email, firstName, lastName, phone }

GET /api/v1/auth/profile/identities
  Requires: Authenticated
  Response: { identities: [{ providerId, lastUsedAt, email }] }

POST /api/v1/auth/profile/identities/link
  Requires: Authenticated
  Body: { providerId }
  Starts OAuth flow to link additional IdP
  Response: { redirectUri }

POST /api/v1/auth/profile/identities/:credentialId/unlink
  Requires: Authenticated
  Prevents unlinking if it's the last credential
  Response: { ok: true }
```

### 7.4 Tenant Routes (Admin Only)

```
GET /api/v1/auth/tenant
  Requires: ADMIN role
  Response: { id, name, slug, primaryIdP: {...}, additionalIdPs: [...] }

PATCH /api/v1/auth/tenant
  Requires: ADMIN role
  Body: { name?, logoUrl? }
  Response: { id, name, slug, ... }

POST /api/v1/auth/tenant/idps
  Requires: ADMIN role
  Body: { type, displayName, clientId, clientSecret, discoveryUrl }
  Response: { id, type, displayName }

DELETE /api/v1/auth/tenant/idps/:idpId
  Requires: ADMIN role
  Prevents deletion if primary IdP
  Response: { ok: true }

POST /api/v1/auth/tenant/scim-tokens
  Requires: ADMIN role
  Response: { token, createdAt }

GET /api/v1/auth/tenant/members
  Requires: ADMIN role
  Response: { members: [{ id, email, role, status, createdAt }] }

PATCH /api/v1/auth/tenant/members/:memberId
  Requires: ADMIN role
  Body: { role? }
  Response: { id, email, role }

DELETE /api/v1/auth/tenant/members/:memberId
  Requires: ADMIN role
  Soft-deletes TenantMember
  Response: { ok: true }
```

---

## 8. Security Considerations

### 8.1 Token & Session Management

**Access Token (short-lived):**
- JWT issued by `/callback`
- Payload: `{ sub: profileId, tenantId, role, email_hash }`
- Expires: 15 minutes
- Storage: HttpOnly cookie (not localStorage)
- Revocation: Token blacklist (short-lived, so blacklist is small)

**Refresh Token (long-lived):**
- Issued alongside access token
- Stored in secure httpOnly cookie, `Path=/api/v1/auth/refresh`
- Expires: 7 days (rotates on each refresh)
- Cannot be used for API calls (separate cookie, separate path)

**CSRF Protection:**
- OAuth state parameter (standard OIDC)
- SameSite=Strict cookies
- POST requests require CSRF token (for non-OAuth flows)

### 8.2 IdP Secret Rotation

**Client secrets stored encrypted in DB:**
- Encrypted at rest via TDE + app-level encryption
- Decrypted only during IdP calls
- Implement secret rotation: New secret + old secret valid for 7 days
- After rotation, delete old secret

### 8.3 Email Verification

**Profile creation via IdP:**
- IdP already verified user's email ownership (via their login flow)
- We trust IdP's email claim
- No additional email verification needed (reduces friction)

**B2B Invitations:**
- Token sent in email (attacker cannot auto-accept without email access)
- Token expires after 7 days
- One-time use (invalidated after accept/reject)

### 8.4 Linked Identities

**Email mismatch detection:**
- If user links GitHub (jane@personal.com) to Entra ID profile (jane@company.com):
  - Require explicit confirmation ("You own both emails?")
  - Log to audit trail
  - Only then create credential

**Credential hijacking prevention:**
- Each IdentityCredential is unique to Profile
- Attacker cannot reuse providerUserId across multiple Profiles
- DB constraint: `UNIQUE(providerId, providerUserId)`

### 8.5 SCIM Security

**SCIM tokens:**
- Bearer tokens, 256-bit random
- Scoped to tenant (token can only modify that tenant)
- Can be revoked immediately
- Audit log every SCIM operation (user created, role changed, deprovisioned)

**Rogue IdP protection:**
- SCIM operations must come from registered IdP (e.g., Entra ID service principal)
- Verify SCIM source (IP whitelist optional)

---

## 9. Migration Path

### 9.1 Phase 1 (v0.4.0): Single-Tenant Local Auth

**Keep existing JWT auth; add multi-IdP skeleton:**
- Create Tenant table (default: "E-CLAT")
- Create Profile + IdentityCredential tables (empty)
- Create TenantMember join table (backfill from existing Employee.role)
- No IdP routes yet; existing `/api/auth/login` still works
- Tests: Pass; no breaking changes

### 9.2 Phase 2 (v0.5.0): OAuth Bootstrap

**Add OAuth routes + first-user setup:**
- Implement `/api/v1/auth/providers`, `/api/v1/auth/callback`
- Add Entra ID + GitHub IdP config (per tenant)
- Implement Invitation flow
- New signups use OAuth; existing JWT still works (parallel auth)
- Add Profile scoping to all data queries
- Tests: New OAuth flow + invitation tests

### 9.3 Phase 3 (v0.6.0): PII Isolation + SCIM

**Enable PII encryption + directory sync:**
- Encrypt Profile PII columns
- Migrate to key-based decryption (Key Vault)
- Implement SCIM endpoints
- Remove Employee.email; make firstName/lastName display aliases
- Tests: Encryption, SCIM provisioning, breach scenarios

### 9.4 Phase 4 (v1.0.0): Decommission Local Auth

**Remove legacy JWT:**
- Deprecate `/api/auth/login` (return 410 Gone)
- Force password reset flow → OAuth migration
- Archive old auth module
- Finalize multi-tenant scalability

---

## 10. Phased Rollout Plan

### 10.1 Sprint 5 (1 week): Schema + Skeleton
- [x] Create Tenant, Profile, IdentityCredential, TenantMember, Invitation, SCIMToken models
- [x] Backfill default Tenant + TenantMember join data
- [x] Add tenantId to all data tables
- **Deliverable:** Prisma schema updated; migrations run; no API changes

### 10.2 Sprint 6 (2 weeks): OAuth Routes + Invitations
- [x] Implement OAuth callback handler
- [x] Implement Invitation creation + acceptance
- [x] Add profile routes (read, update, link identities)
- [x] Dual-auth: JWT + OAuth both work
- **Deliverable:** OAuth signup flow working; invitations testable

### 10.3 Sprint 7 (2 weeks): PII Isolation
- [x] Encrypt Profile columns (firstName, lastName, email, phone)
- [x] Implement Key Vault integration
- [x] Update Employee model (display aliases, no real PII)
- [x] Add decryption path for profile view
- **Deliverable:** PII encrypted; profile reads work

### 10.4 Sprint 8 (1 week): SCIM + Tenant Admin
- [x] Implement SCIM provisioning endpoints
- [x] Add tenant configuration routes (IdP management)
- [x] Add member management (role changes, deprovisioning)
- **Deliverable:** Entra ID directory sync testable

### 10.5 Sprint 9+: Testing + Decommission
- [ ] 40+ OAuth + SCIM tests
- [ ] Deprecate local JWT routes (Phase 4)
- [ ] Production rollout (single-tenant → multi-tenant)

---

## 11. Locked Decisions

### 11.1 Decision #2: Multi-IdP Architecture
- **Relevance:** This spec implements GitHub-style first-user bootstrap, primary + additional providers, B2B invite, email-anchored profile merge, SCIM.
- **Implementation:** IdPConfig, IdentityCredential, Invitation, Profile models encapsulate multi-IdP patterns.

### 11.2 Decision #12: Semi-Anonymous Profiles
- **Relevance:** PII isolation via encrypted Profile table; business data uses UUID only.
- **Implementation:** Employee.firstName/lastName become display aliases; real names encrypted in Profile.

### 11.3 Decision #1: Tiered Isolation
- **Relevance:** Tenant table + TenantMember join support both shared (SMB) and dedicated (enterprise) deployments.
- **Implementation:** tenantId indexed on all tables; future DB-per-tenant via connection resolver.

### 11.4 Decision #8: Group Mapping + Claims
- **Relevance:** B2B invitations + SCIM support claim-driven auto-assignment from IdP attributes.
- **Implementation:** Invitation.role + TenantMember.role fields; future SCIM group-to-role mapping.

### 11.5 Decision #3: Modular Monolith
- **Relevance:** Auth module stays independent; identity backing (JWT → OAuth) swappable.
- **Implementation:** AuthService interface abstracts token strategy; OAuth layer pluggable.

---

## Next Steps

1. **Sprint 5:** Implement Prisma schema + migrations
2. **Sprint 6:** Implement OAuth callback + Invitation routes
3. **Sprint 7:** Implement PII encryption + Profile routes
4. **Sprint 8:** Implement SCIM + Tenant admin routes
5. **Sprint 9+:** Test + deprecate local JWT

**Completion Target:** v0.6.0 (multi-tenant, multi-IdP, SCIM-synced, PII-isolated, compliance-ready)
