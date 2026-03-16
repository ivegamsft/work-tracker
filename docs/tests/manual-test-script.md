# E-CLAT Manual Test Script

## Quick Start

Use **PowerShell** on Windows and call **`curl.exe`** explicitly so you do not hit the built-in `curl` alias.

### Base variables

```powershell
$API = "http://localhost:3000/api"
$WEB = "http://localhost:5173"
$PASSWORD = "Password123!"

function Set-RoleToken([string]$Email) {
  $global:LOGIN = (
    curl.exe -s -X POST "$API/auth/login" `
      -H "Content-Type: application/json" `
      -d "{`"email`":`"$Email`",`"password`":`"$PASSWORD`"}" |
    ConvertFrom-Json
  )

  $global:TOKEN = $LOGIN.accessToken
  $global:REFRESH_TOKEN = $LOGIN.refreshToken
  Write-Host "Using token for $Email"
}
```

### Get a token for each role

```powershell
Set-RoleToken "employee@example.com"
Set-RoleToken "supervisor@example.com"
Set-RoleToken "manager@example.com"
Set-RoleToken "compliance@example.com"
Set-RoleToken "admin@example.com"
```

### Lookup helper IDs once

Use a **supervisor+** token for this block because `GET /api/employees` is restricted.

```powershell
Set-RoleToken "supervisor@example.com"

$EMPLOYEES = curl.exe -s "$API/employees?page=1&limit=10" `
  -H "Authorization: Bearer $TOKEN" |
  ConvertFrom-Json

$AVERY_ID = ($EMPLOYEES.data | Where-Object email -eq "employee@example.com").id
$JORDAN_ID = ($EMPLOYEES.data | Where-Object email -eq "supervisor@example.com").id
$PRIYA_ID = ($EMPLOYEES.data | Where-Object email -eq "manager@example.com").id
$ELENA_ID = ($EMPLOYEES.data | Where-Object email -eq "compliance@example.com").id
$MARCUS_ID = ($EMPLOYEES.data | Where-Object email -eq "admin@example.com").id

$STANDARDS = curl.exe -s "$API/standards?page=1&limit=10" `
  -H "Authorization: Bearer $TOKEN" |
  ConvertFrom-Json

$FAA_ID = ($STANDARDS.data | Where-Object code -eq "FAA-147-RT").id
$OSHA_ID = ($STANDARDS.data | Where-Object code -eq "OSHA-30-GI").id
$HAZCOM_ID = ($STANDARDS.data | Where-Object code -eq "HAZCOM-1910").id
```

### Seed users

| Role | Email | Person | Department |
|---|---|---|---|
| EMPLOYEE | `employee@example.com` | Avery Cole | MX-OPS |
| SUPERVISOR | `supervisor@example.com` | Jordan Nguyen | MX-OPS |
| MANAGER | `manager@example.com` | Priya Shah | MX-PLN |
| COMPLIANCE_OFFICER | `compliance@example.com` | Elena Ramirez | QUALITY |
| ADMIN | `admin@example.com` | Marcus Hill | IT-ADMIN |

### Current-state notes before testing

- Browser UI currently implemented: `/login`, `/`, `/employees`, `/employees/:id`
- The dashboard stats and **View All Employees** quick action should be visible for **SUPERVISOR, MANAGER, COMPLIANCE_OFFICER, and ADMIN**
- **EMPLOYEE** can sign in, view the dashboard, and call self-service APIs, but cannot list the employee directory
- Auth endpoints `register`, `change-password`, and `oauth/callback` are wired but not implemented yet
- The **Hours** module is mounted but currently returns **501 Not Implemented** for business actions
- The **Labels** module is mounted but currently returns **501 Not Implemented**
- Document upload is currently **JSON metadata only**; there is no multipart file upload flow yet
- Document extraction correction is not implemented yet; expect an error response
- In the current web UI, the header/welcome name comes from the **email prefix** (for example, `admin`) rather than the seeded full name

---

## 1. Prerequisites

1. Start the stack.
   - **Docker option**:
     ```powershell
     docker compose up -d
     ```
   - **Local dev option**:
     ```powershell
     npm install
     npm run dev -w @e-clat/api
     npm run dev -w @e-clat/web
     ```
   - **Expected result:** API listens on `http://localhost:3000`, web app on `http://localhost:5173`.

2. Verify health checks.
   ```powershell
   curl.exe -s http://localhost:3000/health
   curl.exe -I http://localhost:5173
   ```
   - **Expected result:** `/health` returns JSON with `status: "ok"`; the web app responds with HTTP 200.

3. Open a clean browser session.
   - Use an incognito/private window, or log out between roles.
   - **Expected result:** Each role test starts without stale local storage or a previous token.

4. Run the **Quick Start** block above.
   - **Expected result:** You can switch roles quickly by resetting `$TOKEN` and `$REFRESH_TOKEN`.

---

## 2. Test Scenario 1: Authentication

### Role
All five seeded roles.

### Steps

1. Open `http://localhost:5173/login` in the browser.
   - **Expected result:** You see the E-CLAT login form with **Email**, **Password**, and a **Login** button.

2. Sign in as **EMPLOYEE** using:
   - Email: `employee@example.com`
   - Password: `Password123!`
   - **Expected result:** You are redirected to `/` and see the protected app shell.

3. Log out.
   - **Expected result:** You return to `/login` and the protected pages are no longer accessible without signing in again.

4. Repeat step 2 for:
   - `supervisor@example.com`
   - `manager@example.com`
   - `compliance@example.com`
   - `admin@example.com`
   - **Expected result:** All five seeded users can sign in successfully with the same password.

5. Validate API login with curl for one role.
   ```powershell
   $LOGIN = curl.exe -s -X POST "$API/auth/login" `
     -H "Content-Type: application/json" `
     -d '{"email":"admin@example.com","password":"Password123!"}' |
     ConvertFrom-Json

   $TOKEN = $LOGIN.accessToken
   $REFRESH_TOKEN = $LOGIN.refreshToken
   $LOGIN
   ```
   - **Expected result:** HTTP 200 with `accessToken`, `refreshToken`, and `expiresIn`.

6. Validate refresh token flow.
   ```powershell
   curl.exe -s -X POST "$API/auth/refresh" `
     -H "Content-Type: application/json" `
     -d "{`"refreshToken`":`"$REFRESH_TOKEN`"}"
   ```
   - **Expected result:** HTTP 200 with a new `accessToken`, a `refreshToken`, and `expiresIn`.

7. Try to browse directly to `/login` while still authenticated.
   - **Expected result:** The app redirects you back to `/`.

---

## 3. Test Scenario 2: Role-Based Dashboard

### Role visibility summary

| Role | Expected dashboard stats | Expected quick action | Expected `/employees` result |
|---|---|---|---|
| EMPLOYEE | **No** stats cards | No **View All Employees** link | Permission message |
| SUPERVISOR | Stats visible | **View All Employees** visible | Employee list loads |
| MANAGER | Stats visible | **View All Employees** visible | Employee list loads |
| COMPLIANCE_OFFICER | Stats visible | **View All Employees** visible | Employee list loads |
| ADMIN | Stats visible | **View All Employees** visible | Employee list loads |

> If you only see the stats card set under **ADMIN**, treat that as a defect. The current RBAC allows **SUPERVISOR, MANAGER, and COMPLIANCE_OFFICER** to load employee stats too.

### Steps

1. Sign in as **EMPLOYEE**.
   - **Expected result:** The dashboard loads, but there is **no stats grid**.
   - **Expected result:** You see the employee-limited message and a note that directory access is for supervisors and above.

2. Click the **Employees** link in the left navigation as **EMPLOYEE**.
   - **Expected result:** The page loads an error/permission state such as **"You don't have permission to view employees"**.

3. Sign in as **SUPERVISOR**.
   - **Expected result:** The dashboard shows:
     - **Total Employees: 5**
     - **Active: 5**
     - **Inactive: 0**
   - **Expected result:** A **View All Employees** quick action is visible.

4. Repeat step 3 as **MANAGER**, **COMPLIANCE_OFFICER**, and **ADMIN**.
   - **Expected result:** The same stats grid and quick action are visible for all three roles.

5. Note the user-name display in the header.
   - **Expected result:** The current UI shows the email prefix (for example, `admin`) rather than the seeded full name (`Marcus Hill`).

---

## 4. Test Scenario 3: Employee Management (UI)

### Role
Use **SUPERVISOR**, **MANAGER**, **COMPLIANCE_OFFICER**, or **ADMIN**. Supervisor is sufficient.

### Steps

1. Sign in as **SUPERVISOR** and open `http://localhost:5173/employees`.
   - **Expected result:** The employee table loads.
   - **Expected result:** The page shows **5** seeded employees.

2. Verify the seeded names are present:
   - Avery Cole
   - Jordan Nguyen
   - Priya Shah
   - Elena Ramirez
   - Marcus Hill
   - **Expected result:** All five appear with the correct email, department, role, and active status.

3. In the search box, search for `MX-OPS`.
   - **Expected result:** Avery Cole and Jordan Nguyen remain visible.

4. Search for `compliance@example.com`.
   - **Expected result:** Only Elena Ramirez remains visible.

5. Search for `Marcus`.
   - **Expected result:** Marcus Hill remains visible.

6. Clear the search and click Avery Cole's row.
   - **Expected result:** You navigate to `/employees/:id`.
   - **Expected result:** The detail page shows the employee name, email, department, role, and a compliance/readiness section.

7. Click the back button.
   - **Expected result:** You return to the employee list.

---

## 5. Test Scenario 4: Employee Readiness (UI + API)

### Role
- **Browser checks:** Use **SUPERVISOR+**
- **Self-service API checks:** **EMPLOYEE** can call readiness, qualifications-by-employee, and medical-by-employee endpoints

### Steps

1. Set a **SUPERVISOR** token and run the helper-ID block from **Quick Start**.
   - **Expected result:** `$AVERY_ID`, `$JORDAN_ID`, `$PRIYA_ID`, `$ELENA_ID`, `$MARCUS_ID`, `$FAA_ID`, `$OSHA_ID`, and `$HAZCOM_ID` are populated.

2. Get Avery's readiness snapshot.
   ```powershell
   Set-RoleToken "employee@example.com"

   curl.exe -s "$API/employees/$AVERY_ID/readiness" `
     -H "Authorization: Bearer $TOKEN"
   ```
   - **Expected result:** HTTP 200.
   - **Expected result:** Response includes:
     - `employeeId`
     - `overallStatus`
     - `qualifications[]`
     - `medicalClearances[]`

3. Verify Avery's seeded readiness facts.
   - **Expected result:** Avery is currently **non_compliant** overall.
   - **Expected result:** Qualifications include:
     - `FAA-147-RT` with an active record but an expired date-driven readiness outcome
     - `OSHA-30-GI` as compliant
     - `HAZCOM-1910` as missing/non-compliant
   - **Expected result:** Medical includes **Respirator Clearance** with expired readiness.

4. Pull Avery's qualifications and medical details directly.
   ```powershell
   curl.exe -s "$API/qualifications/employee/$AVERY_ID" `
     -H "Authorization: Bearer $TOKEN"

   curl.exe -s "$API/medical/employee/$AVERY_ID" `
     -H "Authorization: Bearer $TOKEN"
   ```
   - **Expected result:** Qualifications return an array tied to Avery.
   - **Expected result:** Medical returns Avery's respirator clearance record.

5. In the browser, open Avery's employee detail page and compare the UI to the readiness API response.
   - **Expected result:** The page loads and shows employee identity details.
   - **Expected result:** The compliance section should align with the readiness API. If the card labels or statuses do not line up with the API response, log a defect.

6. Spot-check the other seeded users with `GET /api/employees/:id/readiness`.
   - **Expected result:** Current seed data should make the following users visibly not fully ready:
     - **Jordan Nguyen:** expired/late FAA + expired medical
     - **Priya Shah:** active OSHA, but missing standards and non-clear medical state
     - **Elena Ramirez:** active HAZCOM, but missing other standards and no medical
     - **Marcus Hill:** pending-review HAZCOM plus missing medical/other standards

---

## 6. Test Scenario 5: Qualifications (API)

### Role
Use **SUPERVISOR+**. Supervisor is sufficient.

### Steps

1. Set a **SUPERVISOR** token and ensure `$JORDAN_ID` and `$HAZCOM_ID` are available.
   ```powershell
   Set-RoleToken "supervisor@example.com"
   ```
   - **Expected result:** `$TOKEN` contains a valid supervisor bearer token.

2. Create a qualification for Jordan Nguyen.
   ```powershell
   $QUAL_BODY = @{
     employeeId = $JORDAN_ID
     standardId = $HAZCOM_ID
     certificationName = "Manual Test HAZCOM Qualification"
     issuingBody = "Manual QA Board"
     issueDate = "2026-03-16T00:00:00.000Z"
     expirationDate = "2027-03-16T00:00:00.000Z"
     documentIds = @()
   } | ConvertTo-Json -Depth 4

   $QUAL = curl.exe -s -X POST "$API/qualifications" `
     -H "Authorization: Bearer $TOKEN" `
     -H "Content-Type: application/json" `
     -d $QUAL_BODY |
     ConvertFrom-Json

   $QUAL_ID = $QUAL.id
   $QUAL
   ```
   - **Expected result:** HTTP 201.
   - **Expected result:** Response includes a new qualification `id`, Jordan's `employeeId`, HAZCOM `standardId`, and status `active`.

3. Check compliance for Jordan against HAZCOM before updating it.
   ```powershell
   curl.exe -s "$API/qualifications/compliance/$JORDAN_ID/$HAZCOM_ID" `
     -H "Authorization: Bearer $TOKEN"
   ```
   - **Expected result:** HTTP 200.
   - **Expected result:** `compliant` should be `true` if the just-created active qualification satisfies the standard.

4. Update the qualification.
   ```powershell
   $QUAL_UPDATE = @{
     certificationName = "Manual Test HAZCOM Qualification - Updated"
     status = "suspended"
   } | ConvertTo-Json

   curl.exe -s -X PUT "$API/qualifications/$QUAL_ID" `
     -H "Authorization: Bearer $TOKEN" `
     -H "Content-Type: application/json" `
     -d $QUAL_UPDATE
   ```
   - **Expected result:** HTTP 200.
   - **Expected result:** The qualification now shows the updated certification name and `status: "suspended"`.

5. Re-run compliance.
   ```powershell
   curl.exe -s "$API/qualifications/compliance/$JORDAN_ID/$HAZCOM_ID" `
     -H "Authorization: Bearer $TOKEN"
   ```
   - **Expected result:** If there is no other active/expiring-soon HAZCOM qualification for Jordan, `compliant` should now become `false`.

6. Read the audit trail.
   ```powershell
   curl.exe -s "$API/qualifications/$QUAL_ID/audit" `
     -H "Authorization: Bearer $TOKEN"
   ```
   - **Expected result:** HTTP 200 with an array of audit entries.
   - **Expected result:** You should see create/update history for the qualification.

---

## 7. Test Scenario 6: Medical Clearances (API)

### Role
Use **SUPERVISOR+**. Supervisor is sufficient.

### Steps

1. Set a **SUPERVISOR** token and ensure `$PRIYA_ID` is available.
   ```powershell
   Set-RoleToken "supervisor@example.com"
   ```
   - **Expected result:** `$TOKEN` contains a valid supervisor bearer token.

2. Create a new medical clearance for Priya Shah.
   ```powershell
   $MED_BODY = @{
     employeeId = $PRIYA_ID
     clearanceType = "Manual Test Occupational Clearance"
     status = "cleared"
     effectiveDate = "2026-03-16T00:00:00.000Z"
     expirationDate = "2027-03-16T00:00:00.000Z"
     visualAcuityResult = "pass"
     colorVisionResult = "pass"
     issuedBy = "Manual QA Clinic"
   } | ConvertTo-Json

   $MED = curl.exe -s -X POST "$API/medical" `
     -H "Authorization: Bearer $TOKEN" `
     -H "Content-Type: application/json" `
     -d $MED_BODY |
     ConvertFrom-Json

   $MED_ID = $MED.id
   $MED
   ```
   - **Expected result:** HTTP 201.
   - **Expected result:** Response includes a new clearance `id`, Priya's `employeeId`, and status `cleared`.

3. Update the medical clearance.
   ```powershell
   $MED_UPDATE = @{
     status = "restricted"
     visualAcuityResult = "fail"
     colorVisionResult = "pass"
   } | ConvertTo-Json

   curl.exe -s -X PUT "$API/medical/$MED_ID" `
     -H "Authorization: Bearer $TOKEN" `
     -H "Content-Type: application/json" `
     -d $MED_UPDATE
   ```
   - **Expected result:** HTTP 200.
   - **Expected result:** The updated record shows `status: "restricted"`, `visualAcuityResult: "fail"`, and `colorVisionResult: "pass"`.

4. Get the record by ID.
   ```powershell
   curl.exe -s "$API/medical/$MED_ID" `
     -H "Authorization: Bearer $TOKEN"
   ```
   - **Expected result:** HTTP 200 with full medical-clearance detail for the new record.

5. Read the audit trail.
   ```powershell
   curl.exe -s "$API/medical/$MED_ID/audit" `
     -H "Authorization: Bearer $TOKEN"
   ```
   - **Expected result:** HTTP 200 with an audit array showing create/update history.

---

## 8. Test Scenario 7: Hours Tracking (API)

### Role
- **EMPLOYEE:** clock-in, clock-out, manual entry
- **SUPERVISOR:** imports
- **MANAGER:** conflicts

### Important expectation
The routes are present and RBAC/validation is active, but the current business logic returns **501 Not Implemented**. This scenario verifies the current boundary behavior.

### Steps

1. Try clock-in as **EMPLOYEE**.
   ```powershell
   Set-RoleToken "employee@example.com"

   $CLOCK_IN = @{
     employeeId = $AVERY_ID
   } | ConvertTo-Json

   curl.exe -i -s -X POST "$API/hours/clock-in" `
     -H "Authorization: Bearer $TOKEN" `
     -H "Content-Type: application/json" `
     -d $CLOCK_IN
   ```
   - **Expected result:** HTTP **501 Not Implemented**.

2. Try clock-out as **EMPLOYEE**.
   ```powershell
   $CLOCK_OUT = @{
     employeeId = $AVERY_ID
   } | ConvertTo-Json

   curl.exe -i -s -X POST "$API/hours/clock-out" `
     -H "Authorization: Bearer $TOKEN" `
     -H "Content-Type: application/json" `
     -d $CLOCK_OUT
   ```
   - **Expected result:** HTTP **501 Not Implemented**.

3. Try manual entry as **EMPLOYEE**.
   ```powershell
   $MANUAL_HOURS = @{
     employeeId = $AVERY_ID
     date = "2026-03-16T00:00:00.000Z"
     hours = 4
     qualificationCategory = "airframe_maintenance"
     description = "Manual test hour entry"
     attestation = "I attest this entry is accurate."
   } | ConvertTo-Json

   curl.exe -i -s -X POST "$API/hours/manual" `
     -H "Authorization: Bearer $TOKEN" `
     -H "Content-Type: application/json" `
     -d $MANUAL_HOURS
   ```
   - **Expected result:** HTTP **501 Not Implemented** after the payload passes validation.

4. Try payroll import as **SUPERVISOR**.
   ```powershell
   Set-RoleToken "supervisor@example.com"

   $PAYROLL_IMPORT = @{
     sourceSystemId = "manual-test-payroll"
     records = @(
       @{
         employeeId = $AVERY_ID
         date = "2026-03-16T00:00:00.000Z"
         hours = 8
         qualificationCategory = "airframe_maintenance"
         description = "Imported payroll record"
       }
     )
   } | ConvertTo-Json -Depth 5

   curl.exe -i -s -X POST "$API/hours/import/payroll" `
     -H "Authorization: Bearer $TOKEN" `
     -H "Content-Type: application/json" `
     -d $PAYROLL_IMPORT
   ```
   - **Expected result:** HTTP **501 Not Implemented**.

5. Try conflicts list as **MANAGER**.
   ```powershell
   Set-RoleToken "manager@example.com"

   curl.exe -i -s "$API/hours/conflicts?page=1&limit=10" `
     -H "Authorization: Bearer $TOKEN"
   ```
   - **Expected result:** HTTP **501 Not Implemented**.

6. Optional RBAC check: try conflicts list as **EMPLOYEE**.
   ```powershell
   Set-RoleToken "employee@example.com"

   curl.exe -i -s "$API/hours/conflicts?page=1&limit=10" `
     -H "Authorization: Bearer $TOKEN"
   ```
   - **Expected result:** HTTP **403 Forbidden** because conflict management is manager-only.

---

## 9. Test Scenario 8: Document Management (API)

### Role
- **EMPLOYEE:** upload and read document/extraction
- **MANAGER:** review queue and review actions
- **SUPERVISOR+:** audit trail

### Important expectation
The current upload endpoint accepts **JSON metadata only**. Use a unique file name each time; no multipart file payload is required yet.

### Steps

1. Upload a document as **EMPLOYEE**.
   ```powershell
   Set-RoleToken "employee@example.com"

   $STAMP = Get-Date -Format "yyyyMMddHHmmss"
   $DOC_BODY = @{
     employeeId = $AVERY_ID
     fileName = "manual-test-$STAMP.pdf"
     mimeType = "application/pdf"
     description = "Manual test upload"
   } | ConvertTo-Json

   $DOC = curl.exe -s -X POST "$API/documents/upload" `
     -H "Authorization: Bearer $TOKEN" `
     -H "Content-Type: application/json" `
     -d $DOC_BODY |
     ConvertFrom-Json

   $DOC_ID = $DOC.id
   $DOC
   ```
   - **Expected result:** HTTP 201.
   - **Expected result:** The response includes `id`, `employeeId`, `fileName`, `mimeType`, and `status: "uploaded"`.

2. Read the document back.
   ```powershell
   curl.exe -s "$API/documents/$DOC_ID" `
     -H "Authorization: Bearer $TOKEN"
   ```
   - **Expected result:** HTTP 200 with the same document metadata.

3. Read extraction results.
   ```powershell
   curl.exe -s "$API/documents/$DOC_ID/extraction" `
     -H "Authorization: Bearer $TOKEN"
   ```
   - **Expected result:** HTTP 200 with `[]` until OCR/extraction is implemented.

4. Open the review queue as **MANAGER**.
   ```powershell
   Set-RoleToken "manager@example.com"

   curl.exe -s "$API/documents/review-queue?page=1&limit=10" `
     -H "Authorization: Bearer $TOKEN"
   ```
   - **Expected result:** HTTP 200 with `data`, `total`, `page`, and `limit`.
   - **Expected result:** The uploaded document appears in the queue with `status: "pending"`.

5. Approve the document as **MANAGER**.
   ```powershell
   $DOC_REVIEW = @{
     action = "approve"
     notes = "Approved during manual test"
   } | ConvertTo-Json

   curl.exe -s -X POST "$API/documents/$DOC_ID/review" `
     -H "Authorization: Bearer $TOKEN" `
     -H "Content-Type: application/json" `
     -d $DOC_REVIEW
   ```
   - **Expected result:** HTTP 200.
   - **Expected result:** The response is a review-queue item showing an approved review action.

6. Try extraction correction as **MANAGER**.
   ```powershell
   $CORRECTION = @{
     correctedValue = "Corrected test value"
   } | ConvertTo-Json

   curl.exe -i -s -X PUT "$API/documents/$DOC_ID/extraction/field-1/correct" `
     -H "Authorization: Bearer $TOKEN" `
     -H "Content-Type: application/json" `
     -d $CORRECTION
   ```
   - **Expected result:** Error response because extraction correction is not implemented yet.
   - **Expected result:** Treat a 400-style validation/business error here as the current expected result.

7. Read the audit trail as **SUPERVISOR**.
   ```powershell
   Set-RoleToken "supervisor@example.com"

   curl.exe -s "$API/documents/$DOC_ID/audit" `
     -H "Authorization: Bearer $TOKEN"
   ```
   - **Expected result:** HTTP 200 with an audit array covering the upload/review activity.

---

## 10. Test Scenario 9: Standards Management (API)

### Role
Use **ADMIN**.

### Steps

1. Set an **ADMIN** token.
   ```powershell
   Set-RoleToken "admin@example.com"
   ```
   - **Expected result:** `$TOKEN` contains a valid admin token.

2. List existing standards.
   ```powershell
   curl.exe -s "$API/standards?page=1&limit=10" `
     -H "Authorization: Bearer $TOKEN"
   ```
   - **Expected result:** HTTP 200 with the three seeded standards:
     - `FAA-147-RT`
     - `OSHA-30-GI`
     - `HAZCOM-1910`

3. Create a new standard.
   ```powershell
   $STAMP = Get-Date -Format "yyyyMMddHHmmss"
   $STANDARD_CODE = "MT-STD-$STAMP"

   $STANDARD_BODY = @{
     code = $STANDARD_CODE
     name = "Manual Test Standard $STAMP"
     description = "Manual test standard for API verification"
     issuingBody = "Manual QA Board"
     version = "1.0"
   } | ConvertTo-Json

   $STANDARD = curl.exe -s -X POST "$API/standards" `
     -H "Authorization: Bearer $TOKEN" `
     -H "Content-Type: application/json" `
     -d $STANDARD_BODY |
     ConvertFrom-Json

   $STANDARD_ID = $STANDARD.id
   $STANDARD
   ```
   - **Expected result:** HTTP 201 with a new standard `id` and `isActive: true`.

4. Update the standard.
   ```powershell
   $STANDARD_UPDATE = @{
     name = "Manual Test Standard Updated"
     version = "1.1"
     isActive = $false
   } | ConvertTo-Json

   curl.exe -s -X PUT "$API/standards/$STANDARD_ID" `
     -H "Authorization: Bearer $TOKEN" `
     -H "Content-Type: application/json" `
     -d $STANDARD_UPDATE
   ```
   - **Expected result:** HTTP 200 with the updated name/version and `isActive: false`.

5. Add a requirement to the standard.
   ```powershell
   $REQ_BODY = @{
     category = "Manual Test Category"
     description = "Manual test requirement"
     minimumHours = 12
     recertificationPeriodMonths = 24
     requiredTests = @("written review", "practical assessment")
   } | ConvertTo-Json -Depth 4

   $REQ = curl.exe -s -X POST "$API/standards/$STANDARD_ID/requirements" `
     -H "Authorization: Bearer $TOKEN" `
     -H "Content-Type: application/json" `
     -d $REQ_BODY |
     ConvertFrom-Json

   $REQ_ID = $REQ.id
   $REQ
   ```
   - **Expected result:** HTTP 201 with a new requirement tied to `$STANDARD_ID`.

6. Update the requirement.
   ```powershell
   $REQ_UPDATE = @{
     description = "Manual test requirement updated"
     minimumHours = 18
     recertificationPeriodMonths = 36
     requiredTests = @("scenario evaluation")
   } | ConvertTo-Json -Depth 4

   curl.exe -s -X PUT "$API/standards/requirements/$REQ_ID" `
     -H "Authorization: Bearer $TOKEN" `
     -H "Content-Type: application/json" `
     -d $REQ_UPDATE
   ```
   - **Expected result:** HTTP 200 with the updated requirement data.

7. List requirements for the new standard.
   ```powershell
   curl.exe -s "$API/standards/$STANDARD_ID/requirements" `
     -H "Authorization: Bearer $TOKEN"
   ```
   - **Expected result:** HTTP 200 with an array containing the requirement you created.

---

## 11. Test Scenario 10: Notifications (API)

### Role
- **Any authenticated role:** preferences, list, read, dismiss, digest
- **ADMIN:** test notification and escalation rules

### Steps

1. Read current preferences as **EMPLOYEE**.
   ```powershell
   Set-RoleToken "employee@example.com"

   curl.exe -s "$API/notifications/preferences" `
     -H "Authorization: Bearer $TOKEN"
   ```
   - **Expected result:** HTTP 200.
   - **Expected result:** Response is an array of notification preferences.
   - **Expected result:** If no preferences were saved yet, you should still get the default set of notification types.

2. Save preferences as **EMPLOYEE**.
   ```powershell
   $PREFS_BODY = @{
     preferences = @(
       @{
         notificationType = "expiring_soon"
         channels = @("in_app", "email")
         isEnabled = $true
         frequency = "daily"
       },
       @{
         notificationType = "weekly_compliance_digest"
         channels = @("in_app")
         isEnabled = $true
         frequency = "weekly"
       }
     )
   } | ConvertTo-Json -Depth 6

   curl.exe -s -X POST "$API/notifications/preferences" `
     -H "Authorization: Bearer $TOKEN" `
     -H "Content-Type: application/json" `
     -d $PREFS_BODY
   ```
   - **Expected result:** HTTP 200 with the saved preference array.

3. Get the weekly digest.
   ```powershell
   curl.exe -s "$API/notifications/digest/weekly" `
     -H "Authorization: Bearer $TOKEN"
   ```
   - **Expected result:** HTTP 200 with `overdueCount`, `expiringThisWeek`, `pendingReviews`, `recentApprovals`, and `generatedAt`.

4. Send a test notification as **ADMIN**.
   ```powershell
   Set-RoleToken "admin@example.com"

   curl.exe -s -X POST "$API/notifications/admin/test" `
     -H "Authorization: Bearer $TOKEN"
   ```
   - **Expected result:** HTTP 200 with `{ "sent": true }`.

5. List notifications as **ADMIN**.
   ```powershell
   $NOTIFICATIONS = curl.exe -s "$API/notifications?page=1&limit=10" `
     -H "Authorization: Bearer $TOKEN" |
     ConvertFrom-Json

   $NOTIFICATION_ID = $NOTIFICATIONS.data[0].id
   $NOTIFICATIONS
   ```
   - **Expected result:** HTTP 200 with a paginated list.
   - **Expected result:** The test notification appears near the top.

6. Mark the notification as read.
   ```powershell
   curl.exe -s -X PUT "$API/notifications/$NOTIFICATION_ID/read" `
     -H "Authorization: Bearer $TOKEN"
   ```
   - **Expected result:** HTTP 200 with the same notification now showing `status: "read"`.

7. Dismiss the notification.
   ```powershell
   curl.exe -i -s -X DELETE "$API/notifications/$NOTIFICATION_ID" `
     -H "Authorization: Bearer $TOKEN"
   ```
   - **Expected result:** HTTP **204 No Content**.

8. Optional admin-only escalation-rule check.
   ```powershell
   $RULE_BODY = @{
     trigger = "expiring_soon"
     delayHours = 24
     escalateToRole = "supervisor"
     maxEscalations = 3
   } | ConvertTo-Json

   curl.exe -s -X POST "$API/notifications/admin/escalation-rules" `
     -H "Authorization: Bearer $TOKEN" `
     -H "Content-Type: application/json" `
     -d $RULE_BODY

   curl.exe -s "$API/notifications/admin/escalation-rules" `
     -H "Authorization: Bearer $TOKEN"
   ```
   - **Expected result:** Create returns HTTP 201 and list returns HTTP 200 with the new rule present.

---

## 12. Test Scenario 11: Negative Tests

### Role
Use the role called out in each step.

### Steps

1. Wrong password on login.
   ```powershell
   curl.exe -i -s -X POST "$API/auth/login" `
     -H "Content-Type: application/json" `
     -d '{"email":"employee@example.com","password":"WrongPassword!"}'
   ```
   - **Expected result:** HTTP **401 Unauthorized**.

2. Invalid login payload.
   ```powershell
   curl.exe -i -s -X POST "$API/auth/login" `
     -H "Content-Type: application/json" `
     -d '{"email":"not-an-email","password":"Password123!"}'
   ```
   - **Expected result:** HTTP **400 Bad Request**.

3. Unauthenticated access to a protected endpoint.
   ```powershell
   curl.exe -i -s "$API/standards?page=1&limit=10"
   ```
   - **Expected result:** HTTP **401 Unauthorized**.

4. Employee trying to list employees.
   ```powershell
   Set-RoleToken "employee@example.com"

   curl.exe -i -s "$API/employees?page=1&limit=10" `
     -H "Authorization: Bearer $TOKEN"
   ```
   - **Expected result:** HTTP **403 Forbidden**.

5. Browser RBAC check for employee directory.
   - Sign in as **EMPLOYEE** and browse to `http://localhost:5173/employees`.
   - **Expected result:** The page shows the permission error state instead of the table.

6. Invalid qualification data: expiration earlier than issue date.
   ```powershell
   Set-RoleToken "supervisor@example.com"

   $BAD_QUAL = @{
     employeeId = $AVERY_ID
     standardId = $HAZCOM_ID
     certificationName = "Invalid qualification"
     issuingBody = "Manual QA"
     issueDate = "2026-03-16T00:00:00.000Z"
     expirationDate = "2026-03-15T00:00:00.000Z"
     documentIds = @()
   } | ConvertTo-Json -Depth 4

   curl.exe -i -s -X POST "$API/qualifications" `
     -H "Authorization: Bearer $TOKEN" `
     -H "Content-Type: application/json" `
     -d $BAD_QUAL
   ```
   - **Expected result:** HTTP **400 Bad Request**.

7. Invalid medical data: expiration earlier than effective date.
   ```powershell
   $BAD_MED = @{
     employeeId = $AVERY_ID
     clearanceType = "Invalid medical"
     status = "cleared"
     effectiveDate = "2026-03-16T00:00:00.000Z"
     expirationDate = "2026-03-15T00:00:00.000Z"
     visualAcuityResult = "pass"
     colorVisionResult = "pass"
     issuedBy = "Manual QA Clinic"
   } | ConvertTo-Json

   curl.exe -i -s -X POST "$API/medical" `
     -H "Authorization: Bearer $TOKEN" `
     -H "Content-Type: application/json" `
     -d $BAD_MED
   ```
   - **Expected result:** HTTP **400 Bad Request**.

8. Supervisor trying to create a standard.
   ```powershell
   Set-RoleToken "supervisor@example.com"

   $BAD_STANDARD = @{
     code = "RBAC-NEG-001"
     name = "Should Fail"
     description = "Supervisor should not be able to create this"
     issuingBody = "Manual QA"
     version = "1.0"
   } | ConvertTo-Json

   curl.exe -i -s -X POST "$API/standards" `
     -H "Authorization: Bearer $TOKEN" `
     -H "Content-Type: application/json" `
     -d $BAD_STANDARD
   ```
   - **Expected result:** HTTP **403 Forbidden**.

9. Extraction correction before OCR exists.
   ```powershell
   Set-RoleToken "manager@example.com"

   $BAD_CORRECTION = @{
     correctedValue = "Attempt correction"
   } | ConvertTo-Json

   curl.exe -i -s -X PUT "$API/documents/$DOC_ID/extraction/field-1/correct" `
     -H "Authorization: Bearer $TOKEN" `
     -H "Content-Type: application/json" `
     -d $BAD_CORRECTION
   ```
   - **Expected result:** Error response because OCR correction is not implemented yet.

10. Check an explicitly unimplemented auth endpoint.
    ```powershell
    Set-RoleToken "admin@example.com"

    $CHANGE_PASSWORD = @{
      currentPassword = "Password123!"
      newPassword = "Password123!"
    } | ConvertTo-Json

    curl.exe -i -s -X POST "$API/auth/change-password" `
      -H "Authorization: Bearer $TOKEN" `
      -H "Content-Type: application/json" `
      -d $CHANGE_PASSWORD
    ```
    - **Expected result:** HTTP **501 Not Implemented**.

11. Check the labels module.
    ```powershell
    curl.exe -i -s "$API/labels/versions" `
      -H "Authorization: Bearer $TOKEN"
    ```
    - **Expected result:** HTTP **501 Not Implemented**.

12. Check an hours endpoint that should still be unimplemented.
    ```powershell
    Set-RoleToken "employee@example.com"

    $CLOCK_IN = @{
      employeeId = $AVERY_ID
    } | ConvertTo-Json

    curl.exe -i -s -X POST "$API/hours/clock-in" `
      -H "Authorization: Bearer $TOKEN" `
      -H "Content-Type: application/json" `
      -d $CLOCK_IN
    ```
    - **Expected result:** HTTP **501 Not Implemented**.

---

## Suggested defect-capture notes

When you find an issue, capture:

- Role used
- Browser page or API endpoint
- Exact request payload (if API)
- Actual result
- Expected result from this script
- Screenshot or response body
- Whether it is a true bug vs. an expected current-state `501`/placeholder response
