# Recertification / Requalification Lifecycle

## Problem
Current proof specs define expiration, but they do not define the next-cycle lifecycle that regulated programs actually require. A certification expiration, a training renewal, and a periodic proficiency requalification should not just flip a status to `expired`; they should preserve the prior cycle and open the next obligation in a controlled way.

## Proposed Solution
- Introduce a renewal-cycle model for proof fulfillments.
- Preserve expired fulfillments as immutable historical evidence.
- Create a next-cycle renewal task or fulfillment when a proof approaches expiration or is marked expired.
- Distinguish vocabulary and workflow by obligation type:
  - **renewal** = generic next-cycle action
  - **recertification** = renewing a credential/certification
  - **requalification** = re-establishing competency via assessment/hours/training
- Support warning windows, grace windows, and organization-specific rules by proof type.
- Allow revocation/suspension events to force an immediate next-cycle action even before nominal expiration.

## Priority
High — this is necessary for regulated-industry readiness and audit continuity.

## Impact
This closes the largest lifecycle gap between proof tracking and true compliance operations. It also prevents audit-destructive behavior where expired evidence appears to vanish instead of remaining historically visible.
