-- CreateEnum
CREATE TYPE "Role" AS ENUM ('EMPLOYEE', 'SUPERVISOR', 'MANAGER', 'COMPLIANCE_OFFICER', 'ADMIN');

-- CreateEnum
CREATE TYPE "QualificationStatus" AS ENUM ('ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'PENDING_REVIEW', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "HourSource" AS ENUM ('CLOCK_IN_OUT', 'TIMESHEET_IMPORT', 'JOB_TICKET_SYNC', 'CALENDAR_SYNC', 'MANUAL_ENTRY');

-- CreateEnum
CREATE TYPE "ConflictType" AS ENUM ('DUPLICATE', 'MISMATCH');

-- CreateEnum
CREATE TYPE "ConflictStatus" AS ENUM ('PENDING', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ResolutionMethod" AS ENUM ('PRECEDENCE', 'OVERRIDE', 'MERGE');

-- CreateEnum
CREATE TYPE "LabelStatus" AS ENUM ('ACTIVE', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'CLASSIFIED', 'REVIEW_REQUIRED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProcessingStep" AS ENUM ('OCR', 'CLASSIFICATION', 'EXTRACTION', 'EXPIRATION_DETECTION', 'STANDARDS_MATCHING');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MedicalClearanceStatus" AS ENUM ('CLEARED', 'PENDING', 'RESTRICTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('SENT', 'READ', 'DISMISSED');

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "departmentId" TEXT,
    "hireDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qualifications" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "standardId" TEXT NOT NULL,
    "certificationName" TEXT NOT NULL,
    "issuingBody" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "expirationDate" TIMESTAMP(3),
    "status" "QualificationStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qualifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qualification_documents" (
    "qualificationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,

    CONSTRAINT "qualification_documents_pkey" PRIMARY KEY ("qualificationId","documentId")
);

-- CreateTable
CREATE TABLE "hour_records" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "source" "HourSource" NOT NULL,
    "date" DATE NOT NULL,
    "hours" DECIMAL(5,2) NOT NULL,
    "qualificationCategory" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "labelId" TEXT,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hour_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hour_conflicts" (
    "id" TEXT NOT NULL,
    "conflictType" "ConflictType" NOT NULL,
    "status" "ConflictStatus" NOT NULL DEFAULT 'PENDING',
    "resolutionMethod" "ResolutionMethod",
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "attestation" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hour_conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hour_conflict_records" (
    "conflictId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,

    CONSTRAINT "hour_conflict_records_pkey" PRIMARY KEY ("conflictId","recordId")
);

-- CreateTable
CREATE TABLE "labels" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" "LabelStatus" NOT NULL DEFAULT 'ACTIVE',
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "retirementDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "label_mappings" (
    "id" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,
    "hourCategory" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "label_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taxonomy_versions" (
    "id" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "changeLog" TEXT NOT NULL,
    "migrationRules" JSONB NOT NULL DEFAULT '{}',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "taxonomy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "classifiedType" TEXT,
    "detectedExpiration" TIMESTAMP(3),
    "uploadedBy" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_processing" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "processingStep" "ProcessingStep" NOT NULL,
    "status" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "processor" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_processing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extraction_results" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "extractedValue" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "suggestedValue" TEXT,
    "correctedValue" TEXT,
    "correctedBy" TEXT,
    "correctedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extraction_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_queue" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvalNotes" TEXT,
    "linkedQualificationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_clearances" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "clearanceType" TEXT NOT NULL,
    "status" "MedicalClearanceStatus" NOT NULL DEFAULT 'PENDING',
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "expirationDate" TIMESTAMP(3),
    "visualAcuityResult" TEXT,
    "colorVisionResult" TEXT,
    "issuedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_clearances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_standards" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "issuingBody" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_standards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "standard_requirements" (
    "id" TEXT NOT NULL,
    "standardId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "minimumHours" DECIMAL(7,2),
    "recertificationPeriodMonths" INTEGER,
    "requiredTests" TEXT[],

    CONSTRAINT "standard_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "changedFields" JSONB,
    "actor" TEXT NOT NULL,
    "reason" TEXT,
    "attestation" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actionUrl" TEXT,
    "status" "NotificationStatus" NOT NULL DEFAULT 'SENT',
    "deliveryChannel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notificationType" TEXT NOT NULL,
    "channels" TEXT[],
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "frequency" TEXT NOT NULL DEFAULT 'immediate',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalation_rules" (
    "id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "delayHours" INTEGER NOT NULL,
    "escalateToRole" TEXT NOT NULL,
    "maxEscalations" INTEGER NOT NULL DEFAULT 3,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escalation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_employeeNumber_key" ON "employees"("employeeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");

-- CreateIndex
CREATE INDEX "qualifications_employeeId_idx" ON "qualifications"("employeeId");

-- CreateIndex
CREATE INDEX "qualifications_standardId_idx" ON "qualifications"("standardId");

-- CreateIndex
CREATE INDEX "qualifications_status_idx" ON "qualifications"("status");

-- CreateIndex
CREATE INDEX "hour_records_employeeId_date_idx" ON "hour_records"("employeeId", "date");

-- CreateIndex
CREATE INDEX "hour_records_source_idx" ON "hour_records"("source");

-- CreateIndex
CREATE INDEX "hour_conflicts_status_idx" ON "hour_conflicts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "labels_code_key" ON "labels"("code");

-- CreateIndex
CREATE INDEX "label_mappings_labelId_version_idx" ON "label_mappings"("labelId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "taxonomy_versions_versionNumber_key" ON "taxonomy_versions"("versionNumber");

-- CreateIndex
CREATE INDEX "documents_employeeId_idx" ON "documents"("employeeId");

-- CreateIndex
CREATE INDEX "documents_status_idx" ON "documents"("status");

-- CreateIndex
CREATE INDEX "document_processing_documentId_idx" ON "document_processing"("documentId");

-- CreateIndex
CREATE INDEX "extraction_results_documentId_idx" ON "extraction_results"("documentId");

-- CreateIndex
CREATE INDEX "review_queue_status_idx" ON "review_queue"("status");

-- CreateIndex
CREATE INDEX "medical_clearances_employeeId_idx" ON "medical_clearances"("employeeId");

-- CreateIndex
CREATE INDEX "medical_clearances_status_idx" ON "medical_clearances"("status");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_standards_code_key" ON "compliance_standards"("code");

-- CreateIndex
CREATE INDEX "standard_requirements_standardId_idx" ON "standard_requirements"("standardId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_recordId_idx" ON "audit_logs"("entityType", "recordId");

-- CreateIndex
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs"("actor");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "notifications_userId_status_idx" ON "notifications"("userId", "status");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_notificationType_key" ON "notification_preferences"("userId", "notificationType");

-- AddForeignKey
ALTER TABLE "qualifications" ADD CONSTRAINT "qualifications_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qualifications" ADD CONSTRAINT "qualifications_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES "compliance_standards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qualification_documents" ADD CONSTRAINT "qualification_documents_qualificationId_fkey" FOREIGN KEY ("qualificationId") REFERENCES "qualifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qualification_documents" ADD CONSTRAINT "qualification_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hour_records" ADD CONSTRAINT "hour_records_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hour_records" ADD CONSTRAINT "hour_records_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "labels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hour_conflict_records" ADD CONSTRAINT "hour_conflict_records_conflictId_fkey" FOREIGN KEY ("conflictId") REFERENCES "hour_conflicts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hour_conflict_records" ADD CONSTRAINT "hour_conflict_records_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "hour_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "label_mappings" ADD CONSTRAINT "label_mappings_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "labels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_processing" ADD CONSTRAINT "document_processing_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_results" ADD CONSTRAINT "extraction_results_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_queue" ADD CONSTRAINT "review_queue_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_clearances" ADD CONSTRAINT "medical_clearances_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standard_requirements" ADD CONSTRAINT "standard_requirements_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES "compliance_standards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
