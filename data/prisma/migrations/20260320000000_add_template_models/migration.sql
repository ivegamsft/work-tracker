-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AttestationLevel" AS ENUM ('SELF_ATTEST', 'UPLOAD', 'THIRD_PARTY', 'VALIDATED');

-- CreateEnum
CREATE TYPE "FulfillmentStatus" AS ENUM ('UNFULFILLED', 'PENDING_REVIEW', 'FULFILLED', 'EXPIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProofType" AS ENUM ('HOURS', 'CERTIFICATION', 'TRAINING', 'CLEARANCE', 'ASSESSMENT', 'COMPLIANCE');

-- CreateTable
CREATE TABLE "proof_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT,
    "status" "TemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "previousVersion" TEXT,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "standardId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "proof_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proof_requirements" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "attestationLevels" "AttestationLevel"[],
    "proofType" "ProofType",
    "proofSubType" TEXT,
    "typeConfig" JSONB,
    "threshold" DOUBLE PRECISION,
    "thresholdUnit" TEXT,
    "rollingWindowDays" INTEGER,
    "universalCategory" TEXT,
    "qualificationType" TEXT,
    "medicalTestType" TEXT,
    "standardReqId" TEXT,
    "validityDays" INTEGER,
    "renewalWarningDays" INTEGER DEFAULT 30,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proof_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_assignments" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "employeeId" TEXT,
    "role" TEXT,
    "department" TEXT,
    "assignedBy" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "template_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proof_fulfillments" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "status" "FulfillmentStatus" NOT NULL DEFAULT 'UNFULFILLED',
    "selfAttestedAt" TIMESTAMP(3),
    "selfAttestation" TEXT,
    "uploadedAt" TIMESTAMP(3),
    "documentId" TEXT,
    "thirdPartyVerifiedAt" TIMESTAMP(3),
    "thirdPartySource" TEXT,
    "thirdPartyRefId" TEXT,
    "thirdPartyData" JSONB,
    "validatedAt" TIMESTAMP(3),
    "validatedBy" TEXT,
    "validatorNotes" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proof_fulfillments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proof_templates_status_idx" ON "proof_templates"("status");

-- CreateIndex
CREATE INDEX "proof_templates_createdBy_idx" ON "proof_templates"("createdBy");

-- CreateIndex
CREATE INDEX "proof_templates_standardId_idx" ON "proof_templates"("standardId");

-- CreateIndex
CREATE INDEX "proof_requirements_templateId_idx" ON "proof_requirements"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "template_assignments_templateId_employeeId_key" ON "template_assignments"("templateId", "employeeId");

-- CreateIndex
CREATE INDEX "template_assignments_employeeId_idx" ON "template_assignments"("employeeId");

-- CreateIndex
CREATE INDEX "template_assignments_role_idx" ON "template_assignments"("role");

-- CreateIndex
CREATE INDEX "template_assignments_department_idx" ON "template_assignments"("department");

-- CreateIndex
CREATE INDEX "template_assignments_assignedBy_idx" ON "template_assignments"("assignedBy");

-- CreateIndex
CREATE UNIQUE INDEX "proof_fulfillments_assignmentId_requirementId_key" ON "proof_fulfillments"("assignmentId", "requirementId");

-- CreateIndex
CREATE INDEX "proof_fulfillments_employeeId_idx" ON "proof_fulfillments"("employeeId");

-- CreateIndex
CREATE INDEX "proof_fulfillments_status_idx" ON "proof_fulfillments"("status");

-- CreateIndex
CREATE INDEX "proof_fulfillments_expiresAt_idx" ON "proof_fulfillments"("expiresAt");

-- AddForeignKey
ALTER TABLE "proof_templates" ADD CONSTRAINT "proof_templates_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_templates" ADD CONSTRAINT "proof_templates_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES "compliance_standards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_requirements" ADD CONSTRAINT "proof_requirements_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "proof_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_requirements" ADD CONSTRAINT "proof_requirements_standardReqId_fkey" FOREIGN KEY ("standardReqId") REFERENCES "standard_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_assignments" ADD CONSTRAINT "template_assignments_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "proof_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_assignments" ADD CONSTRAINT "template_assignments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_assignments" ADD CONSTRAINT "template_assignments_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_fulfillments" ADD CONSTRAINT "proof_fulfillments_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "template_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_fulfillments" ADD CONSTRAINT "proof_fulfillments_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "proof_requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_fulfillments" ADD CONSTRAINT "proof_fulfillments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_fulfillments" ADD CONSTRAINT "proof_fulfillments_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_fulfillments" ADD CONSTRAINT "proof_fulfillments_validatedBy_fkey" FOREIGN KEY ("validatedBy") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
