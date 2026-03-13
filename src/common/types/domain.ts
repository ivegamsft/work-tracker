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
