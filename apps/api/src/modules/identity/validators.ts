import { z } from "zod";

// ─── Enums ──────────────────────────────────────────────

export const identityProviderTypeSchema = z.enum(["oidc", "saml", "local", "custom"]);

export type IdentityProviderType = z.infer<typeof identityProviderTypeSchema>;

// ─── Provider CRUD ──────────────────────────────────────

export const createProviderSchema = z.object({
  name: z.string().min(1).max(100),
  type: identityProviderTypeSchema,
  issuer: z.string().url(),
  jwks_uri: z.string().url().optional(),
  client_id: z.string().optional(),
  client_secret: z.string().optional(),
  scopes: z.array(z.string()).default(["openid", "profile", "email"]),
  claims_mapping: z.record(z.string(), z.string()).default({}),
  enabled: z.boolean().default(true),
});

export const updateProviderSchema = createProviderSchema.partial();

export const providerIdParamSchema = z.object({
  id: z.string().uuid(),
});

// ─── Token Validation ───────────────────────────────────

export const validateTokenSchema = z.object({
  token: z.string().min(1),
  provider_id: z.string().uuid().optional(),
});

// ─── Inferred Types ─────────────────────────────────────

export type CreateProviderInput = z.infer<typeof createProviderSchema>;
export type UpdateProviderInput = z.infer<typeof updateProviderSchema>;
export type ValidateTokenInput = z.infer<typeof validateTokenSchema>;
