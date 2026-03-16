import { FeatureFlagDefinitionSchema, type FeatureFlagDefinition, type FeatureFlagRegistry } from "@e-clat/shared";

function defineFlag(definition: FeatureFlagDefinition) {
  return FeatureFlagDefinitionSchema.parse(definition);
}

export const baseFeatureFlags: FeatureFlagRegistry = {
  "records.hours-ui": defineFlag({
    key: "records.hours-ui",
    description: "Gates the records hours UI and related backend surfaces while the experience is incomplete.",
    owner: "records",
    type: "boolean",
    defaultValue: false,
    expiresOn: "2026-06-30",
    clientVisible: true,
  }),
  "reference.labels-admin": defineFlag({
    key: "reference.labels-admin",
    description: "Controls access to the labels administration experience until the reference workflows are complete.",
    owner: "reference",
    type: "boolean",
    defaultValue: false,
    expiresOn: "2026-06-30",
    clientVisible: true,
  }),
  "compliance.templates": defineFlag({
    key: "compliance.templates",
    description: "Enables the compliance templates authoring and assignment flows for staged rollout.",
    owner: "compliance",
    type: "boolean",
    defaultValue: false,
    expiresOn: "2026-06-30",
    clientVisible: true,
  }),
  "notifications.escalation-rules": defineFlag({
    key: "notifications.escalation-rules",
    description: "Guards escalation rule management until notification admin workflows are production-ready.",
    owner: "notifications",
    type: "boolean",
    defaultValue: false,
    expiresOn: "2026-06-30",
    clientVisible: false,
  }),
  "web.team-subnav": defineFlag({
    key: "web.team-subnav",
    description: "Turns on the team sub-navigation experience incrementally in the web shell.",
    owner: "web",
    type: "boolean",
    defaultValue: false,
    expiresOn: "2026-06-30",
    clientVisible: true,
  }),
};
