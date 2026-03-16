# Evidence Package Sharing

## Problem
The current sharing concepts mix zero-knowledge proof storage with external share-link access in a way that risks breaking the vault's security posture. Regulated organizations need external disclosure, but they also need that disclosure to be deliberate, reviewable, and separate from raw employee-owned vault content.

## Proposed Solution
- Introduce an explicit **evidence package** concept for external disclosure.
- Allow compliance users to assemble approved proofs into a package with purpose, audience, expiration, and retention metadata.
- Keep internal sharing based on re-encryption and RBAC.
- Keep external sharing limited to generated packages or approved non-vault documents.
- Require package-level audit records, access logging, and optional approval gates for sensitive content.
- Support redaction and package composition rules so external auditors receive only the minimum necessary evidence.

## Priority
Medium-High — this unblocks safe sharing without weakening zero-knowledge storage promises.

## Impact
This resolves a major architectural contradiction before implementation hardens around the wrong external-sharing model. It also creates a cleaner compliance story for auditors and regulated customers.
