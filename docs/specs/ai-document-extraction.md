# Specification: AI-Assisted Document Extraction and Review

**Issue:** #45  
**Owner:** Kima (Frontend), Bunk (Backend), Pearlman (Compliance)  
**Status:** Design Spike  
**Last Updated:** 2026-03-20

---

## 1. Executive Summary

This specification defines the user experience, system architecture, and API contracts for AI-powered document processing in E-CLAT. Employees and supervisors upload compliance documents (PDFs, images, scanned records). Azure Document Intelligence extracts structured fields (dates, numbers, text). Compliance officers review extraction quality, correct confidence-flagged fields, and approve documents for qualification linking. The system audits all corrections and integrates extracted data into existing qualification and review queue workflows.

---

## 2. User Experience Design

### 2.1 Upload Flow (Employee & Supervisor)

**Screen: Document Upload (My Documents > Upload New)**

```
┌─────────────────────────────────────────┐
│  Upload Compliance Document             │
├─────────────────────────────────────────┤
│                                         │
│  📁 Drag & drop or click to select     │
│     Files: PDF, PNG, JPG, TIFF         │
│     Max: 10 MB per file, 5 files/batch │
│                                         │
│  ☑ Document Type (required):           │
│    ⊙ Certification                      │
│    ⊙ Training Record                    │
│    ⊙ Medical Clearance                  │
│    ⊙ License                            │
│    ⊙ Other                              │
│                                         │
│  Title (optional):                      │
│  [_________________________________]   │
│                                         │
│  [ Cancel ]  [ Upload & Extract ]      │
└─────────────────────────────────────────┘
```

**Behavior:**
- Drag-and-drop zone with file type hints
- Bulk upload: up to 5 files per batch
- Format validation: PDF, PNG, JPG, TIFF (block unsupported formats)
- File size check: reject files >10 MB upfront
- Document type selection guides extraction templates (certification → date fields; medical → expiration detection)
- Optional title field for user context
- **Success state:** Toast notification + redirect to document detail with extraction status
- **Error state:** Inline error messages (invalid type, file too large, format unsupported)

---

### 2.2 Extraction Status & Progress

**Screen: Extraction In Progress**

```
┌──────────────────────────────────────────────┐
│  📄 Certification (In Progress)               │
├──────────────────────────────────────────────┤
│                                              │
│  Status: Extracting data...  [spinner]      │
│  Estimated time: 5-10 seconds                │
│                                              │
│  Processing Steps:                           │
│  ✓ Document uploaded                         │
│  ⟳ Optical character recognition (OCR)       │
│  ◯ Field extraction                          │
│  ◯ Expiration detection                      │
│  ◯ Review preparation                        │
│                                              │
│  [Expand Details]                            │
│                                              │
└──────────────────────────────────────────────┘
```

**Behavior:**
- Poll `/api/documents/:id/extraction-status` every 2 seconds
- Show individual processing step status (OCR, EXTRACTION, CLASSIFICATION, EXPIRATION_DETECTION, STANDARDS_MATCHING)
- Display spinner during processing
- If extraction fails after 3 retries, show error UI with manual field entry option
- Once complete, auto-redirect to extraction review screen

---

### 2.3 Extraction Review & Correction

**Screen: Extract and Correct Fields**

```
┌────────────────────────────────────────────────────┐
│  Certification — Review Extracted Data             │
├────────────────────────────────────────────────────┤
│                                                    │
│  Document: scan_cert_2026.pdf                      │
│  Confidence: 87% ⓘ                                 │
│                                                    │
│  📋 Fields Extracted:                              │
│  ┌─ Certificate Name ─────────────────────────┐   │
│  │ AWS Solutions Architect                    │   │
│  │ Confidence: 95% ✓                          │   │
│  └─────────────────────────────────────────────┘   │
│                                                    │
│  ┌─ Issue Date ───────────────────────────────┐   │
│  │ 2024-03-15                                 │   │
│  │ Confidence: 98% ✓                          │   │
│  │ [ Correct ]                                │   │
│  └─────────────────────────────────────────────┘   │
│                                                    │
│  ⚠️ ┌─ Expiration Date ──────────────────────┐    │
│     │ [                           ] (empty)   │    │
│     │ Confidence: 42% ⚠️  (flagged)          │    │
│     │ Suggested: 2026-03-15 (not confident)  │    │
│     │ [ Use Suggested ] [ Correct Manually ] │    │
│     └────────────────────────────────────────┘    │
│                                                    │
│  ┌─ Issuing Body ────────────────────────────┐    │
│  │ Amazon Web Services, Inc.                 │    │
│  │ Confidence: 91% ✓                         │    │
│  └─────────────────────────────────────────────┘   │
│                                                    │
│  [ Cancel ]  [ Save Corrections ]  [ Approve ]   │
│                                                    │
└────────────────────────────────────────────────────┘
```

**Field-Level Behavior:**
- **High confidence (≥90%):** Display as read-only with confidence badge; no Correct button visible
- **Medium confidence (70-89%):** Display extracted value with Correct button; subtle warning color
- **Low confidence (<70%):** Highlight in yellow/orange warning color; show both extracted + suggested values with separate buttons
- **Empty fields:** Show placeholder with manual entry prompt
- **Correct inline:** Click Correct button → inline text editor appears; press Enter or click Save to confirm
- **Suggest alternative:** Show alternative extraction if AI provided one (e.g., "Maybe you meant: 2026-03-20")

**Actions:**
- **Save Corrections:** Updates ExtractionResult.correctedValue + correctedBy + correctedAt timestamps
- **Approve:** Moves document status to REVIEW_REQUIRED; creates ReviewQueueItem; notifies compliance officer
- **Cancel:** Discards all corrections; returns to document detail without saving

---

### 2.4 Review Queue Integration

**Screen: Compliance Officer Review Queue**

```
┌──────────────────────────────────────────────────┐
│  Review Queue (Compliance Officer)                │
├──────────────────────────────────────────────────┤
│  Filters: [ All ] [ Pending ] [ Approved ]        │
│  Sort:    [ Newest ] [ Employee ] [ Priority ]    │
│                                                  │
│  🆕 ┌─────────────────────────────────────────┐  │
│     │ John Smith                              │  │
│     │ Certification: AWS Solutions Architect  │  │
│     │ Submitted: Mar 19, 2026 @ 2:30 PM      │  │
│     │ Status: Pending Review                  │  │
│     │ Fields Corrected: 1/4 by employee      │  │
│     │ [ Review Details ]                      │  │
│     └─────────────────────────────────────────┘  │
│                                                  │
│  ✓ ┌─────────────────────────────────────────┐   │
│     │ Jane Doe                                │   │
│     │ Medical Clearance (occupational health) │   │
│     │ Submitted: Mar 18, 2026 @ 4:15 PM      │   │
│     │ Status: Approved                        │   │
│     │ [ View ]                                │   │
│     └─────────────────────────────────────────┘   │
│                                                  │
│  ☐ ┌─────────────────────────────────────────┐   │
│     │ Mark Johnson                            │   │
│     │ License: Professional Engineer (PE)     │   │
│     │ Submitted: Mar 17, 2026 @ 10:00 AM     │   │
│     │ Status: Pending Review                  │   │
│     │ Fields Corrected: 2/5 by supervisor    │   │
│     │ [ Review Details ]                      │   │
│     └─────────────────────────────────────────┘   │
│                                                  │
│  [1]  [2]  [3]  [Next]                           │
└──────────────────────────────────────────────────┘
```

**Queue Item Detail Screen:**

```
┌────────────────────────────────────────────────┐
│ Review Queue Detail — Certification             │
├────────────────────────────────────────────────┤
│                                                │
│ Employee: John Smith (ID: emp-001)             │
│ Submitted: Mar 19, 2026 @ 2:30 PM by employee │
│                                                │
│ 📄 Scan: scan_cert_2026.pdf                    │
│    [ View Document ] [ Download ]              │
│                                                │
│ Extraction Summary:                            │
│ ✓ Certificate Name: AWS Solutions Architect   │
│ ✓ Issue Date: 2024-03-15                      │
│ ⚠️  Expiration Date: (manually corrected      │
│    original: empty → 2026-03-15)              │
│ ✓ Issuing Body: Amazon Web Services, Inc.     │
│                                                │
│ AI Confidence Score: 87%                       │
│ [ Show Extraction Audit ]                      │
│                                                │
│ ┌──────────────────────────────────────────┐  │
│ │ Compliance Officer Decision:              │  │
│ │ ⊙ Approve — Add to qualifications        │  │
│ │ ⊙ Request Changes — Return to employee   │  │
│ │ ⊙ Reject — Document invalid             │  │
│ │                                          │  │
│ │ Notes (optional):                        │  │
│ │ [________________________]                │  │
│ │                                          │  │
│ │ [ Cancel ]  [ Submit Decision ]          │  │
│ └──────────────────────────────────────────┘  │
│                                                │
└────────────────────────────────────────────────┘
```

**Behavior:**
- Review queue shows recently submitted extracted documents awaiting compliance officer approval
- Documents show extraction confidence score prominently
- Show which fields have been corrected (and by whom) to highlight areas of human attention
- Expandable audit trail shows exact corrections made + timestamps
- Document preview embedded or accessible via modal
- Compliance officer can:
  - **Approve** → Creates/updates Qualification record; document status → APPROVED; sends notification to employee
  - **Request Changes** → Document status → REVIEW_REQUIRED; notifies employee with specific change requests
  - **Reject** → Document status → REJECTED; notifies employee of denial reason

---

### 2.5 Escalation & Notifications

**Notification Scenarios:**
1. **Extraction Complete** → Employee receives "Your document has been extracted and is ready for review"
2. **Changes Needed** → Employee receives "Please correct the following fields in your document: [list]"
3. **Document Approved** → Employee receives "Your certification has been verified and added to your profile"
4. **Document Rejected** → Employee receives "Your document could not be verified: [reason]"
5. **Extraction Failed** → Employee receives "We couldn't automatically extract your document. Please help us by entering key details."

**Escalation:** If compliance officer doesn't review within 48 hours, notification escalates to manager, then compliance manager (if configured).

---

## 3. System Architecture

### 3.1 Data Model

**Existing Models (Reviewed):**
- `Document` — tracks upload, status, reviewer, review timestamp
- `DocumentProcessing` — tracks each processing step (OCR, CLASSIFICATION, EXTRACTION, etc.) with status
- `ExtractionResult` — individual field with extracted value, confidence, suggested value, and correction tracking
- `ReviewQueueItem` — queues extracted documents for compliance review

**Data Flow:**
```
Employee Uploads PDF
  ↓
POST /api/documents/upload
  ↓
Create Document (status: UPLOADED)
Create DocumentProcessing.EXTRACTION (status: PENDING)
  ↓
Azure Document Intelligence async job
  ↓
Extract fields → ExtractionResult rows (field, extractedValue, confidence, suggestedValue)
DocumentProcessing.EXTRACTION status → COMPLETED
Document status → PROCESSING
  ↓
Employee Reviews Corrections
  ↓
PUT /api/documents/:id/extraction/:fieldId/correct
  ↓
ExtractionResult.correctedValue = user input
ExtractionResult.correctedBy = userId
ExtractionResult.correctedAt = now()
  ↓
Employee/Supervisor Approves
  ↓
POST /api/documents/:id/review { decision: "APPROVE" }
  ↓
Document status → REVIEW_REQUIRED
Create ReviewQueueItem (status: PENDING)
  ↓
Compliance Officer Reviews & Decides
  ↓
POST /api/admin/review-queue/:id { decision: "APPROVE", notes?: string }
  ↓
Document status → APPROVED
Create Qualification record linking document
Notification to employee
```

**Correction Audit Trail:**
- Every correction is timestamped with `correctedBy` (user ID)
- AuditLog entries track each state transition
- Historical values stored for compliance reporting

---

### 3.2 API Endpoints

#### Upload & Status

**POST /api/documents/upload** (EMPLOYEE+)
```json
Request:
{
  "documentType": "certification",  // enum: certification, training, clearance, license, other
  "title": "AWS Solutions Architect"  // optional
}
// File attached via multipart/form-data
// Body: binary file buffer

Response: 201 Created
{
  "id": "doc-uuid",
  "employeeId": "emp-uuid",
  "fileName": "scan_cert_2026.pdf",
  "status": "UPLOADED",
  "createdAt": "2026-03-19T14:30:00Z"
}
```

**GET /api/documents/:id/extraction-status** (EMPLOYEE+)
```json
Response: 200 OK
{
  "documentId": "doc-uuid",
  "status": "PROCESSING",  // UPLOADED, PROCESSING, COMPLETED, FAILED
  "currentStep": "EXTRACTION",  // OCR, CLASSIFICATION, EXTRACTION, EXPIRATION_DETECTION, STANDARDS_MATCHING
  "progress": 60,  // percentage
  "estimatedSecondsRemaining": 5,
  "errorMessage": null,
  "completedAt": null
}
```

#### Extraction Review

**GET /api/documents/:id/extraction** (EMPLOYEE+, SUPERVISOR+)
```json
Response: 200 OK
{
  "documentId": "doc-uuid",
  "overallConfidence": 87,
  "fields": [
    {
      "id": "ext-uuid",
      "field": "certificateName",
      "extractedValue": "AWS Solutions Architect",
      "confidence": 95,
      "suggestedValue": null,
      "correctedValue": null,
      "correctedBy": null,
      "correctedAt": null
    },
    {
      "id": "ext-uuid-2",
      "field": "expirationDate",
      "extractedValue": null,
      "confidence": 0,
      "suggestedValue": "2026-03-15",
      "correctedValue": "2026-03-15",
      "correctedBy": "user-uuid",
      "correctedAt": "2026-03-19T15:45:00Z"
    }
  ]
}
```

**PUT /api/documents/:id/extraction/:fieldId/correct** (EMPLOYEE+, SUPERVISOR+)
```json
Request:
{
  "correctedValue": "2026-03-15"  // user's corrected/confirmed value
}

Response: 200 OK
{
  "id": "ext-uuid",
  "field": "expirationDate",
  "correctedValue": "2026-03-15",
  "correctedBy": "user-uuid",
  "correctedAt": "2026-03-19T15:45:00Z"
}
```

#### Review Decision

**POST /api/documents/:id/review** (MANAGER+, COMPLIANCE_OFFICER+)
```json
Request:
{
  "decision": "APPROVE",  // enum: APPROVE, REQUEST_CHANGES, REJECT
  "notes": "All fields verified against issuing body database"  // optional
}

Response: 200 OK
{
  "documentId": "doc-uuid",
  "status": "REVIEW_REQUIRED",  // or APPROVED, REJECTED
  "reviewedBy": "user-uuid",
  "reviewedAt": "2026-03-19T16:00:00Z",
  "approvalNotes": "..."
}
```

#### Review Queue (Compliance Officer)

**GET /api/admin/review-queue** (COMPLIANCE_OFFICER+)
```json
Request:
  ?page=1&limit=20&status=PENDING&sort=createdAt

Response: 200 OK
{
  "items": [
    {
      "id": "queue-item-uuid",
      "documentId": "doc-uuid",
      "employeeId": "emp-uuid",
      "employeeName": "John Smith",
      "documentFileName": "scan_cert_2026.pdf",
      "documentType": "certification",
      "status": "PENDING",  // PENDING, APPROVED, REJECTED
      "overallConfidence": 87,
      "fieldsCorrected": 1,
      "fieldsTotal": 4,
      "submittedAt": "2026-03-19T14:30:00Z",
      "createdAt": "2026-03-19T14:30:00Z"
    }
  ],
  "total": 45,
  "page": 1,
  "limit": 20
}
```

**POST /api/admin/review-queue/:itemId** (COMPLIANCE_OFFICER+)
```json
Request:
{
  "decision": "APPROVE",  // enum: APPROVE, REQUEST_CHANGES, REJECT
  "notes": "Verified against AWS Certification database"
}

Response: 200 OK
{
  "id": "queue-item-uuid",
  "status": "APPROVED",
  "reviewedAt": "2026-03-19T16:15:00Z",
  "linkedQualificationId": "qual-uuid"  // created if decision == APPROVE
}
```

#### Audit Trail

**GET /api/documents/:id/audit** (SUPERVISOR+)
```json
Response: 200 OK
{
  "documentId": "doc-uuid",
  "events": [
    {
      "timestamp": "2026-03-19T14:30:00Z",
      "action": "UPLOADED",
      "actor": "emp-uuid",
      "details": { "fileName": "scan_cert_2026.pdf" }
    },
    {
      "timestamp": "2026-03-19T14:35:00Z",
      "action": "EXTRACTION_COMPLETED",
      "actor": "system",
      "details": { "overallConfidence": 87, "fieldsExtracted": 4 }
    },
    {
      "timestamp": "2026-03-19T15:45:00Z",
      "action": "FIELD_CORRECTED",
      "actor": "emp-uuid",
      "details": {
        "field": "expirationDate",
        "before": null,
        "after": "2026-03-15"
      }
    },
    {
      "timestamp": "2026-03-19T16:15:00Z",
      "action": "APPROVED",
      "actor": "user-uuid",
      "details": { "notes": "Verified..." }
    }
  ]
}
```

---

### 3.3 Azure Document Intelligence Integration

**Service Layer (`documentsService`):**
- `uploadAndQueue(file, documentType, userId)` — Store file in blob storage, queue async extraction job
- `getExtractionStatus(documentId)` → Polling-friendly response
- `triggerExtraction(documentId)` — Call Azure Document Intelligence API with document-type-specific model
- `processExtractionResults(documentId, aiResponse)` → Parse AI response, create ExtractionResult rows, update document status
- `correctExtraction(documentId, fieldId, correctedValue, userId)` — Update ExtractionResult.correctedValue
- `reviewDocument(documentId, decision, notes, userId)` — Update document status, optionally create Qualification

**AI Model Selection:**
- Generic document extraction model for initial pass (multi-field, multi-document type)
- Optional specialized models: certificates (US credentials), medical records (occupational health)
- Fallback to manual field entry if extraction fails (prompt employee to provide key data)

**Async Job Queue:**
- Use Azure Storage Queue or similar for extraction jobs
- Polling mechanism: client polls `/api/documents/:id/extraction-status` every 2 seconds
- Webhook alternative: notify frontend via WebSocket when extraction completes (if real-time desired)

---

### 3.4 RBAC Matrix

| Role | Upload | View Own | View Team's | Correct Fields | Review Queue | Approve |
|------|--------|----------|------------|----------------|--------------|---------|
| EMPLOYEE | ✓ | ✓ | ✗ | ✓ (own) | ✗ | ✗ |
| SUPERVISOR | ✓ | ✓ | ✓ | ✓ (team) | ✓ | ✗ |
| MANAGER | ✓ | ✓ | ✓ | ✓ (all) | ✓ | ✓ |
| COMPLIANCE_OFFICER | ✓ | ✓ | ✓ | ✓ (all) | ✓ | ✓ |
| ADMIN | ✓ | ✓ | ✓ | ✓ (all) | ✓ | ✓ |

---

## 4. Frontend Component Architecture

### 4.1 New Components

**`DocumentUploadForm.tsx`**
- Drag-and-drop area with file browser fallback
- Bulk file selection (max 5)
- Document type dropdown
- Title input
- Upload button with progress indicator
- Error display for invalid files

**`ExtractionProgress.tsx`**
- Animated progress bar with step indicators
- Current processing step display
- Expandable details panel
- "Try Again" button for failed extractions

**`ExtractionFieldEditor.tsx`**
- Reusable field row: displays extracted value + confidence badge
- Confidence-aware rendering (high = read-only, low = editable)
- Inline text editor on Correct button click
- Suggested value display for low-confidence fields
- Approve/Reject buttons per field

**`ExtractionReviewPage.tsx`**
- Aggregates ExtractionFieldEditor instances
- Summary stats: overall confidence, fields corrected
- Document preview sidebar
- Save & Approve flow

**`ReviewQueuePage.tsx` (Compliance Officer)**
- Filterable, sortable queue of extracted documents
- Queue item cards showing confidence, employee, document type
- Detail modal/page with full extraction audit
- Decision form (Approve/Request Changes/Reject)

**`ExtractionAuditTrail.tsx`**
- Timeline view of all document lifecycle events
- Correction history with before/after values
- Actor names and timestamps

### 4.2 API Integration Pattern

```typescript
// pages/MyDocuments/MyDocumentsPage.tsx
const [extraction, setExtraction] = useState<ExtractionResult[] | null>(null);
const [status, setStatus] = useState<"uploading" | "extracting" | "ready">("uploading");

useEffect(() => {
  const checkStatus = async () => {
    const res = await apiClient.get(`/documents/${docId}/extraction-status`);
    setStatus(res.status === "COMPLETED" ? "ready" : "extracting");
    
    if (res.status === "COMPLETED") {
      const extraction = await apiClient.get(`/documents/${docId}/extraction`);
      setExtraction(extraction.fields);
    }
  };
  
  if (status === "extracting") {
    const interval = setInterval(checkStatus, 2000);
    return () => clearInterval(interval);
  }
}, [status, docId]);

return (
  <PageShell breadcrumbs={[...]} tabs={[...]}>
    {status === "uploading" && <DocumentUploadForm />}
    {status === "extracting" && <ExtractionProgress />}
    {status === "ready" && (
      <ExtractionReviewPage
        fields={extraction}
        onCorrect={(fieldId, value) => 
          apiClient.put(`/documents/${docId}/extraction/${fieldId}/correct`, { correctedValue: value })
        }
      />
    )}
  </PageShell>
);
```

---

## 5. State Machines

### 5.1 Document Lifecycle

```
UPLOADED
  ↓
PROCESSING (DocumentProcessing steps: OCR → CLASSIFICATION → EXTRACTION → EXPIRATION_DETECTION)
  ↓
[CLASSIFIED] (intermediate, not persisted as enum)
  ↓
REVIEW_REQUIRED (employee/supervisor sees extraction, makes corrections)
  ↓
[CORRECTED] (intermediate state; fields have correctedValue set)
  ↓
REVIEW_REQUIRED (submitted to compliance review)
  ↓
APPROVED (compliance officer approves, Qualification created) or REJECTED (denied)
```

### 5.2 ExtractionResult Correction State

```
{
  extractedValue: "value from AI" (immutable),
  confidence: 95,
  suggestedValue: "alternative if low confidence",
  correctedValue: null (employee's correction, set on first PUT)
  correctedBy: null,
  correctedAt: null
}

Flow:
1. Employee views extraction
2. Sees low-confidence field
3. Clicks "Correct" → inline editor
4. Enters value → PUT /documents/:id/extraction/:fieldId/correct
5. Response updates correctedValue, correctedBy, correctedAt
6. Component re-renders with new value + "Corrected by you" label
```

---

## 6. Integration Points

### 6.1 Qualification Linking

When document is approved by compliance officer:
```
POST /api/admin/review-queue/:itemId { decision: "APPROVE" }
  ↓
Backend creates Qualification record:
  {
    employeeId: extracted from ReviewQueueItem,
    standardId: inferred from documentType (if mapping exists),
    certificationName: ExtractionResult.field="certificateName".correctedValue || extractedValue,
    issuingBody: ExtractionResult.field="issuer".correctedValue || extractedValue,
    issueDate: ExtractionResult.field="issueDate".correctedValue || extractedValue,
    expirationDate: ExtractionResult.field="expirationDate".correctedValue || extractedValue,
    status: "ACTIVE" or "PENDING_REVIEW" (depends on compliance policy)
  }
```

Frontend: After approval, qualification appears in MyQualifications list (via background refresh or socket notification).

### 6.2 Notification Integration

- Document uploaded → Send "extraction in progress" notification
- Extraction completed → Send "review your extracted fields" notification
- Approval workflow → Send "approved" or "needs revision" notification
- Escalation (if unreviewed >48h) → Manager + Compliance Officer notified

Uses existing Notification model + NotificationPreference channels.

---

## 7. Error Handling

| Scenario | Status Code | Response |
|----------|-------------|----------|
| File too large | 413 | `{ error: { code: "FILE_TOO_LARGE", message: "Max 10 MB" } }` |
| Unsupported format | 400 | `{ error: { code: "INVALID_FORMAT", message: "Supported: PDF, PNG, JPG, TIFF" } }` |
| Extraction failed (retries exhausted) | 500 | `{ error: { code: "EXTRACTION_FAILED", message: "Could not process document" } }` |
| Correction rejected (invalid value) | 400 | `{ error: { code: "INVALID_CORRECTION", message: "Date must be valid ISO 8601" } }` |
| Review decision not found | 404 | `{ error: { code: "NOT_FOUND", message: "Review queue item not found" } }` |
| Insufficient RBAC | 403 | `{ error: { code: "FORBIDDEN", message: "Only COMPLIANCE_OFFICER+ can approve" } }` |

**Frontend handling:**
- Display user-friendly toast messages
- Log extraction failures to ErrorLog for compliance audit
- Offer manual data entry fallback for failed extractions

---

## 8. Testing Strategy

### Backend (Bunk)

- **Unit Tests:**
  - `documentsService.upload()` with mock file buffer
  - `documentsService.correctExtraction()` validates field existence, timestamps
  - `documentsService.reviewDocument()` state transitions
  
- **Integration Tests:**
  - Full extraction flow: upload → status poll → extraction data → correction → review
  - RBAC enforcement: EMPLOYEE can correct own, SUPERVISOR+ can correct team's
  - ReviewQueueItem creation on document review
  - Qualification linking on compliance approval

- **Contract Tests:**
  - Azure Document Intelligence API mock returns expected response schema
  - Extraction results map correctly to ExtractionResult rows

### Frontend (Kima)

- **Component Tests:**
  - DocumentUploadForm: drag-and-drop, file validation, disabled states
  - ExtractionProgress: step progression, error fallback
  - ExtractionFieldEditor: inline edit, confidence-aware rendering
  - ReviewQueuePage: filter/sort, modal open/close

- **Page Tests:**
  - MyDocumentsPage: upload flow end-to-end
  - ExtractionReviewPage: load extraction, correct field, approve
  - ComplianceOfficerReviewQueue: list items, open detail, submit decision

- **Integration Tests:**
  - Upload → Status poll → Redirect to extraction review
  - Correct field → API call → UI updates
  - Approve → Notification + redirect to dashboard

---

## 9. Acceptance Criteria

- [x] Employee can upload PDF/image documents with type selection
- [x] System extracts structured fields using Azure Document Intelligence
- [x] Extraction confidence displayed per field with visual indicators
- [x] Employee/supervisor can correct low-confidence or empty fields inline
- [x] Compliance officer reviews extracted documents in dedicated queue
- [x] Compliance officer can approve/reject with optional notes
- [x] Approved documents automatically create Qualification records
- [x] Full audit trail of corrections + approvals preserved
- [x] RBAC enforced: employees see own, supervisors see team's, compliance sees all
- [x] Error fallback: if extraction fails, manual field entry offered
- [x] Notifications sent at each workflow stage

---

## 10. Success Metrics

- Document extraction success rate ≥85% on first pass (automated)
- Average compliance review time <4 hours/document
- 0 lost audit trails (all corrections timestamped + attributed)
- User satisfaction: >85% of users find extraction helpful
- Compliance team reduction in manual data entry: >60%

---

## 11. Open Questions & Risks

1. **Azure Costs:** How many daily extractions anticipated? Cost optimization (batch vs. real-time)?
2. **OCR Accuracy:** Should we implement user feedback loop to improve AI model over time?
3. **Bulk Corrections:** Can supervisor correct multiple fields at once, or field-by-field only?
4. **Soft Delete:** When document is rejected, should it be soft-deleted or just marked REJECTED?
5. **Performance:** If extraction takes >30 seconds, should we show longer timeout message or background-queue with email notification?

---

## Appendix A: Example Extraction Response (Azure Document Intelligence)

```json
{
  "analyzeResult": {
    "documents": [
      {
        "fields": {
          "CertificateName": {
            "type": "string",
            "value": "AWS Solutions Architect",
            "confidence": 0.95
          },
          "IssueDate": {
            "type": "date",
            "value": "2024-03-15",
            "confidence": 0.98
          },
          "ExpirationDate": {
            "type": "date",
            "value": null,
            "confidence": 0.0
          },
          "IssuingBody": {
            "type": "string",
            "value": "Amazon Web Services, Inc.",
            "confidence": 0.91
          }
        }
      }
    ]
  }
}
```

**Mapping to ExtractionResult:**
- field = "CertificateName"
- extractedValue = "AWS Solutions Architect"
- confidence = 95 (converted from 0.95)
- suggestedValue = null (if no alternative)
- correctedValue = null (until user corrects)

