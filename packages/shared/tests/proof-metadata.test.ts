import { describe, expect, it } from "vitest";

import {
  AttestationLevels,
  FulfillmentStatuses,
  ProofTypes,
  validateEvidenceMetadata,
  validateProofType,
  validateStatusTransition,
} from "@e-clat/shared";

describe("proof metadata validation", () => {
  describe("validateProofType", () => {
    it("accepts valid proof types", () => {
      const result = validateProofType(ProofTypes.CERTIFICATION);

      expect(result.success).toBe(true);
    });

    it("rejects invalid proof types", () => {
      const result = validateProofType("badge");

      expect(result.success).toBe(false);
    });

    it("accepts attestation levels that are valid for the proof type", () => {
      const result = validateProofType(ProofTypes.LICENSE, AttestationLevels.THIRD_PARTY);

      expect(result.success).toBe(true);
    });

    it("rejects attestation levels that are not allowed for the proof type", () => {
      const result = validateProofType(ProofTypes.BACKGROUND_CHECK, AttestationLevels.SELF);

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toContain("not allowed");
    });
  });

  describe("validateStatusTransition", () => {
    it("accepts valid workflow transitions", () => {
      const result = validateStatusTransition(FulfillmentStatuses.NOT_STARTED, FulfillmentStatuses.IN_PROGRESS);

      expect(result.success).toBe(true);
    });

    it("allows the rejection restart cycle", () => {
      const result = validateStatusTransition(FulfillmentStatuses.REJECTED, FulfillmentStatuses.IN_PROGRESS);

      expect(result.success).toBe(true);
    });

    it("rejects invalid workflow transitions", () => {
      const result = validateStatusTransition(FulfillmentStatuses.NOT_STARTED, FulfillmentStatuses.APPROVED);

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toContain("Invalid fulfillment status transition");
    });

    it("requires approved to expired transitions to be system-triggered", () => {
      const manualResult = validateStatusTransition(FulfillmentStatuses.APPROVED, FulfillmentStatuses.EXPIRED);
      const systemResult = validateStatusTransition(FulfillmentStatuses.APPROVED, FulfillmentStatuses.EXPIRED, {
        systemTriggered: true,
      });

      expect(manualResult.success).toBe(false);
      expect(systemResult.success).toBe(true);
    });
  });

  describe("validateEvidenceMetadata", () => {
    it("accepts certification metadata with required fields", () => {
      const result = validateEvidenceMetadata(ProofTypes.CERTIFICATION, {
        issuer: "FAA",
        certificationNumber: "CERT-123",
        issuedDate: "2026-01-15",
        expirationDate: "2028-01-15",
      });

      expect(result.success).toBe(true);
    });

    it("rejects certification metadata missing required fields", () => {
      const result = validateEvidenceMetadata(ProofTypes.CERTIFICATION, {
        issuer: "FAA",
        issuedDate: "2026-01-15",
      });

      expect(result.success).toBe(false);
      expect(result.error?.issues.some((issue) => issue.path.join(".") === "metadata.certificationNumber")).toBe(true);
    });

    it("accepts training metadata with a positive completed hours value", () => {
      const result = validateEvidenceMetadata(ProofTypes.TRAINING, {
        provider: "Acme LMS",
        completionDate: "2026-02-01",
        hoursCompleted: 4,
      });

      expect(result.success).toBe(true);
    });

    it("rejects training metadata when completed hours are not positive", () => {
      const result = validateEvidenceMetadata(ProofTypes.TRAINING, {
        provider: "Acme LMS",
        completionDate: "2026-02-01",
        hoursCompleted: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error?.issues.some((issue) => issue.path.join(".") === "metadata.hoursCompleted")).toBe(true);
    });

    it("accepts unconstrained proof types without metadata requirements", () => {
      const result = validateEvidenceMetadata(ProofTypes.ATTESTATION, null);

      expect(result.success).toBe(true);
    });

    it("rejects invalid date metadata values", () => {
      const result = validateEvidenceMetadata(ProofTypes.CERTIFICATION, {
        issuer: "FAA",
        certificationNumber: "CERT-123",
        issuedDate: "not-a-date",
      });

      expect(result.success).toBe(false);
      expect(result.error?.issues.some((issue) => issue.path.join(".") === "metadata.issuedDate")).toBe(true);
    });

    it("validates medical metadata requirements", () => {
      const result = validateEvidenceMetadata(ProofTypes.MEDICAL, {
        provider: "Metro Clinic",
        examType: "DOT Physical",
        clearanceLevel: "cleared",
      });

      expect(result.success).toBe(true);
    });
  });
});
