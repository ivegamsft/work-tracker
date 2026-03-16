/**
 * Attestation Policy Matrix
 * 
 * Defines allowed attestation level combinations per proof type.
 * This is a core compliance control - changes require regulatory review.
 */

import { AttestationLevel as PrismaAttestationLevel, ProofType as PrismaProofType } from "@prisma/client";

type AttestationLevel = "self_attest" | "upload" | "third_party" | "validated";
type ProofType = "hours" | "certification" | "training" | "clearance" | "assessment" | "compliance";

export interface AttestationPolicy {
  // Minimum attestation level required
  minimumLevel: AttestationLevel;
  // Allowed attestation levels for this proof type
  allowedLevels: AttestationLevel[];
  // Whether L4 validation is mandatory
  requiresValidation: boolean;
  // Whether self-attestation alone is prohibited
  prohibitsSelfAttestOnly: boolean;
  // Description for audit/compliance documentation
  description: string;
}

/**
 * Policy matrix defining attestation requirements by proof type.
 * 
 * Attestation levels in order:
 * - self_attest (L1): Employee self-certification
 * - upload (L2): Document evidence uploaded
 * - third_party (L3): Verified by authoritative external source
 * - validated (L4): Internal compliance officer approval
 */
export const ATTESTATION_POLICIES: Record<ProofType, AttestationPolicy> = {
  hours: {
    minimumLevel: "upload",
    allowedLevels: ["upload", "third_party", "validated"],
    requiresValidation: false,
    prohibitsSelfAttestOnly: true,
    description: "Hours require documented evidence (timesheets, logs). Self-attestation alone is insufficient.",
  },
  certification: {
    minimumLevel: "upload",
    allowedLevels: ["upload", "third_party", "validated"],
    requiresValidation: false,
    prohibitsSelfAttestOnly: true,
    description: "Certifications require credential evidence. Third-party verification recommended for regulated certifications.",
  },
  training: {
    minimumLevel: "self_attest",
    allowedLevels: ["self_attest", "upload", "third_party", "validated"],
    requiresValidation: false,
    prohibitsSelfAttestOnly: false,
    description: "Training may accept self-attestation for internal programs. External/regulatory training requires upload or third-party verification.",
  },
  clearance: {
    minimumLevel: "third_party",
    allowedLevels: ["third_party", "validated"],
    requiresValidation: true,
    prohibitsSelfAttestOnly: true,
    description: "Clearances (medical, background, security) require authoritative third-party verification and compliance officer validation. Self-attestation prohibited.",
  },
  assessment: {
    minimumLevel: "upload",
    allowedLevels: ["upload", "third_party", "validated"],
    requiresValidation: true,
    prohibitsSelfAttestOnly: true,
    description: "Assessments require documented results and compliance officer validation.",
  },
  compliance: {
    minimumLevel: "upload",
    allowedLevels: ["upload", "third_party", "validated"],
    requiresValidation: true,
    prohibitsSelfAttestOnly: true,
    description: "Compliance proofs require documented evidence and validation by compliance officer.",
  },
};

/**
 * Normalize attestation levels to unordered, unique set.
 * Removes duplicates and sorts in canonical order.
 */
export function normalizeAttestationLevels(levels: AttestationLevel[]): AttestationLevel[] {
  const order: Record<AttestationLevel, number> = {
    self_attest: 1,
    upload: 2,
    third_party: 3,
    validated: 4,
  };

  const unique = Array.from(new Set(levels));
  return unique.sort((a, b) => order[a] - order[b]);
}

/**
 * Validate attestation levels against proof type policy.
 * Returns validation errors, or empty array if valid.
 */
export function validateAttestationPolicy(
  proofType: ProofType | null,
  attestationLevels: AttestationLevel[]
): string[] {
  const errors: string[] = [];

  if (!proofType) {
    // If no proof type specified, allow any combination (for draft templates)
    return errors;
  }

  const policy = ATTESTATION_POLICIES[proofType];
  if (!policy) {
    errors.push(`Unknown proof type: ${proofType}`);
    return errors;
  }

  const normalized = normalizeAttestationLevels(attestationLevels);

  // Check if at least one allowed level is present
  const hasAllowedLevel = normalized.some((level) => policy.allowedLevels.includes(level));
  if (!hasAllowedLevel) {
    errors.push(
      `Proof type '${proofType}' requires at least one of: ${policy.allowedLevels.join(", ")}`
    );
  }

  // Check for disallowed levels
  const disallowed = normalized.filter((level) => !policy.allowedLevels.includes(level));
  if (disallowed.length > 0) {
    errors.push(
      `Proof type '${proofType}' does not allow: ${disallowed.join(", ")}. Allowed levels: ${policy.allowedLevels.join(", ")}`
    );
  }

  // Check self-attest-only prohibition
  if (
    policy.prohibitsSelfAttestOnly &&
    normalized.length === 1 &&
    normalized[0] === "self_attest"
  ) {
    errors.push(
      `Proof type '${proofType}' prohibits self-attestation as the only evidence. Additional evidence required.`
    );
  }

  // Check validation requirement
  if (policy.requiresValidation && !normalized.includes("validated")) {
    errors.push(
      `Proof type '${proofType}' requires 'validated' attestation level for compliance officer approval.`
    );
  }

  // Check minimum level
  const levelOrder: Record<AttestationLevel, number> = {
    self_attest: 1,
    upload: 2,
    third_party: 3,
    validated: 4,
  };

  const maxLevel = Math.max(...normalized.map((l) => levelOrder[l]));
  const minRequired = levelOrder[policy.minimumLevel];

  if (maxLevel < minRequired) {
    errors.push(
      `Proof type '${proofType}' requires minimum attestation level '${policy.minimumLevel}' or higher.`
    );
  }

  return errors;
}

/**
 * Check if an employee can validate their own proof (separation of duties).
 * Returns true if validation is allowed, false if prohibited.
 */
export function canValidateOwnProof(
  fulfillmentEmployeeId: string,
  validatorEmployeeId: string
): boolean {
  return fulfillmentEmployeeId !== validatorEmployeeId;
}

/**
 * Get policy description for a proof type.
 */
export function getAttestationPolicy(proofType: ProofType): AttestationPolicy | null {
  return ATTESTATION_POLICIES[proofType] || null;
}

/**
 * Convert Prisma enums to internal types for validation.
 */
export function fromPrismaAttestationLevel(level: PrismaAttestationLevel): AttestationLevel {
  return level.toLowerCase() as AttestationLevel;
}

export function fromPrismaProofType(type: PrismaProofType): ProofType {
  return type.toLowerCase() as ProofType;
}
