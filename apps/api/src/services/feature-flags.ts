import { createHash } from "node:crypto";
import {
  FlagResolutionContextSchema,
  ForbiddenError,
  ValidationError,
  type FeatureFlagDefinition,
  type FeatureFlagEnvironment,
  type FeatureFlagOverrideMap,
  type FeatureFlagRegistry,
  type FlagResolutionContext,
} from "@e-clat/shared";
import { baseFeatureFlags, featureFlagEnvironmentOverrides, parseRuntimeFeatureFlagOverrides } from "../config/feature-flags";

export interface FeatureFlagService {
  isEnabled(key: string, context: FlagResolutionContext): boolean;
  requireEnabled(key: string, context: FlagResolutionContext): void;
  getClientFlags(context: FlagResolutionContext): Record<string, boolean>;
}

export interface CreateFeatureFlagServiceOptions {
  definitions?: FeatureFlagRegistry;
  environmentOverrides?: Partial<Record<FeatureFlagEnvironment, FeatureFlagOverrideMap>>;
  runtimeOverrides?: FeatureFlagOverrideMap;
}

function validateContext(context: FlagResolutionContext) {
  const result = FlagResolutionContextSchema.safeParse(context);

  if (!result.success) {
    throw new ValidationError("Invalid feature flag resolution context.", result.error.format());
  }

  return result.data;
}

function getDefinition(definitions: FeatureFlagRegistry, key: string) {
  const definition = definitions[key];

  if (!definition) {
    throw new ValidationError(`Unknown feature flag '${key}'.`);
  }

  return definition;
}

function normalizeEmail(email?: string) {
  return email?.trim().toLowerCase();
}

function resolveConfiguredValue(
  definition: FeatureFlagDefinition,
  context: FlagResolutionContext,
  environmentOverrides: Partial<Record<FeatureFlagEnvironment, FeatureFlagOverrideMap>>,
  runtimeOverrides: FeatureFlagOverrideMap,
) {
  const runtimeOverride = runtimeOverrides[definition.key];
  const environmentOverride = environmentOverrides[context.environment]?.[definition.key];
  const embeddedEnvironmentOverride = definition.environments?.[context.environment];

  return runtimeOverride ?? environmentOverride ?? embeddedEnvironmentOverride ?? definition.defaultValue;
}

function matchesAllowlist(definition: FeatureFlagDefinition, context: FlagResolutionContext) {
  if (!definition.allowlist?.length) {
    return definition.type !== "allowlist";
  }

  const userId = context.userId?.trim();
  const email = normalizeEmail(context.email);

  return definition.allowlist.some((entry) => {
    const normalizedEntry = entry.trim();

    if (userId && normalizedEntry === userId) {
      return true;
    }

    return Boolean(email) && normalizedEntry.toLowerCase() === email;
  });
}

function matchesRollout(definition: FeatureFlagDefinition, context: FlagResolutionContext) {
  if (definition.rolloutPercentage === undefined) {
    return true;
  }

  if (definition.rolloutPercentage <= 0) {
    return false;
  }

  if (definition.rolloutPercentage >= 100) {
    return true;
  }

  const actorId = context.userId?.trim() ?? normalizeEmail(context.email);

  if (!actorId) {
    return false;
  }

  const hash = createHash("sha256").update(`${definition.key}:${actorId}`).digest("hex");
  const bucket = Number.parseInt(hash.slice(0, 8), 16) % 100;

  return bucket < definition.rolloutPercentage;
}

export function createFeatureFlagService(options: CreateFeatureFlagServiceOptions = {}): FeatureFlagService {
  const definitions = options.definitions ?? baseFeatureFlags;
  const environmentOverrides = options.environmentOverrides ?? featureFlagEnvironmentOverrides;
  const runtimeOverrides = options.runtimeOverrides ?? parseRuntimeFeatureFlagOverrides();

  const isEnabled = (key: string, rawContext: FlagResolutionContext) => {
    const context = validateContext(rawContext);
    const definition = getDefinition(definitions, key);
    const configuredValue = resolveConfiguredValue(definition, context, environmentOverrides, runtimeOverrides);

    if (!configuredValue) {
      return false;
    }

    if (definition.allowedRoles?.length && (!context.role || !definition.allowedRoles.includes(context.role))) {
      return false;
    }

    if (!matchesAllowlist(definition, context)) {
      return false;
    }

    if (!matchesRollout(definition, context)) {
      return false;
    }

    return true;
  };

  const requireEnabled = (key: string, context: FlagResolutionContext) => {
    if (!isEnabled(key, context)) {
      throw new ForbiddenError(`Feature flag '${key}' is disabled.`);
    }
  };

  const getClientFlags = (rawContext: FlagResolutionContext) => {
    const context = validateContext(rawContext);

    return Object.values(definitions).reduce<Record<string, boolean>>((flags, definition) => {
      if (!definition.clientVisible) {
        return flags;
      }

      flags[definition.key] = isEnabled(definition.key, context);
      return flags;
    }, {});
  };

  return {
    isEnabled,
    requireEnabled,
    getClientFlags,
  };
}

export const featureFlagService = createFeatureFlagService();

export function isEnabled(key: string, context: FlagResolutionContext) {
  return featureFlagService.isEnabled(key, context);
}

export function requireEnabled(key: string, context: FlagResolutionContext) {
  return featureFlagService.requireEnabled(key, context);
}

export function getClientFlags(context: FlagResolutionContext) {
  return featureFlagService.getClientFlags(context);
}
