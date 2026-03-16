import { FeatureFlagOverrideMapSchema, type FeatureFlagOverrideMap } from "@e-clat/shared";

export const devFeatureFlagOverrides: FeatureFlagOverrideMap = FeatureFlagOverrideMapSchema.parse({
  "records.hours-ui": true,
  "reference.labels-admin": true,
  "compliance.templates": true,
});
