import { z } from "zod";

import {
  AttestationLevels,
  FulfillmentStatuses,
  ProofTypes,
  type AttestationLevel,
  type FulfillmentStatus,
  type ProofType,
} from "../types";

const proofTypeValues = [
  ProofTypes.CERTIFICATION,
  ProofTypes.LICENSE,
  ProofTypes.TRAINING,
  ProofTypes.EDUCATION,
  ProofTypes.BACKGROUND_CHECK,
  ProofTypes.MEDICAL,
  ProofTypes.ATTESTATION,
] as const;

const attestationLevelValues = [
  AttestationLevels.SELF,
  AttestationLevels.SUPERVISOR,
  AttestationLevels.THIRD_PARTY,
  AttestationLevels.NOTARIZED,
] as const;

const fulfillmentStatusValues = [
  FulfillmentStatuses.NOT_STARTED,
  FulfillmentStatuses.IN_PROGRESS,
  FulfillmentStatuses.SUBMITTED,
  FulfillmentStatuses.UNDER_REVIEW,
  FulfillmentStatuses.APPROVED,
  FulfillmentStatuses.REJECTED,
  FulfillmentStatuses.EXPIRED,
] as const;

const nonEmptyStringSchema = z.string().trim().min(1);
const positiveNumberSchema = z.coerce.number().positive();
const dateValueSchema = z.union([
  z.date(),
  z.string().trim().min(1).refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Invalid date value.",
  }),
]);
const openMetadataSchema = z.object({}).catchall(z.unknown());

export const proofTypeSchema = z.enum(proofTypeValues);
export const attestationLevelSchema = z.enum(attestationLevelValues);
export const fulfillmentStatusSchema = z.enum(fulfillmentStatusValues);

export const proofTypeAttestationMatrix = {
  [ProofTypes.CERTIFICATION]: [
    AttestationLevels.SELF,
    AttestationLevels.THIRD_PARTY,
    AttestationLevels.NOTARIZED,
  ],
  [ProofTypes.LICENSE]: [AttestationLevels.THIRD_PARTY, AttestationLevels.NOTARIZED],
  [ProofTypes.TRAINING]: [
    AttestationLevels.SELF,
    AttestationLevels.SUPERVISOR,
    AttestationLevels.THIRD_PARTY,
  ],
  [ProofTypes.EDUCATION]: [
    AttestationLevels.SELF,
    AttestationLevels.THIRD_PARTY,
    AttestationLevels.NOTARIZED,
  ],
  [ProofTypes.BACKGROUND_CHECK]: [AttestationLevels.THIRD_PARTY],
  [ProofTypes.MEDICAL]: [AttestationLevels.THIRD_PARTY, AttestationLevels.NOTARIZED],
  [ProofTypes.ATTESTATION]: [
    AttestationLevels.SELF,
    AttestationLevels.SUPERVISOR,
    AttestationLevels.NOTARIZED,
  ],
} as const satisfies Record<ProofType, readonly AttestationLevel[]>;

export const fulfillmentStatusTransitions = {
  [FulfillmentStatuses.NOT_STARTED]: [FulfillmentStatuses.IN_PROGRESS],
  [FulfillmentStatuses.IN_PROGRESS]: [FulfillmentStatuses.SUBMITTED],
  [FulfillmentStatuses.SUBMITTED]: [FulfillmentStatuses.UNDER_REVIEW],
  [FulfillmentStatuses.UNDER_REVIEW]: [FulfillmentStatuses.APPROVED, FulfillmentStatuses.REJECTED],
  [FulfillmentStatuses.REJECTED]: [FulfillmentStatuses.IN_PROGRESS],
  [FulfillmentStatuses.APPROVED]: [FulfillmentStatuses.EXPIRED],
  [FulfillmentStatuses.EXPIRED]: [],
} as const satisfies Record<FulfillmentStatus, readonly FulfillmentStatus[]>;

export const certificationEvidenceMetadataSchema = z.object({
  issuer: nonEmptyStringSchema,
  certificationNumber: nonEmptyStringSchema,
  issuedDate: dateValueSchema,
}).passthrough();

export const licenseEvidenceMetadataSchema = z.object({
  licenseNumber: nonEmptyStringSchema,
  issuingAuthority: nonEmptyStringSchema,
  jurisdiction: nonEmptyStringSchema,
}).passthrough();

export const trainingEvidenceMetadataSchema = z.object({
  provider: nonEmptyStringSchema,
  completionDate: dateValueSchema,
  hoursCompleted: positiveNumberSchema,
}).passthrough();

export const educationEvidenceMetadataSchema = z.object({
  institution: nonEmptyStringSchema,
  degree: nonEmptyStringSchema,
  fieldOfStudy: nonEmptyStringSchema,
}).passthrough();

export const medicalEvidenceMetadataSchema = z.object({
  provider: nonEmptyStringSchema,
  examType: nonEmptyStringSchema,
  clearanceLevel: nonEmptyStringSchema,
}).passthrough();

export const proofTypeMetadataRequirements = {
  [ProofTypes.CERTIFICATION]: ["issuer", "certificationNumber", "issuedDate"],
  [ProofTypes.LICENSE]: ["licenseNumber", "issuingAuthority", "jurisdiction"],
  [ProofTypes.TRAINING]: ["provider", "completionDate", "hoursCompleted"],
  [ProofTypes.EDUCATION]: ["institution", "degree", "fieldOfStudy"],
  [ProofTypes.BACKGROUND_CHECK]: [],
  [ProofTypes.MEDICAL]: ["provider", "examType", "clearanceLevel"],
  [ProofTypes.ATTESTATION]: [],
} as const satisfies Record<ProofType, readonly string[]>;

const proofTypeMetadataSchemas = {
  [ProofTypes.CERTIFICATION]: certificationEvidenceMetadataSchema,
  [ProofTypes.LICENSE]: licenseEvidenceMetadataSchema,
  [ProofTypes.TRAINING]: trainingEvidenceMetadataSchema,
  [ProofTypes.EDUCATION]: educationEvidenceMetadataSchema,
  [ProofTypes.BACKGROUND_CHECK]: openMetadataSchema.nullish(),
  [ProofTypes.MEDICAL]: medicalEvidenceMetadataSchema,
  [ProofTypes.ATTESTATION]: openMetadataSchema.nullish(),
} as const satisfies Record<ProofType, z.ZodTypeAny>;

export const proofTypeValidationSchema = z.object({
  proofType: proofTypeSchema,
  attestationLevel: attestationLevelSchema.optional(),
}).superRefine((value, ctx) => {
  if (!value.attestationLevel) {
    return;
  }

  const allowedLevels = proofTypeAttestationMatrix[value.proofType] as readonly AttestationLevel[];
  if (!allowedLevels.includes(value.attestationLevel)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["attestationLevel"],
      message: `Attestation level '${value.attestationLevel}' is not allowed for proof type '${value.proofType}'. Allowed values: ${allowedLevels.join(", ")}.`,
    });
  }
});

export const fulfillmentStatusTransitionSchema = z.object({
  fromStatus: fulfillmentStatusSchema,
  toStatus: fulfillmentStatusSchema,
  systemTriggered: z.boolean().optional().default(false),
}).superRefine((value, ctx) => {
  const allowedTransitions = fulfillmentStatusTransitions[value.fromStatus] as readonly FulfillmentStatus[];
  if (!allowedTransitions.includes(value.toStatus)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["toStatus"],
      message: `Invalid fulfillment status transition from '${value.fromStatus}' to '${value.toStatus}'.`,
    });
    return;
  }

  if (
    value.fromStatus === FulfillmentStatuses.APPROVED
    && value.toStatus === FulfillmentStatuses.EXPIRED
    && !value.systemTriggered
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["systemTriggered"],
      message: "The approved to expired transition is reserved for system-triggered lifecycle processing.",
    });
  }
});

export const evidenceMetadataSchema = z.object({
  proofType: proofTypeSchema,
  metadata: z.unknown(),
}).superRefine((value, ctx) => {
  const schema = proofTypeMetadataSchemas[value.proofType];
  const result = schema.safeParse(value.metadata);

  if (result.success) {
    return;
  }

  for (const issue of result.error.issues) {
    ctx.addIssue({
      ...issue,
      path: ["metadata", ...issue.path],
    });
  }
});

export function validateProofType(proofType: unknown, attestationLevel?: unknown) {
  return proofTypeValidationSchema.safeParse({ proofType, attestationLevel });
}

export function validateStatusTransition(fromStatus: unknown, toStatus: unknown, options?: { systemTriggered?: boolean }) {
  return fulfillmentStatusTransitionSchema.safeParse({
    fromStatus,
    toStatus,
    systemTriggered: options?.systemTriggered ?? false,
  });
}

export function validateEvidenceMetadata(proofType: unknown, metadata: unknown) {
  return evidenceMetadataSchema.safeParse({ proofType, metadata });
}
