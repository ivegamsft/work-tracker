# Issuer / Registry Verification Integrations

## Problem
The specs correctly identify third-party verification (L3), but they stop short of defining how authoritative issuer checks actually work. Without a provider model, source hierarchy, and canonical verification response, `third_party` remains a label rather than a trustworthy compliance mechanism.

## Proposed Solution
- Define a provider registry for verification sources such as state licensing boards, background-check providers, LMS systems, and government registries.
- Establish trust tiers for sources: authoritative registry, delegated provider, employer-supplied evidence, and offline/manual verification.
- Normalize verification payloads into a common structure including source, subject, match confidence, status, timestamp, expiry, and raw reference ID.
- Specify retry, outage, mismatch, and manual-escalation rules.
- Require audit linkage for all issuer checks, including the query made, the response summary, and the actor/system that initiated it.
- Distinguish proof types that may use L3 optionally from those where L3 is the preferred or required path.

## Priority
High — L3 is central to trusted proofs in healthcare, transportation, aviation, finance, and nuclear workflows.

## Impact
This turns third-party verification into a governable compliance capability instead of an implementation placeholder. It also reduces future rework when external integrations begin.
