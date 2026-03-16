# Proof Taxonomy & Validation Framework — E-CLAT Platform

> **Status:** Authoritative Reference  
> **Owner:** Freamon (Lead / Architect)  
> **Created:** 2026-03-18  
> **Companion Docs:** [Templates & Attestation Spec](./templates-attestation-spec.md) · [Proof Vault Spec](./proof-vault-spec.md) · [RBAC API Spec](./rbac-api-spec.md) · [PRD](../prds/eclat-spec.md)  
> **Triggered By:** User directive — proof type taxonomy with validation methods, industry mappings, and template integration

---

## Table of Contents

1. [Overview](#1-overview)
2. [Two-Axis Proof Model](#2-two-axis-proof-model)
3. [Proof Type Taxonomy](#3-proof-type-taxonomy)
4. [Validation Methods per Type](#4-validation-methods-per-type)
5. [Industry Template Presets](#5-industry-template-presets)
6. [Data Model Extensions](#6-data-model-extensions)
7. [Manager Workflow](#7-manager-workflow)
8. [API Extensions](#8-api-extensions)
9. [Integration with Templates & Attestation](#9-integration-with-templates--attestation)
10. [Implementation Phases](#10-implementation-phases)

---

## 1. Overview

### The Problem

The [Templates & Attestation Spec](./templates-attestation-spec.md) defines **how** employees prove things (self-attest, upload, third-party, validated). But it doesn't define **what** they're proving. A "CPR Certification" and "500 Flight Hours" are fundamentally different proof types — they have different input schemas, expiration patterns, evidence formats, and validation logic.

### The Solution: Two-Axis Proof Model

Every proof requirement in E-CLAT is classified along two independent axes:

| Axis | Question | Examples |
|------|----------|---------|
| **Proof Type** (this document) | *What* are you proving? | Hours logged, certification earned, training completed, clearance obtained |
| **Attestation Level** ([templates spec](./templates-attestation-spec.md)) | *How* do you prove it? | Self-attest, upload, third-party verify, internal validation |

A manager creating a template selects **both**: "I need proof of 500 flight hours (type: `hours`) verified by upload of logbook plus instructor validation (attestation: `upload_validated`)."

### Why Types Matter

| Without Types | With Types |
|---------------|------------|
| Every proof is a generic text field + file upload | Structured input: hours have a quantity field, certs have an issuer + credential ID |
| No rollup: can't answer "how many total hours does this employee have?" | Quantitative aggregation: sum hours across proofs, track CE credits toward renewal |
| No smart expiration: manager manually sets days | Type-aware expiration: medical certs = 12 months, safety training = 24 months |
| No industry presets: managers build from scratch | Preset libraries: "Aviation Pilot Onboarding" → 6 typed proof requirements auto-populated |

---

## 2. Two-Axis Proof Model

### Visual

```
                        ATTESTATION LEVEL (How you prove it)
                   ┌──────────┬──────────┬───────────┬───────────┐
                   │  L1      │  L2      │  L3       │  L4       │
                   │  Self    │  Upload  │  3rd Party│  Validated│
  ─────────────────┼──────────┼──────────┼───────────┼───────────┤
  Hours            │ "I did   │ Upload   │ System    │ Supervisor│
  (flight, shift,  │  50 hrs" │ logbook  │ imports   │ approves  │
   CE, lab)        │          │ scan     │ from LMS  │ log entry │
  ─────────────────┼──────────┼──────────┼───────────┼───────────┤
  Certification    │ "I have  │ Upload   │ Issuer    │ CO verifies│
  (license, cert,  │  my CPR" │ cert PDF │ API check │ authenticity│
   credential)     │          │          │           │           │
  ─────────────────┼──────────┼──────────┼───────────┼───────────┤
  Training         │ "I took  │ Upload   │ LMS       │ Trainer   │
  (course, module, │  OSHA"   │ completion│ confirms  │ confirms  │
   workshop)       │          │ cert     │ enrollment│ attendance│
  ─────────────────┼──────────┼──────────┼───────────┼───────────┤
  Clearance        │ N/A      │ Upload   │ Agency    │ CO reviews│
  (background,     │ (usually │ clearance│ confirms  │ and signs │
   medical, secur.)│  not L1) │ letter   │ status    │ off       │
  ─────────────────┼──────────┼──────────┼───────────┼───────────┤
  Assessment       │ "I passed│ Upload   │ Testing   │ Examiner  │
  (exam, checkride,│  the test│ score    │ center    │ verifies  │
   skill test)     │  "       │ report   │ transmits │ result    │
  ─────────────────┼──────────┼──────────┼───────────┼───────────┤
  Compliance       │ "I read  │ Upload   │ Audit     │ Auditor   │
  (audit, inspect.,│  the     │ signed   │ system    │ approves  │
   acknowledgment) │  policy" │ form     │ reports   │ finding   │
  ─────────────────┴──────────┴──────────┴───────────┴───────────┘

 P
 R
 O
 O
 F

 T
 Y
 P
 E

 (What you're proving)
```

---

## 3. Proof Type Taxonomy

### 3.1 Type Hierarchy

```
ProofType
├── hours              # Quantitative time-based proof
│   ├── flight_hours
│   ├── shift_hours
│   ├── ce_credits
│   ├── lab_hours
│   ├── apprenticeship_hours
│   ├── supervisor_hours
│   └── project_hours
├── certification      # Credential issued by authority
│   ├── license
│   ├── professional_cert
│   ├── equipment_ticket
│   ├── endorsement
│   └── registration
├── training           # Educational completion
│   ├── course
│   ├── module
│   ├── workshop
│   ├── safety_training
│   └── orientation
├── clearance          # Authorization/status check
│   ├── background_check
│   ├── medical_clearance
│   ├── security_clearance
│   ├── drug_test
│   └── fingerprint_clearance
├── assessment         # Demonstrated competency
│   ├── exam
│   ├── checkride
│   ├── skills_test
│   ├── peer_evaluation
│   ├── observation
│   └── proficiency_check
└── compliance         # Regulatory acknowledgment
    ├── policy_acknowledgment
    ├── code_of_ethics
    ├── audit_finding
    ├── inspection_pass
    └── incident_report
```

### 3.2 Type Definitions

#### `hours` — Quantitative Time-Based Proof

Tracks measurable time spent on qualifying activities. Supports rolling windows, accumulation toward thresholds, and period-based tracking.

| Property | Description |
|----------|-------------|
| **Input Schema** | `quantity` (number), `unit` (hours/credits/days), `activityDescription`, `dateRange` (start, end), `category` (optional sub-type) |
| **Aggregation** | Sum across fulfillments per employee per category. Example: total flight hours, total CE credits this year |
| **Threshold** | Optional minimum to meet requirement (e.g., "4,000 apprenticeship hours", "6 CE credits/year") |
| **Rolling Window** | Optional period for recency (e.g., "3 landings in 90 days", "20 hours in 12 months") |
| **Expiration** | Per-period: resets at period boundary. Accumulative: never expires but may have recency requirements |
| **Evidence** | Logbook scan, timesheet, LMS export, signed supervisor log |

**Sub-types:**

| Sub-type | Unit | Typical Threshold | Industry Example |
|----------|------|-------------------|------------------|
| `flight_hours` | hours | 1,500 (ATP), 250 (Commercial) | Aviation |
| `shift_hours` | hours | varies | Healthcare, Nuclear |
| `ce_credits` | credits | 6/year (FINRA), 40/cycle (nursing) | Finance, Healthcare, Teaching |
| `lab_hours` | hours | varies | IT/Security |
| `apprenticeship_hours` | hours | 4,000+ | Trades |
| `supervisor_hours` | hours | varies | Finance |
| `project_hours` | hours | varies | Construction, Trades |

#### `certification` — Credential Issued by Authority

A formal credential, license, or registration issued by a recognized authority with a credential ID, issue date, and typically an expiration.

| Property | Description |
|----------|-------------|
| **Input Schema** | `credentialName`, `issuingAuthority`, `credentialId` (cert number), `issueDate`, `expirationDate`, `scope` (optional: what the cert covers) |
| **Verification** | Credential ID + issuing authority → potential third-party API lookup |
| **Renewal** | Most require periodic renewal (1-5 year cycles) |
| **Expiration** | Fixed date set by issuing authority |
| **Evidence** | Certificate PDF/image, verification letter, registry screenshot |

**Sub-types:**

| Sub-type | Description | Industry Example |
|----------|-------------|------------------|
| `license` | Government-issued authorization to practice | Nursing license, CDL, teaching cert |
| `professional_cert` | Industry body credential | CISSP, CPA, PMP |
| `equipment_ticket` | Authorization to operate specific equipment | Forklift, crane, respirator |
| `endorsement` | Addition to existing credential | Hazmat (CDL), type-rating (aviation) |
| `registration` | Enrollment with regulatory body | FINRA registration, state contractor |

#### `training` — Educational Completion

Proof of completing an educational course, module, or workshop. Usually tracked by an LMS or training provider.

| Property | Description |
|----------|-------------|
| **Input Schema** | `courseName`, `provider`, `completionDate`, `duration` (hours), `score` (if applicable), `certificateId` (if issued) |
| **Verification** | Provider confirmation, LMS integration, completion certificate |
| **Renewal** | Some require periodic re-training (OSHA annually, HIPAA annually) |
| **Expiration** | Based on training validity period (typically 12-24 months for safety) |
| **Evidence** | Completion certificate, transcript, LMS export, attendance log |

**Sub-types:**

| Sub-type | Description | Industry Example |
|----------|-------------|------------------|
| `course` | Formal multi-session course | OSHA 30-Hour, First Aid |
| `module` | Single learning unit | HIPAA annual refresher |
| `workshop` | In-person hands-on session | Lockout/Tagout training |
| `safety_training` | Safety-specific training | Fall protection, hazmat handling |
| `orientation` | Initial onboarding training | New hire safety orientation |

#### `clearance` — Authorization / Status Check

Proof that an employee has been authorized or cleared by an external or internal authority. Usually binary (cleared / not cleared) with periodic renewal.

| Property | Description |
|----------|-------------|
| **Input Schema** | `clearanceType`, `issuingAgency`, `issueDate`, `expirationDate`, `levelOrScope` (e.g., "Secret", "Public Trust"), `referenceNumber` |
| **Verification** | Agency API, background check provider, medical provider |
| **Renewal** | Periodic (medical: annual, background: 2-5 years, security: 5-10 years) |
| **Expiration** | Fixed date set by issuing authority |
| **Evidence** | Clearance letter, medical form, test results (stored encrypted in vault) |

**Sub-types:**

| Sub-type | Description | Industry Example |
|----------|-------------|------------------|
| `background_check` | Criminal/employment history check | All regulated industries |
| `medical_clearance` | Fit-for-duty medical evaluation | Aviation (FAA medical), CDL (DOT physical) |
| `security_clearance` | Government security authorization | Nuclear, defense contractors |
| `drug_test` | Substance test compliance | CDL, construction, nuclear |
| `fingerprint_clearance` | Fingerprint-based background check | Finance, teaching, healthcare |

#### `assessment` — Demonstrated Competency

Proof that an employee demonstrated knowledge or skill through a formal evaluation process.

| Property | Description |
|----------|-------------|
| **Input Schema** | `assessmentName`, `assessor` (person or org), `date`, `score` (if applicable), `passFail`, `attemptNumber`, `nextDueDate` |
| **Verification** | Assessor confirmation, testing center transmission, score report |
| **Renewal** | Periodic proficiency checks (aviation: 24 months, nuclear: 2 years) |
| **Expiration** | Based on requalification period |
| **Evidence** | Score report, practical test results, signed evaluation form |

**Sub-types:**

| Sub-type | Description | Industry Example |
|----------|-------------|------------------|
| `exam` | Written/online knowledge test | Series 7, NCLEX, subject matter exams |
| `checkride` | Practical skill demonstration with examiner | Aviation checkrides, CDL skills test |
| `skills_test` | Hands-on proficiency evaluation | Equipment operation, clinical skills |
| `peer_evaluation` | Collegial review of competency | Healthcare peer reviews |
| `observation` | Direct observation of work performance | Teaching classroom observation |
| `proficiency_check` | Periodic requalification | Nuclear operator requalification |

#### `compliance` — Regulatory Acknowledgment

Proof of regulatory compliance, policy adherence, or audit outcomes. Often the "glue" that ties other proofs together.

| Property | Description |
|----------|-------------|
| **Input Schema** | `complianceItem`, `regulatoryBody` (if applicable), `date`, `outcome` (pass/fail/finding), `notes`, `correctiveAction` (if finding) |
| **Verification** | Audit system, signed acknowledgment, inspection results |
| **Renewal** | Periodic (annual policy re-acknowledgment, inspection cycles) |
| **Expiration** | Based on compliance cycle |
| **Evidence** | Signed form, audit report, inspection certificate, corrective action plan |

**Sub-types:**

| Sub-type | Description | Industry Example |
|----------|-------------|------------------|
| `policy_acknowledgment` | Read and accepted a policy | HIPAA, code of conduct, safety manual |
| `code_of_ethics` | Signed ethics agreement | CISSP ethics, financial advisor fiduciary |
| `audit_finding` | Result of compliance audit | Internal audit, regulatory inspection |
| `inspection_pass` | Passed facility/process inspection | Food safety inspection, OSHA walkthrough |
| `incident_report` | Documented safety/compliance event | Near-miss reports, accident documentation |

---

## 4. Validation Methods per Type

### 4.1 Validation Method Matrix

Each proof type has natural validation methods that map to attestation levels:

| Proof Type | L1: Self-Attest | L2: Upload | L3: Third-Party | L4: Validated |
|------------|:---:|:---:|:---:|:---:|
| **hours** | Employee logs hours | Upload logbook/timesheet | LMS/system import | Supervisor reviews & approves |
| **certification** | Declare credential | Upload cert PDF | Issuer API verification | CO verifies authenticity |
| **training** | Claim completion | Upload completion cert | LMS confirms enrollment | Trainer confirms attendance |
| **clearance** | ❌ Not recommended | Upload clearance letter | Agency/provider confirms | CO reviews and signs off |
| **assessment** | Claim pass | Upload score report | Testing center transmits | Examiner verifies result |
| **compliance** | Sign acknowledgment | Upload signed form | Audit system reports | Auditor approves finding |

### 4.2 Recommended Attestation Levels by Type

These are the **default** attestation levels suggested when a manager selects a proof type. The manager can override.

| Proof Type | Default Attestation | Rationale |
|------------|:-------------------:|-----------|
| `hours` | `upload_validated` | Hours are often inflated; upload log + supervisor review |
| `certification` | `upload` (low-risk) or `upload_validated` (high-risk) | Most certs can be verified from the document itself |
| `training` | `upload` or `third_party` | Depends on whether LMS integration exists |
| `clearance` | `third_party_validated` | Must come from authoritative source + internal review |
| `assessment` | `upload_validated` | Score report + examiner confirmation |
| `compliance` | `self_attest_upload` | Acknowledge + sign |

### 4.3 Type-Specific Validation Rules

#### Hours Validation

```
IF proof.type == 'hours':
  REQUIRE quantity > 0
  REQUIRE unit IN ['hours', 'credits', 'days']
  IF requirement.threshold:
    total = SUM(employee.fulfillments WHERE type='hours' AND category=requirement.category)
    IF total >= requirement.threshold: status = FULFILLED
    ELSE: status = PARTIAL (show progress: "250/500 hours")
  IF requirement.rollingWindow:
    windowTotal = SUM(employee.fulfillments WHERE dateRange WITHIN window)
    IF windowTotal >= requirement.threshold: status = FULFILLED
```

#### Certification Validation

```
IF proof.type == 'certification':
  REQUIRE credentialId NOT NULL
  REQUIRE issuingAuthority NOT NULL
  IF expirationDate < TODAY: status = EXPIRED
  IF expirationDate < TODAY + 30: status = EXPIRING_SOON
  IF thirdParty.available:
    VERIFY credentialId against issuer registry
```

#### Training Validation

```
IF proof.type == 'training':
  REQUIRE completionDate NOT NULL
  IF validityPeriod:
    IF completionDate + validityPeriod < TODAY: status = EXPIRED
  IF lmsIntegration.available:
    VERIFY enrollment AND completion via LMS API
```

#### Clearance Validation

```
IF proof.type == 'clearance':
  REQUIRE attestationLevel >= L2  // Self-attest not sufficient
  REQUIRE issuingAgency NOT NULL
  IF expirationDate < TODAY: status = EXPIRED
  MUST be validated by Compliance Officer (L4 always recommended)
```

---

## 5. Industry Template Presets

### 5.1 Preset Library

Pre-built templates that managers can select and customize. Each preset maps to a specific industry and common role requirement.

#### Aviation

| Template Name | Requirements |
|--------------|-------------|
| **Pilot Annual Compliance** | Flight Hours (hours, 100/year, `upload_validated`), Medical Certificate (clearance, annual, `third_party_validated`), Recency — 3 Landings in 90 Days (hours, rolling 90d, `upload_validated`), Proficiency Check (assessment, 24mo, `upload_validated`) |
| **Type Rating Qualification** | Type-Rating Checkride (assessment, `upload_validated`), Simulator Hours (hours, 40hrs, `upload`), Ground School Completion (training, `third_party`) |

#### Healthcare

| Template Name | Requirements |
|--------------|-------------|
| **Nursing Annual Renewal** | CPR/BLS Certification (certification, 24mo, `upload`), License Verification (certification, annual, `third_party`), CE Credits (hours, 30/cycle, `upload`), TB Test (clearance, annual, `third_party_validated`), HIPAA Training (training, annual, `self_attest_upload`) |
| **Clinical Competency** | Competency Assessment (assessment, annual, `upload_validated`), Shift Hours — Active Practice (hours, 500/year, `upload`), Peer Evaluation (assessment, annual, `validated`) |

#### Construction / OSHA

| Template Name | Requirements |
|--------------|-------------|
| **Site Worker Onboarding** | OSHA 10/30 Certification (certification, `upload`), Fall Protection Training (training, annual, `self_attest_upload`), Drug Test Clearance (clearance, `third_party_validated`), Safety Orientation (training, `upload`) |
| **Equipment Operator** | Equipment Operation Ticket (certification, `upload_validated`), Jobsite Hours (hours, 1000/year, `upload`), Safety Training Attendance (training, annual, `upload`) |

#### Finance / Securities

| Template Name | Requirements |
|--------------|-------------|
| **Registered Representative** | Series 7 Exam (assessment, `third_party`), Series 63 Exam (assessment, `third_party`), Fingerprint Clearance (clearance, `third_party`), Annual CE Credits (hours, 6/year, `third_party`), AML/KYC Training (training, annual, `self_attest_upload`) |
| **Supervisor Compliance** | Supervisor Hours (hours, logged, `upload_validated`), Compliance Certifications (certification, annual, `upload`), Code of Ethics (compliance, annual, `self_attest`) |

#### Licensed Trades (Electrical/Plumbing)

| Template Name | Requirements |
|--------------|-------------|
| **Apprentice Progress** | Apprenticeship Hours (hours, 4000 total, `upload_validated`), Project Hours — Residential (hours, `upload`), Project Hours — Commercial (hours, `upload`), Journeyman Exam Readiness Assessment (assessment, `validated`) |
| **Journeyman Renewal** | Journeyman License (certification, cycle, `third_party`), CE Credits for Renewal (hours, per-cycle, `upload`), Code Compliance Training (training, `self_attest_upload`) |

#### Transportation / CDL

| Template Name | Requirements |
|--------------|-------------|
| **CDL Driver Compliance** | DOT Physical (clearance, 24mo, `third_party_validated`), CDL Skills Test (assessment, `third_party`), Hours-of-Service Logbook (compliance, continuous, `upload_validated`), Drug/Alcohol Test (clearance, random, `third_party`) |
| **Hazmat Endorsement** | Hazmat Exam (assessment, `third_party`), Background Check (clearance, `third_party_validated`), Hazmat Training (training, `upload`) |

#### Nuclear / Power Generation

| Template Name | Requirements |
|--------------|-------------|
| **Reactor Operator** | Operator Certification Exam (assessment, `third_party`), Simulator Training Hours (hours, 80/year, `upload_validated`), Security Clearance (clearance, `third_party_validated`), Radiation Safety Cert (certification, annual, `upload`), Requalification (assessment, 2yr, `upload_validated`) |

#### Food Safety

| Template Name | Requirements |
|--------------|-------------|
| **Food Handler** | Food Handler Certification (certification, `upload`), HACCP Training (training, `upload`), Health Inspection (compliance, annual, `third_party`) |

#### IT / Security

| Template Name | Requirements |
|--------------|-------------|
| **Security Professional** | Security+/CISSP (certification, 3yr, `third_party`), CPE Credits (hours, 40/year, `upload`), Work Experience Hours (hours, 2000 total, `upload_validated`), Code of Ethics (compliance, annual, `self_attest`) |

#### Teaching

| Template Name | Requirements |
|--------------|-------------|
| **Teacher Certification** | State Teaching Certificate (certification, cycle, `third_party`), PD Hours (hours, per-cycle, `upload`), Background Check (clearance, `third_party_validated`), Classroom Observation (assessment, annual, `validated`), Subject Matter Exam (assessment, `third_party`) |

### 5.2 The 5 Universal Proof Categories

Every industry follows the same meta-pattern. Templates should map to these categories:

| Category | Maps To Proof Types | Description |
|----------|:-------------------:|-------------|
| **Initial Qualification** | `certification`, `assessment`, `training` | Proves you learned it — exam passage, cert earned, training completed |
| **Recency Proof** | `hours`, `assessment` | Proves you're actively using it — hours logged, skills demonstrated recently |
| **Clearance Status** | `clearance` | Proves you're authorized — background, medical, security cleared |
| **Continuing Competency** | `hours` (CE), `training`, `assessment` | Proves you can maintain it — ongoing education, periodic skills tests |
| **Audit Trail** | `compliance` | Proves it's all verified — documented evidence, signed acknowledgments, inspection records |

---

## 6. Data Model Extensions

### 6.1 New Enums

```prisma
enum ProofType {
  hours
  certification
  training
  clearance
  assessment
  compliance
}

enum ProofSubType {
  // hours
  flight_hours
  shift_hours
  ce_credits
  lab_hours
  apprenticeship_hours
  supervisor_hours
  project_hours
  
  // certification
  license
  professional_cert
  equipment_ticket
  endorsement
  registration
  
  // training
  course
  module
  workshop
  safety_training
  orientation
  
  // clearance
  background_check
  medical_clearance
  security_clearance
  drug_test
  fingerprint_clearance
  
  // assessment
  exam
  checkride
  skills_test
  peer_evaluation
  observation
  proficiency_check
  
  // compliance
  policy_acknowledgment
  code_of_ethics
  audit_finding
  inspection_pass
  incident_report
}

enum HoursUnit {
  hours
  credits
  days
}
```

### 6.2 ProofRequirement Extension

Add to the existing `ProofRequirement` model from [templates-attestation-spec.md](./templates-attestation-spec.md):

```prisma
model ProofRequirement {
  // ... existing fields from templates-attestation-spec.md ...
  
  // NEW: Proof type classification
  proofType         ProofType          // Required: which type of proof
  proofSubType      ProofSubType?      // Optional: specific sub-type
  
  // NEW: Type-specific configuration (JSON for flexibility)
  typeConfig        Json?              // Type-specific schema (see §6.3)
  
  // NEW: Threshold for accumulative types (hours, CE credits)
  threshold         Float?             // e.g., 500.0 (hours), 6.0 (credits)
  thresholdUnit     HoursUnit?         // Unit for threshold
  rollingWindowDays Int?               // e.g., 90 (for "3 landings in 90 days")
  
  // NEW: Industry preset metadata
  presetId          String?            // Links back to the preset library entry
  universalCategory String?            // One of: initial_qualification, recency_proof, clearance_status, continuing_competency, audit_trail
}
```

### 6.3 Type-Specific Configuration Schemas (JSON)

The `typeConfig` JSON field stores type-specific metadata. Schemas per type:

#### Hours Config
```json
{
  "unit": "hours | credits | days",
  "accumulationMode": "total | per_period | rolling_window",
  "periodMonths": 12,
  "categories": ["residential", "commercial", "industrial"],
  "requireSupervisorApproval": true
}
```

#### Certification Config
```json
{
  "issuingAuthorities": ["FAA", "State Board of Nursing"],
  "credentialIdPattern": "^[A-Z]{2}\\d{6}$",
  "renewalCycleMonths": 24,
  "verificationUrl": "https://registry.example.com/verify"
}
```

#### Training Config
```json
{
  "providers": ["OSHA", "Red Cross", "Company LMS"],
  "minimumDurationHours": 8,
  "requireScore": false,
  "passingScore": 70,
  "lmsIntegrationId": "lms-provider-123"
}
```

#### Clearance Config
```json
{
  "levels": ["Public Trust", "Secret", "Top Secret"],
  "checkProvider": "Checkr | CastleBranch | Sterling",
  "renewalMonths": 24,
  "requireComplianceReview": true
}
```

#### Assessment Config
```json
{
  "assessmentFormat": "written | practical | oral | combined",
  "passingCriteria": "score >= 70 | pass/fail",
  "maxAttempts": 3,
  "retakeWaitDays": 30,
  "requalificationMonths": 24
}
```

#### Compliance Config
```json
{
  "regulatoryBody": "OSHA | FDA | SEC",
  "complianceCycle": "annual | biennial | continuous",
  "requireSignature": true,
  "correctiveActionRequired": false
}
```

### 6.4 ProofFulfillment Extension

Add to the existing `ProofFulfillment` model:

```prisma
model ProofFulfillment {
  // ... existing fields from templates-attestation-spec.md ...
  
  // NEW: Type-specific fulfillment data
  proofType         ProofType?         // Denormalized from requirement for query efficiency
  
  // Hours-specific
  hoursQuantity     Float?             // Actual hours/credits logged
  hoursUnit         HoursUnit?
  hoursDateStart    DateTime?          // Period start
  hoursDateEnd      DateTime?          // Period end
  hoursCategory     String?            // Sub-category (e.g., "residential")
  
  // Certification-specific
  credentialId      String?            // Certificate/license number
  issuingAuthority  String?
  issueDate         DateTime?
  credentialExpiry  DateTime?          // Distinct from fulfillment expiry
  
  // Training-specific
  courseName        String?
  trainingProvider  String?
  completionDate    DateTime?
  durationHours     Float?
  score             Float?
  
  // Assessment-specific
  assessmentName    String?
  assessor          String?            // Person or org who assessed
  assessmentDate    DateTime?
  assessmentScore   Float?
  passFail          Boolean?
  attemptNumber     Int?
  
  // Clearance-specific
  clearanceLevel    String?
  clearanceAgency   String?
  clearanceRef      String?
  
  // Compliance-specific
  complianceItem    String?
  complianceOutcome String?            // pass, fail, finding, acknowledged
  correctiveAction  String?
}
```

### 6.5 Industry Preset Model

```prisma
model IndustryPreset {
  id              String   @id @default(uuid())
  industry        String   // e.g., "aviation", "healthcare"
  templateName    String   // e.g., "Pilot Annual Compliance"
  description     String   @default("")
  requirements    Json     // Array of requirement definitions (see §6.6)
  isActive        Boolean  @default(true)
  sortOrder       Int      @default(0)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([industry])
  @@map("industry_presets")
}
```

### 6.6 Preset Requirement Schema (JSON)

```json
{
  "requirements": [
    {
      "name": "Flight Hours",
      "description": "Annual flight hour requirement",
      "proofType": "hours",
      "proofSubType": "flight_hours",
      "attestationLevels": ["upload", "validated"],
      "threshold": 100,
      "thresholdUnit": "hours",
      "rollingWindowDays": null,
      "validityDays": 365,
      "renewalWarningDays": 30,
      "isRequired": true,
      "universalCategory": "recency_proof",
      "typeConfig": {
        "unit": "hours",
        "accumulationMode": "per_period",
        "periodMonths": 12,
        "requireSupervisorApproval": true
      }
    }
  ]
}
```

---

## 7. Manager Workflow

### 7.1 Creating a Template — Three Paths

```
Manager clicks "Create Template"
         │
         ├─── 🏭 "Start from Industry Preset"
         │        │
         │        ├── Select industry (Aviation, Healthcare, ...)
         │        ├── Select preset (Pilot Annual, Nursing Renewal, ...)
         │        ├── Template auto-populated with typed requirements
         │        ├── Manager can add/remove/modify requirements
         │        └── Save as draft → publish when ready
         │
         ├─── 📋 "Start from Blank Template"
         │        │
         │        ├── Name the template
         │        ├── Add requirements one by one:
         │        │     ├── Select proof type (hours, cert, training, ...)
         │        │     ├── Select sub-type (flight_hours, license, course, ...)
         │        │     ├── Configure type-specific fields
         │        │     ├── Set attestation level(s)
         │        │     └── Set expiration / threshold rules
         │        └── Save as draft → publish when ready
         │
         └─── 🔄 "Clone Existing Template"
                  │
                  ├── Select from published templates in the org
                  ├── Creates a new draft copy
                  ├── Modify as needed
                  └── Save as draft → publish when ready
```

### 7.2 Adding a Requirement — Type-Driven UI

When a manager adds a proof requirement, the UI adapts based on the selected proof type:

| Step | UI Element |
|------|-----------|
| 1. **Select Proof Type** | Dropdown: Hours, Certification, Training, Clearance, Assessment, Compliance |
| 2. **Select Sub-Type** (optional) | Filtered dropdown: only sub-types for the selected type |
| 3. **Type-Specific Fields** | Dynamic form: hours → quantity + unit + threshold; cert → issuer + credential pattern; etc. |
| 4. **Attestation Level** | Pre-selected based on type defaults (§4.2), manager can override |
| 5. **Expiration Rules** | Type-aware defaults (medical → 12mo, safety training → 24mo), manager can override |
| 6. **Universal Category** | Auto-suggested: cert → "Initial Qualification", hours → "Recency Proof", etc. |

### 7.3 Assigning Templates

Unchanged from [templates-attestation-spec.md](./templates-attestation-spec.md) §5. The proof type taxonomy is transparent to the assignment process — managers assign templates the same way regardless of what proof types are inside.

---

## 8. API Extensions

### 8.1 Industry Presets Endpoints

| # | Method | Path | Description | Min Role |
|---|--------|------|-------------|----------|
| P-01 | `GET` | `/api/presets` | List all industry presets | SUPERVISOR |
| P-02 | `GET` | `/api/presets/:industry` | List presets for an industry | SUPERVISOR |
| P-03 | `GET` | `/api/presets/:id` | Get preset details | SUPERVISOR |
| P-04 | `POST` | `/api/presets` | Create custom preset | ADMIN |
| P-05 | `PUT` | `/api/presets/:id` | Update preset | ADMIN |
| P-06 | `POST` | `/api/templates/from-preset/:presetId` | Create template from preset | MANAGER |

### 8.2 Proof Type Metadata Endpoints

| # | Method | Path | Description | Min Role |
|---|--------|------|-------------|----------|
| PT-01 | `GET` | `/api/proof-types` | List all proof types with sub-types | EMPLOYEE |
| PT-02 | `GET` | `/api/proof-types/:type/config-schema` | Get type-specific JSON schema | SUPERVISOR |
| PT-03 | `GET` | `/api/proof-types/:type/default-attestation` | Get recommended attestation level | SUPERVISOR |

### 8.3 Hours Aggregation Endpoints

| # | Method | Path | Description | Min Role |
|---|--------|------|-------------|----------|
| H-01 | `GET` | `/api/employees/:id/hours-summary` | Aggregated hours by category | EMPLOYEE (own) / SUPERVISOR+ |
| H-02 | `GET` | `/api/employees/:id/hours-progress/:requirementId` | Progress toward hours threshold | EMPLOYEE (own) / SUPERVISOR+ |

### 8.4 Template Creation from Preset

**P-06: Create Template from Preset**

```http
POST /api/templates/from-preset/:presetId
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Our Aviation Team Compliance",    // Override preset name
  "description": "Customized for our operation",
  "overrides": {                              // Optional: modify preset defaults
    "requirementOverrides": [
      {
        "presetIndex": 0,                    // Which requirement to modify
        "threshold": 200,                     // Override: 200 hours instead of 100
        "attestationLevels": ["upload"]       // Override: upload only, no validation
      }
    ],
    "addRequirements": [                     // Add extra requirements
      {
        "name": "Company Safety Video",
        "proofType": "training",
        "proofSubType": "module",
        "attestationLevels": ["self_attest"],
        "validityDays": 365
      }
    ],
    "removeRequirements": [2]               // Remove preset requirement at index 2
  }
}
```

---

## 9. Integration with Templates & Attestation

### 9.1 How This Spec Extends the Templates Spec

| Templates Spec (existing) | This Spec (extension) |
|--------------------------|----------------------|
| `ProofRequirement.attestationLevels` — **how** to prove | `ProofRequirement.proofType` + `proofSubType` — **what** to prove |
| Generic fulfillment fields | Type-specific fulfillment fields (hours, cert ID, score, etc.) |
| Manual template creation only | Industry presets + clone workflows |
| Binary fulfillment (done / not done) | Quantitative progress (250/500 hours) |
| Fixed expiration (validityDays) | Type-aware expiration (rolling windows, per-period resets) |
| No aggregation | Hours/credits rollup across fulfillments |

### 9.2 Backward Compatibility

The proof type system is **additive** — it doesn't break any existing template/attestation functionality:

- `proofType` is a **required** field on new `ProofRequirement` records
- Existing requirements without a proof type default to `compliance` (the most generic type)
- All attestation level logic remains unchanged
- All fulfillment state machine logic remains unchanged
- The manager can ignore types entirely and still use the system as before

### 9.3 Template-to-Readiness Pipeline

```
                         TEMPLATE (what's required)
                              │
                              ▼
┌─────────────────────────────────────────────────────┐
│  ProofRequirement                                     │
│  ├── proofType: hours                                │
│  ├── proofSubType: flight_hours                      │
│  ├── attestationLevels: [upload, validated]           │
│  ├── threshold: 500                                   │
│  └── thresholdUnit: hours                             │
└─────────────────────────┬───────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│  ProofFulfillment (employee's response)               │
│  ├── hoursQuantity: 350                              │
│  ├── hoursUnit: hours                                │
│  ├── uploadedAt: 2026-03-15                          │
│  ├── validatedAt: 2026-03-16                         │
│  └── status: PARTIAL (350/500 = 70%)                 │
└─────────────────────────┬───────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│  Readiness Score Impact                               │
│  ├── This requirement: 70% complete                  │
│  ├── Template overall: N of M requirements met       │
│  └── Employee readiness: factored into overall score │
└─────────────────────────────────────────────────────┘
```

---

## 10. Implementation Phases

### Phase 2b (Current — with Templates MVP)

- Add `proofType` and `proofSubType` enums to schema
- Add `proofType`, `proofSubType`, `threshold`, `thresholdUnit` to `ProofRequirement`
- Add type-specific fulfillment fields to `ProofFulfillment`
- Proof type metadata endpoint (`GET /api/proof-types`)
- Type-driven form UI for requirement creation
- Default attestation level suggestions per type
- Seed 3 industry presets (pick the client's industry + 2 others)

### Phase 3 (Industry Presets & Hours Aggregation)

- Full `IndustryPreset` model and CRUD endpoints
- All 10 industry preset libraries from §5.1
- "Create from preset" workflow
- Hours aggregation endpoints and progress tracking
- Rolling window calculations
- Type-specific validation rules (§4.3)

### Phase 3+ (Advanced Validation)

- Third-party verification integrations (LMS, credential registries)
- Type-specific expiration engines (rolling window cron jobs)
- Cross-template hours aggregation (hours count toward multiple templates)
- AI-assisted template creation from regulatory text
- Industry community templates (shared across organizations)

---

## Appendix A: Proof Type Quick Reference

```
hours           ⏱️  Quantitative time   "I logged 50 flight hours"
certification   📜  Formal credential   "Here's my CISSP cert #12345"
training        📚  Course completion   "I completed OSHA 30-Hour"
clearance       🔐  Authorization       "My background check cleared"
assessment      📊  Demonstrated skill  "I passed the checkride"
compliance      ✅  Regulatory ack      "I read and signed the policy"
```

## Appendix B: Universal Category Mapping

```
Initial Qualification    → certification, assessment, training
Recency Proof            → hours, assessment
Clearance Status         → clearance
Continuing Competency    → hours (CE), training, assessment
Audit Trail              → compliance
```

## Appendix C: Industry Preset Coverage

| Industry | Presets | Total Requirements |
|----------|:-------:|:-----------------:|
| Aviation | 2 | 7 |
| Healthcare | 2 | 10 |
| Construction/OSHA | 2 | 8 |
| Finance/Securities | 2 | 10 |
| Licensed Trades | 2 | 7 |
| Transportation/CDL | 2 | 7 |
| Nuclear | 1 | 5 |
| Food Safety | 1 | 3 |
| IT/Security | 1 | 4 |
| Teaching | 1 | 5 |
| **Total** | **16** | **66** |
