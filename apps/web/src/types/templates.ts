export type TemplateStatus = 'draft' | 'published' | 'archived';
export type TemplateAttestationLevel = 'self_attest' | 'upload' | 'third_party' | 'validated';
export type TemplateProofType = 'hours' | 'certification' | 'training' | 'clearance' | 'assessment' | 'compliance';
export type TemplateFulfillmentStatus = 'unfulfilled' | 'pending_review' | 'fulfilled' | 'expired' | 'rejected';

export interface TemplateRequirementRecord {
  id: string;
  templateId: string;
  name: string;
  description: string;
  attestationLevels: TemplateAttestationLevel[];
  proofType: TemplateProofType | null;
  proofSubType: string | null;
  threshold: number | null;
  thresholdUnit: string | null;
  rollingWindowDays: number | null;
  universalCategory: string | null;
  qualificationType: string | null;
  medicalTestType: string | null;
  standardReqId: string | null;
  validityDays: number | null;
  renewalWarningDays: number | null;
  sortOrder: number;
  isRequired: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProofTemplateRecord {
  id: string;
  name: string;
  description: string;
  category: string | null;
  status: TemplateStatus;
  version: number;
  previousVersion: string | null;
  createdBy: string;
  updatedBy: string | null;
  standardId: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  archivedAt: string | null;
  requirements: TemplateRequirementRecord[];
}

export interface TemplateAssignmentEmployeeRecord {
  id: string;
  templateId: string;
  templateVersion: number;
  employeeId: string | null;
  employeeName: string | null;
  employeeEmail: string | null;
  role: string | null;
  department: string | null;
  assignedBy: string;
  dueDate: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface TemplateFulfillmentRecord {
  id: string;
  assignmentId: string;
  requirementId: string;
  employeeId: string;
  status: TemplateFulfillmentStatus;
  selfAttestedAt?: string | null;
  selfAttestation?: string | null;
  uploadedAt?: string | null;
  documentId?: string | null;
  attachedDocumentId?: string | null;
  thirdPartyVerifiedAt?: string | null;
  validatedAt?: string | null;
  validatorNotes?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  expiresAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  requirement?: TemplateRequirementRecord;
}

export interface EmployeeListRecord {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  departmentId: string;
  isActive: boolean;
}

export interface AssignTemplateResult {
  assignments: TemplateAssignmentEmployeeRecord[];
  created: number;
  skipped: number;
}
