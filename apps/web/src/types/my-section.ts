export type ComplianceStatus = 'compliant' | 'at_risk' | 'non_compliant';

export interface EmployeeProfile {
  id: string;
  email: string;
  role: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  departmentId?: string;
  position?: string | null;
  hireDate?: string | null;
  overallStatus?: ComplianceStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReadinessItem {
  qualificationId?: string | null;
  standardId?: string;
  standardCode?: string;
  standardName?: string;
  qualificationName?: string;
  certificationName?: string | null;
  status: string;
  readinessStatus?: ComplianceStatus;
  expirationDate?: string | null;
  expiresAt?: string | null;
  daysUntilExpiry?: number;
}

export interface MedicalReadinessItem {
  clearanceId?: string | null;
  clearanceType: string;
  expirationDate?: string | null;
  status: string;
  readinessStatus?: ComplianceStatus;
}

export interface Readiness {
  employeeId?: string;
  qualifications: ReadinessItem[];
  medicalClearances?: MedicalReadinessItem[];
  medicalStatus?: ComplianceStatus;
  medicalExpiresAt?: string | null;
  medicalDaysUntilExpiry?: number;
  overallStatus: ComplianceStatus;
}

export interface Qualification {
  id: string;
  employeeId?: string;
  standardId?: string;
  name?: string;
  certificationName?: string;
  status: string;
  standardName?: string | null;
  standard?: {
    id?: string;
    code?: string;
    name: string;
    issuingBody?: string;
  } | null;
  issuer?: string | null;
  issuingBody?: string | null;
  issueDate?: string | null;
  expiresAt?: string | null;
  expirationDate?: string | null;
  requirementsMet?: number;
  requirementsTotal?: number;
  documentCount?: number;
  documentIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface MedicalRecord {
  id: string;
  employeeId?: string;
  clearanceType: string;
  provider?: string;
  issuedBy?: string;
  status: string;
  validFrom?: string;
  effectiveDate?: string;
  validTo?: string | null;
  expirationDate?: string | null;
  restrictions?: string | null;
  visualAcuityResult?: string | null;
  colorVisionResult?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmployeeDocument {
  id: string;
  employeeId?: string;
  name?: string;
  fileName?: string;
  type?: string;
  mimeType?: string;
  classifiedType?: string | null;
  uploadedAt?: string;
  createdAt?: string;
  detectedExpiration?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  status: string;
}

export interface StandardRequirementRecord {
  id: string;
  standardId: string;
  category: string;
  description: string;
  minimumHours?: number | null;
  recertificationPeriodMonths?: number | null;
  requiredTests?: string[];
}

export interface ComplianceStandardRecord {
  id: string;
  code: string;
  name: string;
  description: string;
  issuingBody: string;
  version: string;
  isActive: boolean;
  requirements?: StandardRequirementRecord[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ReviewQueueItem {
  id: string;
  documentId: string;
  status: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  approvalNotes?: string | null;
  linkedQualificationId?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface ExtractionRecord {
  id: string;
  documentId: string;
  field: string;
  extractedValue: string;
  confidence: number;
  suggestedValue?: string | null;
  correctedValue?: string | null;
  correctedBy?: string | null;
  correctedAt?: string | null;
  createdAt?: string;
}

export interface DocumentUploadPayload {
  employeeId: string;
  fileName: string;
  mimeType: string;
  description?: string;
  name?: string;
  type?: string;
  notes?: string;
}

export interface MyNotification {
  id: string;
  message: string;
  title?: string;
  type: string;
  createdAt: string;
  status?: string;
  read?: boolean;
  readAt?: string | null;
  actionUrl?: string | null;
}

export interface NotificationPreferenceRecord {
  notificationType: string;
  channels: string[];
  isEnabled: boolean;
  frequency?: string;
}

export interface NotificationPreferences {
  email: boolean;
  inApp: boolean;
  categories: Record<string, boolean>;
}

export interface HoursRecord {
  id: string;
  date: string;
  clockIn?: string | null;
  clockOut?: string | null;
  totalHours?: number | null;
  hours?: number | null;
  description?: string;
  source?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
