export const ProofTypes = {
  CERTIFICATION: "certification",
  LICENSE: "license",
  TRAINING: "training",
  EDUCATION: "education",
  BACKGROUND_CHECK: "background-check",
  MEDICAL: "medical",
  ATTESTATION: "attestation",
} as const;

export type ProofType = (typeof ProofTypes)[keyof typeof ProofTypes];

export const AttestationLevels = {
  SELF: "self",
  SUPERVISOR: "supervisor",
  THIRD_PARTY: "third-party",
  NOTARIZED: "notarized",
} as const;

export type AttestationLevel = (typeof AttestationLevels)[keyof typeof AttestationLevels];

export const FulfillmentStatuses = {
  NOT_STARTED: "not-started",
  IN_PROGRESS: "in-progress",
  SUBMITTED: "submitted",
  UNDER_REVIEW: "under-review",
  APPROVED: "approved",
  REJECTED: "rejected",
  EXPIRED: "expired",
} as const;

export type FulfillmentStatus = (typeof FulfillmentStatuses)[keyof typeof FulfillmentStatuses];

export const ProofEvidenceTypes = {
  DOCUMENT: "document",
  LINK: "link",
  NOTE: "note",
  VERIFICATION: "verification",
} as const;

export type ProofEvidenceType = (typeof ProofEvidenceTypes)[keyof typeof ProofEvidenceTypes];

export type ApiDate = Date | string;

export interface TemplateAssignmentProgress {
  completedRequirements: number;
  totalRequirements: number;
  percentage: number;
}

export interface ProofEvidence {
  id: string;
  fulfillmentId: string;
  documentId: string | null;
  evidenceType: ProofEvidenceType;
  uploadedAt: Date;
  uploadedBy: string;
  fileName: string | null;
  fileUrl: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
}

export interface ProofFulfillment {
  id: string;
  assignmentId: string;
  requirementId: string;
  status: FulfillmentStatus;
  evidence: ProofEvidence[];
  submittedAt: Date | null;
  submittedBy: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewNotes: string | null;
  rejectionReason: string | null;
  approvedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProofRequirement {
  id: string;
  templateId: string;
  name: string;
  description: string;
  attestationLevel: AttestationLevel;
  isRequired: boolean;
  sortOrder: number;
  helpText: string | null;
  proofType: ProofType;
  allowedEvidenceTypes: ProofEvidenceType[];
  expiresInDays: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProofTemplate {
  id: string;
  name: string;
  description: string;
  proofType: ProofType;
  requirements: ProofRequirement[];
  isActive: boolean;
  createdBy: string;
  updatedBy: string | null;
  version: number;
  standardId: string | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}

export interface TemplateAssignment {
  id: string;
  templateId: string;
  assigneeId: string;
  assignedBy: string;
  dueDate: Date | null;
  status: FulfillmentStatus;
  progress: TemplateAssignmentProgress;
  fulfillments: ProofFulfillment[];
  isActive: boolean;
  assignedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export interface ProofRequirementInput {
  name: string;
  description?: string;
  attestationLevel: AttestationLevel;
  isRequired?: boolean;
  sortOrder?: number;
  helpText?: string | null;
  proofType: ProofType;
  allowedEvidenceTypes?: ProofEvidenceType[];
  expiresInDays?: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface ProofEvidenceInput {
  documentId?: string | null;
  evidenceType: ProofEvidenceType;
  uploadedAt?: ApiDate;
  uploadedBy?: string;
  fileName?: string | null;
  fileUrl?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface CreateTemplateRequest {
  name: string;
  description?: string;
  proofType: ProofType;
  requirements?: ProofRequirementInput[];
  isActive?: boolean;
  standardId?: string | null;
}

export interface UpdateTemplateRequest {
  name?: string;
  description?: string;
  proofType?: ProofType;
  requirements?: ProofRequirementInput[];
  isActive?: boolean;
  standardId?: string | null;
}

export interface AssignTemplateRequest {
  templateId: string;
  assigneeId?: string;
  assigneeIds?: string[];
  dueDate?: ApiDate;
  assignedBy?: string;
}

export interface SubmitFulfillmentRequest {
  assignmentId: string;
  requirementId: string;
  status?: Extract<FulfillmentStatus, "in-progress" | "submitted" | "under-review">;
  evidence?: ProofEvidenceInput[];
  submittedAt?: ApiDate;
  submissionNotes?: string | null;
}

export interface ReviewFulfillmentRequest {
  fulfillmentId: string;
  status: Extract<FulfillmentStatus, "approved" | "rejected" | "under-review">;
  reviewedBy?: string;
  reviewedAt?: ApiDate;
  reviewNotes?: string | null;
  rejectionReason?: string | null;
  expiresAt?: ApiDate;
}
