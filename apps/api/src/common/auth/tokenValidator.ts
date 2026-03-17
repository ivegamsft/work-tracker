import jwt, { type JwtPayload } from "jsonwebtoken";
import { UnauthorizedError, AppError } from "@e-clat/shared";
import { prisma } from "../../config/database";
import { jwksCache, type JwksKey } from "./jwksCache";
import { normalizeClaims, type NormalizedClaims, type ClaimsMapping } from "./claimsNormalizer";
import { logger } from "../utils";

// ─── Types ──────────────────────────────────────────────

export interface TokenValidationResult {
  valid: boolean;
  provider_id?: string;
  claims?: NormalizedClaims;
  error?: string;
  message?: string;
}

export interface TokenValidationStrategy {
  readonly type: string;
  validate(token: string, providerConfig: ProviderConfig): Promise<TokenValidationResult>;
}

export interface ProviderConfig {
  id: string;
  type: string;
  issuer: string;
  jwksUri: string | null;
  clientId: string | null;
  clientSecret: string | null;
  claimsMapping: ClaimsMapping;
}

// ─── OIDC Strategy ──────────────────────────────────────

function rsaPublicKeyFromJwks(key: JwksKey): string {
  if (!key.n || !key.e) {
    throw new Error("JWKS key missing n or e components");
  }
  // Build PEM from JWK components
  const modulus = Buffer.from(key.n, "base64url");
  const exponent = Buffer.from(key.e, "base64url");

  // DER encode RSA public key
  const modulusEncoded = encodeLength(modulus);
  const exponentEncoded = encodeLength(exponent);
  const sequenceContent = Buffer.concat([
    Buffer.from([0x02]),
    modulusEncoded,
    Buffer.from([0x02]),
    exponentEncoded,
  ]);
  const sequence = Buffer.concat([
    Buffer.from([0x30]),
    encodeLengthPrefix(sequenceContent.length),
    sequenceContent,
  ]);

  // Wrap in SubjectPublicKeyInfo
  const algorithmId = Buffer.from("300d06092a864886f70d0101010500", "hex");
  const bitString = Buffer.concat([
    Buffer.from([0x03]),
    encodeLengthPrefix(sequence.length + 1),
    Buffer.from([0x00]),
    sequence,
  ]);
  const spki = Buffer.concat([
    Buffer.from([0x30]),
    encodeLengthPrefix(algorithmId.length + bitString.length),
    algorithmId,
    bitString,
  ]);

  const base64 = spki.toString("base64");
  const pem = `-----BEGIN PUBLIC KEY-----\n${base64.match(/.{1,64}/g)!.join("\n")}\n-----END PUBLIC KEY-----`;
  return pem;
}

function encodeLength(data: Buffer): Buffer {
  // Ensure positive integer (prepend 0x00 if high bit set)
  const padded = data[0]! & 0x80 ? Buffer.concat([Buffer.from([0x00]), data]) : data;
  return Buffer.concat([encodeLengthPrefix(padded.length), padded]);
}

function encodeLengthPrefix(length: number): Buffer {
  if (length < 0x80) return Buffer.from([length]);
  if (length < 0x100) return Buffer.from([0x81, length]);
  return Buffer.from([0x82, (length >> 8) & 0xff, length & 0xff]);
}

export const oidcStrategy: TokenValidationStrategy = {
  type: "oidc",

  async validate(token, providerConfig) {
    if (!providerConfig.jwksUri) {
      return { valid: false, error: "MISSING_JWKS_URI", message: "Provider has no JWKS URI configured" };
    }

    // Decode header to get kid
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === "string") {
      return { valid: false, error: "INVALID_TOKEN", message: "Token cannot be decoded" };
    }

    const kid = decoded.header.kid;
    if (!kid) {
      return { valid: false, error: "MISSING_KID", message: "Token header missing kid" };
    }

    // Fetch JWKS and find key
    const keys = await jwksCache.getKeys(providerConfig.jwksUri);
    const jwk = jwksCache.getKeyById(keys, kid);

    if (!jwk) {
      // Key not found; invalidate cache and retry once
      jwksCache.invalidate(providerConfig.jwksUri);
      const freshKeys = await jwksCache.getKeys(providerConfig.jwksUri);
      const freshJwk = jwksCache.getKeyById(freshKeys, kid);
      if (!freshJwk) {
        return { valid: false, error: "KEY_NOT_FOUND", message: `No JWKS key found for kid: ${kid}` };
      }
      return verifyWithKey(token, freshJwk, providerConfig);
    }

    return verifyWithKey(token, jwk, providerConfig);
  },
};

async function verifyWithKey(
  token: string,
  jwk: JwksKey,
  providerConfig: ProviderConfig,
): Promise<TokenValidationResult> {
  try {
    let publicKey: string;

    if (jwk.x5c && jwk.x5c.length > 0) {
      publicKey = `-----BEGIN CERTIFICATE-----\n${jwk.x5c[0]}\n-----END CERTIFICATE-----`;
    } else {
      publicKey = rsaPublicKeyFromJwks(jwk);
    }

    const payload = jwt.verify(token, publicKey, {
      issuer: providerConfig.issuer,
      algorithms: [(jwk.alg ?? "RS256") as jwt.Algorithm],
    }) as JwtPayload;

    const claimsMapping = providerConfig.claimsMapping ?? {};
    const normalized = normalizeClaims(payload as Record<string, unknown>, claimsMapping);

    return {
      valid: true,
      provider_id: providerConfig.id,
      claims: normalized,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("expired")) {
      return { valid: false, error: "TOKEN_EXPIRED", message: "Token has expired" };
    }
    return { valid: false, error: "INVALID_SIGNATURE", message: "Token signature does not match provider JWKS" };
  }
}

// ─── Local Strategy ─────────────────────────────────────

export const localStrategy: TokenValidationStrategy = {
  type: "local",

  async validate(token, providerConfig) {
    try {
      if (!providerConfig.clientSecret) {
        return { valid: false, error: "MISSING_SECRET", message: "Local provider has no secret configured" };
      }

      const payload = jwt.verify(token, providerConfig.clientSecret, {
        issuer: providerConfig.issuer,
      }) as JwtPayload;

      const claimsMapping = providerConfig.claimsMapping ?? {};
      const normalized = normalizeClaims(payload as Record<string, unknown>, claimsMapping);

      return {
        valid: true,
        provider_id: providerConfig.id,
        claims: normalized,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("expired")) {
        return { valid: false, error: "TOKEN_EXPIRED", message: "Token has expired" };
      }
      return { valid: false, error: "INVALID_TOKEN", message };
    }
  },
};

// ─── Strategy Registry ──────────────────────────────────

const strategies = new Map<string, TokenValidationStrategy>();
strategies.set("oidc", oidcStrategy);
strategies.set("local", localStrategy);

export function registerStrategy(strategy: TokenValidationStrategy): void {
  strategies.set(strategy.type, strategy);
}

export function getStrategy(type: string): TokenValidationStrategy | undefined {
  return strategies.get(type.toLowerCase());
}

// ─── Token Validator (Main Entry) ───────────────────────

const PROVIDER_TYPE_MAP: Record<string, string> = {
  OIDC: "oidc",
  SAML: "saml",
  LOCAL: "local",
  CUSTOM: "custom",
};

export interface TokenValidator {
  validate(token: string, providerId?: string): Promise<TokenValidationResult>;
}

async function resolveProviderByIssuer(issuer: string): Promise<ProviderConfig | null> {
  const provider = await prisma.identityProvider.findFirst({
    where: { issuer, enabled: true, deletedAt: null },
  });

  if (!provider) return null;

  return {
    id: provider.id,
    type: PROVIDER_TYPE_MAP[provider.type] ?? provider.type,
    issuer: provider.issuer,
    jwksUri: provider.jwksUri,
    clientId: provider.clientId,
    clientSecret: provider.clientSecret,
    claimsMapping: (provider.claimsMapping ?? {}) as ClaimsMapping,
  };
}

async function resolveProviderById(id: string): Promise<ProviderConfig | null> {
  const provider = await prisma.identityProvider.findFirst({
    where: { id, enabled: true, deletedAt: null },
  });

  if (!provider) return null;

  return {
    id: provider.id,
    type: PROVIDER_TYPE_MAP[provider.type] ?? provider.type,
    issuer: provider.issuer,
    jwksUri: provider.jwksUri,
    clientId: provider.clientId,
    clientSecret: provider.clientSecret,
    claimsMapping: (provider.claimsMapping ?? {}) as ClaimsMapping,
  };
}

export const tokenValidator: TokenValidator = {
  async validate(token, providerId) {
    try {
      let providerConfig: ProviderConfig | null = null;

      if (providerId) {
        providerConfig = await resolveProviderById(providerId);
      } else {
        // Decode token to extract issuer claim
        const decoded = jwt.decode(token) as JwtPayload | null;
        if (decoded?.iss) {
          providerConfig = await resolveProviderByIssuer(decoded.iss);
        }
      }

      if (!providerConfig) {
        return {
          valid: false,
          error: "PROVIDER_NOT_FOUND",
          message: providerId
            ? `No active provider found for id: ${providerId}`
            : "No active provider found for token issuer",
        };
      }

      const strategy = getStrategy(providerConfig.type);
      if (!strategy) {
        return {
          valid: false,
          error: "UNSUPPORTED_PROVIDER_TYPE",
          message: `No validation strategy for provider type: ${providerConfig.type}`,
        };
      }

      return await strategy.validate(token, providerConfig);
    } catch (error) {
      logger.error("Token validation error", {
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof AppError) throw error;

      throw new UnauthorizedError("Token validation failed");
    }
  },
};
