## Plan: Workforce Compliance Tracker Prompt

Create one reusable master prompt that generates a full product blueprint for your app: requirements, data model, workflows, notifications, and MVP backlog, while explicitly excluding sensitive medical records.

## Prompt Management Framework

Use a layered structure so the master prompt remains stable while feature prompts can evolve independently.

Framework layers:
1. Master Prompt (Level 0): product vision, boundaries, shared constraints, and global outputs.
2. Feature Modules (Level 1): one section per top-level feature with explicit requirements and outputs.
3. Capability Specs (Level 2): focused specs inside each feature (for example reconciliation or attestation).
4. Delivery Units (Level 3): stories, acceptance criteria, tasks, tests, and release notes.

Lifecycle for each feature module:
1. Draft
2. Review
3. Approved
4. In Delivery
5. Stabilized

Governance rules:
1. Every feature module must reference the master prompt assumptions it extends.
2. Breaking changes require version bump plus migration notes.
3. Each module must maintain a decision log with owner, date, and rationale.
4. Each module must include explicit out-of-scope items.

Feature module template:
1. Intent and scope
2. In-scope and out-of-scope
3. Requirements
4. Data model additions/changes
5. Business rules and edge cases
6. API/events and integration contracts
7. UX states and permissions
8. AI behavior and human review rules (if applicable)
9. Acceptance criteria
10. Test matrix
11. Rollout and migration
12. Decision log

**Steps**
1. Lock scope boundaries:
- Track people, roles, certifications, medical clearance status (fit-for-duty only), internal eye exams (visual acuity and color blindness), job assignments, and hours.
- Exclude protected medical details and document storage beyond simple clearance status + expiration.
2. Define compliance logic:
- Multiple standards frameworks and mappings by role/job.
- Due, expiring, overdue status for each requirement.
3. Define data model:
- Person, Role, Certification, Standard, Requirement Mapping, Eye Exam, Fit-for-Duty Status, Job Assignment, Hour Log, Audit Trail.
4. Define hour automation:
- Clock-in/out, payroll/timesheet import, scheduling/job-ticket sync, manual entry with approval, and labeled calendar sync.
5. Define notifications:
- Manager escalation for overdue items and weekly compliance digest.
6. Generate execution artifacts:
- PRD, user stories, acceptance criteria, API/event contracts, reporting/dashboard requirements, phased backlog.
7. Validate:
- Privacy boundary checks, auditability, and conflict-resolution rules for mixed hour sources.

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

## Feature Module: Label Taxonomy and Mapping

Intent and scope:
- Define how labels are created, governed, mapped to hour categories, versioned, and used in reporting and integrations.

Requirements:
- The system must support configurable, extensible label definitions and label-to-hour-category mappings (for example: billable, training, field work, safety, admin, overtime).
- Label taxonomy must be versioned so admins can add, deprecate, merge, split, and alias labels over time without breaking historical reporting.
- Label governance must include status states (active, deprecated), effective dates, and migration rules between taxonomy versions.
- Reporting must preserve historical label meaning at the time of capture while supporting normalized rollups to current categories.
- Integrations must support inbound label mapping tables and fallback handling for unknown labels.

Outputs expected from this module:
1. Seed label map
2. Extension and governance rules
3. Alias/synonym strategy
4. Deprecation and migration policy
5. Backward-compatible reporting behavior
6. API and event contracts for label administration and resolution

## Feature Module: Hour Capture and Reconciliation

Intent and scope:
- Define ingestion and reconciliation rules across all hour sources.

Requirements:
- Support clock-in/clock-out, timesheet/payroll import, scheduling/job-ticket sync, OAuth calendar labels, and manual entry.
- Define deterministic source precedence and conflict-resolution policy.
- Manager override must require employee attestation and an auditable reason.
- Preserve immutable audit history for edits and overrides.

Outputs expected from this module:
1. Ingestion architecture and source contracts
2. Reconciliation rules and precedence matrix
3. Exception and attestation workflow
4. Audit and reporting behavior

## Feature Module: Document Uploads and AI Review

Intent and scope:
- Define upload handling and AI-assisted extraction/validation with human approval before compliance state updates.

Requirements:
- Support document uploads for certifications and related evidence.
- AI must provide OCR/extraction, classification, expiration detection, and standards matching suggestions.
- AI outputs must include confidence scoring and be reviewable/correctable by humans.
- No automatic final compliance status change without approved human review.

Outputs expected from this module:
1. Upload processing pipeline
2. Extraction schema and confidence policy
3. Human review queue and correction flow
4. Audit logging and traceability model

## Feature Module: Access, Visibility, and Notifications

Intent and scope:
- Define role-based access, employee visibility boundaries, and escalation communications.

Requirements:
- Employee self-service is limited to own profile/readiness in MVP.
- Supervisor/Manager and Compliance/Auditor permissions must be explicit by action.
- Notifications must include manager escalation for overdue requirements and weekly compliance digest.

Outputs expected from this module:
1. Permission matrix by role and action
2. Notification trigger definitions and escalation policy
3. Weekly digest contract and schedule

## Suggestions

1. Start with one canonical requirement engine, then plug standards frameworks into it via mappings.
2. Make hour-source reconciliation explicit early, because mixed sources will create disputes.
3. Treat calendar sync as read-only in MVP to reduce complexity and trust risk.
4. Add an audit timeline view from day one; it will save time during compliance checks.

## Decisions for This Iteration

1. Integrations: include all source systems that support OAuth connections.
2. Labels: define and map labels to hour categories as a configurable, extensible admin taxonomy.
3. Conflicts and exceptions: manager override is supported with required employee attestation.
4. Documents and intelligence: enable uploads and include AI-assisted extraction/validation workflow.
5. Employee visibility: employee users can view only their own records in MVP.
