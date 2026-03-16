# Proof Vault Encryption Architecture — E-CLAT Platform

> **Status:** Authoritative Reference  
> **Owner:** Freamon (Lead / Architect)  
> **Created:** 2026-03-18  
> **Applies To:** `apps/api` (vault module), `apps/web` (vault UI), `packages/shared` (vault types), Azure Blob Storage  
> **Companion Docs:** [App Spec](./app-spec.md) · [RBAC API Spec](./rbac-api-spec.md) · [Entra Auth Design](./entra-auth-design.md)  
> **Triggered By:** User directive — encrypted proof vault for compliance documents ([decision](../../.squad/decisions/inbox/copilot-directive-proof-vault-encryption.md))

---

## Table of Contents

1. [Overview](#1-overview)
2. [Encryption Design](#2-encryption-design)
3. [Data Model](#3-data-model)
4. [API Endpoints](#4-api-endpoints)
5. [Storage Architecture](#5-storage-architecture)
6. [Client-Side Crypto](#6-client-side-crypto)
7. [Vault Lifecycle](#7-vault-lifecycle)
8. [Security Considerations](#8-security-considerations)
9. [RBAC](#9-rbac)
10. [UI Screens](#10-ui-screens)
11. [Migration Path](#11-migration-path)
12. [Implementation Notes](#12-implementation-notes)

---

## 1. Overview

### What Is the Proof Vault?

The Proof Vault is a **zero-knowledge encrypted document store** where employees store compliance evidence — certifications, medical clearance PDFs, training records, evidence files. It replaces the plaintext document storage model from W-06 (My Documents) with a user-controlled encryption layer.

### Security Model

| Principle | Guarantee |
|-----------|-----------|
| **Zero-knowledge** | Server never sees plaintext file content or the user's passphrase |
| **User-held keys** | Encryption key is derived from a user-chosen passphrase; server stores only a verification token |
| **No recovery** | If the user forgets their passphrase, all vault contents are permanently unrecoverable |
| **Metadata visible** | Filenames, file types, sizes, and dates are stored in plaintext for search/display; only file *content* is encrypted |
| **Audit preserved** | All vault operations (create, upload, download, export, key change) produce audit log entries |

### What the Vault Protects

- **File content** — encrypted at rest in Azure Blob Storage (Azurite locally)
- **Sensitive attachments** — medical records, certification scans, identity documents

### What the Vault Does NOT Protect

- **File metadata** — filenames, MIME types, file sizes, upload dates (stored plaintext in Postgres for searchability)
- **Vault existence** — managers/compliance can see that an employee *has* a vault and how many documents it contains
- **Access patterns** — server logs record that a download occurred (audit trail), though not the decrypted content

---

## 2. Encryption Design

### 2.1 Algorithm Selection

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Symmetric cipher** | AES-256-GCM | Industry standard AEAD cipher. Provides confidentiality + integrity + authentication. Supported by WebCrypto API. |
| **Key derivation** | PBKDF2-SHA-256 (100,000 iterations) | Supported natively by WebCrypto API in all browsers. Argon2 is stronger but requires WASM — defer to Phase 2 if needed. |
| **Salt** | 32 bytes, cryptographically random | Unique per vault, stored alongside vault metadata |
| **IV/Nonce** | 12 bytes per file, cryptographically random | Unique per encrypted blob, stored as blob metadata |
| **Key length** | 256 bits | Derived from PBKDF2 output |

### 2.2 Key Derivation Flow

```
User passphrase
       │
       ▼
┌─────────────────────────┐
│  PBKDF2-SHA-256         │
│  salt: vault.salt (32B) │
│  iterations: 100,000    │
│  keyLength: 256 bits    │
└─────────────────────────┘
       │
       ▼
   Derived Key (256-bit AES key)
       │
       ├──► Encrypt/decrypt file content (AES-256-GCM)
       │
       └──► Encrypt sentinel value → verification token
```

### 2.3 Key Verification (Sentinel Pattern)

To verify the user has entered the correct passphrase **without storing the passphrase or derived key**, we use a sentinel pattern:

1. **On vault creation:** derive the key → encrypt a known sentinel string (`"e-clat-vault-sentinel-v1"`) → store the ciphertext as `verificationToken` on the vault record.
2. **On unlock:** derive the key from the entered passphrase → attempt to decrypt `verificationToken` → if decrypted value matches the sentinel string, the key is correct.
3. **On failure:** AES-GCM authentication tag check fails → decryption throws → wrong passphrase.

This reveals nothing about the key or passphrase. An attacker with database access sees only the encrypted sentinel, which is useless without the passphrase.

### 2.4 Per-Blob Encryption

Each uploaded file is encrypted independently:

```
Plaintext file bytes
       │
       ▼
┌─────────────────────────────┐
│  AES-256-GCM Encrypt        │
│  key: derived key            │
│  iv: random 12 bytes         │
│  additionalData: documentId  │
└─────────────────────────────┘
       │
       ▼
Encrypted blob (ciphertext + auth tag)
  + iv stored in VaultDocument.encryptionIv
```

The `additionalData` (AAD) field binds the ciphertext to the specific document ID, preventing blob-swapping attacks.

### 2.5 Where Encryption Happens

| Operation | Location | Rationale |
|-----------|----------|-----------|
| **Upload** | Client-side (WebCrypto) | True zero-knowledge — server never sees plaintext |
| **Download (single)** | Client-side (WebCrypto) | Encrypted blob delivered to browser, decrypted in-memory |
| **Zip export** | Server-side with per-request key | User provides passphrase in the export request. Server derives key in-memory, decrypts blobs, assembles zip, streams response. Key is never persisted — exists only in request-scoped memory. |

> **Decision:** Zip export is the **only** operation where the server transiently handles the key. This is acceptable because: (a) TLS protects the passphrase in transit, (b) the key exists only in request handler memory for the duration of the zip assembly, (c) no key material is logged or persisted.

### 2.6 Key Change (Re-encryption)

When a user changes their vault passphrase:

1. Derive old key from old passphrase, derive new key from new passphrase + new salt
2. For each `VaultDocument`: download encrypted blob → decrypt with old key → re-encrypt with new key + new IV → upload replacement blob
3. Update `verificationToken` with new sentinel encryption
4. Update `salt` on vault record
5. All steps in a single transaction (Postgres metadata) + sequential blob operations

This is an expensive operation — O(n) blob reads + writes. For vaults with many large files, this should be performed as a background job with progress tracking.

---

## 3. Data Model

### 3.1 Prisma Schema Additions

```prisma
// ─── Proof Vault ────────────────────────────────────────

model ProofVault {
  id                 String          @id @default(uuid())
  employeeId         String          @unique
  employee           Employee        @relation(fields: [employeeId], references: [id])
  salt               String          // Base64-encoded 32-byte PBKDF2 salt
  verificationToken  String          // Base64-encoded encrypted sentinel
  verificationIv     String          // Base64-encoded 12-byte IV for sentinel
  isLocked           Boolean         @default(true)
  documentCount      Int             @default(0)
  totalSizeBytes     BigInt          @default(0)
  createdAt          DateTime        @default(now())
  updatedAt          DateTime        @updatedAt

  documents VaultDocument[]

  @@map("proof_vaults")
}

model VaultDocument {
  id              String     @id @default(uuid())
  vaultId         String
  vault           ProofVault @relation(fields: [vaultId], references: [id], onDelete: Cascade)
  fileName        String
  mimeType        String
  fileSizeBytes   BigInt
  storageKey      String     // Path/key in Azure Blob Storage
  encryptionIv    String     // Base64-encoded 12-byte IV for this file
  description     String     @default("")
  uploadedAt      DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  @@index([vaultId])
  @@map("vault_documents")
}
```

### 3.2 Employee Relation Update

Add to the existing `Employee` model:

```prisma
model Employee {
  // ... existing fields ...
  proofVault ProofVault?
}
```

### 3.3 Design Rationale

| Decision | Rationale |
|----------|-----------|
| **1:1 vault per employee** | Each employee has at most one vault. No shared vaults — zero-knowledge means only the owner can access. |
| **`documentCount` + `totalSizeBytes` denormalized** | Allows managers/compliance to see vault stats without querying encrypted blobs. Updated on upload/delete. |
| **`isLocked` flag** | Server-side tracking. The vault is always "locked" at rest — this flag is informational for the client session state. Actual lock/unlock is key-based. |
| **`storageKey` on VaultDocument** | Maps to the blob path in Azure Blob Storage. Decouples Postgres metadata from blob location. |
| **Separate from `Document` model** | Vault documents are a distinct concept from the existing document review pipeline. Vault documents are user-owned encrypted files; `Document` records are unencrypted documents in the review workflow. They may link (e.g., an approved vault proof → qualification), but the storage is separate. |
| **Cascade delete on vault documents** | If a vault is destroyed, all document metadata is removed. Blob cleanup handled by a background job. |

---

## 4. API Endpoints

### 4.1 New Module: `apps/api/src/modules/vault/`

All vault endpoints are prefixed: `/api/vault`

### 4.2 Endpoint Catalog

| # | Method | Path | Description | Auth | Min Role |
|---|--------|------|-------------|------|----------|
| V-01 | `POST` | `/api/vault` | Create vault (set passphrase) | Bearer | Employee (own) |
| V-02 | `POST` | `/api/vault/unlock` | Verify passphrase, return session token | Bearer | Employee (own) |
| V-03 | `GET` | `/api/vault` | Get vault metadata (existence, doc count, size) | Bearer | Employee (own) |
| V-04 | `GET` | `/api/vault/documents` | List vault documents (metadata only) | Bearer | Employee (own) |
| V-05 | `POST` | `/api/vault/documents` | Upload encrypted document | Bearer | Employee (own) |
| V-06 | `GET` | `/api/vault/documents/:docId` | Get single document metadata | Bearer | Employee (own) |
| V-07 | `GET` | `/api/vault/documents/:docId/download` | Download encrypted blob | Bearer | Employee (own) |
| V-08 | `DELETE` | `/api/vault/documents/:docId` | Delete a vault document | Bearer | Employee (own) |
| V-09 | `POST` | `/api/vault/export` | Export all as zip (passphrase required in body) | Bearer | Employee (own) |
| V-10 | `POST` | `/api/vault/change-passphrase` | Re-encrypt vault with new passphrase | Bearer | Employee (own) |
| V-11 | `DELETE` | `/api/vault` | Destroy vault + all documents | Bearer | Employee (own) |
| V-12 | `GET` | `/api/vault/employee/:employeeId/status` | Vault existence + doc count (no content) | Bearer | Supervisor+ |

### 4.3 Endpoint Details

#### V-01: Create Vault

```typescript
// POST /api/vault
// Body:
{
  salt: string;              // Base64, 32 bytes, client-generated
  verificationToken: string; // Base64, encrypted sentinel
  verificationIv: string;    // Base64, 12 bytes
}
// Response: 201
{
  id: string;
  employeeId: string;
  documentCount: 0;
  totalSizeBytes: 0;
  createdAt: string;
}
```

The client generates the salt, derives the key from the user's passphrase, encrypts the sentinel, and sends only the encrypted artifacts. **The passphrase never leaves the browser.**

#### V-02: Unlock Vault (Verify Passphrase)

```typescript
// POST /api/vault/unlock
// Body:
{
  verificationAttempt: string; // Base64, client re-encrypts sentinel with derived key
}
// Response: 200
{
  verified: true;
  vault: { id, documentCount, totalSizeBytes, createdAt };
}
// Or: 401 { error: "Invalid vault passphrase" }
```

**Implementation detail:** The client derives the key, encrypts the sentinel string, and sends the ciphertext. The server compares this to the stored `verificationToken`. This is NOT a hash comparison — it's a crypto-identity check. Both sides encrypt the same known plaintext with the same derived key; if the ciphertexts' decrypted values match, the key is correct.

**Alternative (simpler):** Server sends back `salt` + `verificationToken` + `verificationIv` on `GET /api/vault`, client derives key and decrypts locally. If decryption succeeds (GCM auth tag valid), the key is correct. This is the **recommended approach** — no verification data needs to be sent to the server.

#### V-05: Upload Encrypted Document

```typescript
// POST /api/vault/documents
// Content-Type: multipart/form-data
// Fields:
{
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;     // Original plaintext size
  encryptionIv: string;      // Base64, 12 bytes, client-generated
  encryptedFile: Blob;       // Binary, AES-256-GCM encrypted content
  description?: string;
}
// Response: 201
{
  id: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadedAt: string;
}
```

The encrypted blob is streamed directly to Azure Blob Storage. The server sees only ciphertext.

#### V-07: Download Encrypted Blob

```typescript
// GET /api/vault/documents/:docId/download
// Response: 200
// Content-Type: application/octet-stream
// X-Encryption-Iv: <base64 IV>
// Body: raw encrypted bytes
```

The client receives encrypted bytes + IV, derives the key from the cached passphrase, decrypts in-browser, and presents the file for save/view.

#### V-09: Zip Export (Server-Side Decryption)

```typescript
// POST /api/vault/export
// Body:
{
  passphrase: string; // Plaintext passphrase — sent over TLS
}
// Response: 200
// Content-Type: application/zip
// Content-Disposition: attachment; filename="proof-vault-export-{date}.zip"
// Body: zip stream of decrypted files
```

**Security notes:**
- Passphrase sent over TLS — encrypted in transit
- Server derives key in request-scoped memory
- Key + plaintext exist only during zip assembly — never persisted
- Request is rate-limited (1 export per 5 minutes)
- Audit log entry created with `action: "vault_export"` (no content logged)

#### V-10: Change Passphrase

```typescript
// POST /api/vault/change-passphrase
// Body:
{
  currentPassphrase: string;
  newSalt: string;              // Base64, new 32-byte salt
  newVerificationToken: string; // Base64, new encrypted sentinel
  newVerificationIv: string;    // Base64, new 12-byte IV
  reEncryptedDocuments: [       // Client re-encrypts each doc
    {
      documentId: string;
      newEncryptionIv: string;  // Base64, new 12-byte IV
      encryptedFile: Blob;      // Re-encrypted content
    }
  ]
}
// Response: 200
{ success: true; documentsUpdated: number; }
```

**Decision: Client-side re-encryption** for passphrase changes. The client downloads each encrypted blob, decrypts with the old key, re-encrypts with the new key, and uploads the replacements. This keeps the operation zero-knowledge — the server never sees plaintext during key change.

For large vaults (>50 files), this should show a progress bar and use chunked uploads. The server applies all metadata updates in a single transaction after all blobs are replaced.

#### V-12: Vault Status (Manager/Compliance View)

```typescript
// GET /api/vault/employee/:employeeId/status
// Response: 200
{
  hasVault: boolean;
  documentCount: number;    // 0 if no vault
  totalSizeBytes: number;   // 0 if no vault
  createdAt: string | null;
}
```

**No content access.** Managers and compliance officers can verify an employee has uploaded proofs, but cannot access the encrypted content.

---

## 5. Storage Architecture

### 5.1 Blob Storage Layout

```
Container: proof-vaults
│
├── {employeeId}/
│   ├── {documentId-1}    ← encrypted blob
│   ├── {documentId-2}    ← encrypted blob
│   └── {documentId-N}    ← encrypted blob
│
├── {anotherEmployeeId}/
│   └── ...
```

| Property | Value |
|----------|-------|
| **Container name** | `proof-vaults` |
| **Blob path** | `{employeeId}/{vaultDocumentId}` |
| **Access tier** | Hot (frequent access for compliance workflows) |
| **Redundancy** | LRS for dev/Azurite, GRS for production |
| **Soft delete** | Enabled, 30-day retention (recovery of encrypted blobs only — still need key) |

### 5.2 Azurite (Local Development)

- Uses the same container layout as production
- Connection string: `UseDevelopmentStorage=true` (default Azurite)
- Container created on first vault creation via `@azure/storage-blob` SDK

### 5.3 Production Azure Blob Storage

- Provisioned via Terraform in `00-foundation` layer alongside existing storage
- Managed identity access (system-assigned on the Container App)
- No SAS tokens — all access through the API server
- Encryption at rest: Azure SSE (platform-managed keys) provides a second encryption layer. Our vault encryption is the primary protection; Azure SSE is defense-in-depth.

### 5.4 Size Limits

| Constraint | Limit | Rationale |
|-----------|-------|-----------|
| **Max file size** | 50 MB | Compliance docs are typically PDFs/images <10 MB |
| **Max vault documents** | 200 | Reasonable upper bound for proof storage |
| **Max vault total size** | 2 GB | Per-employee storage cap |

---

## 6. Client-Side Crypto

### 6.1 WebCrypto API Usage

All cryptographic operations in the browser use the native `window.crypto.subtle` API — no third-party crypto libraries.

```typescript
// packages/shared/src/crypto/vault-crypto.ts

/**
 * Derive an AES-256 key from a passphrase + salt using PBKDF2.
 */
async function deriveKey(
  passphrase: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,              // not extractable
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt a file buffer with AES-256-GCM.
 */
async function encryptFile(
  key: CryptoKey,
  plaintext: ArrayBuffer,
  documentId: string
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: encoder.encode(documentId),
    },
    key,
    plaintext
  );

  return { ciphertext, iv };
}

/**
 * Decrypt a file buffer with AES-256-GCM.
 */
async function decryptFile(
  key: CryptoKey,
  ciphertext: ArrayBuffer,
  iv: Uint8Array,
  documentId: string
): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();

  return crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: encoder.encode(documentId),
    },
    key,
    ciphertext
  );
}

/**
 * Encrypt the sentinel value for vault creation / verification.
 */
const SENTINEL = "e-clat-vault-sentinel-v1";

async function createVerificationToken(
  key: CryptoKey
): Promise<{ token: ArrayBuffer; iv: Uint8Array }> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const token = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(SENTINEL)
  );

  return { token, iv };
}

async function verifyKey(
  key: CryptoKey,
  token: ArrayBuffer,
  iv: Uint8Array
): Promise<boolean> {
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      token
    );
    const decoder = new TextDecoder();
    return decoder.decode(decrypted) === SENTINEL;
  } catch {
    return false; // GCM auth tag failed → wrong key
  }
}
```

### 6.2 Key Lifecycle in Browser

1. **Derive key** — user enters passphrase → `deriveKey()` → `CryptoKey` object
2. **Hold in memory** — the `CryptoKey` is held in a React context/store for the session duration
3. **Never serialize** — the key is created with `extractable: false`, making it impossible to export or log
4. **Clear on lock/logout** — context is cleared, `CryptoKey` reference dropped, garbage collected
5. **No localStorage** — passphrase and key are never written to `localStorage`, `sessionStorage`, `IndexedDB`, or cookies

### 6.3 Browser Compatibility

WebCrypto API with AES-GCM and PBKDF2 is supported in all modern browsers (Chrome 37+, Firefox 34+, Safari 11+, Edge 12+). No polyfill needed.

---

## 7. Vault Lifecycle

### 7.1 State Machine

```
                          ┌─────────────┐
                          │   No Vault  │
                          └──────┬──────┘
                                 │ POST /api/vault
                                 ▼
                          ┌─────────────┐
              ┌──────────►│   Locked    │◄──────────┐
              │           └──────┬──────┘           │
              │                  │ Client-side       │
              │                  │ key verify         │ Logout / timeout /
              │                  ▼                   │ manual lock
              │           ┌─────────────┐           │
              │           │  Unlocked   │───────────┘
              │           └──────┬──────┘
              │                  │
              │     ┌────────────┼────────────┐
              │     ▼            ▼            ▼
              │  Upload       Download     Export
              │  (encrypt)    (decrypt)    (zip)
              │
              │  DELETE /api/vault
              │           │
              │           ▼
              │    ┌─────────────┐
              └────│  Destroyed  │
                   └─────────────┘
```

### 7.2 Flow Details

#### Create Vault
1. Employee navigates to Proof Vault (new screen W-06b or replaces W-06)
2. "Create Vault" button → passphrase entry dialog (min 12 characters, strength meter)
3. Client generates 32-byte salt
4. Client derives key via PBKDF2
5. Client encrypts sentinel → `verificationToken`
6. `POST /api/vault` with `{ salt, verificationToken, verificationIv }`
7. Server stores vault record, returns vault metadata
8. Vault is now in "Unlocked" state (key is in memory)

#### Unlock Vault
1. Employee navigates to vault (page load)
2. `GET /api/vault` returns vault metadata including `salt`, `verificationToken`, `verificationIv`
3. Passphrase entry dialog
4. Client derives key, calls `verifyKey()` locally
5. If valid → vault unlocked, load document list. If invalid → error message.

#### Upload File
1. Vault must be unlocked (key in memory)
2. Employee selects file(s) via file picker
3. Client reads file as `ArrayBuffer`
4. Client calls `encryptFile()` → encrypted blob + IV
5. `POST /api/vault/documents` (multipart: encrypted blob + metadata)
6. Server streams blob to Azure Blob Storage, stores metadata in Postgres
7. UI updates document grid

#### Download File
1. Vault must be unlocked
2. Employee clicks download on a document card
3. `GET /api/vault/documents/:docId/download` → encrypted blob + IV (in header)
4. Client calls `decryptFile()` → plaintext
5. Browser triggers file save dialog

#### Zip Export
1. Vault must be unlocked
2. Employee clicks "Export All" → confirmation dialog
3. User re-enters passphrase (required even though vault is unlocked — defense against unattended sessions)
4. `POST /api/vault/export` with `{ passphrase }`
5. Server derives key, decrypts all blobs in memory, assembles zip stream
6. Browser downloads zip file
7. Server clears key from memory

#### Change Passphrase
1. Vault must be unlocked
2. Employee enters current + new passphrase
3. Client derives both keys
4. Client downloads each encrypted blob, decrypts with old key, re-encrypts with new key
5. `POST /api/vault/change-passphrase` with new crypto artifacts + re-encrypted blobs
6. Server replaces blobs and updates vault metadata atomically
7. Progress bar for large vaults

#### Destroy Vault
1. Employee clicks "Delete Vault" → double-confirmation dialog
2. `DELETE /api/vault`
3. Server soft-deletes vault record, schedules blob cleanup
4. After 30-day retention (soft delete on blob storage), data is permanently gone

### 7.3 Session Timeout

- Vault auto-locks after **15 minutes** of inactivity (client-side timer)
- Locking = dropping the `CryptoKey` reference from memory
- Re-entry of passphrase required to resume operations
- Configurable per deployment (environment variable: `VAULT_SESSION_TIMEOUT_MINUTES`)

---

## 8. Security Considerations

### 8.1 Threat Model

| Threat | Mitigation | Residual Risk |
|--------|-----------|---------------|
| **Database breach** (attacker reads Postgres) | Vault content is not in Postgres — only encrypted blob references. Salt + encrypted sentinel visible, but useless without passphrase. | Attacker could attempt offline brute-force against PBKDF2 with known salt. Mitigated by 100K iterations + passphrase strength requirements. |
| **Blob storage breach** (attacker reads Azure blobs) | All blobs are AES-256-GCM encrypted. Attacker gets ciphertext only. | Same brute-force risk as above. Azure SSE adds defense-in-depth. |
| **Server compromise** (attacker has code execution on API server) | For upload/download: zero-knowledge, server never sees plaintext. For zip export: attacker could intercept passphrase in request memory. | Zip export is the weak point. Accept this trade-off for usability. Rate-limit exports. |
| **Man-in-the-middle** | TLS everywhere. Passphrase for zip export sent over TLS. | If TLS is compromised, passphrase is exposed during export. Standard TLS risk. |
| **Weak passphrase** | Enforce minimum 12 characters, client-side strength meter. PBKDF2 with 100K iterations adds computational cost. | Determined attacker with GPU cluster could brute-force weak passphrases. Argon2 (Phase 2) improves this. |
| **Unattended browser** | Auto-lock after 15 minutes. Re-auth required for export. Key not extractable. | Physical access to unlocked browser reveals decrypted files in memory. Standard browser security limitation. |
| **Blob-swapping attack** | AAD (Additional Authenticated Data) binds ciphertext to document ID. Swapping blobs causes decryption failure. | None — GCM authentication prevents this. |

### 8.2 What We Explicitly Do NOT Attempt

- **Key escrow / recovery** — by design, forgotten passphrases mean permanent data loss
- **Admin override** — no admin backdoor to decrypt vault contents
- **Server-side key storage** — not in Redis, not in database, not in Key Vault (the encryption key is user-owned)
- **Audit of content** — audit logs record operations (upload, download, export) but never log file content or names of decrypted files

### 8.3 Passphrase Requirements

| Requirement | Value |
|-------------|-------|
| Minimum length | 12 characters |
| Strength meter | Client-side (zxcvbn or similar library) |
| Blocklist | Common passwords rejected |
| Re-entry for export | Required even if vault is unlocked |
| No server validation | Server never receives the passphrase (except for zip export) |

---

## 9. RBAC

### 9.1 Permission Model

New permissions added to the `vault` resource category:

| Permission | Description |
|-----------|-------------|
| `vault:create` | Create own proof vault |
| `vault:read` | Read own vault metadata + document list |
| `vault:write` | Upload/delete documents in own vault |
| `vault:export` | Export own vault as zip |
| `vault:delete` | Destroy own vault |
| `vault:read_status` | View another employee's vault existence + doc count |

### 9.2 Role-Permission Matrix

| Permission | Employee | Supervisor | Manager | CO | Admin |
|-----------|:--------:|:----------:|:-------:|:--:|:-----:|
| `vault:create` | ✅ own | ✅ own | ✅ own | ✅ own | ✅ own |
| `vault:read` | ✅ own | ✅ own | ✅ own | ✅ own | ✅ own |
| `vault:write` | ✅ own | ✅ own | ✅ own | ✅ own | ✅ own |
| `vault:export` | ✅ own | ✅ own | ✅ own | ✅ own | ✅ own |
| `vault:delete` | ✅ own | ✅ own | ✅ own | ✅ own | ✅ own |
| `vault:read_status` | ❌ | ✅ team | ✅ dept | ✅ org | ✅ org |

### 9.3 Data Scoping

| Role | Vault Access | Status Access (V-12) |
|------|-------------|---------------------|
| **Employee** | Own vault only | None — cannot see others' vault status |
| **Supervisor** | Own vault only | Can see vault status for direct reports |
| **Manager** | Own vault only | Can see vault status for department members |
| **Compliance Officer** | Own vault only | Can see vault status for all employees |
| **Admin** | Own vault only | Can see vault status for all employees |

> **Critical invariant:** No role — not even Admin — can read, download, or decrypt another employee's vault content. The `vault:read_status` permission reveals only: `hasVault`, `documentCount`, `totalSizeBytes`, `createdAt`.

---

## 10. UI Screens

### 10.1 New/Modified Screens

| # | Screen | Route | Description | Min Role |
|---|--------|-------|-------------|----------|
| W-06a | Proof Vault | `/me/vault` | Vault management: create, unlock, file grid, upload, export | Employee |
| W-06b | Proof Vault Setup | `/me/vault/setup` | First-time vault creation with passphrase entry | Employee |

W-06 (My Documents) remains for the standard document review workflow. The Proof Vault is a **separate, parallel screen** — not a replacement. Employees use My Documents for compliance workflow uploads (which enter the review queue) and Proof Vault for personal encrypted storage of sensitive evidence.

### 10.2 Navigation Addition

Add to the "Me" section in `apps/web`:

```
👤 Me
  📊 My Profile
  📋 My Qualifications
  🏥 My Medical
  📄 My Documents        ← existing (review workflow)
  🔒 Proof Vault         ← NEW (encrypted storage)
  ⏰ My Hours
  🔔 Notifications
```

### 10.3 Proof Vault Screen (W-06a) — Wireframe

#### Locked State

```
┌─────────────────────────────────────────────────────────────┐
│  🔒 Proof Vault                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│         ┌──────────────────────────────────┐                │
│         │  🔐 Enter Your Vault Passphrase  │                │
│         │                                  │                │
│         │  ┌──────────────────────────┐    │                │
│         │  │ ●●●●●●●●●●●●●●          │    │                │
│         │  └──────────────────────────┘    │                │
│         │                                  │                │
│         │  ⚠️ If you forget your passphrase│                │
│         │    your proofs are unrecoverable │                │
│         │                                  │                │
│         │         [ Unlock Vault ]         │                │
│         └──────────────────────────────────┘                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Unlocked State (File Grid — Reference Pattern)

```
┌─────────────────────────────────────────────────────────────┐
│  🔓 Proof Vault                               ⊕ Add  🔒Lock│
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────┐              │
│  │ 🔍 Search files...                        │              │
│  └───────────────────────────────────────────┘              │
│                                                             │
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │    ┌──────────┐     │  │    ┌──────────┐     │          │
│  │    │   📄     │     │  │    │   🏥     │     │          │
│  │    │  (PDF)   │     │  │    │  (PDF)   │     │          │
│  │    └──────────┘     │  │    └──────────┘     │          │
│  │  **CPR-Cert-2026**  │  │  **Medical-Clear**  │          │
│  │  2.3 MB · Mar 2026  │  │  1.1 MB · Feb 2026  │          │
│  │  [ ↓ ] [ 🗑 ]       │  │  [ ↓ ] [ 🗑 ]       │          │
│  └─────────────────────┘  └─────────────────────┘          │
│                                                             │
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │    ┌──────────┐     │  │    ┌──────────┐     │          │
│  │    │   🖼️     │     │  │    │   📋     │     │          │
│  │    │  (IMG)   │     │  │    │ (DOCX)   │     │          │
│  │    └──────────┘     │  │    └──────────┘     │          │
│  │  **ID-Badge-Photo** │  │  **Training-Log**   │          │
│  │  4.5 MB · Jan 2026  │  │  0.8 MB · Mar 2026  │          │
│  │  [ ↓ ] [ 🗑 ]       │  │  [ ↓ ] [ 🗑 ]       │          │
│  └─────────────────────┘  └─────────────────────┘          │
│                                                             │
│  ──────────────────────────────────────────────             │
│  4 files · 8.7 MB total          [ 📦 Export Zip ]         │
└─────────────────────────────────────────────────────────────┘
```

### 10.4 UI Design Elements (Matching Reference)

| Element | Implementation |
|---------|---------------|
| **2-column grid** | CSS Grid, `grid-template-columns: 1fr 1fr`, responsive to single column on mobile |
| **File-type icons** | Large icon with soft colored circle background (PDF=red, DOC=blue, IMG=green, etc.) |
| **Card design** | White background, rounded corners (`border-radius: 12px`), subtle shadow |
| **File info** | Bold filename (truncated with ellipsis), muted subtitle: `{size} · {date}` |
| **Search bar** | Filters document list by filename (client-side, metadata already loaded) |
| **Add button** | ⊕ icon top-right, opens file picker → encrypts → uploads |
| **Lock button** | 🔒 top-right, clears key from memory, returns to locked state |
| **Footer** | File count + total size + Export Zip button |
| **Empty state** | Illustration + "Your vault is empty — upload your first proof" + prominent add button |

### 10.5 Upload Flow UI

1. Click ⊕ → native file picker opens
2. File selected → upload progress card appears in grid
3. Progress bar shows encryption + upload progress
4. On complete → card transitions to normal file card
5. Multiple files can be selected and upload in parallel

### 10.6 Manager/Compliance View

On the Employee Detail screen (W-10), add a "Proof Vault" section:

```
┌─────────────────────────────────────────┐
│  🔒 Proof Vault                         │
│  ────────────────────────               │
│  Vault created: Mar 15, 2026            │
│  Documents: 7                           │
│  Total size: 12.4 MB                    │
│                                         │
│  ℹ️ Vault contents are encrypted.       │
│  Only the employee can access them.     │
└─────────────────────────────────────────┘
```

---

## 11. Migration Path

### 11.1 Existing Documents

The current `Document` model stores unencrypted file references in the review workflow. These are **not** migrated to the Proof Vault. The two systems are parallel:

| System | Purpose | Storage | Encryption |
|--------|---------|---------|------------|
| **Documents** (existing) | Compliance review workflow — upload, AI processing, manager review, approval | Azure Blob (unencrypted) + Postgres | None (Azure SSE only) |
| **Proof Vault** (new) | Personal encrypted evidence storage — user-controlled | Azure Blob (AES-256-GCM) + Postgres | Client-side AES-256-GCM |

### 11.2 Linking Vault Documents to Compliance Records

After a qualification or medical clearance is approved, an employee may want to store the underlying evidence in their vault. The flow:

1. Employee uploads document through standard workflow → `POST /api/documents/upload`
2. Document enters review queue → approved by Manager+
3. Approved document linked to qualification
4. Employee can **separately** upload the same file to their Proof Vault for personal encrypted backup
5. No automatic migration — the employee chooses what to vault

### 11.3 Future Enhancement: Vault-to-Review Pipeline

In a future phase, consider allowing direct submission from the vault:

1. Employee selects a vault document
2. Client decrypts in-memory → re-uploads as a standard (unencrypted) Document
3. Document enters the review queue as normal

This preserves zero-knowledge (vault → client decrypt → standard upload) while streamlining the workflow. **Deferred to Phase 2+.**

### 11.4 Database Migration

```sql
-- Migration: Create proof vault tables

CREATE TABLE proof_vaults (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         UUID NOT NULL UNIQUE REFERENCES employees(id),
  salt                TEXT NOT NULL,
  verification_token  TEXT NOT NULL,
  verification_iv     TEXT NOT NULL,
  is_locked           BOOLEAN NOT NULL DEFAULT true,
  document_count      INTEGER NOT NULL DEFAULT 0,
  total_size_bytes    BIGINT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE vault_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id        UUID NOT NULL REFERENCES proof_vaults(id) ON DELETE CASCADE,
  file_name       TEXT NOT NULL,
  mime_type       TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  storage_key     TEXT NOT NULL,
  encryption_iv   TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vault_documents_vault_id ON vault_documents(vault_id);
```

---

## 12. Implementation Notes

### 12.1 Module Structure

```
apps/api/src/modules/vault/
  ├── index.ts         // Module export
  ├── router.ts        // Express routes (V-01 through V-12)
  ├── service.ts       // Business logic + blob storage interaction
  ├── validators.ts    // Zod schemas for all vault inputs
  └── crypto.ts        // Server-side PBKDF2 + AES-GCM for zip export

packages/shared/src/
  ├── crypto/
  │   └── vault-crypto.ts  // Client-side WebCrypto utilities (shared module)
  └── types/
      └── vault.ts         // Vault + VaultDocument types
```

### 12.2 Dependencies

| Package | Purpose | Where |
|---------|---------|-------|
| `@azure/storage-blob` | Azure Blob Storage SDK | `apps/api` |
| `archiver` | Zip file generation for export | `apps/api` |
| `zxcvbn` | Password strength estimation | `apps/web` |

### 12.3 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AZURE_STORAGE_CONNECTION_STRING` | Blob storage connection | `UseDevelopmentStorage=true` |
| `VAULT_CONTAINER_NAME` | Blob container name | `proof-vaults` |
| `VAULT_MAX_FILE_SIZE_MB` | Max single file size | `50` |
| `VAULT_MAX_DOCUMENTS` | Max documents per vault | `200` |
| `VAULT_MAX_TOTAL_SIZE_MB` | Max total vault size | `2048` |
| `VAULT_SESSION_TIMEOUT_MINUTES` | Client-side auto-lock | `15` |
| `VAULT_EXPORT_RATE_LIMIT_MINUTES` | Minimum time between exports | `5` |
| `VAULT_PBKDF2_ITERATIONS` | PBKDF2 iteration count | `100000` |

### 12.4 Testing Strategy

| Layer | What | How |
|-------|------|-----|
| **Unit** | `vault-crypto.ts` functions | Jest + Node's `crypto.subtle` (Node 15+) |
| **Unit** | Service layer (vault CRUD, blob mock) | Jest + Prisma mock + Azurite mock |
| **Integration** | Full API routes with Azurite | Supertest + Docker Compose (Azurite container) |
| **E2E** | Complete vault lifecycle (create → upload → download → export) | Playwright + Azurite |

### 12.5 Phase Rollout

| Phase | Scope |
|-------|-------|
| **Phase 1** (MVP) | Vault create, upload, download, delete. Client-side crypto. File grid UI. |
| **Phase 2** | Zip export (server-side decryption). Passphrase change. Manager vault status view. |
| **Phase 3** | Vault-to-review pipeline. Argon2 upgrade. Background re-encryption job for key changes. |

---

## Appendix: Decision Log

| # | Decision | Rationale | Alternatives Rejected |
|---|----------|-----------|----------------------|
| D-01 | AES-256-GCM for symmetric encryption | AEAD, WebCrypto native, industry standard | ChaCha20-Poly1305 (not in WebCrypto), AES-CBC (no authentication) |
| D-02 | PBKDF2 for key derivation | WebCrypto native, no WASM dependency | Argon2 (requires WASM, deferred to Phase 3), scrypt (limited WebCrypto support) |
| D-03 | Client-side encryption for upload/download | True zero-knowledge | Server-side (leaks plaintext to server memory) |
| D-04 | Server-side decryption for zip export | Impractical to assemble zip client-side for many files | Client-side zip (slow, memory-heavy for large vaults) |
| D-05 | Metadata in plaintext | Enables search, display, compliance reporting | Encrypt everything (kills searchability, breaks manager status view) |
| D-06 | Separate from Document model | Different lifecycle, different security model, different access patterns | Extend Document with encryption flags (muddies the review workflow) |
| D-07 | No key recovery | Zero-knowledge by design; recovery = backdoor | Key escrow (breaks zero-knowledge), admin recovery (compliance risk) |
| D-08 | Client-side re-encryption for key change | Keeps key change zero-knowledge | Server-side re-encryption (server sees plaintext during change) |
| D-09 | Sentinel pattern for key verification | Reveals nothing about key; uses GCM auth tag for verification | Passphrase hash comparison (leaks hash, vulnerable to rainbow tables) |
