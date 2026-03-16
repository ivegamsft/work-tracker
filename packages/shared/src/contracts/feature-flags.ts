import { z } from "zod";

const featureFlagKeyPattern = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

export const FeatureFlagKeySchema = z
  .string()
  .trim()
  .min(1)
  .regex(featureFlagKeyPattern, "Feature flag keys must use dotted lowercase names.");

export const FeatureFlagOwnerSchema = z.enum([
  "platform",
  "workforce",
  "compliance",
  "records",
  "reference",
  "notifications",
  "web",
]);

export const FeatureFlagTypeSchema = z.enum(["boolean", "percentage", "allowlist"]);

export const FeatureFlagEnvironmentSchema = z.enum(["dev", "staging", "prod", "test"]);

export const FeatureFlagEnvironmentsSchema = z.object({
  dev: z.boolean().optional(),
  staging: z.boolean().optional(),
  prod: z.boolean().optional(),
  test: z.boolean().optional(),
});

export const FeatureFlagDefinitionSchema = z
  .object({
    key: FeatureFlagKeySchema,
    description: z.string().trim().min(1),
    owner: FeatureFlagOwnerSchema,
    type: FeatureFlagTypeSchema,
    defaultValue: z.boolean(),
    environments: FeatureFlagEnvironmentsSchema.optional(),
    allowedRoles: z.array(z.string().trim().min(1)).optional(),
    allowlist: z.array(z.string().trim().min(1)).optional(),
    rolloutPercentage: z.number().min(0).max(100).optional(),
    expiresOn: z.string().trim().min(1).optional(),
    clientVisible: z.boolean(),
  })
  .superRefine((definition, context) => {
    if (definition.type === "percentage" && definition.rolloutPercentage === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rolloutPercentage"],
        message: "percentage flags must declare rolloutPercentage.",
      });
    }

    if (definition.type === "allowlist" && (!definition.allowlist || definition.allowlist.length === 0)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["allowlist"],
        message: "allowlist flags must declare at least one allowlist entry.",
      });
    }
  });

export const FeatureFlagRegistrySchema = z.record(z.string(), FeatureFlagDefinitionSchema);

export const FeatureFlagOverrideMapSchema = z.record(FeatureFlagKeySchema, z.boolean());

export const FlagResolutionContextSchema = z.object({
  userId: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
  role: z.string().trim().min(1).optional(),
  environment: FeatureFlagEnvironmentSchema,
});

export type FeatureFlagOwner = z.infer<typeof FeatureFlagOwnerSchema>;
export type FeatureFlagType = z.infer<typeof FeatureFlagTypeSchema>;
export type FeatureFlagEnvironment = z.infer<typeof FeatureFlagEnvironmentSchema>;
export type FeatureFlagDefinition = z.infer<typeof FeatureFlagDefinitionSchema>;
export type FeatureFlagRegistry = z.infer<typeof FeatureFlagRegistrySchema>;
export type FeatureFlagOverrideMap = z.infer<typeof FeatureFlagOverrideMapSchema>;
export type FlagResolutionContext = z.infer<typeof FlagResolutionContextSchema>;
