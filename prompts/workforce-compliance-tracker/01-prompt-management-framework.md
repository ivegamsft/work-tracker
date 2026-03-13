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
