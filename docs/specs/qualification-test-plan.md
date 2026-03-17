# Qualification Engine Test Plan Specification
**Issue:** #104  
**Version:** 1.0  
**Author:** Sydnor (Tester)  
**Date:** 2026-03-17  
**Scope:** Comprehensive test strategy for E-CLAT qualification attestation, overrides, exemptions, standards customization, and RBAC enforcement.

---

## Overview

This document defines a comprehensive test plan (not test code) for the E-CLAT qualification engine. The plan covers:

1. **Attestation Level Matrix (L1-L4)** — four-level proof validation hierarchy
2. **Override Matrix** — four types of compliance overrides with RBAC + regulatory/custom dichotomy
3. **Exemption Scenarios** — five exemption states with auto-expiry logic
4. **Standards Customization** — regulatory immutability + custom flexibility
5. **RBAC Edge Cases** — role-boundary enforcement across all qualification workflows
6. **Data Relationship Tests** — employee-group-template-requirement-fulfillment chain

All test cases include: ID, description, preconditions, steps, expected results, and priority.

---

## 1. Attestation Level Test Matrix

### Design Principles
- **L1 (self_attest):** Employee submits evidence → auto-accepted (no approval required)
- **L2 (supervisor):** Employee submits → supervisor review → approve/reject
- **L3 (third_party):** Employee submits → external invite sent → invitee attests → CO verifies
- **L4 (validated):** Employee submits → CO reviews all evidence → seals qualification
- **Level satisfaction:** L3 satisfies L2, L4 satisfies all lower levels
- **Negative paths:** L1 submitted where L2+ required → auto-reject

---

### 1.1 L1 Self-Attestation Flow

#### TC-ATT-1.1.1: L1 Self-Attest Submission Auto-Accepted
- **Priority:** P0
- **Description:** Employee submits proof at L1 (self-attestation); system auto-accepts without approval
- **Preconditions:**
  - Employee has active assignment with L1-level requirement
  - Requirement accepts `self_attest` attestation level
  - Employee has valid auth token
- **Steps:**
  1. POST `/api/fulfillments` with `attestationLevel: "self_attest"` + proof metadata
  2. System validates payload
  3. System creates ProofFulfillment record with status `fulfilled`
  4. System does NOT create approval task for reviewer
- **Expected Results:**
  - Response: 201 Created
  - Fulfillment status: `fulfilled` (not `pending_review`)
  - No approval notification sent
  - Audit log: "Employee [ID] submitted L1 self-attestation for requirement [ID]"
  - overallStatus recalculated: requirement now satisfied

#### TC-ATT-1.1.2: L1 Fulfillment Satisfies L1 Requirement Only
- **Priority:** P1
- **Description:** L1 submission satisfies L1 requirement but NOT L2+ requirements
- **Preconditions:**
  - Employee has two requirements: one L1, one L2 (supervisor approval required)
  - Same assignment/qualification context
- **Steps:**
  1. Submit L1 fulfillment for first requirement
  2. Query assignment fulfillment status
- **Expected Results:**
  - L1 requirement: satisfied ✓
  - L2 requirement: unfulfilled (remains pending)
  - Overall assignment status: partially_fulfilled

#### TC-ATT-1.1.3: L1 Submission Where L2 Required → Rejected
- **Priority:** P0
- **Description:** Employee attempts L1 submission for requirement that mandates L2+
- **Preconditions:**
  - Requirement has minAttestationLevel: L2 (supervisor)
  - Requirement does NOT accept `self_attest` in attestationLevels array
- **Steps:**
  1. POST `/api/fulfillments` with `attestationLevel: "self_attest"`
  2. System validates against requirement's allowedAttestationLevels
- **Expected Results:**
  - Response: 400 Bad Request
  - Error code: `VALIDATION_ERROR`
  - Error detail: "Attestation level self_attest not allowed for this requirement (requires supervisor approval)"
  - No fulfillment record created

#### TC-ATT-1.1.4: L1 Submission Missing Required Proof → Rejected
- **Priority:** P1
- **Description:** L1 submission succeeds only with required proof document/metadata
- **Preconditions:**
  - Requirement specifies required fields (e.g., certificationNumber, issueDate)
  - Payload missing required field
- **Steps:**
  1. POST `/api/fulfillments` with incomplete proof metadata
- **Expected Results:**
  - Response: 400 Bad Request
  - Error lists missing fields
  - No fulfillment created

---

### 1.2 L2 Supervisor Approval Flow

#### TC-ATT-2.1.1: Employee Submits L2 → Supervisor Approves
- **Priority:** P0
- **Description:** Employee submits L2 evidence; supervisor reviews and approves
- **Preconditions:**
  - Employee has assignment with L2 requirement (minAttestationLevel: supervisor)
  - Supervisor is employee's reporting manager (via ComplianceStandard group)
  - No prior fulfillment for requirement
- **Steps:**
  1. Employee POSTs `/api/fulfillments` with `attestationLevel: "supervisor"` + proof
  2. System creates ProofFulfillment with status `pending_review`
  3. System sends notification to supervisor (if notifications enabled)
  4. Supervisor GETs `/api/fulfillments/:id` to review
  5. Supervisor PUTs `/api/fulfillments/:id` with `status: "fulfilled"` + optional comment
  6. System updates status to `fulfilled`
  7. Assignment recomputed
- **Expected Results:**
  - Step 2: ProofFulfillment created with status `pending_review`
  - Step 3: Notification (if enabled) includes proof details
  - Step 5: 200 OK response with updated fulfillment
  - Step 6: Audit log: "Supervisor [ID] approved L2 fulfillment for employee [ID]"
  - Requirement marked satisfied

#### TC-ATT-2.1.2: Supervisor Rejects L2 Evidence
- **Priority:** P0
- **Description:** Supervisor reviews and rejects L2 evidence with reason
- **Preconditions:**
  - ProofFulfillment exists with status `pending_review`
  - Supervisor has permission to review (employee's direct manager or higher)
- **Steps:**
  1. Supervisor PUTs `/api/fulfillments/:id` with:
     ```json
     { "status": "rejected", "rejectionReason": "Certificate has expired" }
     ```
  2. System validates rejection reason is present (required)
  3. System updates status to `rejected`
- **Expected Results:**
  - Response: 200 OK
  - Fulfillment status: `rejected`
  - rejectionReason stored
  - Requirement returns to `unfulfilled`
  - Audit log includes rejection reason
  - Employee notified of rejection (if notifications enabled)

#### TC-ATT-2.1.3: Non-Manager Cannot Approve L2 Evidence
- **Priority:** P0
- **Description:** Peer employee cannot approve another employee's L2 evidence
- **Preconditions:**
  - ProofFulfillment owned by employee A, pending_review
  - Requester is employee B (peer, not supervisor)
- **Steps:**
  1. Employee B PUTs `/api/fulfillments/:id` with approval status
- **Expected Results:**
  - Response: 403 Forbidden
  - Error code: `FORBIDDEN`
  - Error message: "Not the assigned reviewer for this fulfillment"
  - No status change

#### TC-ATT-2.1.4: Supervisor Approves Evidence from Wrong Org Section → 403
- **Priority:** P1
- **Description:** Supervisor from department A cannot approve evidence from department B (if scoped by department)
- **Preconditions:**
  - Supervisor only has authority over their direct reports
  - Employee in different reporting chain
  - (Assuming department-scoped RBAC is implemented)
- **Steps:**
  1. Supervisor from Dept A tries to approve fulfillment for employee in Dept B
- **Expected Results:**
  - Response: 403 Forbidden
  - Fulfillment unchanged

---

### 1.3 L3 Third-Party Attestation Flow

#### TC-ATT-3.1.1: Employee Submits L3, External Invite Sent
- **Priority:** P0
- **Description:** Employee submits L3 fulfillment with external invitee; system sends attestation invite
- **Preconditions:**
  - Requirement has minAttestationLevel: third_party
  - Employee provides third-party details (email, organization)
  - L3 external invite feature is enabled
- **Steps:**
  1. Employee POSTs `/api/fulfillments` with:
     ```json
     {
       "attestationLevel": "third_party",
       "proofMetadata": {...},
       "thirdPartyEmail": "certifier@acme.com",
       "thirdPartyOrg": "ACME Cert Board"
     }
     ```
  2. System validates third-party email format
  3. System creates ProofFulfillment with status `pending_review` (waiting for external attestation)
  4. System generates invite token
  5. System sends email invite to third-party email with link to `/api/fulfillments/:token/verify`
- **Expected Results:**
  - Response: 201 Created
  - Fulfillment status: `pending_review` (not `fulfilled` yet)
  - Audit log: "Employee [ID] submitted L3 fulfillment, invite sent to [email]"
  - Email contains link with embedded token (secure, time-limited)

#### TC-ATT-3.1.2: Third-Party Verifies Evidence
- **Priority:** P0
- **Description:** External invitee uses token link to verify employee's qualification
- **Preconditions:**
  - ProofFulfillment exists with pending L3 attestation
  - Invite token is valid and not expired (e.g., 30-day expiry)
  - Third-party clicks link from email
- **Steps:**
  1. Third-party GETs `/api/fulfillments/:token/verify` → displays proof + attestation form
  2. Third-party confirms proof matches their records
  3. Third-party POSTs `/api/fulfillments/:token/verify` with `status: "verified"` + attestation comment
  4. System validates token signature
  5. System updates fulfillment with:
     - status: `pending_validation` (waiting for CO to seal)
     - thirdPartyVerifiedAt: now
     - thirdPartyVerificationComment: (stored)
  6. System notifies Compliance Officer to review & seal
- **Expected Results:**
  - Response: 200 OK
  - Fulfillment status: `pending_validation`
  - thirdPartyVerifiedAt: timestamp of verification
  - Audit log: "Third-party [email] verified L3 fulfillment for employee [ID]"

#### TC-ATT-3.1.3: Third-Party Verification Link Expired
- **Priority:** P1
- **Description:** Third-party attempts to verify after token expires
- **Preconditions:**
  - Fulfillment created 31+ days ago (assuming 30-day token TTL)
  - Token has expired
- **Steps:**
  1. Third-party GETs `/api/fulfillments/:token/verify`
- **Expected Results:**
  - Response: 401 Unauthorized or 410 Gone
  - Error: "Attestation link has expired"
  - Employee can resubmit with new L3 request
  - Original fulfillment marked `rejected` (optional, depends on retry UX)

#### TC-ATT-3.1.4: L3 Satisfies L2 Requirement
- **Priority:** P0
- **Description:** L3 (third-party) attestation satisfies a requirement that requires only L2 (supervisor)
- **Preconditions:**
  - Employee has requirement with minAttestationLevel: supervisor (L2)
  - Employee submits L3 evidence
  - Third-party verifies
  - CO validates
- **Steps:**
  1. Employee submits L3 fulfillment (higher than requirement)
  2. Third-party verifies
  3. CO seals
- **Expected Results:**
  - Requirement satisfied ✓ (L3 > L2)
  - overallStatus updated accordingly

---

### 1.4 L4 Validated (CO Seal) Flow

#### TC-ATT-4.1.1: CO Reviews All Evidence and Seals L4
- **Priority:** P0
- **Description:** Compliance Officer reviews fulfillment evidence and applies official seal (L4 validation)
- **Preconditions:**
  - Fulfillment exists with status `pending_validation` (from L3) or `pending_review` (from L2/L1 with override)
  - CO has permission to validate (requireRole: COMPLIANCE_OFFICER or higher)
  - All prerequisite attestations complete (e.g., L3 third-party verified)
- **Steps:**
  1. CO GETs `/api/fulfillments/:id` to review complete proof package
  2. CO examines:
     - Employee-submitted proof
     - Supervisor approval (if applicable)
     - Third-party verification (if applicable)
     - Audit history
  3. CO PUTs `/api/fulfillments/:id` with:
     ```json
     { "status": "fulfilled", "validatedAt": "...", "validatedBy": "CO_ID" }
     ```
  4. System marks fulfillment as `fulfilled` (L4 validated)
  5. Requirement marked satisfied
  6. Assignment recomputed
- **Expected Results:**
  - Response: 200 OK
  - Fulfillment status: `fulfilled` (CO-sealed)
  - validatedAt: timestamp
  - validatedBy: CO user ID
  - Audit log: "Compliance Officer [ID] validated L4 fulfillment for employee [ID]"
  - Dashboard shows "Validated by [CO name]"

#### TC-ATT-4.1.2: CO Rejects Evidence at L4
- **Priority:** P0
- **Description:** CO reviews evidence and determines it insufficient
- **Preconditions:**
  - Fulfillment in `pending_validation` status
  - CO identifies issues with proof package
- **Steps:**
  1. CO PUTs `/api/fulfillments/:id` with:
     ```json
     { "status": "rejected", "rejectionReason": "Certificate not from recognized issuer" }
     ```
- **Expected Results:**
  - Fulfillment status: `rejected`
  - rejectionReason stored
  - Employee notified
  - Requirement reverts to `unfulfilled`

#### TC-ATT-4.1.3: Non-CO Cannot Seal L4
- **Priority:** P0
- **Description:** Supervisor cannot mark fulfillment as L4 validated
- **Preconditions:**
  - Requester is SUPERVISOR role
  - Fulfillment pending validation
- **Steps:**
  1. Supervisor PUTs `/api/fulfillments/:id` with `validatedBy: supervisor_id`
- **Expected Results:**
  - Response: 403 Forbidden
  - Fulfillment unchanged

---

### 1.5 Cross-Level Satisfaction

#### TC-ATT-5.1.1: L4 Satisfies All Lower Levels
- **Priority:** P1
- **Description:** L4 fulfillment satisfies requirements at L1, L2, and L3 levels
- **Preconditions:**
  - Employee with multiple requirements at varying levels (L1, L2, L3, L4)
  - Single fulfillment submitted at L4 (highest level)
- **Steps:**
  1. Employee submits L4 fulfillment
  2. System processes through all approval chains
  3. System marks all lower-level requirements satisfied
- **Expected Results:**
  - All L1, L2, L3 requirements: satisfied ✓
  - L4 requirement: satisfied ✓
  - overallStatus: compliant

#### TC-ATT-5.1.2: L3 Satisfies L1, L2 but Not L4
- **Priority:** P1
- **Description:** L3 fulfillment does NOT satisfy L4-only requirement
- **Preconditions:**
  - Requirement has minAttestationLevel: validated (L4)
  - Submission at L3
- **Steps:**
  1. Submit L3 fulfillment
- **Expected Results:**
  - Requirement unfulfilled
  - Error indicates L4 required

---

## 2. Override Test Matrix

### Design Principles
- **Four override types:**
  1. **Expiration extension** — extend due date without new proof
  2. **Proof override** — manually accept proof without standard process
  3. **Requirement waiver** — exempt a requirement entirely
  4. **Grace period** — time-limited exception (auto-expires)
- **All overrides require:**
  - Mandatory justification text
  - Audit trail (who, when, why, original→new)
  - Approval chain: supervisor for custom, CO+admin for regulatory
  - Expiration date (no permanent overrides)
- **RBAC boundaries:**
  - Supervisor can override custom requirements
  - Only CO+admin can override regulatory requirements
  - Supervisor cannot override outside their reporting chain

---

### 2.1 Expiration Extension Override

#### TC-OVR-1.1.1: Supervisor Extends Custom Requirement Expiration
- **Priority:** P0
- **Description:** Supervisor extends expiration date for custom requirement without new proof
- **Preconditions:**
  - Requirement is custom (non-regulatory, part of org standard)
  - Expiration date is within 30 days (or overdue)
  - Employee is supervisor's direct report
  - Supervisor has extend permission
- **Steps:**
  1. Supervisor POSTs `/api/overrides` with:
     ```json
     {
       "type": "expiration_extension",
       "employeeId": "emp-123",
       "requirementId": "req-456",
       "newExpirationDate": "2027-06-30",
       "justification": "Employee on approved maternity leave, extending grace period",
       "overrideValidUntil": "2026-09-30"
     }
     ```
  2. System validates:
     - Requirement is custom (not regulatory)
     - Justification ≥ 20 characters
     - overrideValidUntil is future date
  3. System creates override record with approval_status: approved (supervisor auto-approves own custom overrides)
  4. System updates qualification.expirationDate
- **Expected Results:**
  - Response: 201 Created
  - Override created with type `expiration_extension`
  - Override approval_status: `approved`
  - Qualification expirationDate updated
  - Audit log: "Supervisor [ID] extended expiration for requirement [ID], valid until [date]: [justification]"

#### TC-OVR-1.1.2: CO Must Approve Supervisor's Regulatory Extension
- **Priority:** P0
- **Description:** Supervisor requests extension for regulatory requirement; requires CO+admin dual approval
- **Preconditions:**
  - Requirement is regulatory (marked as_regulatory: true)
  - Supervisor submits override request
- **Steps:**
  1. Supervisor POSTs `/api/overrides` with type `expiration_extension` + regulatory requirement
  2. System detects regulatory requirement
  3. System creates override with approval_status: `pending_approval`
  4. System routes to CO approval queue
  5. CO GETs `/api/overrides?status=pending_approval`
  6. CO + Admin jointly approve (dual approval workflow):
     - CO PUTs `/api/overrides/:id/approve` with comment
     - Admin PUTs `/api/overrides/:id/approve` with comment
  7. System updates override approval_status: `approved`
- **Expected Results:**
  - Step 1-3: Override created with `pending_approval`
  - Step 5: CO sees override in queue
  - Step 6: Both approvals required
  - Step 7: Override approved and applied

#### TC-OVR-1.1.3: Supervisor Cannot Extend Outside Reporting Chain
- **Priority:** P0
- **Description:** Supervisor attempts to extend requirement for employee outside their team
- **Preconditions:**
  - Employee in different department/reporting chain
  - Supervisor lacks authority
- **Steps:**
  1. Supervisor POSTs `/api/overrides` for employee not in their group
- **Expected Results:**
  - Response: 403 Forbidden
  - Error: "Employee not in your reporting chain"

#### TC-OVR-1.1.4: Override Expires, Requirement Reverts to Non-Compliant
- **Priority:** P1
- **Description:** Time-limited override expires; requirement status changes
- **Preconditions:**
  - Override has overrideValidUntil: [past date]
  - System runs compliance check
- **Steps:**
  1. Scheduler/batch job checks overrides with past expiry dates
  2. System marks override as `expired`
  3. System reverts qualification.expirationDate to original (or marks requirement `non_compliant`)
  4. Employee added to at-risk/overdue queue
- **Expected Results:**
  - Override status: `expired`
  - Requirement compliance status: `non_compliant` or `overdue`
  - Audit log: "Override [ID] expired, requirement [ID] no longer compliant"
  - Dashboard flag: "Compliance override expired"

---

### 2.2 Proof Override (Manual Acceptance)

#### TC-OVR-2.1.1: CO Manually Accepts Proof with Override
- **Priority:** P0
- **Description:** CO reviews employee claim and manually marks requirement fulfilled without standard fulfillment flow
- **Preconditions:**
  - Requirement exists but no formal fulfillment (e.g., employee trained off-system)
  - CO has evidence (email, verbal confirmation, third-party verification outside system)
  - Requirement status: `unfulfilled`
- **Steps:**
  1. CO POSTs `/api/overrides` with:
     ```json
     {
       "type": "proof_override",
       "employeeId": "emp-123",
       "requirementId": "req-456",
       "justification": "Reviewed training completion email from provider, credential valid",
       "overrideValidUntil": "2027-06-30"
     }
     ```
  2. System creates override record
  3. System creates synthetic ProofFulfillment with:
     - status: `fulfilled`
     - fulfillmentType: `manual_override`
     - createdBy: CO_ID
     - notes: (from justification)
  4. Requirement marked satisfied
- **Expected Results:**
  - Response: 201 Created
  - Override created
  - ProofFulfillment created with manual flag
  - Requirement satisfied ✓
  - Audit log: "CO [ID] manually accepted proof for requirement [ID]: [justification]"

#### TC-OVR-2.1.2: Supervisor Cannot Override Proof (CO-Only)
- **Priority:** P0
- **Description:** Supervisor cannot manually accept proof; only CO can
- **Preconditions:**
  - Supervisor attempts proof_override request
- **Steps:**
  1. Supervisor POSTs `/api/overrides` with type `proof_override`
- **Expected Results:**
  - Response: 403 Forbidden
  - Error: "Proof override requires Compliance Officer role"

---

### 2.3 Requirement Waiver Override

#### TC-OVR-3.1.1: CO Waives Custom Requirement with Reason
- **Priority:** P0
- **Description:** CO exempts employee from a custom (non-regulatory) requirement with documented reason
- **Preconditions:**
  - Requirement is custom
  - CO decides to waive it (e.g., role change, policy exception)
- **Steps:**
  1. CO POSTs `/api/overrides` with:
     ```json
     {
       "type": "requirement_waiver",
       "employeeId": "emp-123",
       "requirementId": "req-456",
       "justification": "Employee transitioned to non-safety role, requirement no longer applicable",
       "overrideValidUntil": "2027-12-31"
     }
     ```
  2. System creates override
  3. System marks requirement as `waived` (distinct from `satisfied`)
  4. Assignment recalculated
- **Expected Results:**
  - Override created with type `requirement_waiver`
  - Requirement status: `waived`
  - Requirement no longer counts against overallStatus (not non-compliant)
  - Audit log: "CO [ID] waived requirement [ID]: [justification]"
  - Assignment overallStatus updated: one less requirement to track

#### TC-OVR-3.1.2: Supervisor Cannot Waive Regulatory Requirement
- **Priority:** P0
- **Description:** Regulatory requirement cannot be waived by supervisor
- **Preconditions:**
  - Requirement is regulatory (is_regulatory: true)
  - Supervisor attempts waiver
- **Steps:**
  1. Supervisor POSTs `/api/overrides` with type `requirement_waiver`
- **Expected Results:**
  - Response: 403 Forbidden
  - Error: "Regulatory requirements cannot be waived by supervisor; requires CO+admin dual approval"

#### TC-OVR-3.1.3: Admin Dual-Approves Regulatory Waiver (Rare)
- **Priority:** P1
- **Description:** In exceptional case, regulatory requirement can be waived with CO+admin dual approval
- **Preconditions:**
  - Requirement is regulatory
  - Legal/compliance team requests waiver
  - Both CO and admin available
- **Steps:**
  1. CO submits waiver request with business justification
  2. System creates override with `pending_approval`
  3. Admin reviews and approves
  4. CO confirms
  5. System applies waiver
- **Expected Results:**
  - Both approvals logged
  - Audit trail explicitly notes dual approval
  - Dashboard flags: "Regulatory requirement waived (approved by CO + Admin)"

---

### 2.4 Grace Period Override

#### TC-OVR-4.1.1: Grace Period for New Hire Transitional Window
- **Priority:** P0
- **Description:** New employee auto-granted grace period for qualifications; auto-expires after 90 days
- **Preconditions:**
  - Employee just hired (employment start date within 30 days)
  - Standard qualification requirements not yet met
  - Grace period policy enabled
- **Steps:**
  1. Employee assigned to standard → system auto-creates grace period override
     ```json
     {
       "type": "grace_period",
       "employeeId": "emp-999",
       "requirementId": "req-*",
       "justification": "New hire transition window (90 days from start)",
       "overrideValidUntil": "2026-06-30"
     }
     ```
  2. System marks all requirements with grace period status `grace_period`
  3. overallStatus: `compliant_with_grace` (distinct from full compliance)
  4. Dashboard shows: "In grace period until [date]"
  5. 90-day timer starts
  6. At 80 days: system sends reminder notification
  7. At 90 days: override expires, requirements become non-compliant
- **Expected Results:**
  - Override auto-created on assignment
  - Requirements marked `grace_period`
  - overallStatus adjusted
  - Audit log: "Grace period auto-created for new hire [ID]"
  - Expiry timer: 90 days (configurable per policy)

#### TC-OVR-4.1.2: Grace Period Auto-Expires, Requirements Become Non-Compliant
- **Priority:** P0
- **Description:** When grace period expires, employee transitions to non-compliant
- **Preconditions:**
  - Grace period override with past expiry date
  - Requirements still unfulfilled
  - Scheduler job runs
- **Steps:**
  1. System detects overrideValidUntil < now
  2. System marks override `expired`
  3. System recalculates assignment:
     - Requirements reverts from `grace_period` to `unfulfilled`
     - overallStatus: `non_compliant`
  4. System escalates to manager/CO: "Employee [name] grace period ended, now non-compliant"
  5. Audit trail logged
- **Expected Results:**
  - Override status: `expired`
  - Requirements reverted to `unfulfilled`
  - overallStatus: `non_compliant`
  - Manager notification sent
  - Audit log: "Grace period expired for employee [ID], now non-compliant"

---

## 3. Exemption Test Scenarios

### Design Principles
- **Five exemption types:**
  1. `NOT_APPLICABLE` — department/role exemption (permanent until policy changes)
  2. `MEDICAL` — ADA accommodation with alternative requirement
  3. `TRANSITIONAL` — new hire grace with auto-expiry
  4. `GRANDFATHERED` — pre-existing qualification accepted as-is
  5. `REGULATORY_WAIVER` — rare regulatory exception (dual approval)
- **Exemption vs. override:** Exemptions are policy decisions; overrides are one-off exceptions

---

### 3.1 NOT_APPLICABLE Exemption

#### TC-EXM-1.1.1: Department Marked NOT_APPLICABLE for Requirement
- **Priority:** P0
- **Description:** Requirement not applicable to employees in specific department; exemption created with reason
- **Preconditions:**
  - Requirement: "Forklift certification"
  - Department: "Finance" (no warehouse work)
  - CO decides exemption applies
- **Steps:**
  1. CO POSTs `/api/exemptions` with:
     ```json
     {
       "type": "NOT_APPLICABLE",
       "requirementId": "req-forklift",
       "appliesTo": "department",
       "departmentName": "Finance",
       "reason": "Finance department does not perform warehouse operations; requirement not applicable",
       "effectiveDate": "2026-01-01",
       "expirationDate": null
     }
     ```
  2. System creates exemption rule
  3. System recalculates all Finance employees: requirement hidden/ignored for them
  4. Assignment overallStatus recalculated: one fewer requirement to track
- **Expected Results:**
  - Exemption created with `type: NOT_APPLICABLE`
  - Finance employees' assignments: requirement not counted
  - overallStatus: improves (fewer required items)
  - Audit log: "CO [ID] created NOT_APPLICABLE exemption for requirement [ID] in Finance department"

#### TC-EXM-1.1.2: Expired Exemption → Employee Becomes Non-Compliant
- **Priority:** P1
- **Description:** Time-limited exemption expires; requirement now applies
- **Preconditions:**
  - Exemption with `expirationDate: [past date]`
  - Employee in affected department
  - Scheduler runs exemption expiry check
- **Steps:**
  1. System detects exemption expiry
  2. System marks exemption `expired`
  3. System recalculates assignments in affected department
  4. Requirement now applies → employees become non-compliant if unfulfilled
  5. Manager notifications sent
- **Expected Results:**
  - Exemption status: `expired`
  - Affected employees now show requirement as unfulfilled
  - overallStatus: `non_compliant`
  - Audit log: "Exemption [ID] expired, requirement [ID] now applies"

---

### 3.2 MEDICAL Exemption

#### TC-EXM-2.1.1: ADA Accommodation with Alternative Requirement
- **Priority:** P0
- **Description:** Employee with medical limitation receives alternative requirement (ADA accommodation)
- **Preconditions:**
  - Requirement: "In-person safety training (8 hours on-site)"
  - Employee: physical limitation makes in-person impractical
  - HR/Medical team documents accommodation
- **Steps:**
  1. CO POSTs `/api/exemptions` with:
     ```json
     {
       "type": "MEDICAL",
       "appliesTo": "employee",
       "employeeId": "emp-456",
       "originalRequirementId": "req-training-onsite",
       "alternativeRequirementId": "req-training-remote",
       "reason": "ADA: Employee accommodation for documented mobility limitation",
       "medicalCertification": true,
       "certificationDate": "2026-03-15",
       "effectiveDate": "2026-03-15",
       "expirationDate": "2027-03-15"
     }
     ```
  2. System creates MEDICAL exemption
  3. System hides original requirement for this employee
  4. System applies alternative requirement instead
  5. Assignment recalculated with alternative requirement
- **Expected Results:**
  - Exemption created with `type: MEDICAL`
  - Original requirement hidden for employee
  - Alternative requirement (remote training) now applied
  - Audit log: "CO [ID] created MEDICAL exemption for employee [ID], original req → alternative req"
  - Assignment tracking: focuses on alternative requirement

#### TC-EXM-2.1.2: Medical Exemption Expires, Original Requirement Reapplies
- **Priority:** P1
- **Description:** Accommodation expires; original requirement reapplies
- **Preconditions:**
  - Medical exemption with past expiry
  - Employee still in system
- **Steps:**
  1. Scheduler detects exemption expiry
  2. System marks exemption `expired`
  3. System recalculates: alternative requirement hidden, original reapplied
  4. If employee hasn't fulfilled original requirement, now non-compliant
- **Expected Results:**
  - Exemption status: `expired`
  - Original requirement reappears
  - Audit log: "Medical exemption [ID] expired, original requirement [ID] reapplied"

---

### 3.3 TRANSITIONAL Exemption

#### TC-EXM-3.1.1: New Hire Receives Transitional Exemption (90-Day Grace)
- **Priority:** P0
- **Description:** Employee starting new role auto-receives transitional exemption; expires in 90 days
- **Preconditions:**
  - Employee role change/new hire
  - Transition start date defined
- **Steps:**
  1. System auto-creates TRANSITIONAL exemption:
     ```json
     {
       "type": "TRANSITIONAL",
       "employeeId": "emp-new",
       "reason": "New role transition, grace period for qualification catch-up",
       "transitionStartDate": "2026-03-17",
       "effectiveDate": "2026-03-17",
       "expirationDate": "2026-06-15"
     }
     ```
  2. System marks all applicable requirements `transitional_grace`
  3. Assignment status: `compliant_with_grace`
  4. Dashboard: "In transition period until [date]"
- **Expected Results:**
  - Exemption auto-created on role change
  - All requirements: grace_period status
  - overallStatus: compliant (with grace notation)
  - Audit log: "TRANSITIONAL exemption auto-created for employee [ID]"

#### TC-EXM-3.1.2: Post-Transition Auto-Expiry and Escalation
- **Priority:** P0
- **Description:** 90-day grace expires; requirements become mandatory
- **Preconditions:**
  - TRANSITIONAL exemption with past expiry
- **Steps:**
  1. Scheduler checks exemptions
  2. System marks exemption `expired`
  3. System recalculates assignment: grace ends, requirements mandatory
  4. System escalates to manager: "Employee [name] transition period ended, now requires full compliance"
  5. Requirements still unfulfilled → non-compliant
- **Expected Results:**
  - Exemption status: `expired`
  - Requirements: `unfulfilled` (no longer graceful)
  - overallStatus: `non_compliant`
  - Manager notification sent
  - Audit log: "TRANSITIONAL exemption [ID] expired, employee [ID] now fully compliant"

---

### 3.4 GRANDFATHERED Exemption

#### TC-EXM-4.1.1: Pre-Existing Qualification Auto-Accepted as Grandfathered
- **Priority:** P1
- **Description:** Employee had qualification before requirement added; system accepts legacy cert
- **Preconditions:**
  - Standard updated: new requirement added (e.g., new annual cert type)
  - Employee has old cert that no longer meets new standard
  - Policy: accept legacy certs under "grandfathered" status
- **Steps:**
  1. System detects employee + old qualification + new requirement
  2. CO reviews and creates GRANDFATHERED exemption:
     ```json
     {
       "type": "GRANDFATHERED",
       "employeeId": "emp-legacy",
       "requirementId": "req-new-cert",
       "reason": "Employee held legacy certification prior to requirement change; accepted under grandfathering policy",
       "originalQualificationId": "qual-old-cert",
       "effectiveDate": "2026-01-01",
       "expirationDate": "2030-01-01"
     }
     ```
  3. System marks requirement `grandfathered` (fulfilled without new cert)
  4. System creates synthetic fulfillment record (audit trail)
- **Expected Results:**
  - GRANDFATHERED exemption created
  - Requirement marked satisfied (with grandfathered flag)
  - Audit log: "CO [ID] created GRANDFATHERED exemption for requirement [ID]"
  - Employee compliant for that requirement

---

### 3.5 REGULATORY_WAIVER Exemption

#### TC-EXM-5.1.1: Regulatory Requirement Waiver (Emergency, Rare)
- **Priority:** P2
- **Description:** Regulatory requirement waived in exceptional circumstances with executive approval
- **Preconditions:**
  - Requirement is regulatory (OSHA, Joint Commission, etc.)
  - Extraordinary business circumstance (major incident, system failure, etc.)
  - Executive/board approval required
- **Steps:**
  1. CO + Admin jointly submit REGULATORY_WAIVER exemption:
     ```json
     {
       "type": "REGULATORY_WAIVER",
       "requirementId": "req-osha-30",
       "reason": "Temporary system failure prevented renewal; regulatory authority notified and approved temporary waiver",
       "executiveApprovals": ["exec-1", "exec-2"],
       "documentationUrl": "https://...",
       "effectiveDate": "2026-03-17",
       "expirationDate": "2026-04-17"
     }
     ```
  2. System creates exemption with `approval_status: pending_executive_review`
  3. Executive reviews and approves (both signatures required)
  4. System applies temporary waiver
  5. Audit trail: explicit note of executive approval + documentation reference
- **Expected Results:**
  - REGULATORY_WAIVER exemption created with pending status
  - Requires dual executive approval
  - Duration limited (30 days typical)
  - Audit log includes documentation reference
  - Dashboard red flag: "Regulatory waiver active (expires [date])"

---

## 4. Standards Customization Tests

### Design Principles
- **Lock regulatory, flex custom:**
  - Regulatory standards: immutable (cannot remove requirements, cannot relax attestation levels)
  - Custom standards: fully flexible (add, remove, change levels)
  - Backend override: platform admin can set requirement as `mandatory-not-overridable`
- **Inheritance:** Standard → Org → Dept → Individual
- **Requirement lifecycle:** regulatory requirements cannot be deleted; custom can be

---

### 4.1 Regulatory Standard Immutability

#### TC-STD-1.1.1: Regulatory Standard Cannot Remove Required Item
- **Priority:** P0
- **Description:** Org admin attempts to remove regulatory requirement; system blocks
- **Preconditions:**
  - Standard: OSHA-30 (regulatory)
  - Requirement: "30-hour classroom training" (is_regulatory: true, source: OSHA)
  - Org admin tries to remove it
- **Steps:**
  1. Org Admin PUTs `/api/standards/{standardId}/requirements/{reqId}` with `DELETE`
  2. System validates requirement.is_regulatory
- **Expected Results:**
  - Response: 403 Forbidden
  - Error: "Cannot remove regulatory requirement. Standard requirements are locked from modification."
  - Requirement unchanged

#### TC-STD-1.1.2: Regulatory Requirement Cannot Relax Attestation Level
- **Priority:** P0
- **Description:** Org admin attempts to lower attestation requirement (L2 → L1); system blocks
- **Preconditions:**
  - Requirement: OSHA, minAttestationLevel: supervisor (L2)
  - Admin tries to change to L1 (self_attest)
- **Steps:**
  1. Admin PUTs `/api/standards/{standardId}/requirements/{reqId}` with:
     ```json
     { "minAttestationLevel": "self_attest" }
     ```
  2. System validates is_regulatory flag
- **Expected Results:**
  - Response: 403 Forbidden
  - Error: "Regulatory requirements cannot be relaxed below their registered level"
  - Attestation level unchanged

#### TC-STD-1.1.3: Regulatory Requirement CAN Be Tightened (L2 → L3)
- **Priority:** P0
- **Description:** Org admin raises attestation requirement above minimum; allowed
- **Preconditions:**
  - Requirement: OSHA, minAttestationLevel: supervisor (L2)
  - Admin wants to require L3 (third-party) for their org's stricter policy
- **Steps:**
  1. Admin PUTs `/api/standards/{standardId}/requirements/{reqId}` with:
     ```json
     { "minAttestationLevel": "third_party" }
     ```
  2. System allows tightening (is_regulatory: true, but TIGHTENING is allowed)
  3. System updates requirement and recalculates affected assignments
- **Expected Results:**
  - Response: 200 OK
  - Requirement minAttestationLevel: L3
  - Audit log: "Org admin [ID] tightened attestation requirement [ID] from L2 to L3"
  - Affected employees: now need L3 fulfillment instead of L2

---

### 4.2 Custom Standard Flexibility

#### TC-STD-2.1.1: Org Can Add Custom Requirements Beyond Standard
- **Priority:** P0
- **Description:** Org creates custom requirement beyond regulatory minimum
- **Preconditions:**
  - Standard: OSHA-30 (base regulatory)
  - Org wants to add extra requirement: "Annual safety audit" (not in OSHA)
  - Org admin has permission to customize
- **Steps:**
  1. Org Admin POSTs `/api/standards/{standardId}/requirements` with:
     ```json
     {
       "name": "Annual safety audit",
       "description": "Internal audit to verify ongoing compliance",
       "isRegulatory": false,
       "minAttestationLevel": "supervisor",
       "validityPeriodDays": 365
     }
     ```
  2. System creates new requirement linked to standard
  3. System applies to all employees assigned to standard
  4. Assignment count increases
- **Expected Results:**
  - Response: 201 Created
  - Requirement created with is_regulatory: false
  - Requirement linked to standard
  - Audit log: "Org admin [ID] added custom requirement [ID] to standard [ID]"
  - Existing assignments updated: new requirement added

#### TC-STD-2.1.2: Custom Requirement Removed from Standard
- **Priority:** P0
- **Description:** Org removes custom requirement; existing fulfillments remain in audit trail
- **Preconditions:**
  - Requirement is custom (is_regulatory: false)
  - Existing fulfillments for this requirement
- **Steps:**
  1. Org Admin DELETEs `/api/standards/{standardId}/requirements/{reqId}`
  2. System marks requirement `archived` (soft delete)
  3. System stops applying to new assignments
  4. System preserves existing fulfillments (audit trail)
- **Expected Results:**
  - Response: 200 OK (or 204 No Content)
  - Requirement archived (not hard-deleted)
  - Existing fulfillments preserved
  - New assignments: requirement not included
  - Audit log: "Org admin [ID] archived custom requirement [ID]"

#### TC-STD-2.1.3: Org Changes Attestation Level for Custom Requirement
- **Priority:** P0
- **Description:** Org tightens or relaxes custom requirement attestation level
- **Preconditions:**
  - Requirement is custom
  - Currently L1, org wants L2
- **Steps:**
  1. Admin PUTs `/api/standards/{standardId}/requirements/{reqId}` with:
     ```json
     { "minAttestationLevel": "supervisor" }
     ```
  2. System updates requirement
  3. System recalculates assignments: existing fulfillments may no longer satisfy
- **Expected Results:**
  - Response: 200 OK
  - minAttestationLevel updated
  - Assignments recalculated: employees previously compliant (L1) now non-compliant if requirement raised to L2
  - Audit log: "Org admin [ID] changed attestation level for requirement [ID] from self_attest to supervisor"

---

### 4.3 Layered Customization (Inheritance)

#### TC-STD-3.1.1: Standard → Org → Dept → Individual Effective Requirements
- **Priority:** P0
- **Description:** Requirement effective level = highest restriction across all layers
- **Preconditions:**
  - Standard: OSHA-30, req "30-hour training", L2
  - Org customization: tighten to L3
  - Dept customization: none
  - Employee exception: medical exemption for alternative
- **Steps:**
  1. System calculates effective requirement:
     ```
     Standard: L2
     Org: L3 (override)
     Dept: none
     Emp: MEDICAL exemption
     → Effective for employee: alternative requirement instead
     ```
  2. Employee assignment reflects alternative (not original L3)
  3. Fulfillment tracked against alternative
- **Expected Results:**
  - Effective requirement: alternative (per medical exemption)
  - Original L3 requirement hidden for this employee
  - Audit log: "Effective requirement calculated for employee [ID], standard L2 + org L3 + medical exemption = alternative"

#### TC-STD-3.1.2: Dept Tightens Requirement Beyond Org Level
- **Priority:** P1
- **Description:** Department can set stricter requirement than org baseline
- **Preconditions:**
  - Org standard: L2 supervisor approval
  - Dept: "Safety-critical role" needs L3 third-party verification
- **Steps:**
  1. Dept Admin PUTs `/api/standards/{standardId}/requirements/{reqId}/dept-override` with:
     ```json
     { "minAttestationLevel": "third_party", "appliesTo": "dept_manufacturing" }
     ```
  2. System creates dept-level override
  3. All manufacturing employees: requirement now L3 instead of org L2
- **Expected Results:**
  - Dept override created
  - Manufacturing employees: effective requirement L3
  - Other depts: L2
  - Audit log: "Dept [ID] overrode requirement [ID], L2 → L3"

---

### 4.4 Requirement Composition and Effective Calculation

#### TC-STD-4.1.1: Multiple Exemptions Don't Double-Hide Requirement
- **Priority:** P1
- **Description:** If employee has multiple exemptions (dept NOT_APPLICABLE + medical MEDICAL), system correctly hides/replaces requirement
- **Preconditions:**
  - Employee in Finance (dept has NOT_APPLICABLE for warehouse reqs)
  - Employee also has medical exemption for remote alternative
  - Multiple inheritance layers apply
- **Steps:**
  1. System calculates effective requirement:
     ```
     Base: warehouse safety cert
     Dept exemption: NOT_APPLICABLE (Finance)
     Medical exemption: alternative remote cert
     → Effective: hidden (NOT_APPLICABLE takes precedence)
     ```
  2. Requirement not shown in assignment
- **Expected Results:**
  - Requirement hidden (dept exemption applied)
  - Medical exemption not contradictory (both allow hiding)
  - Audit log: "Effective requirement: hidden (dept NOT_APPLICABLE exemption)"

---

## 5. RBAC Edge Cases

### Design Principles
- **Five roles:**
  - EMPLOYEE(0): View own assignments/fulfillments only
  - SUPERVISOR(1): Manage direct reports + own
  - MANAGER(2): Manage supervisors + direct reports + own
  - COMPLIANCE_OFFICER(3): Org-wide oversight, approve regulatory overrides
  - ADMIN(4): System admin, backend overrides, policy flags
- **Permission model:** `hasPermission(user, "resource:action")`
- **Boundaries:**
  - Supervisor cannot review outside reporting chain
  - CO cannot override regulatory without admin approval
  - Employee cannot submit qualification on behalf of others (must be own)

---

### 5.1 Supervisor RBAC Boundaries

#### TC-RBAC-1.1.1: Supervisor Can Review Only Direct Reports
- **Priority:** P0
- **Description:** Supervisor A cannot approve fulfillment for employee outside their reporting chain
- **Preconditions:**
  - Supervisor A manages [Emp1, Emp2]
  - Supervisor B manages [Emp3, Emp4]
  - ProofFulfillment owned by Emp3 (Supervisor B's report)
  - Supervisor A tries to approve
- **Steps:**
  1. Supervisor A PUTs `/api/fulfillments/{id}` with approval
  2. System checks: is Emp3 in Supervisor A's reporting chain?
- **Expected Results:**
  - Response: 403 Forbidden
  - Error: "Employee not in your reporting chain"
  - No approval made

#### TC-RBAC-1.1.2: Supervisor Can Create Qualification for Direct Report
- **Priority:** P0
- **Description:** Supervisor can create qualification record on behalf of direct report
- **Preconditions:**
  - Supervisor has SUPERVISOR+ role
  - Employee is direct report
- **Steps:**
  1. Supervisor POSTs `/api/qualifications` with:
     ```json
     {
       "employeeId": "emp-direct-report",
       "standardId": "req-123",
       ...
     }
     ```
  2. System validates: is employeeId in supervisor's reporting chain?
- **Expected Results:**
  - Response: 201 Created
  - Qualification created for employee

#### TC-RBAC-1.1.3: Supervisor Cannot Create Qualification for Non-Report
- **Priority:** P0
- **Description:** Supervisor cannot create qualification for employee outside their chain
- **Preconditions:**
  - Employee in different department
- **Steps:**
  1. Supervisor POSTs `/api/qualifications` for outside employee
- **Expected Results:**
  - Response: 403 Forbidden
  - Error: "Cannot create qualification for employee outside your reporting chain"

---

### 5.2 Compliance Officer RBAC Boundaries

#### TC-RBAC-2.1.1: CO Can Validate Any Employee's Fulfillment
- **Priority:** P0
- **Description:** CO has org-wide access to validate fulfillments
- **Preconditions:**
  - ProofFulfillment from any employee
  - CO has COMPLIANCE_OFFICER+ role
- **Steps:**
  1. CO PUTs `/api/fulfillments/{id}` with `status: "fulfilled"` + validation
- **Expected Results:**
  - Response: 200 OK
  - Fulfillment validated

#### TC-RBAC-2.1.2: CO Must Have Dual Admin Approval for Regulatory Overrides
- **Priority:** P0
- **Description:** CO alone cannot override regulatory requirement; requires admin co-approval
- **Preconditions:**
  - Regulatory requirement override pending approval
  - CO wants to approve
- **Steps:**
  1. CO PUTs `/api/overrides/{id}/approve` with CO signature
  2. System expects admin approval also
  3. Admin PUTs `/api/overrides/{id}/approve` with admin signature
- **Expected Results:**
  - Step 1: Override marked as CO_APPROVED (pending admin)
  - Step 2: Override final_status: APPROVED
  - Both signatures in audit log

#### TC-RBAC-2.1.3: CO Cannot Perform Backend Override (Admin Only)
- **Priority:** P0
- **Description:** Platform admin feature: mark requirement as mandatory-not-overridable
- **Preconditions:**
  - CO tries to set `mandatory-not-overridable` flag
  - Feature requires ADMIN role
- **Steps:**
  1. CO PUTs `/api/requirements/{id}` with `mandatory-not-overridable: true`
- **Expected Results:**
  - Response: 403 Forbidden
  - Error: "Only platform admins can set policy flags"

---

### 5.3 Employee RBAC Boundaries

#### TC-RBAC-3.1.1: Employee Can Submit Own Fulfillments Only
- **Priority:** P0
- **Description:** Employee cannot submit fulfillment on behalf of another employee
- **Preconditions:**
  - Employee A tries to submit fulfillment for Employee B
- **Steps:**
  1. Employee A POSTs `/api/fulfillments` with `employeeId: "emp-b"`
- **Expected Results:**
  - Response: 403 Forbidden
  - Error: "Can only submit fulfillments for yourself"

#### TC-RBAC-3.1.2: Employee Can View Own Fulfillments Only
- **Priority:** P0
- **Description:** Employee cannot list all fulfillments; only own
- **Preconditions:**
  - Employee tries to GET `/api/fulfillments?employeeId=other`
- **Steps:**
  1. Employee GETs `/api/fulfillments` with different employeeId
- **Expected Results:**
  - Response: 403 Forbidden OR 200 with empty list (depends on design)
  - If 200, list is filtered to own assignments only

#### TC-RBAC-3.1.3: Employee Cannot Approve Own Fulfillments
- **Priority:** P0
- **Description:** Employee cannot approve their own L2 submission (clear separation of duty)
- **Preconditions:**
  - Employee has unfulfilled L2 requirement
  - Employee submits and then tries to approve own submission
- **Steps:**
  1. Employee POSTs `/api/fulfillments` with L2 evidence
  2. Employee tries PUTs `/api/fulfillments/{id}` with approval
- **Expected Results:**
  - Step 2: Response 403 Forbidden
  - Error: "Cannot approve own submission (separation of duty)"

---

### 5.4 Manager RBAC Boundaries

#### TC-RBAC-4.1.1: Manager Can Manage Supervisors and Their Reports
- **Priority:** P1
- **Description:** Manager (L2) can approve/override for supervisors (L1) and employees
- **Preconditions:**
  - Manager role (requireMinRole: MANAGER)
  - Org hierarchy: Manager → Supervisors → Employees
- **Steps:**
  1. Manager approves fulfillment for supervisor's report
- **Expected Results:**
  - Response: 200 OK
  - Approval recorded

#### TC-RBAC-4.1.2: Manager Cannot Override Outside Org Structure
- **Priority:** P1
- **Description:** Manager confined to their reporting tree
- **Preconditions:**
  - Employee in different manager's tree
- **Steps:**
  1. Manager A tries to override for employee under Manager B
- **Expected Results:**
  - Response: 403 Forbidden

---

### 5.5 Admin RBAC Boundaries

#### TC-RBAC-5.1.1: Admin Can Perform Backend Override (Mandatory-Not-Overridable)
- **Priority:** P0
- **Description:** Platform admin can set requirement as regulatory lock-down (no tenant override)
- **Preconditions:**
  - Admin role only
  - Requirement policy flag: `mandatory-not-overridable`
- **Steps:**
  1. Admin PUTs `/api/requirements/{id}` with:
     ```json
     { "mandatory-not-overridable": true }
     ```
  2. System sets flag; tenant admins cannot override this requirement
- **Expected Results:**
  - Flag set
  - Tenant admins: 403 if they try to exempt/waive/override
  - Audit log: "Admin [ID] set requirement [ID] as mandatory-not-overridable"

---

## 6. Data Relationship Tests

### Design Principles
- **Chain:** Employee → Group → ComplianceStandard → StandardRequirement → ProofTemplate/ProofFulfillment
- **Cascading:** Template change → existing assignments affected?
- **Environment scoping:** Qualification in env A ≠ env B

---

### 6.1 Employee-Group-Template Chain

#### TC-DATA-1.1.1: Employee Assignment Created from Standard
- **Priority:** P0
- **Description:** Employee assigned to standard → TemplateAssignment auto-created with all requirements
- **Preconditions:**
  - Employee exists
  - Standard (OSHA-30) exists with 5 requirements
  - Employee assigned to standard via group/department
- **Steps:**
  1. Employee record includes group: "Safety Team"
  2. Group linked to ComplianceStandard: OSHA-30
  3. System queries: GET `/api/employees/{id}/assignments`
- **Expected Results:**
  - TemplateAssignment created for employee + standard
  - Assignment includes all 5 requirements
  - Status: `active`
  - Audit log: "TemplateAssignment created for employee [ID] + standard [ID]"

#### TC-DATA-1.1.2: Employee Removed from Group → Assignment Deactivated
- **Priority:** P0
- **Description:** When employee removed from group, assignments deactivate
- **Preconditions:**
  - Employee in "Safety Team"
  - Active assignment to OSHA-30
  - Employee moved to different group
- **Steps:**
  1. Update employee.groups to remove "Safety Team"
  2. System recalculates assignments
- **Expected Results:**
  - Assignment status: `inactive` (not deleted)
  - Requirements no longer tracked
  - Audit log: "TemplateAssignment deactivated for employee [ID]"

---

### 6.2 Cascading Effects

#### TC-DATA-2.1.1: Template Requirement Added → Existing Assignments Updated
- **Priority:** P0
- **Description:** After publishing requirement to standard, all active assignments updated
- **Preconditions:**
  - Template published with 5 requirements
  - 100 employees already assigned
  - New requirement added to template
- **Steps:**
  1. Admin POSTs new requirement to template
  2. System publishes requirement
  3. System cascades: all active assignments + 1 new requirement
- **Expected Results:**
  - All 100 assignments: new requirement added
  - New fulfillment records created (status: unfulfilled)
  - overallStatus recalculated for each employee
  - Audit log: "Requirement [ID] added to standard [ID], cascaded to [100] active assignments"

#### TC-DATA-2.1.2: Template Requirement Removed → Existing Assignments Updated
- **Priority:** P0
- **Description:** Requirement archived → existing fulfillments preserved, assignments updated
- **Preconditions:**
  - Requirement archived from template
  - 50 employees have fulfillments for this requirement
- **Steps:**
  1. Admin archives requirement
  2. System cascades to assignments
  3. System preserves fulfillments (audit trail)
- **Expected Results:**
  - All assignments: requirement removed
  - Existing fulfillments: marked `archived` (not deleted)
  - overallStatus improves (one fewer requirement)
  - Audit log: "Requirement [ID] archived, cascaded to [50] assignments, [50] fulfillments preserved"

---

### 6.3 Environment Scoping

#### TC-DATA-3.1.1: Qualification in Environment A Isolated from Environment B
- **Priority:** P1
- **Description:** Multi-environment deployment: qualification data does not leak between envs
- **Preconditions:**
  - Two environments: production, staging
  - Employee exists in both with different qualification states
  - Qualification created in staging
- **Steps:**
  1. In staging: create qualification for emp-123
  2. In production: query emp-123's qualifications
- **Expected Results:**
  - Staging: qualification visible
  - Production: qualification NOT visible (different database)
  - Data scoping enforced by environment

#### TC-DATA-3.1.2: Cross-Tenant Data Isolation
- **Priority:** P1
- **Description:** Multi-tenant SaaS: Tenant A's qualifications not visible to Tenant B
- **Preconditions:**
  - Two tenants (if multi-tenant architecture)
  - Tenant A: qualification created for emp-123
  - Tenant B: emp-123 exists with different qualifications
- **Steps:**
  1. Query as Tenant A: GET `/api/qualifications` for emp-123
  2. Query as Tenant B: same employee
- **Expected Results:**
  - Tenant A: sees own qualification
  - Tenant B: sees own qualification (different record)
  - No cross-tenant leakage

---

## Test Execution Strategy

### Test Phases

| Phase | Scope | Tests | Duration | Gate |
|-------|-------|-------|----------|------|
| 1 | Attestation L1-L4 | TC-ATT-* (25) | 2 days | All passing + coverage >90% |
| 2 | Overrides | TC-OVR-* (18) | 2 days | All passing + dual approval flows work |
| 3 | Exemptions | TC-EXM-* (12) | 1 day | All passing + auto-expiry verified |
| 4 | Standards customization | TC-STD-* (14) | 2 days | Regulatory lock verified |
| 5 | RBAC | TC-RBAC-* (20) | 2 days | All boundaries enforced |
| 6 | Data relationships | TC-DATA-* (8) | 1 day | Cascading effects + isolation verified |
| **Total** | **All** | **97** | **10 days** | **All gates passed** |

### Coverage Goals
- **Line coverage:** >85% of qualification service + router
- **Branch coverage:** >80% (especially error paths)
- **Integration coverage:** All approval workflows (L2, L3, L4, overrides)
- **RBAC coverage:** Every role × every endpoint (5 × 25+ = 125+ boundary tests)

### Testing Tools
- **Vitest** — unit + integration tests
- **Supertest** — HTTP endpoint testing
- **PostgreSQL** — persistent test database (real schema, seeded baseline)
- **Spies** — `vi.spyOn(service, method)` for mocking service logic
- **Factories** — deterministic test data builders

---

## Success Criteria

✅ **All 97 test cases executed and passing**  
✅ **Regulatory requirement lock enforced** (cannot relax, can tighten)  
✅ **All four override types** working with audit trail  
✅ **Dual approval workflow** tested (CO + admin for regulatory)  
✅ **Attestation levels** (L1-L4) with proper satisfaction rules  
✅ **Exemptions** with auto-expiry + cascading effects  
✅ **RBAC boundaries** enforced (no cross-chain, no unauthorized roles)  
✅ **Data relationships** cascading correctly  
✅ **Coverage >85%** for qualification service  

---

## Known Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Dual approval workflow complexity | Overrides hang in limbo if admin unavailable | Implement approval SLA + escalation (to other admin) |
| Cascading requirement changes | 10K+ assignments updated slowly | Batch processing + async jobs |
| Exemption auto-expiry timing | Off-by-one-day errors in expiry logic | Comprehensive timer tests + cron validation |
| RBAC boundary leakage | Supervisor can access out-of-chain employees | Mock reporting chain explicitly in tests |
| Multi-env data isolation | Staging data pollutes production | Test env randomization + explicit partition scoping |

---

## References

- **Locked Decisions:**
  - Decision #4: Regulatory immutable, custom flexible, backend override
  - Decision #5: L1-L4 attestation hierarchy
  - Decision #6: Full overrides with dual approval
- **Related Specs:**
  - `docs/specs/templates-attestation-spec.md` — Template + fulfillment architecture
  - `docs/specs/rbac-api-spec.md` — RBAC permission model
  - `docs/specs/proof-compliance-audit.md` — Audit trail requirements
- **Existing Tests:**
  - `apps/api/tests/qualifications.test.ts` — Current unit tests (15+)
  - `apps/api/tests/templates-integration.test.ts` — Template + fulfillment integration (80)
  - `apps/api/tests/helpers.ts` — Test factories & utilities

---

**End of Specification**

---

*Status: Ready for implementation*  
*Assigned to: Sydnor (Tester)* — Lead test writer + integration test infrastructure  
*Coordination: Squad Lead (Freamon) for issue tracking & dependency management*
