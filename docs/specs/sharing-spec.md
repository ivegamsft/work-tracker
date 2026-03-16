# Sharing & Proof Vault Specification — E-CLAT Platform

> **Status:** Draft Specification (Phase 2+)  
> **Owner:** Freamon (Lead / Architect)  
> **Created:** 2026-03-18  
> **Applies To:** `apps/web`, `apps/api` (new `vault` module), `apps/admin`  
> **Source PRD:** [`docs/requirements/eclat-spec.md`](../requirements/eclat-spec.md) — Product north star  
> **Companion Docs:** [App Spec](./app-spec.md) · [RBAC API Spec](./rbac-api-spec.md) · [Entra Auth Design](./entra-auth-design.md)  
> **Prerequisite:** Existing `documents` module (upload, review, extraction) must be stable before vault layer is added.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Sharing Model](#2-sharing-model)
3. [File Organization Sections](#3-file-organization-sections)
4. [Encryption Considerations](#4-encryption-considerations)
5. [File Requests Workflow](#5-file-requests-workflow)
6. [Storage & Quotas](#6-storage--quotas)
7. [API Endpoints](#7-api-endpoints)
8. [RBAC — Sharing Permissions](#8-rbac--sharing-permissions)
9. [Screen Descriptions](#9-screen-descriptions)
10. [Data Model](#10-data-model)
11. [Implementation Phase](#11-implementation-phase)

---

## 1. Overview

### 1.1 What Is the Proof Vault?

The **Proof Vault** is a secure document storage and sharing layer built on top of E-CLAT's existing `documents` module. While the `documents` module handles upload, review, and AI extraction of compliance proofs, the Proof Vault adds:

- **Organized storage** — files grouped into personal vault, shared folders, archive, and trash
- **Controlled sharing** — proofs can be shared with specific users or via time-limited links
- **File requests** — managers and compliance officers can request specific proofs from employees
- **Storage quotas** — per-user limits enforced by admin, with usage tracking

### 1.2 Why Sharing Matters in E-CLAT

In regulated industries, compliance proofs must flow between people:

| Scenario | From | To | Example |
|----------|------|----|---------|
| Qualification verification | Employee | Supervisor/Manager | "Here's my updated forklift cert" |
| Audit preparation | Compliance Officer | External auditor | "Read-only access to all warehouse certs" |
| Team onboarding | Supervisor | New employee | "Training materials for your first week" |
| Compliance remediation | Manager | Compliance Officer | "Corrected qualification records for review" |
| Regulatory submission | Compliance Officer | External body | "Time-limited link to our DOT compliance file" |

Without structured sharing, users fall back to email attachments — losing auditability, encryption, and access control. The Proof Vault keeps all sharing inside E-CLAT's audit trail.

### 1.3 Design Principles

1. **Sharing is explicit, never implicit.** Documents are private by default. Sharing requires deliberate action and creates an audit record.
2. **Permissions are subtractive from the sharer's access.** You cannot grant permissions you don't hold. A "View" sharer cannot grant "Download."
3. **Encryption at rest is non-negotiable.** Shared access uses re-encryption, not decryption-and-copy.
4. **File requests are first-class.** Requesting a proof is as important as sharing one — it drives compliance workflows.
5. **Existing RBAC still applies.** Sharing does not bypass role-based scoping. A Supervisor sharing a document with an Employee does not let that Employee see other team members' documents.

---

## 2. Sharing Model

### 2.1 Shared Folders

A **shared folder** is a named container owned by a user. All members see the same folder contents.

| Property | Description |
|----------|-------------|
| `name` | Display name (e.g., "Q1 2026 Audit Package") |
| `ownerId` | The user who created the folder |
| `members` | List of user IDs + permission level |
| `createdAt` / `updatedAt` | Timestamps |

**Rules:**
- Any authenticated user (Employee+) can create a shared folder.
- The owner has implicit `manage` permission and cannot be removed.
- Folders can contain existing vault documents (by reference, not copy).
- Adding a document to a shared folder does not remove it from the owner's personal vault.
- Deleting a shared folder does not delete the underlying documents — it only removes the folder container and all share grants.
- Maximum folder members: 50 (configurable by Admin).

### 2.2 Per-File Sharing

Individual proofs can be shared without creating a folder:

- Select a document → Share → Pick users → Set permission level
- Creates a `VaultShare` record linking the document to the recipient(s)
- Recipient sees the document in their "Shared With Me" section
- Sharer sees the document in their "Shared By Me" section

### 2.3 Permission Levels

| Level | View | Download | Comment | Manage |
|:------|:----:|:--------:|:-------:|:------:|
| **View** | ✅ | ❌ | ❌ | ❌ |
| **Download** | ✅ | ✅ | ❌ | ❌ |
| **Comment** | ✅ | ✅ | ✅ | ❌ |
| **Manage** | ✅ | ✅ | ✅ | ✅ |

**Manage** includes: add/remove members, change permission levels, delete the share (not the document).

Permission level hierarchy (numeric):

```
View (0) < Download (1) < Comment (2) < Manage (3)
```

**Constraint:** A sharer can only grant permissions at or below their own level. The folder/document owner always has `Manage`.

### 2.4 Share Links

For external sharing (auditors, regulatory bodies), users can generate a **share link** — a URL that grants access without requiring an E-CLAT account.

| Property | Description |
|----------|-------------|
| `token` | Cryptographically random URL-safe string (256-bit) |
| `targetType` | `document` or `folder` |
| `targetId` | UUID of the shared item |
| `permission` | `view` or `download` only (no comment/manage for external) |
| `expiresAt` | Required. Maximum 30 days from creation (Admin-configurable). |
| `password` | Optional. Bcrypt-hashed passphrase for additional protection. |
| `maxAccessCount` | Optional. Limit total accesses before link expires. |
| `createdBy` | The user who generated the link |
| `accessLog` | Array of `{ accessedAt, ipAddress, userAgent }` entries |

**Rules:**
- Only Compliance Officer+ can create share links (prevents unauthorized external exposure).
- Supervisor and Manager can request a share link via the Compliance Officer.
- All share link accesses are logged in the audit trail.
- Expired or exhausted links return a generic "Link not available" page (no information leakage).
- Admin can revoke any share link system-wide.
- Share links for documents with `confidential` labels require Admin approval before activation.

### 2.5 Internal vs. External Sharing

| Aspect | Internal Sharing | External Sharing (Share Links) |
|--------|-----------------|-------------------------------|
| **Authentication** | E-CLAT account required | No account needed (token-based) |
| **Permission levels** | View, Download, Comment, Manage | View, Download only |
| **Duration** | Indefinite until revoked | Time-limited (max 30 days) |
| **Audit trail** | Full user identity logged | IP + user-agent logged |
| **Who can create** | Any authenticated user | Compliance Officer+ only |
| **Encryption** | Re-encrypted with recipient key | Decrypted on access via TLS |

---

## 3. File Organization Sections

Adapting the reference UI design to E-CLAT's compliance context. These sections appear in the Vault Home screen as a bottom-sheet or sidebar navigation.

### 3.1 My Vault (Personal Encrypted Proofs)

The user's personal document storage. All uploaded compliance proofs land here by default.

- **Contents:** All documents owned by the authenticated user
- **Sort/filter:** By type (qualification cert, medical clearance, training record, other), date, file size, status
- **Actions:** Upload, preview, share, move to archive, delete
- **Search:** Full-text search across file names and metadata
- **Default view:** Most recent first

### 3.2 Shared With Me

Documents and folders that other users have shared with the current user.

- **Contents:** All `VaultShare` records where `recipientId` = current user
- **Display:** Each item shows the sharer's name, permission level, and shared date
- **Avatar stacks:** When a document is shared with multiple recipients, show 2-3 user avatars (matching the reference UI)
- **Actions:** View, download (if permitted), comment (if permitted)
- **Filter:** By sharer, by permission level, by date shared

### 3.3 Shared By Me

Documents and folders the current user has shared with others.

- **Contents:** All `VaultShare` records where `sharerId` = current user
- **Display:** Each item shows recipient names/avatars, permission levels, and shared date
- **Actions:** Change permissions, revoke share, view access log
- **Filter:** By recipient, by permission level, by date

### 3.4 Archive (Expired/Superseded Proofs)

Documents the user has explicitly archived — typically expired certifications or superseded versions.

- **Contents:** Documents with `archivedAt` set
- **Actions:** Restore to vault, permanently delete, view
- **Retention:** Archived documents count toward storage quota but are flagged for potential cleanup
- **Auto-archive rule (optional):** Documents linked to expired qualifications are suggested for archival (notification, not automatic)

### 3.5 Recent Uploads

Quick access to the most recently uploaded documents across all sections.

- **Contents:** Last 20 documents uploaded by the current user, ordered by upload date
- **Display:** File icon, name, size, date, status (pending review / reviewed / extracted)
- **Actions:** Same as My Vault (this is a filtered view, not a separate storage location)

### 3.6 File Requests

Proof requests from managers and compliance officers. See [Section 5](#5-file-requests-workflow) for the full workflow.

- **Contents:** All `FileRequest` records where `requestedFromId` = current user
- **Display:** Requester name, description of what's needed, deadline, status (pending / fulfilled / overdue / cancelled)
- **Actions:** Upload to fulfill, view details, mark as unable to fulfill (with reason)
- **Badge:** Count of pending requests shown on the section icon

### 3.7 Deleted Files (Soft Delete with Recovery)

Documents the user has deleted. Retained for a recovery period before permanent deletion.

- **Contents:** Documents with `deletedAt` set and `deletedAt` within recovery window
- **Recovery period:** 30 days (Admin-configurable)
- **Actions:** Restore, permanently delete (immediate)
- **Auto-purge:** Cron job permanently deletes documents older than the recovery period
- **Quota note:** Deleted files continue to count toward quota until permanently purged

### 3.8 Storage Indicator

A visual display of the user's storage consumption.

- **Display:** "{used} GB used out of {quota} GB" with a gradient progress bar
- **Thresholds:** Green (< 75%), yellow (75-90%), red (> 90%)
- **Position:** Bottom of the section navigation, always visible
- **Tap action:** Opens Storage Settings screen

---

## 4. Encryption Considerations

### 4.1 Current State

The existing `documents` module stores files in Azure Blob Storage with:
- **Encryption at rest:** Azure Storage Service Encryption (SSE) with Microsoft-managed keys
- **Encryption in transit:** HTTPS/TLS 1.2+
- **Access control:** SAS tokens generated server-side, scoped per-document

This is server-side encryption — Microsoft holds the keys. For the Proof Vault, we introduce **application-layer encryption** to achieve zero-knowledge storage.

### 4.2 Zero-Knowledge Proof Vault Architecture

```
                    ┌─────────────────────────────────────────┐
                    │              Client (Browser)            │
                    │                                          │
                    │  1. User password → PBKDF2 → Master Key  │
                    │  2. Master Key → derives DEK per file    │
                    │  3. Encrypt file client-side (AES-256)   │
                    │  4. Upload encrypted blob + wrapped DEK  │
                    └──────────────┬───────────────────────────┘
                                   │ HTTPS
                    ┌──────────────▼───────────────────────────┐
                    │              API Server                   │
                    │                                          │
                    │  • Stores encrypted blobs in Azure Blob  │
                    │  • Stores wrapped DEK in database        │
                    │  • Never sees plaintext file content     │
                    │  • Never sees Master Key                 │
                    └──────────────────────────────────────────┘
```

**Key hierarchy:**

| Key | Derived From | Stored Where | Purpose |
|-----|-------------|-------------|---------|
| **Master Key** | User password via PBKDF2 (100k iterations, SHA-256) | Never stored — derived at login | Root of user's key hierarchy |
| **Document Encryption Key (DEK)** | Random per file (AES-256-GCM) | Database, wrapped (encrypted) with Master Key | Encrypts/decrypts one document |
| **Share Key** | Recipient's public key (X25519) + sharer's private key (Diffie-Hellman) | Database, as re-wrapped DEK | Enables shared access |

### 4.3 How Sharing Interacts with Encryption

When User A shares a document with User B:

1. User A decrypts the document's DEK using their Master Key (client-side).
2. User A re-encrypts the DEK using User B's public key (X25519 key exchange).
3. The re-wrapped DEK is stored as a `VaultShareKey` record in the database.
4. User B can now decrypt the DEK using their own private key, then decrypt the document.

**The server never sees the plaintext DEK or the document content.**

### 4.4 Shared Folder Key Management

For shared folders (multiple recipients, multiple documents):

- The folder has a **Folder Key** — a symmetric key (AES-256) generated by the folder owner.
- Each folder member has the Folder Key wrapped with their public key.
- Documents added to the folder have their DEK re-wrapped with the Folder Key.
- Adding a new member: the owner wraps the Folder Key for the new member's public key.
- Removing a member: the owner generates a new Folder Key, re-wraps all document DEKs, and re-wraps the new Folder Key for remaining members. (This is a key rotation — the removed member retains access to any documents they previously decrypted locally, but cannot access new content or re-download.)

### 4.5 Share Link Encryption

Share links (external access without an account) cannot use zero-knowledge encryption because the recipient has no key pair. For share link access:

- The server holds a **link-scoped DEK** — the document's DEK re-wrapped with a key derived from the share link token.
- On access, the server decrypts the DEK, decrypts the document, and serves it over TLS.
- This means share link access is **not** zero-knowledge — the server can see the plaintext during link access.
- This trade-off is acceptable because: (a) share links are Compliance Officer+ only, (b) they are time-limited, (c) all accesses are audited.

### 4.6 Key Recovery

If a user forgets their password (and thus loses their Master Key):

- **Recovery key:** At account setup, the user is given a 24-word recovery phrase (BIP-39 style). This can reconstruct the Master Key.
- **Admin recovery:** NOT supported by design. Zero-knowledge means the admin cannot recover user data. This is a compliance feature, not a limitation.
- **Organization recovery key (optional):** Admin can configure an organization-level recovery key that wraps each user's Master Key. This breaks pure zero-knowledge but is required by some regulatory frameworks. Enabled per-organization.

### 4.7 Migration Path

Since the existing `documents` module uses server-side encryption only, a migration is needed:

1. **Phase 2a:** Introduce the Proof Vault UI with sharing, file requests, and organization sections — but use server-side encryption only (no client-side crypto). This delivers value immediately.
2. **Phase 3+:** Add client-side encryption (zero-knowledge vault). Existing documents are re-encrypted client-side during a migration window. New uploads are client-side encrypted from day one.

This phased approach avoids blocking sharing features on the complex crypto implementation.

---

## 5. File Requests Workflow

### 5.1 What Is a File Request?

A **file request** is a formal request from a Supervisor+ user asking an Employee to upload a specific compliance proof. It creates a tracked obligation with a deadline.

### 5.2 Workflow

```
┌────────────┐         ┌────────────────────┐         ┌──────────────┐
│  Manager   │         │      System        │         │   Employee   │
│            │         │                    │         │              │
│ 1. Create  │────────▶│ 2. Create request  │────────▶│ 3. See in    │
│    request │         │    + notification  │         │    "File     │
│            │         │                    │         │    Requests" │
│            │         │                    │         │              │
│            │         │ 5. Auto-share doc  │◀────────│ 4. Upload    │
│            │◀────────│    with requester  │         │    document  │
│ 6. Receive │         │    + notification  │         │              │
│    document│         │                    │         │              │
└────────────┘         └────────────────────┘         └──────────────┘
```

### 5.3 File Request Properties

| Property | Description | Required |
|----------|-------------|:--------:|
| `id` | UUID | Auto |
| `requestedById` | User who created the request | ✅ |
| `requestedFromId` | Employee who must fulfill it | ✅ |
| `title` | Short description (e.g., "Forklift Certification") | ✅ |
| `description` | Detailed instructions for the employee | ❌ |
| `category` | Type of proof expected (qualification, medical, training, other) | ❌ |
| `deadline` | Date by which the proof must be uploaded | ❌ |
| `status` | `pending` · `fulfilled` · `overdue` · `cancelled` · `unable` | Auto |
| `fulfilledDocumentId` | Links to the uploaded document when fulfilled | Auto |
| `createdAt` / `updatedAt` | Timestamps | Auto |

### 5.4 Status Transitions

```
                    ┌─────────┐
         ┌─────────│ pending  │─────────┐
         │         └────┬────┘          │
         │              │               │
    deadline passes     │ employee      │ requester
         │              │ uploads       │ cancels
         ▼              ▼               ▼
    ┌─────────┐   ┌──────────┐   ┌───────────┐
    │ overdue  │   │fulfilled │   │ cancelled │
    └────┬────┘   └──────────┘   └───────────┘
         │
         │ employee uploads
         ▼
    ┌──────────┐
    │fulfilled │
    └──────────┘

    Employee can also mark:
    ┌─────────┐
    │ pending  │──── employee marks "unable" ───▶ ┌────────┐
    └─────────┘     (with reason)                 │ unable │
                                                   └────────┘
```

### 5.5 Auto-Share on Fulfillment

When an employee uploads a document to fulfill a request:

1. The document is added to the employee's personal vault as normal.
2. A `VaultShare` is automatically created, sharing the document with the requester at `download` permission level.
3. The requester receives a notification: "Jane Doe uploaded 'Forklift Cert 2026.pdf' for your request."
4. The file request status changes to `fulfilled` and links to the document ID.

### 5.6 Escalation Rules

| Condition | Action |
|-----------|--------|
| Request pending with deadline ≤ 7 days | Notification to employee: "Reminder: proof due in X days" |
| Request overdue (past deadline) | Notification to employee + escalation to requester |
| Request overdue > 3 days | Escalation to requester's supervisor (if applicable) |
| Request unfulfilled > 14 days past deadline | Notification to Compliance Officer |

These escalation rules integrate with the existing `notifications` module's escalation framework.

---

## 6. Storage & Quotas

### 6.1 Per-User Storage Quota

| Setting | Default | Configurable By |
|---------|---------|----------------|
| Employee quota | 2 GB | Admin |
| Supervisor quota | 5 GB | Admin |
| Manager quota | 5 GB | Admin |
| Compliance Officer quota | 20 GB | Admin |
| Admin quota | Unlimited | N/A |
| Organization total | Per license | N/A |

### 6.2 Storage Tracking

Each user's storage usage is tracked in real time:

- **Counted:** All documents in My Vault + Archive + Deleted Files (until permanently purged)
- **Not counted:** Documents shared with the user (charged to the owner's quota)
- **Counted once:** A document in both a personal vault and a shared folder counts once against the owner

### 6.3 Quota Warnings

| Threshold | Action |
|-----------|--------|
| 75% used | Yellow indicator on storage bar + in-app notification |
| 90% used | Red indicator + email notification (if enabled) |
| 100% used | Upload blocked + notification to user + notification to Admin |
| 100% used + file request pending | Notification to Admin: "User X cannot fulfill file request — quota exceeded" |

### 6.4 Admin Quota Management

Admin can:
- View all users' storage usage (table with search/filter)
- Adjust individual user quotas
- Set default quota per role
- View organization-wide storage consumption
- Identify top consumers
- Force-purge deleted files for a user (with audit log entry)

---

## 7. API Endpoints

### 7.1 New API Module: `vault`

All new endpoints live under `/api/vault/`. The existing `/api/documents/` module is unchanged — the vault module references documents by ID.

### 7.2 Shared Folders

| Endpoint | Method | Permission | Min Role | Description |
|----------|--------|-----------|----------|-------------|
| `/api/vault/folders` | `POST` | `vault:create` | Employee | Create a shared folder |
| `/api/vault/folders` | `GET` | `vault:read` | Employee | List user's shared folders (owned + member of) |
| `/api/vault/folders/:id` | `GET` | `vault:read` | Employee | Get folder details + members + documents |
| `/api/vault/folders/:id` | `PUT` | `vault:update` | Employee | Update folder name (owner or Manage permission) |
| `/api/vault/folders/:id` | `DELETE` | `vault:delete` | Employee | Delete folder (owner only) |
| `/api/vault/folders/:id/members` | `POST` | `vault:share` | Employee | Add member(s) to folder |
| `/api/vault/folders/:id/members/:userId` | `PUT` | `vault:share` | Employee | Change member permission level |
| `/api/vault/folders/:id/members/:userId` | `DELETE` | `vault:share` | Employee | Remove member from folder |
| `/api/vault/folders/:id/documents` | `POST` | `vault:update` | Employee | Add document(s) to folder |
| `/api/vault/folders/:id/documents/:docId` | `DELETE` | `vault:update` | Employee | Remove document from folder |

### 7.3 Per-File Sharing

| Endpoint | Method | Permission | Min Role | Description |
|----------|--------|-----------|----------|-------------|
| `/api/vault/shares` | `POST` | `vault:share` | Employee | Share document(s) with user(s) |
| `/api/vault/shares/with-me` | `GET` | `vault:read` | Employee | List documents shared with current user |
| `/api/vault/shares/by-me` | `GET` | `vault:read` | Employee | List documents current user has shared |
| `/api/vault/shares/:id` | `PUT` | `vault:share` | Employee | Update share permission level |
| `/api/vault/shares/:id` | `DELETE` | `vault:share` | Employee | Revoke a share |

### 7.4 Share Links

| Endpoint | Method | Permission | Min Role | Description |
|----------|--------|-----------|----------|-------------|
| `/api/vault/links` | `POST` | `vault:link` | Compliance Officer | Create a share link |
| `/api/vault/links` | `GET` | `vault:link` | Compliance Officer | List active share links created by user |
| `/api/vault/links/:id` | `DELETE` | `vault:link` | Compliance Officer | Revoke a share link |
| `/api/vault/links/:id/access-log` | `GET` | `vault:link` | Compliance Officer | View access log for a share link |
| `/api/vault/access/:token` | `GET` | — | Public | Access a shared resource via link token |

### 7.5 File Requests

| Endpoint | Method | Permission | Min Role | Description |
|----------|--------|-----------|----------|-------------|
| `/api/vault/requests` | `POST` | `vault:request` | Supervisor | Create a file request |
| `/api/vault/requests` | `GET` | `vault:read` | Employee | List file requests (sent or received) |
| `/api/vault/requests/:id` | `GET` | `vault:read` | Employee | Get file request details |
| `/api/vault/requests/:id` | `PUT` | `vault:request` | Supervisor | Update request (deadline, description) |
| `/api/vault/requests/:id/cancel` | `POST` | `vault:request` | Supervisor | Cancel a request |
| `/api/vault/requests/:id/fulfill` | `POST` | `vault:create` | Employee | Upload document to fulfill request |
| `/api/vault/requests/:id/unable` | `POST` | `vault:read` | Employee | Mark request as unable to fulfill |

### 7.6 Storage & Quotas

| Endpoint | Method | Permission | Min Role | Description |
|----------|--------|-----------|----------|-------------|
| `/api/vault/storage` | `GET` | `vault:read` | Employee | Get own storage usage + quota |
| `/api/vault/storage/users` | `GET` | `vault:admin` | Admin | List all users' storage usage |
| `/api/vault/storage/users/:id` | `GET` | `vault:admin` | Admin | Get specific user's storage details |
| `/api/vault/storage/users/:id/quota` | `PUT` | `vault:admin` | Admin | Update user's quota |
| `/api/vault/storage/defaults` | `GET` | `vault:admin` | Admin | Get default quotas per role |
| `/api/vault/storage/defaults` | `PUT` | `vault:admin` | Admin | Update default quotas per role |

### 7.7 Vault Organization

| Endpoint | Method | Permission | Min Role | Description |
|----------|--------|-----------|----------|-------------|
| `/api/vault/my-vault` | `GET` | `vault:read` | Employee | List personal vault documents (with pagination, filters) |
| `/api/vault/archive` | `GET` | `vault:read` | Employee | List archived documents |
| `/api/vault/archive/:docId` | `POST` | `vault:update` | Employee | Archive a document |
| `/api/vault/archive/:docId/restore` | `POST` | `vault:update` | Employee | Restore from archive |
| `/api/vault/recent` | `GET` | `vault:read` | Employee | Recent uploads (last 20) |
| `/api/vault/deleted` | `GET` | `vault:read` | Employee | List soft-deleted documents |
| `/api/vault/deleted/:docId` | `POST` | `vault:delete` | Employee | Soft-delete a document |
| `/api/vault/deleted/:docId/restore` | `POST` | `vault:update` | Employee | Restore from trash |
| `/api/vault/deleted/:docId/purge` | `DELETE` | `vault:delete` | Employee | Permanently delete |

### 7.8 Endpoint Count Summary

| Category | Endpoints |
|----------|:---------:|
| Shared Folders | 10 |
| Per-File Sharing | 5 |
| Share Links | 5 |
| File Requests | 7 |
| Storage & Quotas | 6 |
| Vault Organization | 9 |
| **Total** | **42** |

---

## 8. RBAC — Sharing Permissions

### 8.1 New Permissions

Following the existing `{resource}:{action}` syntax:

| Permission | Description |
|-----------|-------------|
| `vault:read` | View vault contents, shared items, file requests received |
| `vault:create` | Upload documents to vault, fulfill file requests |
| `vault:update` | Archive/restore, manage folder contents, update shares |
| `vault:delete` | Soft-delete, permanent delete, revoke shares |
| `vault:share` | Share documents/folders with other users |
| `vault:link` | Create/manage external share links |
| `vault:request` | Create/manage file requests (ask others for proofs) |
| `vault:admin` | Manage storage quotas, view all users' storage, force-purge |

### 8.2 Role-Permission Matrix

| Permission | Employee | Supervisor | Manager | Comp. Officer | Admin |
|-----------|:--------:|:----------:|:-------:|:-------------:|:-----:|
| `vault:read` | ✅¹ | ✅ | ✅ | ✅ | ✅ |
| `vault:create` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `vault:update` | ✅¹ | ✅¹ | ✅¹ | ✅¹ | ✅ |
| `vault:delete` | ✅¹ | ✅¹ | ✅¹ | ✅¹ | ✅ |
| `vault:share` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `vault:link` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `vault:request` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `vault:admin` | ❌ | ❌ | ❌ | ❌ | ✅ |

**Notes:**
1. Scoped to own documents only. Shared access is governed by `VaultShare` permission levels, not role.

### 8.3 Data Scoping for Vault

Vault data scoping differs from the main E-CLAT pattern because vault access is **ownership + share-based**, not **role-hierarchy-based**:

| Access Type | Scope Rule |
|------------|------------|
| My Vault | Own documents only (all roles) |
| Shared With Me | Documents explicitly shared with user |
| Shared By Me | Documents user has shared |
| File Requests (received) | Requests targeting the current user |
| File Requests (sent) | Requests created by the current user |
| Archive / Deleted | Own documents only |
| Storage (own) | Own usage only |
| Storage (admin) | All users (Admin only) |

**Key difference from existing modules:** A Supervisor cannot browse their team's vault contents via role hierarchy. They can only see documents that have been explicitly shared with them or that they have `documents:read` scope for via the existing documents module. The vault layer is additive — it does not replace role-based document access, it supplements it with explicit sharing.

### 8.4 Who Can Share What With Whom

| Sharer Role | Can Share With | Can Create File Requests For | Can Create Share Links |
|-------------|---------------|------------------------------|----------------------|
| Employee | Any authenticated user | Nobody | ❌ |
| Supervisor | Any authenticated user | Direct reports | ❌ |
| Manager | Any authenticated user | Department employees | ❌ |
| Compliance Officer | Any authenticated user + external (links) | Any employee (org-wide) | ✅ |
| Admin | Any authenticated user + external (links) | Any employee | ✅ |

---

## 9. Screen Descriptions

### 9.1 New `apps/web` Screens

Continuing the screen numbering from the App Spec (last: W-23).

| # | Screen | Route | Description | Min Role |
|---|--------|-------|-------------|----------|
| W-24 | Vault Home | `/vault` | Main vault screen with 7 section tabs (My Vault, Shared With Me, Shared By Me, Archive, Recent, File Requests, Deleted) + storage indicator | Employee |
| W-25 | Shared Folder View | `/vault/folders/:id` | Contents of a shared folder: document list, member list with avatars, permission levels, actions (add doc, add member, leave folder) | Employee |
| W-26 | Share Dialog | (Modal on W-24/W-25) | Select users (autocomplete search), set permission level, optional message. Also accessible as "Share" action on any document card. | Employee |
| W-27 | Share Link Dialog | (Modal on W-24/W-25) | Create share link: set expiration, optional password, permission (view/download). Shows generated link with copy button. | Compliance Officer |
| W-28 | File Request Dialog | (Modal) | Create file request: select employee (scoped by role), title, description, category, deadline. | Supervisor |
| W-29 | File Request Detail | `/vault/requests/:id` | View request details, status, deadline, upload button (if recipient), cancel button (if requester). Shows fulfilled document if completed. | Employee |

### 9.2 New `apps/admin` Screen

Continuing from the Admin App Spec (last: A-09).

| # | Screen | Route | Description |
|---|--------|-------|-------------|
| A-10 | Storage Management | `/storage` | Table of all users with storage usage bars. Search/filter. Click user to adjust quota. Default quota settings per role. Organization total usage. |

### 9.3 Screen Descriptions (Detailed)

#### W-24: Vault Home

```
┌─────────────────────────────────────────────────────────────┐
│  Dashboard > Proof Vault                                     │
├─────────────────────────────────────────────────────────────┤
│  [🔍 Search vault...]                                       │
│                                                              │
│  ┌─── Section Tabs ──────────────────────────────────────┐  │
│  │ [My Vault] [Shared ▼] [Archive] [Recent] [Requests⁽³⁾]│  │
│  │                        └ With Me                       │  │
│  │                        └ By Me                         │  │
│  │ [Deleted]                                              │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─── My Vault (active tab) ─────────────────────────────┐  │
│  │ [+ Upload]  [+ New Folder]  [Filter ▾]  [Sort ▾]     │  │
│  │                                                        │  │
│  │ 📁 Q1 2026 Audit Package        3 files  ···          │  │
│  │    👤👤👤 shared with 3 people                         │  │
│  │                                                        │  │
│  │ 📄 Forklift_Cert_2026.pdf       1.2 MB   Mar 15  ··· │  │
│  │ 📄 CPR_Training_Complete.pdf    842 KB   Mar 12  ··· │  │
│  │ 📄 DOT_Physical_2026.pdf       2.1 MB   Mar 01  ··· │  │
│  │ 📄 Safety_Orientation.pdf       560 KB   Feb 28  ··· │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─── Storage ───────────────────────────────────────────┐  │
│  │ ████████████░░░░░░  1.2 GB used out of 2.0 GB        │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Key interactions:**
- Each document card has a "···" menu with: Share, Move to Folder, Archive, Delete
- Folder cards show avatar stacks of members
- File Request tab shows a badge with pending request count
- Search bar searches across all sections (file names, sharer names, request titles)

#### W-25: Shared Folder View

```
┌─────────────────────────────────────────────────────────────┐
│  Vault > Q1 2026 Audit Package                               │
├─────────────────────────────────────────────────────────────┤
│  Created by John Smith · 3 members · 5 documents            │
│                                                              │
│  ┌─── Members ───────────────────────────────────────────┐  │
│  │ 👤 John Smith (Owner)     · Manage                    │  │
│  │ 👤 Jane Doe               · Download    [Change ▾][✕] │  │
│  │ 👤 Audit Team Account     · View        [Change ▾][✕] │  │
│  │ [+ Add Member]                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─── Documents ─────────────────────────────────────────┐  │
│  │ [+ Add Document]                                      │  │
│  │                                                        │  │
│  │ 📄 Forklift_Cert_2026.pdf     1.2 MB   Mar 15   ···  │  │
│  │ 📄 CPR_Training_Complete.pdf  842 KB   Mar 12   ···  │  │
│  │ 📄 DOT_Physical_2026.pdf     2.1 MB   Mar 01   ···  │  │
│  │ 📄 Safety_Orientation.pdf     560 KB   Feb 28   ···  │  │
│  │ 📄 Drug_Screen_2026.pdf      340 KB   Feb 15   ···  │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

#### W-28: File Request Dialog

```
┌─────────────────────────────────────────────────────┐
│  Request a Proof                              [✕]   │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Request from:  [Search employee... ▾]              │
│                  (Scoped to your team/department)    │
│                                                      │
│  Title:         [Forklift Certification 2026    ]   │
│                                                      │
│  Description:   [Please upload your renewed      ]  │
│                 [forklift operator certification  ]  │
│                 [from the March training session. ]  │
│                                                      │
│  Category:      [Qualification ▾]                   │
│                                                      │
│  Deadline:      [2026-04-15 📅]                     │
│                                                      │
│  [Cancel]                        [Send Request]     │
└─────────────────────────────────────────────────────┘
```

#### A-10: Storage Management (Admin)

```
┌─────────────────────────────────────────────────────────────┐
│  Admin > Storage Management                                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─── Organization Usage ────────────────────────────────┐  │
│  │ ████████░░░░░░░░░░  42.6 GB used out of 500 GB       │  │
│  │ 312 users · avg 136 MB/user                           │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─── Default Quotas ────────────────────────────────────┐  │
│  │ Employee: [2 GB ▾]  Supervisor: [5 GB ▾]              │  │
│  │ Manager:  [5 GB ▾]  Compliance: [20 GB ▾]  [Save]    │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  [Search: ___________]  [Filter: Over 75% ▾]              │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ User           │ Role       │ Used/Quota │ Usage Bar  │  │
│  │────────────────│────────────│────────────│────────────│  │
│  │ Jane Doe       │ Employee   │ 1.8/2.0 GB │ ████████▓ │  │
│  │ Bob Lee        │ Employee   │ 0.3/2.0 GB │ ██░░░░░░░ │  │
│  │ John Smith     │ Supervisor │ 2.1/5.0 GB │ ████░░░░░ │  │
│  │ ...            │            │            │            │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. Data Model

### 10.1 New Prisma Models

```prisma
model VaultFolder {
  id        String   @id @default(uuid())
  name      String
  ownerId   String
  owner     User     @relation("OwnedFolders", fields: [ownerId], references: [id])
  members   VaultFolderMember[]
  documents VaultFolderDocument[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([ownerId])
}

model VaultFolderMember {
  id         String       @id @default(uuid())
  folderId   String
  folder     VaultFolder  @relation(fields: [folderId], references: [id], onDelete: Cascade)
  userId     String
  user       User         @relation(fields: [userId], references: [id])
  permission VaultPermission @default(VIEW)
  addedAt    DateTime     @default(now())

  @@unique([folderId, userId])
  @@index([userId])
}

model VaultFolderDocument {
  id         String      @id @default(uuid())
  folderId   String
  folder     VaultFolder @relation(fields: [folderId], references: [id], onDelete: Cascade)
  documentId String
  document   Document    @relation(fields: [documentId], references: [id])
  addedAt    DateTime    @default(now())
  addedById  String

  @@unique([folderId, documentId])
}

model VaultShare {
  id           String          @id @default(uuid())
  documentId   String
  document     Document        @relation(fields: [documentId], references: [id])
  sharerId     String
  sharer       User            @relation("SharedByUser", fields: [sharerId], references: [id])
  recipientId  String
  recipient    User            @relation("SharedWithUser", fields: [recipientId], references: [id])
  permission   VaultPermission @default(VIEW)
  message      String?
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  @@unique([documentId, sharerId, recipientId])
  @@index([recipientId])
  @@index([sharerId])
}

model VaultShareLink {
  id              String          @id @default(uuid())
  token           String          @unique
  targetType      ShareLinkTarget
  targetId        String
  permission      VaultPermission @default(VIEW)
  expiresAt       DateTime
  passwordHash    String?
  maxAccessCount  Int?
  accessCount     Int             @default(0)
  createdById     String
  createdBy       User            @relation(fields: [createdById], references: [id])
  revokedAt       DateTime?
  createdAt       DateTime        @default(now())

  accessLog       VaultShareLinkAccess[]

  @@index([token])
  @@index([createdById])
}

model VaultShareLinkAccess {
  id        String         @id @default(uuid())
  linkId    String
  link      VaultShareLink @relation(fields: [linkId], references: [id], onDelete: Cascade)
  accessedAt DateTime      @default(now())
  ipAddress  String
  userAgent  String?
}

model FileRequest {
  id                  String            @id @default(uuid())
  requestedById       String
  requestedBy         User              @relation("FileRequestsCreated", fields: [requestedById], references: [id])
  requestedFromId     String
  requestedFrom       User              @relation("FileRequestsReceived", fields: [requestedFromId], references: [id])
  title               String
  description         String?
  category            FileRequestCategory?
  deadline            DateTime?
  status              FileRequestStatus @default(PENDING)
  fulfilledDocumentId String?
  fulfilledDocument   Document?         @relation(fields: [fulfilledDocumentId], references: [id])
  unableReason        String?
  createdAt           DateTime          @default(now())
  updatedAt           DateTime          @updatedAt

  @@index([requestedFromId])
  @@index([requestedById])
  @@index([status])
}

model StorageQuota {
  id        String   @id @default(uuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id])
  quotaBytes BigInt
  usedBytes  BigInt   @default(0)
  updatedAt  DateTime @updatedAt
}

enum VaultPermission {
  VIEW
  DOWNLOAD
  COMMENT
  MANAGE
}

enum ShareLinkTarget {
  DOCUMENT
  FOLDER
}

enum FileRequestStatus {
  PENDING
  FULFILLED
  OVERDUE
  CANCELLED
  UNABLE
}

enum FileRequestCategory {
  QUALIFICATION
  MEDICAL
  TRAINING
  OTHER
}
```

### 10.2 Modifications to Existing Models

```prisma
// Add to existing Document model:
model Document {
  // ... existing fields ...
  archivedAt  DateTime?
  deletedAt   DateTime?

  // New relations
  vaultShares        VaultShare[]
  folderPlacements   VaultFolderDocument[]
  fulfilledRequests  FileRequest[]
}

// Add to existing User model:
model User {
  // ... existing fields ...

  // New relations
  ownedFolders       VaultFolder[]         @relation("OwnedFolders")
  folderMemberships  VaultFolderMember[]
  sharedByMe         VaultShare[]          @relation("SharedByUser")
  sharedWithMe       VaultShare[]          @relation("SharedWithUser")
  shareLinksCreated  VaultShareLink[]
  fileRequestsCreated  FileRequest[]       @relation("FileRequestsCreated")
  fileRequestsReceived FileRequest[]       @relation("FileRequestsReceived")
  storageQuota       StorageQuota?
}
```

---

## 11. Implementation Phase

### 11.1 Recommendation: Phase 2b

This feature should be implemented **after** the Phase 2 core modules (Documents full implementation, Notifications) are stable but **before** Phase 3 (Reports, Compliance module, Integrations).

**Rationale:**
- The vault depends on a stable `documents` module (Phase 1-2 deliverable).
- File requests depend on the `notifications` module (Phase 2 deliverable).
- Sharing is a natural extension of document management, not a standalone module.
- The encryption migration (§4.7) naturally bridges Phase 2 → Phase 3.

### 11.2 Implementation Order

| Step | Deliverable | Dependencies | Estimated Effort |
|------|-------------|-------------|-----------------|
| 2b-1 | **Data model + migrations** — Prisma models, enums, relations | Stable Document model | S |
| 2b-2 | **Vault organization API** — My Vault, archive, deleted, recent, storage tracking | 2b-1 | M |
| 2b-3 | **Shared folders API** — CRUD, member management, document placement | 2b-1 | M |
| 2b-4 | **Per-file sharing API** — Share, unshare, list shared-with-me/by-me | 2b-1 | M |
| 2b-5 | **File requests API** — Create, fulfill, cancel, status transitions, auto-share | 2b-1, Notifications module | M |
| 2b-6 | **Storage quotas API** — Usage tracking, quota enforcement, admin management | 2b-1 | S |
| 2b-7 | **Share links API** — Token generation, access control, access logging | 2b-4 | M |
| 2b-8 | **Vault Home screen (W-24)** — All sections, search, storage indicator | 2b-2, 2b-3, 2b-4 | L |
| 2b-9 | **Shared Folder View (W-25) + Share Dialog (W-26)** | 2b-3 | M |
| 2b-10 | **File Request UI (W-28, W-29)** | 2b-5 | M |
| 2b-11 | **Share Link Dialog (W-27)** | 2b-7 | S |
| 2b-12 | **Storage Management admin screen (A-10)** | 2b-6 | M |
| 2b-13 | **Integration tests + RBAC verification** | All above | M |

**Size key:** S = 1-2 days, M = 3-5 days, L = 5-8 days

### 11.3 What This Spec Does NOT Cover

These are explicitly out of scope for Phase 2b and deferred to later phases:

| Deferred Item | Target Phase | Reason |
|---------------|-------------|--------|
| Client-side encryption (zero-knowledge vault) | Phase 3+ | Complex crypto; server-side encryption is sufficient for Phase 2 |
| Key recovery infrastructure | Phase 3+ | Depends on client-side encryption |
| Real-time collaboration (comments on shared docs) | Phase 3+ | Requires WebSocket infrastructure |
| Sharing analytics (who viewed what, when) | Phase 3+ | Nice-to-have, not compliance-critical |
| Bulk file requests (request from entire team at once) | Phase 2b+ | Could be added as enhancement after core flow works |
| Mobile-optimized vault UI | Phase 3+ | Web-first; mobile responsive is sufficient |
| Offline vault access | Phase 3+ | Requires service worker + local encryption |

---

## Appendix A: Navigation Integration

The Vault adds a new primary nav item to `apps/web`:

```
📊 Home
👤 Me
📁 Vault  ← NEW (all authenticated roles)
👥 Team     (Supervisor+)
📄 Reviews  (Manager+)
⚡ Conflicts (Manager+)
🏛 Compliance (Compliance Officer+)
📋 Standards
🔔 Notifications
```

The `📁 Vault` nav item shows a badge when the user has pending file requests.

## Appendix B: Audit Trail Events

All vault actions generate audit log entries via the existing `AuditLog` model:

| Action | Entity | Details Logged |
|--------|--------|---------------|
| `vault.folder.create` | VaultFolder | Folder name, owner |
| `vault.folder.delete` | VaultFolder | Folder name, member count, document count |
| `vault.folder.member.add` | VaultFolderMember | Folder, user added, permission level |
| `vault.folder.member.remove` | VaultFolderMember | Folder, user removed |
| `vault.folder.member.permission_change` | VaultFolderMember | Folder, user, old permission, new permission |
| `vault.share.create` | VaultShare | Document, sharer, recipient, permission |
| `vault.share.revoke` | VaultShare | Document, sharer, recipient |
| `vault.share.permission_change` | VaultShare | Document, old permission, new permission |
| `vault.link.create` | VaultShareLink | Target, permission, expiration, created by |
| `vault.link.access` | VaultShareLink | Token (truncated), IP, user-agent |
| `vault.link.revoke` | VaultShareLink | Token (truncated), revoked by |
| `vault.request.create` | FileRequest | Requester, target employee, title, deadline |
| `vault.request.fulfill` | FileRequest | Request ID, document ID |
| `vault.request.cancel` | FileRequest | Request ID, cancelled by |
| `vault.document.archive` | Document | Document ID, archived by |
| `vault.document.restore` | Document | Document ID, restored from (archive/deleted) |
| `vault.document.soft_delete` | Document | Document ID, deleted by |
| `vault.document.permanent_delete` | Document | Document ID, purged by |
| `vault.quota.update` | StorageQuota | User, old quota, new quota, changed by (Admin) |

## Appendix C: Notification Events

New notification types for the `notifications` module:

| Trigger | Recipient | Template |
|---------|-----------|----------|
| Document shared with user | Recipient | "{sharer} shared '{document}' with you" |
| Added to shared folder | New member | "{owner} added you to folder '{folder}'" |
| File request created | Target employee | "{requester} requested '{title}' — due {deadline}" |
| File request fulfilled | Requester | "{employee} uploaded '{document}' for your request '{title}'" |
| File request deadline approaching (7 days) | Target employee | "Reminder: '{title}' due in {days} days" |
| File request overdue | Target employee + requester | "'{title}' is past due" |
| Storage quota at 75% | User | "You've used 75% of your vault storage" |
| Storage quota at 90% | User | "You've used 90% of your vault storage — consider archiving" |
| Storage quota exceeded | User + Admin | "Vault storage full — uploads blocked" |
| Share link accessed | Link creator | "Your share link for '{document}' was accessed" |
