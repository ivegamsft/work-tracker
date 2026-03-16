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
