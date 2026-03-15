# Skill: Entra ID Auth Pattern for Multi-Layer IaC Projects

## When to Use
- Adding Microsoft Entra ID (Azure AD) authentication to a project with layered Terraform infrastructure
- Replacing self-signed JWT auth with external IdP tokens
- Designing auth that must work in both local dev (mock) and production (real IdP)

## Pattern: Strategy-Based Token Validation

### Core Interface
```typescript
interface TokenValidator {
  validate(token: string): Promise<ValidatedUser>;
}

interface ValidatedUser {
  id: string;        // Entra: oid claim
  email: string;     // Entra: preferred_username
  role: Role;        // Highest role from roles claim
  roles: Role[];     // All mapped roles
  name: string;
  tenantId?: string;
  rawClaims: Record<string, unknown>;
}
```

### Factory Selection
```typescript
function getTokenValidator(): TokenValidator {
  return env.AUTH_MODE === 'entra'
    ? new EntraTokenValidator(entraConfig)
    : new MockTokenValidator();
}
```

### Mock Token Structure
Mock tokens MUST mirror real Entra v2.0 claims:
- `iss`: `https://login.microsoftonline.com/{tenant}/v2.0`
- `aud`: API client ID
- `oid`: User object ID
- `tid`: Tenant ID
- `roles`: App role values (e.g., `["Admin", "Manager"]`)
- `preferred_username`: User email
- `scp`: Space-delimited scopes

## Pattern: Terraform Identity Layer

Place Entra resources in a dedicated layer (e.g., `05-identity`) between foundation and compute:

```
00-foundation  (azurerm: RG, KV, ACR)
05-identity    (azuread: app regs, groups, roles) ← NEW
10-data        (azurerm: database, storage)
20-compute     (azurerm: container apps — reads identity outputs)
```

Rationale:
- Different Terraform provider (`azuread` vs `azurerm`)
- Different lifecycle (auth config changes ≠ infra scaling)
- Different permissions (Graph API vs ARM)
- Smaller blast radius per layer

## Pattern: App Roles > Group Claims

Use Entra app roles (not raw group claims) as primary authorization:
- App roles appear in the `roles` claim without Graph API calls
- App roles are scoped to the application, not tenant-wide
- Groups are the assignment mechanism (group → app role assignment)
- Result: `requireRole('Admin')` reads from `roles` claim in token

## Pattern: SPA Auth with MSAL.js

- Use `@azure/msal-react` with redirect flow (not popup)
- Token caching and refresh handled by MSAL automatically
- No custom refresh endpoint needed
- SPA app registrations use PKCE (no client secret)
- API app registration holds the client secret (for OBO flow, stored in Key Vault)

## Anti-Patterns to Avoid

1. **Don't re-sign Entra tokens as app JWTs** — validate them directly; eliminates a trust boundary
2. **Don't put `azuread` resources in the foundation layer** — different lifecycle and permissions
3. **Don't use `passport-azure-ad`** — maintenance mode; MSAL + jwks-rsa is simpler
4. **Don't store tokens in localStorage** — use sessionStorage for SPAs
5. **Don't build custom refresh logic** — MSAL handles the entire token lifecycle
