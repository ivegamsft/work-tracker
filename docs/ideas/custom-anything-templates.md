# Custom "Anything" Templates

## Problem

E-CLAT ships with structured proof types (hours, certifications, training, clearances, assessments, compliance) and an industry template catalog. But regulated organizations also need to track sign-offs on items that don't fit neatly into those categories — policies, ethics declarations, data protection agreements, codes of conduct, training acknowledgments, and more.

Today there's no way for an org admin to define a completely free-form template that says "everyone in Group X must acknowledge Document Y by Date Z."

## Proposal

Allow tenant admins to create **custom templates** for _anything_ that requires employee acknowledgment, sign-off, or proof of completion. These templates are not bound to a specific proof type — they are generic containers with configurable requirements.

## Use Cases

| Template | What It Tracks | Typical Cadence |
|----------|---------------|-----------------|
| Annual policy acknowledgment | Employee read & signed the company handbook | Yearly |
| Ethics declaration | Conflict-of-interest and ethics disclosure | Yearly |
| Data protection / GDPR training | Proof of GDPR or privacy training completion | Yearly or on-hire |
| Code of conduct | Signed code of conduct agreement | On-hire + yearly refresh |
| IT acceptable use policy | Acknowledgment of IT usage policies | On-hire |
| Safety briefing acknowledgment | Site-specific safety orientation sign-off | On-hire + per-site |
| NDA / confidentiality agreement | Signed NDA for project or department | Per-assignment |
| Return-to-work acknowledgment | Post-leave compliance sign-off | Event-driven |
| Emergency contact update | Confirmed emergency contact info is current | Yearly |
| Travel policy acknowledgment | Read and accepted travel & expense policy | On-hire or on-change |
| Whistleblower policy | Acknowledgment of reporting procedures | Yearly |
| Custom training record | Any internal training not covered by a standard | Ad hoc |

## Template Schema

```yaml
name: "Annual Ethics Declaration"
category: "policy"                    # or "training", "acknowledgment", "custom"
description: "Employee declares no conflicts of interest"
proof_type: "acknowledgment"          # new generic type
attestation_level: "self_attest"      # L1 — employee signs; or "upload" (L2) if doc needed
requires_signature: true              # digital signature capture
requires_document_upload: false       # optional attachment
recurrence:
  type: "calendar"                    # "calendar" | "event" | "one-time"
  interval: "yearly"                  # "yearly" | "quarterly" | "monthly" | "on-hire" | "custom"
  anchor_date: "2026-01-01"          # when the cycle starts
  grace_period_days: 30              # time after due date before escalation
applicability:
  scope: "all"                       # "all" | "group" | "department" | "role" | "individual"
  groups: []                         # group IDs if scoped
  roles: []                          # role filters if scoped
content:
  body_markdown: |                   # the actual policy/declaration text
    I hereby declare that I have no undisclosed conflicts of interest...
  external_url: null                 # link to external document (SharePoint, etc.)
  version: "2026.1"                  # content versioning — new version = re-sign required
override:
  allow_exemption: true              # can a manager/CO exempt someone?
  exemption_requires_justification: true
  exemption_approval_chain: ["SUPERVISOR", "COMPLIANCE_OFFICER"]
audit:
  track_view_time: true              # did the employee actually open/read it?
  track_completion_time: true        # how long did they spend?
  require_quiz: false                # optional comprehension check
  quiz_pass_threshold: null          # minimum score if quiz enabled
```

## Key Design Decisions Needed

### 1. New proof type or extend existing?

- **Option A:** Add `acknowledgment` as a new proof type alongside hours, certification, etc.
- **Option B:** Use `custom` as a catch-all proof type with sub-categories.
- **Option C:** Make proof type itself a configurable field on the template (most flexible).

**Recommendation:** Option C — let the template define its own proof semantics. The built-in types become presets, not constraints.

### 2. Content hosting

- **Inline:** Store the policy text in the template itself (simple, versioned with the template).
- **External:** Link to SharePoint/OneDrive/external URL (keeps E-CLAT as tracker, not CMS).
- **Hybrid:** Support both — inline for short declarations, external link for full policy documents.

**Recommendation:** Hybrid. Short declarations inline, long policies linked.

### 3. Digital signature capture

- **Simple checkbox:** "I have read and agree" (L1 attestation).
- **Typed name:** Employee types their full name as acknowledgment.
- **Cryptographic:** Actual digital signature with timestamp and hash.

**Recommendation:** Start with typed-name (middle ground). Add cryptographic later for regulated industries that require it.

### 4. Re-acknowledgment on content change

When a policy is updated (new version), should all prior acknowledgments be invalidated?

- **Auto-invalidate:** New version = everyone must re-sign.
- **Admin choice:** Let the admin decide per-version whether re-sign is required.
- **Diff-based:** Only require re-sign if "material changes" flag is set.

**Recommendation:** Admin choice with a "material change" flag. Minor typo fixes shouldn't trigger company-wide re-signing.

### 5. Compliance reporting

Custom templates should integrate with the existing compliance dashboard:
- Show completion rates per template, per group
- Flag overdue acknowledgments
- Support bulk reminder notifications
- Export audit trail (who signed what, when, from what IP/device)

## Attestation Level Mapping

| Scenario | Level | What Happens |
|----------|-------|-------------|
| Employee clicks "I agree" | L1 (self_attest) | Checkbox + timestamp |
| Employee types name + clicks confirm | L1+ (self_attest with signature) | Typed signature + timestamp |
| Employee uploads signed PDF | L2 (upload) | Document stored + timestamp |
| Third-party training platform reports completion | L3 (third_party) | API callback or SCORM integration |
| Compliance officer manually validates | L4 (validated) | CO review + approval timestamp |

## Implementation Considerations

1. **Template builder UI** — drag-and-drop or form-based template creation for admins
2. **Version history** — full audit trail of template changes with diff view
3. **Bulk operations** — assign template to 500+ employees, send reminders, track completion
4. **Notification integration** — due-date reminders via existing notification system
5. **API support** — CRUD for templates via API so external systems can manage them
6. **Import/export** — YAML or JSON template definitions for sharing between tenants
7. **Cascading inheritance** — company-level templates auto-flow to all groups; group-level templates apply to subgroups

## Relationship to Existing Systems

- **ProofTemplate model:** Custom templates extend the existing `ProofTemplate` with additional fields (content, signature, recurrence).
- **TemplateAssignment:** Reuse existing assignment mechanism — custom templates are assigned the same way as certification templates.
- **ProofFulfillment:** Acknowledgments create fulfillment records with the same audit trail.
- **Notification system:** Leverage existing `EscalationRule` and `Notification` models for reminders.
- **Labels/taxonomy:** Custom templates get labeled and categorized alongside standard templates.
