/**
 * Normalizes provider-specific claims to a standard internal format.
 * Each identity provider may use different claim names for the same data.
 */

export interface NormalizedClaims {
  sub: string;
  email: string;
  given_name?: string;
  family_name?: string;
  name?: string;
  roles?: string[];
  groups?: string[];
  [key: string]: unknown;
}

export interface ClaimsMapping {
  [internalClaim: string]: string;
}

/**
 * Maps raw provider token claims to normalized internal claims
 * using the provider's claims_mapping configuration.
 */
export function normalizeClaims(
  rawClaims: Record<string, unknown>,
  claimsMapping: ClaimsMapping,
): NormalizedClaims {
  const normalized: Record<string, unknown> = {};

  // Apply mapping: internal_name -> provider_claim_name
  for (const [internalName, providerName] of Object.entries(claimsMapping)) {
    if (providerName in rawClaims) {
      normalized[internalName] = rawClaims[providerName];
    }
  }

  // Fallback defaults for required fields
  const sub = (normalized.sub ?? rawClaims.sub ?? rawClaims.oid ?? rawClaims.user_id ?? "") as string;
  const email = (normalized.email ?? rawClaims.email ?? rawClaims.upn ?? rawClaims.preferred_username ?? "") as string;

  return {
    ...normalized,
    sub,
    email,
    given_name: (normalized.given_name ?? rawClaims.given_name ?? rawClaims.givenName) as string | undefined,
    family_name: (normalized.family_name ?? rawClaims.family_name ?? rawClaims.familyName) as string | undefined,
    name: (normalized.name ?? rawClaims.name) as string | undefined,
    roles: normalizeStringArray(normalized.roles ?? rawClaims.roles),
    groups: normalizeStringArray(normalized.groups ?? rawClaims.groups),
  };
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return [value];
  return undefined;
}

// Well-known claim mappings for common providers
export const WELL_KNOWN_MAPPINGS: Record<string, ClaimsMapping> = {
  entra: {
    sub: "oid",
    email: "email",
    given_name: "given_name",
    family_name: "family_name",
    roles: "roles",
    groups: "groups",
  },
  okta: {
    sub: "sub",
    email: "email",
    given_name: "given_name",
    family_name: "family_name",
    groups: "groups",
  },
  auth0: {
    sub: "sub",
    email: "email",
    given_name: "given_name",
    family_name: "family_name",
    name: "name",
  },
};
