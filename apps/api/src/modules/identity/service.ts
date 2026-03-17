import { NotFoundError, ConflictError } from "@e-clat/shared";
import { prisma } from "../../config/database";
import type { CreateProviderInput, UpdateProviderInput } from "./validators";

const PRISMA_TYPE_MAP = {
  oidc: "OIDC",
  saml: "SAML",
  local: "LOCAL",
  custom: "CUSTOM",
} as const;

const DTO_TYPE_MAP: Record<string, string> = {
  OIDC: "oidc",
  SAML: "saml",
  LOCAL: "local",
  CUSTOM: "custom",
};

function toDto(provider: Record<string, unknown>) {
  return {
    id: provider.id,
    name: provider.name,
    type: DTO_TYPE_MAP[provider.type as string] ?? (provider.type as string),
    issuer: provider.issuer,
    jwks_uri: provider.jwksUri ?? null,
    client_id: provider.clientId ?? null,
    scopes: provider.scopes,
    claims_mapping: provider.claimsMapping,
    enabled: provider.enabled,
    jwks_cached_at: provider.jwksCachedAt ?? null,
    last_test_at: provider.lastTestAt ?? null,
    last_test_status: provider.lastTestStatus ?? null,
    created_at: provider.createdAt,
    updated_at: provider.updatedAt,
  };
}

export interface IdentityService {
  createProvider(input: CreateProviderInput, actorId: string): Promise<Record<string, unknown>>;
  listProviders(): Promise<Record<string, unknown>[]>;
  getProvider(id: string): Promise<Record<string, unknown>>;
  updateProvider(id: string, input: UpdateProviderInput): Promise<Record<string, unknown>>;
  deleteProvider(id: string): Promise<void>;
}

export const identityService: IdentityService = {
  async createProvider(input, _actorId) {
    const existing = await prisma.identityProvider.findFirst({
      where: {
        issuer: input.issuer,
        type: PRISMA_TYPE_MAP[input.type],
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictError(`Provider with issuer '${input.issuer}' and type '${input.type}' already exists`);
    }

    const provider = await prisma.identityProvider.create({
      data: {
        name: input.name,
        type: PRISMA_TYPE_MAP[input.type],
        issuer: input.issuer,
        jwksUri: input.jwks_uri,
        clientId: input.client_id,
        clientSecret: input.client_secret,
        scopes: input.scopes,
        claimsMapping: input.claims_mapping,
        enabled: input.enabled,
      },
    });

    return toDto(provider as unknown as Record<string, unknown>);
  },

  async listProviders() {
    const providers = await prisma.identityProvider.findMany({
      where: { enabled: true, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });

    return providers.map((p: Record<string, unknown>) => toDto(p as unknown as Record<string, unknown>));
  },

  async getProvider(id) {
    const provider = await prisma.identityProvider.findFirst({
      where: { id, deletedAt: null },
    });

    if (!provider) {
      throw new NotFoundError("IdentityProvider", id);
    }

    return toDto(provider as unknown as Record<string, unknown>);
  },

  async updateProvider(id, input) {
    const existing = await prisma.identityProvider.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundError("IdentityProvider", id);
    }

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.type !== undefined) data.type = PRISMA_TYPE_MAP[input.type];
    if (input.issuer !== undefined) data.issuer = input.issuer;
    if (input.jwks_uri !== undefined) data.jwksUri = input.jwks_uri;
    if (input.client_id !== undefined) data.clientId = input.client_id;
    if (input.client_secret !== undefined) data.clientSecret = input.client_secret;
    if (input.scopes !== undefined) data.scopes = input.scopes;
    if (input.claims_mapping !== undefined) data.claimsMapping = input.claims_mapping;
    if (input.enabled !== undefined) data.enabled = input.enabled;

    const provider = await prisma.identityProvider.update({
      where: { id },
      data,
    });

    return toDto(provider as unknown as Record<string, unknown>);
  },

  async deleteProvider(id) {
    const existing = await prisma.identityProvider.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundError("IdentityProvider", id);
    }

    await prisma.identityProvider.update({
      where: { id },
      data: { deletedAt: new Date(), enabled: false },
    });
  },
};
