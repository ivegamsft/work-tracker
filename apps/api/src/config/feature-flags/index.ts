import {
  FeatureFlagEnvironmentSchema,
  FeatureFlagOverrideMapSchema,
  type FeatureFlagEnvironment,
  type FeatureFlagOverrideMap,
  type FeatureFlagRegistry,
} from "@e-clat/shared";
import { baseFeatureFlags } from "./base";
import { devFeatureFlagOverrides } from "./dev";
import { prodFeatureFlagOverrides } from "./prod";
import { stagingFeatureFlagOverrides } from "./staging";

export type { FeatureFlagRegistry };
export { baseFeatureFlags, devFeatureFlagOverrides, stagingFeatureFlagOverrides, prodFeatureFlagOverrides };

export const featureFlagEnvironmentOverrides: Readonly<Record<FeatureFlagEnvironment, FeatureFlagOverrideMap>> = {
  dev: devFeatureFlagOverrides,
  staging: stagingFeatureFlagOverrides,
  prod: prodFeatureFlagOverrides,
  test: FeatureFlagOverrideMapSchema.parse({}),
};

const runtimeEnvironmentMap: Record<string, FeatureFlagEnvironment> = {
  dev: "dev",
  development: "dev",
  staging: "staging",
  prod: "prod",
  production: "prod",
  test: "test",
};

export function getFeatureFlagEnvironment(source = process.env.ECLAT_ENVIRONMENT ?? process.env.NODE_ENV) {
  const normalized = source?.trim().toLowerCase();
  return FeatureFlagEnvironmentSchema.parse(runtimeEnvironmentMap[normalized ?? ""] ?? "dev");
}

export function getFeatureFlagOverridesForEnvironment(environment: FeatureFlagEnvironment) {
  return featureFlagEnvironmentOverrides[environment] ?? FeatureFlagOverrideMapSchema.parse({});
}

export function parseRuntimeFeatureFlagOverrides(raw = process.env.ECLAT_FLAG_OVERRIDES_JSON): FeatureFlagOverrideMap {
  if (!raw) {
    return FeatureFlagOverrideMapSchema.parse({});
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return FeatureFlagOverrideMapSchema.parse(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid ECLAT_FLAG_OVERRIDES_JSON: ${message}`);
  }
}

export interface LoadedFeatureFlagRegistry {
  environment: FeatureFlagEnvironment;
  definitions: FeatureFlagRegistry;
  environmentOverrides: FeatureFlagOverrideMap;
  runtimeOverrides: FeatureFlagOverrideMap;
}

export function loadFeatureFlagRegistry(
  environment: FeatureFlagEnvironment = getFeatureFlagEnvironment(),
  runtimeOverridesJson = process.env.ECLAT_FLAG_OVERRIDES_JSON,
): LoadedFeatureFlagRegistry {
  return {
    environment,
    definitions: baseFeatureFlags,
    environmentOverrides: getFeatureFlagOverridesForEnvironment(environment),
    runtimeOverrides: parseRuntimeFeatureFlagOverrides(runtimeOverridesJson),
  };
}

export const featureFlagRegistry = loadFeatureFlagRegistry();
