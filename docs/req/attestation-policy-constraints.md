# Attestation Policy Constraints

## Problem
The current proof specs define the four attestation levels and allow compound combinations, but they do not define a normative policy matrix for which combinations are valid per proof type. They also do not fully define separation-of-duties constraints for Level 4 validation.

## Proposed Solution
- Define allowed and disallowed attestation combinations by proof type.
- Require `clearance` proofs to use authoritative evidence; prohibit `self_attest`-only clearance.
- Normalize compound attestation combinations as unordered, unique sets.
- Define when `validated` is optional, recommended, or mandatory.
- Require separation of duties for internal validation: the validating actor cannot validate their own proof.
- Define whether supervisors may submit on behalf of employees and how those submissions are labeled in audit records.
- Require validator notes/reason codes for approvals that override mismatches or approve manual uploads.

## Priority
Critical — this is a core compliance control, not a UX enhancement.

## Impact
This prevents policy-invalid proofs from being accepted and gives engineering a deterministic ruleset to encode in Prisma, Zod, and service logic. It also reduces regulatory ambiguity around what counts as trustworthy evidence.
