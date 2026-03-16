import { FeatureFlagOverrideMapSchema, type FeatureFlagOverrideMap } from "@e-clat/shared";

export const prodFeatureFlagOverrides: FeatureFlagOverrideMap = FeatureFlagOverrideMapSchema.parse({
  "records.hours-ui": false,
  "reference.labels-admin": false,
  "compliance.templates": false,
});
