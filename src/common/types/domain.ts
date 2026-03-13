export type HourSource =
  | "clock_in_out"
  | "timesheet_import"
  | "job_ticket_sync"
  | "calendar_sync"
  | "manual_entry";

export type QualificationStatus =
  | "active"
  | "expiring_soon"
  | "expired"
  | "pending_review"
  | "suspended";

export type DocumentStatus =
  | "uploaded"
  | "processing"
  | "classified"
  | "review_required"
  | "approved"
  | "rejected";

export type MedicalClearanceStatus =
  | "cleared"
  | "pending"
  | "restricted"
  | "expired";

export interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  departmentId: string;
  hireDate: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Qualification {
  id: string;
  employeeId: string;
  standardId: string;
  certificationName: string;
  issuingBody: string;
  issueDate: Date;
  expirationDate: Date | null;
  status: QualificationStatus;
  documentIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface HourRecord {
  id: string;
  employeeId: string;
  source: HourSource;
  date: Date;
  hours: number;
  qualificationCategory: string;
  description: string;
  verifiedBy: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
}

export interface Document {
  id: string;
  employeeId: string;
  fileName: string;
  mimeType: string;
  storageKey: string;
  status: DocumentStatus;
  classifiedType: string | null;
  extractedData: Record<string, unknown> | null;
  detectedExpiration: Date | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MedicalClearance {
  id: string;
  employeeId: string;
  clearanceType: string;
  status: MedicalClearanceStatus;
  effectiveDate: Date;
  expirationDate: Date | null;
  visualAcuityResult: string | null;
  colorVisionResult: string | null;
  issuedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceStandard {
  id: string;
  code: string;
  name: string;
  description: string;
  issuingBody: string;
  version: string;
  requirements: StandardRequirement[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StandardRequirement {
  id: string;
  standardId: string;
  category: string;
  description: string;
  minimumHours: number | null;
  recertificationPeriodMonths: number | null;
  requiredTests: string[];
}

// --- Label Taxonomy ---

export type LabelStatus = "active" | "deprecated";

export interface Label {
  id: string;
  code: string;
  name: string;
  description: string;
  status: LabelStatus;
  effectiveDate: Date;
  retirementDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LabelMapping {
  id: string;
  labelId: string;
  hourCategory: string;
  version: number;
  effectiveDate: Date;
  createdAt: Date;
}

export interface TaxonomyVersion {
  id: string;
  versionNumber: number;
  changeLog: string;
  migrationRules: Record<string, string>;
  publishedAt: Date | null;
  createdAt: Date;
}

// --- Hour Conflicts & Audit ---

export type ConflictType = "duplicate" | "mismatch";
export type ConflictStatus = "pending" | "resolved";
export type ResolutionMethod = "precedence" | "override" | "merge";

export interface HourConflict {
  id: string;
  recordIds: string[];
  conflictType: ConflictType;
  status: ConflictStatus;
  resolutionMethod: ResolutionMethod | null;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  attestation: string | null;
  reason: string | null;
  createdAt: Date;
}

export type AuditAction = "inserted" | "updated" | "overridden" | "deleted";

export interface AuditLog {
  id: string;
  action: AuditAction;
  recordId: string;
  entityType: string;
  changedFields: Record<string, unknown> | null;
  actor: string;
  reason: string | null;
  attestation: string | null;
  timestamp: Date;
}

export interface HourSourceMapping {
  id: string;
  sourceSystemId: string;
  sourceFieldMapping: Record<string, string>;
  labelTransformRules: Record<string, string>;
  qualificationCategoryMapping: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

// --- Document Processing (AI Pipeline) ---

export type ProcessingStep =
  | "ocr"
  | "classification"
  | "extraction"
  | "expiration_detection"
  | "standards_matching";

export type ProcessingStatus = "pending" | "in_progress" | "completed" | "failed";
export type DocumentProcessor = "aws-textract" | "google-vision" | "azure-form-recognizer";

export interface DocumentProcessing {
  id: string;
  documentId: string;
  processingStep: ProcessingStep;
  status: ProcessingStatus;
  processor: DocumentProcessor;
  startedAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
}

export type ExtractionField =
  | "certName"
  | "issuer"
  | "issueDate"
  | "expirationDate"
  | "issueNumber";

export interface ExtractionResult {
  id: string;
  documentId: string;
  field: ExtractionField;
  extractedValue: string;
  confidence: number;
  suggestedValue: string | null;
  correctedValue: string | null;
  correctedBy: string | null;
  correctedAt: Date | null;
  createdAt: Date;
}

export type ReviewStatus = "pending" | "in_progress" | "approved" | "rejected";

export interface ReviewQueueItem {
  id: string;
  documentId: string;
  status: ReviewStatus;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  approvalNotes: string | null;
  linkedQualificationId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// --- Notifications ---

export type NotificationType =
  | "overdue_requirement"
  | "expiring_soon"
  | "document_review_pending"
  | "document_approved"
  | "hour_conflict_flagged"
  | "manual_hour_pending"
  | "weekly_compliance_digest"
  | "access_violation_alert";

export type DeliveryChannel = "email" | "in_app" | "sms";
export type NotificationStatus = "sent" | "read" | "dismissed";
export type NotificationFrequency = "immediate" | "daily" | "weekly";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl: string | null;
  status: NotificationStatus;
  deliveryChannel: DeliveryChannel;
  createdAt: Date;
  readAt: Date | null;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  notificationType: NotificationType;
  channels: DeliveryChannel[];
  isEnabled: boolean;
  frequency: NotificationFrequency;
  updatedAt: Date;
}

export type EscalationTrigger =
  | "overdue_requirement"
  | "expiring_soon"
  | "conflict_pending";

export interface EscalationRule {
  id: string;
  trigger: EscalationTrigger;
  delayHours: number;
  escalateToRole: string;
  maxEscalations: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
