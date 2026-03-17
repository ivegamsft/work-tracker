# Decision: Identity Foundation — Issues #134, #135

**Decision Maker:** Bunk (Backend Dev)
**Status:** Implemented
**Date:** 2026-03-17
**Related Issues:** #134, #135
**Related Decisions:** Decision #2 (Multi-IdP), Decision #12 (Semi-anonymous profiles)
**Spec:** `docs/specs/identity-api.md`

---

## Context

E-CLAT needs multi-IdP authentication support (Decision #2). The existing auth module only handles JWT with a single secret. This implementation establishes the foundation layer: provider registry and token validation abstraction.

## Decisions Made

### 1. Identity Provider as First-Class Prisma Model

Added `IdentityProvider` model with `IdentityProviderType` enum (OIDC, SAML, LOCAL, CUSTOM). Stored as a database entity rather than configuration file because:
- Admin CRUD via API (no redeployment to add providers)
- Audit trail on provider changes
- Per-provider metadata (JWKS cache timestamps, test status)
- Soft-delete preserves history

### 2. Strategy Pattern for Token Validation

`TokenValidationStrategy` interface with pluggable implementations:
- `oidcStrategy` — JWKS-based RSA verification (Entra, Okta, Auth0, any OIDC)
- `localStrategy` — HMAC/secret-based (on-prem, dev environments)
- Custom strategies can be registered at runtime via `registerStrategy()`

This allows adding SAML or custom validation without modifying existing code.

### 3. Provider-Driven Claims Normalization

Each `IdentityProvider` stores a `claimsMapping` JSON field that maps provider-specific claim names to internal standard format. Well-known mappings for Entra/Okta/Auth0 ship as defaults.

Internal format (`NormalizedClaims`): `sub`, `email`, `given_name`, `family_name`, `name`, `roles`, `groups`.

### 4. JWKS Cache with Graceful Degradation

TTL-based in-memory cache (1 hour). On fetch failure, returns stale cached keys rather than failing. Supports per-URI invalidation and automatic key rotation retry (if kid not found, invalidate cache and re-fetch once).

### 5. Issuer-Based Provider Resolution

When `provider_id` is not specified in token validation, the validator decodes the token's `iss` claim and looks up the matching active provider. This enables transparent multi-IdP without client awareness.

### 6. RBAC on Provider Management

Provider CRUD locked to ADMIN (exact role match). List access for COMPLIANCE_OFFICER+ (for audit visibility). Token validation endpoint is unauthenticated (it validates external tokens before the user has a local session).

## Route Prefix

All identity endpoints under `/api/v1/auth/` per API v1 namespace migration strategy.

## Files

| File | Purpose |
|------|---------|
| `data/prisma/schema.prisma` | IdentityProvider model + enum |
| `apps/api/src/modules/identity/validators.ts` | Zod schemas |
| `apps/api/src/modules/identity/service.ts` | Provider CRUD service |
| `apps/api/src/modules/identity/router.ts` | Express routes |
| `apps/api/src/modules/identity/index.ts` | Barrel export |
| `apps/api/src/common/auth/tokenValidator.ts` | Strategy pattern + validator |
| `apps/api/src/common/auth/jwksCache.ts` | JWKS key cache |
| `apps/api/src/common/auth/claimsNormalizer.ts` | Claims mapping |
| `apps/api/src/common/auth/index.ts` | Auth barrel |
| `apps/api/tests/unit/identity.test.ts` | 42 tests |

## Future Work (Not in Scope)

- Linked identities (Issue scope: future)
- SCIM provisioning (spec Phase 2)
- User invite flow (spec Phase 3)
- SAML strategy implementation (framework ready, needs xml-crypto)
- Profile resolution endpoint (Decision #12)
