# Audit Trail, Retention, and Revocation Requirements

## Problem
Current proof specs emphasize auditability, but they do not yet define immutable retention behavior for expired proofs or a standard response to revocation/suspension events. Clearing evidence on expiry or failing to propagate revocations would create serious compliance risk.

## Proposed Solution
- Require expired fulfillments to remain historically visible with their original evidence timestamps and references.
- Define retention windows for proof evidence, approval records, third-party responses, and exported evidence packages.
- Introduce revocation/suspension handling that can immediately invalidate current-cycle readiness without deleting prior evidence.
- Require every approval, rejection, manual override, third-party verification, and export action to create a linked audit event.
- Define minimum fields for proof audit records: actor, action, rationale, source, affected proof cycle, and related evidence IDs.
- Require proof history to support regulator-facing reconstruction of who knew what, when, and why a person was considered compliant at a given point in time.

## Priority
Critical — regulated customers will expect this behavior from day one.

## Impact
This protects the platform against audit gaps, preserves defensible evidence history, and creates the foundation for trustworthy renewal/revocation workflows.
