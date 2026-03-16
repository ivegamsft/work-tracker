import type {
  AuditLog,
  ComplianceStandard,
  Document,
  Employee,
  EscalationRule,
  ExtractionResult,
  HourConflict,
  HourRecord,
  Label,
  LabelMapping,
  MedicalClearance,
  Notification,
  NotificationPreference,
  ProofFulfillment,
  ProofRequirement,
  ProofTemplate,
  Qualification,
  ReviewQueueItem,
  Role,
  StandardRequirement,
  TaxonomyVersion,
  TemplateAssignment,
} from "@e-clat/shared";

// Repository interfaces isolate persistence from services.
// Employees are migrated first; the remaining repositories capture the target shape for later service refactors.

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export type ReadinessStatus = "compliant" | "at_risk" | "non_compliant";

export interface QualificationReadinessItem {
  qualificationId: string | null;
  standardId: string;
  standardCode: string;
  standardName: string;
  certificationName: string | null;
  expirationDate: Date | null;
  status: Qualification["status"] | "missing";
  readinessStatus: ReadinessStatus;
}

export interface MedicalClearanceReadinessItem {
  clearanceId: string | null;
  clearanceType: string;
  expirationDate: Date | null;
  status: MedicalClearance["status"] | "missing";
  readinessStatus: ReadinessStatus;
}

export interface EmployeeCreateInput {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  departmentId: string;
  hireDate: Date;
}

export interface EmployeeUpdateInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: Role;
  departmentId?: string;
  isActive?: boolean;
}

export interface EmployeeListFilters {
  departmentId?: string;
  role?: string;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface EmployeeDetails extends Employee {
  qualifications: Qualification[];
  medicalClearances: MedicalClearance[];
}

export interface EmployeeReadiness {
  employeeId: string;
  overallStatus: ReadinessStatus;
  qualifications: QualificationReadinessItem[];
  medicalClearances: MedicalClearanceReadinessItem[];
}

export type StandardSummary = Pick<
  ComplianceStandard,
  "id" | "code" | "name" | "description" | "issuingBody" | "version" | "isActive" | "createdAt" | "updatedAt"
>;

export interface QualificationCreateInput {
  employeeId: string;
  standardId: string;
  certificationName: string;
  issuingBody: string;
  issueDate: Date;
  expirationDate?: Date | null;
  documentIds?: string[];
}

export interface QualificationUpdateInput {
  certificationName?: string;
  issuingBody?: string;
  expirationDate?: Date | null;
  status?: Qualification["status"];
  documentIds?: string[];
}

export interface QualificationListFilters {
  employeeId?: string;
  standardId?: string;
  status?: Qualification["status"];
  page?: number;
  limit?: number;
}

export interface QualificationWithStandard extends Qualification {
  standard: StandardSummary;
}

export interface QualificationDetails extends QualificationWithStandard {
  employee: Employee;
}

export interface QualificationComplianceResult {
  compliant: boolean;
  employeeId: string;
  standardId: string;
  requirements: Array<{
    requirementId: string;
    name: string;
    met: boolean;
    qualification?: QualificationWithStandard;
  }>;
}

export interface MedicalCreateInput {
  employeeId: string;
  clearanceType: string;
  status: MedicalClearance["status"];
  effectiveDate: Date;
  expirationDate?: Date | null;
  visualAcuityResult?: string | null;
  colorVisionResult?: string | null;
  issuedBy: string;
}

export interface MedicalUpdateInput {
  status?: MedicalClearance["status"];
  expirationDate?: Date | null;
  visualAcuityResult?: string | null;
  colorVisionResult?: string | null;
}

export interface MedicalClearanceDetails extends MedicalClearance {
  employee: Employee;
}

export interface DocumentUploadInput {
  employeeId: string;
  fileName: string;
  mimeType: string;
  description?: string;
}

export interface CorrectExtractionInput {
  correctedValue: string;
}

export interface ReviewDocumentInput {
  action: "approve" | "reject";
  notes?: string;
  linkedQualificationId?: string;
}

export interface ClockInInput {
  employeeId: string;
  timestamp?: Date;
}

export interface ClockOutInput {
  employeeId: string;
  timestamp?: Date;
}

export interface ManualEntryInput {
  employeeId: string;
  date: Date;
  hours: number;
  qualificationCategory: string;
  description: string;
  labelId?: string;
  attestation: string;
}

export interface ImportedHourRecord {
  employeeId: string;
  date: Date;
  hours: number;
  qualificationCategory: string;
  description?: string;
  labelId?: string;
  jobTicketId?: string;
}

export interface PayrollImportInput {
  records: Array<Omit<ImportedHourRecord, "jobTicketId">>;
  sourceSystemId: string;
}

export interface SchedulingImportInput {
  records: Array<Required<Pick<ImportedHourRecord, "employeeId" | "date" | "hours" | "qualificationCategory" | "jobTicketId">> & Pick<ImportedHourRecord, "description">>;
  sourceSystemId: string;
}

export interface ResolveConflictInput {
  resolutionMethod: HourConflict["resolutionMethod"] extends infer T ? Exclude<T, null> : never;
  attestation: string;
  reason: string;
}

export interface EditHourInput {
  hours?: number;
  qualificationCategory?: string;
  description?: string;
  reason: string;
}

export interface TemplateActor {
  id: string;
  role: Role;
}

export interface TemplateListFilters {
  status?: string;
  category?: string;
  standardId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface AssignmentListFilters {
  page?: number;
  limit?: number;
}

export type TemplateCreateInput = Record<string, unknown>;
export type TemplateUpdateInput = Record<string, unknown>;
export type RequirementCreateInput = Record<string, unknown>;
export type RequirementUpdateInput = Record<string, unknown>;
export type ReorderRequirementsInput = { requirementIds: string[] };
export type AssignTemplateInput = Record<string, unknown>;
export type SelfAttestInput = Record<string, unknown>;
export type AttachDocumentInput = Record<string, unknown>;
export type ValidateFulfillmentInput = Record<string, unknown>;
export type ThirdPartyVerifyInput = Record<string, unknown>;

export interface StandardCreateInput {
  code: string;
  name: string;
  description: string;
  issuingBody: string;
  version: string;
}

export interface StandardUpdateInput {
  name?: string;
  description?: string;
  version?: string;
  isActive?: boolean;
}

export interface StandardRequirementCreateInput {
  category: string;
  description: string;
  minimumHours?: number | null;
  recertificationPeriodMonths?: number | null;
  requiredTests?: string[];
}

export interface StandardRequirementUpdateInput {
  category?: string;
  description?: string;
  minimumHours?: number | null;
  recertificationPeriodMonths?: number | null;
  requiredTests?: string[];
}

export interface StandardListFilters {
  issuingBody?: string;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface LabelCreateInput {
  code: string;
  name: string;
  description?: string;
  effectiveDate: Date;
}

export interface LabelUpdateInput {
  name?: string;
  description?: string;
}

export interface LabelDeprecationInput {
  retirementDate: Date;
  migrateTo?: string;
}

export interface LabelMappingCreateInput {
  labelId: string;
  hourCategory: string;
  effectiveDate: Date;
}

export interface NotificationPreferenceUpdate {
  notificationType: NotificationPreference["notificationType"];
  channels: NotificationPreference["channels"];
  isEnabled: boolean;
  frequency: NotificationPreference["frequency"];
}

export interface SetNotificationPreferencesInput {
  preferences: NotificationPreferenceUpdate[];
}

export interface CreateEscalationRuleInput {
  trigger: EscalationRule["trigger"];
  delayHours: number;
  escalateToRole: string;
  maxEscalations?: number;
}

export interface WeeklyDigest {
  overdueCount: number;
  expiringThisWeek: number;
  pendingReviews: number;
  recentApprovals: number;
  generatedAt: Date;
}

export interface IEmployeeRepository {
  create(input: EmployeeCreateInput): Promise<Employee>;
  getById(id: string): Promise<EmployeeDetails>;
  update(id: string, input: EmployeeUpdateInput): Promise<Employee>;
  list(filters?: EmployeeListFilters): Promise<PaginatedResult<Employee>>;
  getReadiness(id: string): Promise<EmployeeReadiness>;
}

export interface IQualificationRepository {
  create(input: QualificationCreateInput): Promise<Qualification>;
  getById(id: string): Promise<QualificationDetails>;
  update(id: string, input: QualificationUpdateInput): Promise<Qualification>;
  listByEmployee(employeeId: string): Promise<QualificationWithStandard[]>;
  list(filters?: QualificationListFilters): Promise<PaginatedResult<Qualification>>;
  getAuditTrail(id: string): Promise<AuditLog[]>;
  checkCompliance(employeeId: string, standardId: string): Promise<QualificationComplianceResult>;
}

export interface IMedicalRepository {
  create(input: MedicalCreateInput): Promise<MedicalClearance>;
  getById(id: string): Promise<MedicalClearanceDetails>;
  update(id: string, input: MedicalUpdateInput): Promise<MedicalClearance>;
  listByEmployee(employeeId: string): Promise<MedicalClearance[]>;
  getAuditTrail(id: string): Promise<AuditLog[]>;
}

export interface IDocumentRepository {
  upload(input: DocumentUploadInput, fileBuffer: Buffer, uploadedBy: string): Promise<Document>;
  getDocument(id: string): Promise<Document>;
  listByEmployee(employeeId: string, page?: number, limit?: number): Promise<PaginatedResult<Document>>;
  getExtraction(documentId: string): Promise<ExtractionResult[]>;
  correctExtraction(documentId: string, fieldId: string, input: CorrectExtractionInput, correctedBy: string): Promise<ExtractionResult>;
  reviewDocument(id: string, input: ReviewDocumentInput, reviewedBy: string): Promise<ReviewQueueItem>;
  listReviewQueue(page?: number, limit?: number): Promise<PaginatedResult<ReviewQueueItem>>;
  getAuditTrail(documentId: string): Promise<AuditLog[]>;
}

export interface IHoursRepository {
  clockIn(input: ClockInInput): Promise<HourRecord>;
  clockOut(input: ClockOutInput): Promise<HourRecord>;
  submitManualEntry(input: ManualEntryInput, submittedBy: string): Promise<HourRecord>;
  importPayroll(input: PayrollImportInput): Promise<{ imported: number; conflicts: number }>;
  importScheduling(input: SchedulingImportInput): Promise<{ imported: number; conflicts: number }>;
  syncCalendar(employeeId: string): Promise<{ synced: number }>;
  getEmployeeHours(employeeId: string, from?: Date, to?: Date, page?: number, limit?: number): Promise<PaginatedResult<HourRecord>>;
  listConflicts(page?: number, limit?: number): Promise<PaginatedResult<HourConflict>>;
  resolveConflict(conflictId: string, input: ResolveConflictInput, resolvedBy: string): Promise<HourConflict>;
  editHour(id: string, input: EditHourInput, editedBy: string): Promise<HourRecord>;
  deleteHour(id: string, reason: string, deletedBy: string): Promise<void>;
  getAuditTrail(recordId: string): Promise<AuditLog[]>;
}

export interface ITemplateRepository {
  createTemplate(input: TemplateCreateInput, actor: TemplateActor): Promise<ProofTemplate>;
  listTemplates(filters: TemplateListFilters, actor: TemplateActor): Promise<PaginatedResult<ProofTemplate>>;
  getTemplate(id: string, actor: TemplateActor): Promise<ProofTemplate>;
  updateTemplate(id: string, input: TemplateUpdateInput, actor: TemplateActor): Promise<ProofTemplate>;
  deleteTemplate(id: string, actor: TemplateActor): Promise<void>;
  publishTemplate(id: string, actor: TemplateActor): Promise<ProofTemplate>;
  archiveTemplate(id: string, actor: TemplateActor): Promise<ProofTemplate>;
  cloneTemplate(id: string, actor: TemplateActor): Promise<ProofTemplate>;
  addRequirement(templateId: string, input: RequirementCreateInput, actor: TemplateActor): Promise<ProofRequirement>;
  updateRequirement(templateId: string, requirementId: string, input: RequirementUpdateInput, actor: TemplateActor): Promise<ProofRequirement>;
  removeRequirement(templateId: string, requirementId: string, actor: TemplateActor): Promise<void>;
  reorderRequirements(templateId: string, input: ReorderRequirementsInput, actor: TemplateActor): Promise<ProofRequirement[]>;
  assignTemplate(templateId: string, input: AssignTemplateInput, actor: TemplateActor): Promise<{ assignments: TemplateAssignment[]; created: number; skipped: number }>;
  listAssignmentsByTemplate(templateId: string, filters: AssignmentListFilters, actor: TemplateActor): Promise<PaginatedResult<TemplateAssignment>>;
  listAssignmentsByEmployee(employeeId: string, filters: AssignmentListFilters, actor: TemplateActor): Promise<PaginatedResult<TemplateAssignment>>;
  deactivateAssignment(assignmentId: string, actor: TemplateActor): Promise<TemplateAssignment>;
  listFulfillmentsByAssignment(assignmentId: string, actor: TemplateActor): Promise<ProofFulfillment[]>;
  selfAttestFulfillment(fulfillmentId: string, input: SelfAttestInput, actor: TemplateActor): Promise<ProofFulfillment>;
  attachDocument(fulfillmentId: string, input: AttachDocumentInput, actor: TemplateActor): Promise<ProofFulfillment>;
  validateFulfillment(fulfillmentId: string, input: ValidateFulfillmentInput, actor: TemplateActor): Promise<ProofFulfillment>;
  thirdPartyVerify(fulfillmentId: string, input: ThirdPartyVerifyInput, actor: TemplateActor): Promise<ProofFulfillment>;
  listPendingReview(filters: AssignmentListFilters, actor: TemplateActor): Promise<PaginatedResult<ProofFulfillment>>;
  countPendingReview(actor: TemplateActor): Promise<{ count: number }>;
  getTemplateAuditTrail(id: string): Promise<AuditLog[]>;
  getFulfillmentAuditTrail(id: string): Promise<AuditLog[]>;
}

export interface IStandardRepository {
  create(input: StandardCreateInput): Promise<ComplianceStandard>;
  list(filters?: StandardListFilters): Promise<PaginatedResult<ComplianceStandard>>;
  getById(id: string): Promise<ComplianceStandard>;
  update(id: string, input: StandardUpdateInput): Promise<ComplianceStandard>;
  createRequirement(standardId: string, input: StandardRequirementCreateInput): Promise<StandardRequirement>;
  updateRequirement(id: string, input: StandardRequirementUpdateInput): Promise<StandardRequirement>;
  listRequirements(standardId: string): Promise<StandardRequirement[]>;
}

export interface ILabelRepository {
  createLabel(input: LabelCreateInput): Promise<Label>;
  updateLabel(id: string, input: LabelUpdateInput): Promise<Label>;
  deprecateLabel(id: string, input: LabelDeprecationInput): Promise<Label>;
  getLabel(id: string): Promise<Label>;
  listVersions(): Promise<TaxonomyVersion[]>;
  createMapping(input: LabelMappingCreateInput): Promise<LabelMapping>;
  resolveLabel(label: string, version?: number): Promise<LabelMapping>;
  getAuditTrail(id: string): Promise<AuditLog[]>;
}

export interface INotificationRepository {
  getPreferences(userId: string): Promise<NotificationPreference[]>;
  setPreferences(userId: string, input: SetNotificationPreferencesInput): Promise<NotificationPreference[]>;
  listNotifications(userId: string, page?: number, limit?: number): Promise<PaginatedResult<Notification>>;
  markAsRead(id: string, userId: string): Promise<Notification>;
  dismiss(id: string, userId: string): Promise<void>;
  getWeeklyDigest(userId: string): Promise<WeeklyDigest>;
  sendTestNotification(userId: string): Promise<{ sent: boolean }>;
  createEscalationRule(input: CreateEscalationRuleInput): Promise<EscalationRule>;
  listEscalationRules(): Promise<EscalationRule[]>;
}
