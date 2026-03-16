import { FeatureFlagDefinitionSchema, Roles } from "@e-clat/shared";
import { describe, expect, it } from "vitest";
import { baseFeatureFlags, featureFlagEnvironmentOverrides } from "../src/config/feature-flags";
import { createFeatureFlagService } from "../src/services/feature-flags";

type ParsedFeatureFlag = ReturnType<typeof FeatureFlagDefinitionSchema.parse>;

function buildFlag(overrides: Parameters<typeof FeatureFlagDefinitionSchema.parse>[0]) {
  return FeatureFlagDefinitionSchema.parse({
    ...overrides,
  });
}

function buildDefinitions(...flags: ParsedFeatureFlag[]) {
  return {
    ...baseFeatureFlags,
    ...Object.fromEntries(flags.map((flag) => [flag.key, flag])),
  };
}

describe("feature flag service", () => {
  it("resolves base flags with environment and runtime overrides", () => {
    const service = createFeatureFlagService({
      runtimeOverrides: {
        "notifications.escalation-rules": true,
      },
    });

    expect(service.isEnabled("records.hours-ui", { environment: "dev" })).toBe(true);
    expect(service.isEnabled("reference.labels-admin", { environment: "staging" })).toBe(true);
    expect(service.isEnabled("records.hours-ui", { environment: "prod" })).toBe(false);
    expect(service.isEnabled("compliance.templates", { environment: "prod" })).toBe(false);
    expect(service.isEnabled("notifications.escalation-rules", { environment: "prod" })).toBe(true);
    expect(() => service.requireEnabled("web.team-subnav", { environment: "prod" })).toThrow(
      "Feature flag 'web.team-subnav' is disabled.",
    );
  });

  it("supports role-based flag gating", () => {
    const roleScopedFlag = buildFlag({
      ...baseFeatureFlags["web.team-subnav"],
      key: "web.team-subnav",
      description: "Restricts the team sub-navigation to managers during rollout.",
      defaultValue: true,
      allowedRoles: [Roles.MANAGER],
      clientVisible: true,
    });

    const service = createFeatureFlagService({
      definitions: buildDefinitions(roleScopedFlag),
      environmentOverrides: featureFlagEnvironmentOverrides,
      runtimeOverrides: {},
    });

    expect(service.isEnabled("web.team-subnav", { environment: "dev", role: Roles.MANAGER })).toBe(true);
    expect(service.isEnabled("web.team-subnav", { environment: "dev", role: Roles.EMPLOYEE })).toBe(false);
  });

  it("supports allowlist and percentage rollouts in the resolver", () => {
    const allowlistFlag = buildFlag({
      key: "web.beta-allowlist",
      description: "Allows a small beta cohort into the new workflow.",
      owner: "web",
      type: "allowlist",
      defaultValue: true,
      allowlist: ["manager@example.com", "user-123"],
      clientVisible: true,
    });

    const rolloutFlag = buildFlag({
      key: "web.beta-rollout",
      description: "Rolls a beta experience out deterministically by actor.",
      owner: "web",
      type: "percentage",
      defaultValue: true,
      rolloutPercentage: 50,
      clientVisible: false,
    });

    const service = createFeatureFlagService({
      definitions: buildDefinitions(allowlistFlag, rolloutFlag),
      environmentOverrides: featureFlagEnvironmentOverrides,
      runtimeOverrides: {},
    });

    expect(service.isEnabled("web.beta-allowlist", { environment: "dev", email: "manager@example.com" })).toBe(true);
    expect(service.isEnabled("web.beta-allowlist", { environment: "dev", email: "employee@example.com" })).toBe(false);
    expect(service.isEnabled("web.beta-rollout", { environment: "dev", userId: "user-123" })).toBe(
      service.isEnabled("web.beta-rollout", { environment: "dev", userId: "user-123" }),
    );
  });

  it("returns only client-visible flags from getClientFlags", () => {
    const service = createFeatureFlagService({
      environmentOverrides: featureFlagEnvironmentOverrides,
      runtimeOverrides: {
        "web.team-subnav": true,
      },
    });

    const clientFlags = service.getClientFlags({ environment: "dev" });

    expect(clientFlags).toMatchObject({
      "records.hours-ui": true,
      "reference.labels-admin": true,
      "compliance.templates": true,
      "web.team-subnav": true,
    });
    expect(clientFlags).not.toHaveProperty("notifications.escalation-rules");
  });
});
