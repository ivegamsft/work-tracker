## Ready-to-Use Master Prompt

You are a senior product architect and compliance systems designer.
Design a workforce readiness and qualification management app for teams in regulated industries.

Business context:
- The app manages people and tracks:
  - Hours of experience
  - Certifications
  - Medical certifications/clearance status
  - Internal eye test results (visual acuity and color blindness)
- For medical data, store only fit-for-duty style status (pass/fail or cleared/not cleared) plus expiration date.
- Do not store detailed medical records or HIPAA-style protected data.
- Workers have different certifications and requirements.
- There are many industry standards; the system must support multiple standards frameworks and map requirements by role and job type.
- The app must auto-record hours tied to specific jobs.
- Hour sources must include:
  - Clock-in/clock-out
  - Timesheet/payroll imports
  - Scheduling/job-ticket sync
  - Labeled calendar sync from any provider that supports OAuth2
  - Manual entry with manager approval
- Feature-specific requirements are defined in separate top-level feature modules.
- The system must support document uploads for certifications and related evidence.
- Include AI support for document processing (OCR/extraction, classification, expiration detection, and standards matching) with human review and approval.
- Primary roles:
  - Supervisor/Manager
  - Employee self-service
  - Compliance/Auditor
- Employee self-service visibility is limited to their own profile/readiness in MVP.
- Launch notifications:
  - Manager escalation for overdue requirements
  - Weekly compliance digest

What to produce:
1. Product Requirements Document:
- Goals, non-goals, user roles, primary workflows, and privacy boundaries.
2. Domain model:
- Entities, fields, relationships, and lifecycle states.
- Include expiration logic and standards-to-requirement mapping.
3. Compliance engine design:
- Rule evaluation model, due/overdue calculation, and exception handling.
4. Hour tracking architecture:
- Ingestion pipeline for all sources, deduplication, reconciliation, and conflict resolution.
- Explain source-of-truth precedence rules.
5. Notification architecture:
- Trigger conditions, escalation paths, weekly digest generation.
6. UX requirements:
- Manager dashboard, employee profile/readiness card, auditor evidence timeline.
7. API and event contracts:
- Core endpoints and events needed for integrations.
8. Label requirements package:
- Define a seed label map, extension rules, alias/synonym handling, versioning, deprecation strategy, migration policy, and backward-compatible reporting behavior across taxonomy versions.
9. AI-assisted document workflow:
- Upload processing pipeline, extraction schema, confidence scoring, review queue, correction flow, and audit logging for AI-suggested values.
10. MVP plan:
- Phased delivery with must-have vs later features.
- Risks, assumptions, and mitigation plan.
11. Test and validation strategy:
- Functional tests, compliance rule tests, data quality checks, and audit-trail verification.
12. Reporting:
- Readiness by team, upcoming expirations, overdue items, hours accumulated by job/role.

Constraints:
- Privacy-first by design.
- Strong auditability (immutable activity log for key compliance changes).
- Role-based access control.
- Keep implementation practical for iterative delivery.
- Support integrations with systems that allow OAuth connections.
- Manager override is allowed only with employee attestation and an auditable reason.
- AI outputs must be reviewable and correctable by humans before final compliance state updates.

Format:
- Use clear sections, decision tables, and acceptance criteria.
- Include explicit assumptions and open questions.
