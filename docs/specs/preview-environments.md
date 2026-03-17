# Preview Environments Specification — E-CLAT

> **Status:** Design Proposal  
> **Owner:** Daniels (Microservices Engineer)  
> **Date:** 2026-03-16  
> **Applies To:** `.github/workflows`, `infra/layers`, `infra/modules`, Azure Container Apps, PostgreSQL  
> **Related Issues:** #50 (preview environments), #26 (subsystem modules), #35 (change detection), #4 (pipeline epic)  
> **Companion Docs:** `docs/specs/pipeline-architecture-spec.md`, `docs/specs/service-architecture-spec.md`, `docs/req/parallel-deployment-requirements.md`

---

## 1. Goal

Enable high-change subsystems (records, compliance) to validate PRs in ephemeral, isolated preview environments before merging to main, reducing deployment risk and enabling cross-subsystem testing while maintaining cost efficiency and clean state management.

---

## 2. Design Principles

1. **Lifecycle automation:** PR open → provision, PR push → update, PR close/merge → destroy (zero-touch)
2. **Subsystem isolation:** Records previews are independent of compliance previews; shared foundation/data layers only
3. **Cost control:** Auto-TTL (e.g., 7 days), max concurrent previews per subsystem, resource limits per preview instance
4. **State clarity:** Each preview is tracked in Terraform state, tagged, and auditable
5. **Developer experience:** Unique URL, health check, PR comment with link + instructions, smoke test results
6. **Production-safe:** No credential leaks, no data replication from prod, use seeded test data
7. **Scoped rollout:** Start with records-service (documents, hours), proof-of-concept before expanding

---

## 3. Architecture Decision: Revision-Based Previews vs Dedicated Apps

### 3.1 Option A: Container Apps Revisions (RECOMMENDED)

**Approach:** Use Azure Container Apps native revision system to deploy PR-specific versions alongside production revisions.

**Mechanics:**
- Single Container App per subsystem (e.g., `eclat-records-dev`)
- Each PR generates a unique revision (e.g., `pr-123-records`, `pr-124-records`)
- GitHub Actions updates the app with `--revision-suffix pr-{PR_NUMBER}`
- Azure Container Apps automatically routes based on revision label
- Each revision gets its own FQDN (e.g., `pr-123--eclat-records-dev.azurecontainerapps.io`)
- Auto-deactivate inactive revisions after N days (TTL policy)

**Advantages:**
- Native Azure Container Apps feature — no custom orchestration
- Single app to manage per subsystem, drastically simpler Terraform
- Automatic DNS/networking (no custom ingress rules needed)
- Built-in traffic splitting for gradual rollout (if later needed)
- Cleaner state file — revisions are managed within the app resource

**Disadvantages:**
- Revisions share the same app resource (shared CPU, memory pools)
- Preview traffic counts toward main app quota (manageable via resource limits)

### 3.2 Option B: Dedicated Container App per PR (CONSIDERED, NOT RECOMMENDED)

**Approach:** Create a separate Container App for each PR (e.g., `eclat-records-pr-123-dev`).

**Advantages:**
- Complete resource isolation (no contention)
- Simpler networking (each app has its own endpoint)

**Disadvantages:**
- Terraform state explosion (1 app per active PR × N subsystems = N×M resources)
- Difficult quota management (Azure subscriptions have Container App limits)
- Networking complexity (DNS scaling, certificate management per app)
- Cost visibility harder (metering per app vs per subsystem)

---

## **DECISION: Use Container Apps Revisions**

Revisions provide the right balance of isolation (per-preview) and manageability (single app resource).

---

## 4. Database Strategy

### 4.1 Option A: Shared Database with Schema Prefix (RECOMMENDED)

**Approach:** All previews connect to the **same dev PostgreSQL database** but use schema isolation via prefix (e.g., `pr_123_records`, `pr_124_records`).

**Mechanics:**
1. Prisma migration runs `CREATE SCHEMA pr_123_records; ALTER SCHEMA pr_123_records OWNER TO app_user;`
2. Database URL in Container App revision points to the same host but with `search_path = pr_123_records` (Prisma uses schema prefix in connection string or environment variable)
3. On preview destroy, cleanup job runs `DROP SCHEMA IF EXISTS pr_123_records CASCADE;`
4. Prisma schema remains single — no custom per-schema management

**Advantages:**
- Single database to manage and back up
- No additional database provisioning complexity
- Easy cleanup (drop schema vs. drop entire DB)
- Cost-efficient (N previews share infrastructure)
- Familiar workflow (developers see their schema as logical silo)

**Disadvantages:**
- Requires Prisma configuration per connection to set schema search path
- All previews hit the same database server (manageable via connection pooling, resource limits)
- Accidental cross-schema query would be a logic bug (mitigated by testing, code review)

### 4.2 Option B: Seeded Snapshot per Preview (CONSIDERED)

**Approach:** Restore a pre-seeded database backup per preview (one backup per subsystem, pre-created and uploaded to blob storage).

**Advantages:**
- Complete data isolation
- Deterministic test data (same seed every time)

**Disadvantages:**
- Backup management overhead (maintain, version, rotate)
- Much slower preview creation (restore time)
- Storage costs (multiple backups)
- No data reuse across previews (if 10 records previews run, 10 copies of same snapshot)

### 4.3 Option C: Per-Preview Database Instance (NOT RECOMMENDED)

**Approach:** Provision a separate managed PostgreSQL per preview.

**Disadvantages:**
- Massive cost (each preview is a full database instance)
- Quota exhaustion (Azure managed DB limits)
- Slow spinup and spindown

---

## **DECISION: Use Shared Database with Schema Prefix**

Balances cost, speed, and isolation. Seed each schema with standardized test data at preview provision time.

---

## 5. Networking & DNS

### 5.1 Preview URL Scheme

Each revision in a Container App auto-gets a FQDN from Azure:

```
pr-{PR_NUMBER}--{service-name}-{environment}.azurecontainerapps.io
```

Example:
- Main app FQDN: `eclat-records-dev.azurecontainerapps.io`
- PR #123 preview FQDN: `pr-123--eclat-records-dev.azurecontainerapps.io`

**DNS Management:** Handled by Azure Container Apps natively (no custom DNS or ingress controller needed).

### 5.2 Custom Domain (Optional)

For better UX, optionally add a custom domain mapping:

```
pr-123-records.dev.eclat.com → pr-123--eclat-records-dev.azurecontainerapps.io
```

This requires:
1. Azure Container Apps custom domain binding (requires valid TLS cert)
2. DNS CNAME record in Route53 or Azure DNS pointing to Container App FQDN
3. Managed certificate provisioning (Azure App Service domain module)

**Scope:** Not required for MVP; standard Azure FQDN is sufficient for testing.

### 5.3 Cross-Preview Communication

If preview APIs need to call other preview services:
- Records preview → Compliance preview (e.g., fetch templates)

**Approach:**
1. Environment variable in Container App revision: `COMPLIANCE_SERVICE_URL=https://pr-124--eclat-compliance-dev.azurecontainerapps.io`
2. Or use shared service discovery (if service mesh is added later)

**MVP:** Each subsystem preview is tested in isolation; cross-subsystem integration is done on main/staging.

---

## 6. GitHub Actions Integration

### 6.1 Preview Workflow Triggers

**Trigger 1: PR Labeled `preview:records`**
```yaml
on:
  pull_request:
    types: [opened, synchronize, labeled, unlabeled]

jobs:
  preview-records:
    if: contains(github.event.pull_request.labels.*.name, 'preview:records')
    runs-on: ubuntu-latest
    # Provision / update preview
```

**Trigger 2: Path Detection**
```yaml
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  detect-preview-paths:
    runs-on: ubuntu-latest
    outputs:
      records-changed: ${{ steps.filter.outputs.records_service }}
      compliance-changed: ${{ steps.filter.outputs.compliance_service }}
    steps:
      - uses: dorny/paths-filter@v3
        id: filter
        # Reuse existing filters from ci.yml
```

**Trigger 3: PR Closed / Merged**
```yaml
on:
  pull_request:
    types: [closed]

jobs:
  preview-cleanup:
    runs-on: ubuntu-latest
    # Destroy preview (regardless of merge status)
```

### 6.2 Workflow Skeleton: Provision Preview

**File:** `.github/workflows/preview-records.yml` (similar for compliance, notifications, etc.)

```yaml
name: Preview — Records Service

on:
  pull_request:
    types: [opened, synchronize, labeled, unlabeled]
    branches: [main]

env:
  TF_IN_AUTOMATION: "true"
  AZURE_CLIENT_ID: ${{ secrets.AZURE_CLIENT_ID_DEV }}
  AZURE_TENANT_ID: ${{ secrets.AZURE_TENANT_ID_DEV }}
  AZURE_SUBSCRIPTION_ID: ${{ secrets.AZURE_SUBSCRIPTION_ID_DEV }}

jobs:
  check-preview-trigger:
    runs-on: ubuntu-latest
    outputs:
      should-create: ${{ steps.decide.outputs.create_preview }}
    steps:
      - uses: actions/checkout@v6
      - id: decide
        shell: bash
        run: |
          # Check label OR detect path changes
          if [[ "${{ contains(github.event.pull_request.labels.*.name, 'preview:records') }}" == "true" ]]; then
            echo "create_preview=true" >> $GITHUB_OUTPUT
          fi

  provision-preview:
    if: needs.check-preview-trigger.outputs.should-create == 'true'
    needs: check-preview-trigger
    runs-on: ubuntu-latest
    environment: dev
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v6
      - uses: azure/login@v2
        with:
          client-id: ${{ env.AZURE_CLIENT_ID }}
          tenant-id: ${{ env.AZURE_TENANT_ID }}
          subscription-id: ${{ env.AZURE_SUBSCRIPTION_ID }}

      # Build API image
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm ci
      - run: npm run build
      - name: Build and push API image
        run: |
          az acr build \
            --registry ${{ env.ACR_LOGIN_SERVER }} \
            --image api:pr-${{ github.event.pull_request.number }}-records \
            --file apps/api/Dockerfile .

      # Initialize Terraform (preview-specific state)
      - uses: hashicorp/setup-terraform@v4
      - name: Terraform Init
        working-directory: infra/layers/20-compute/preview
        env:
          TF_VAR_pr_number: ${{ github.event.pull_request.number }}
          TF_VAR_subsystem: records
        run: |
          terraform init \
            -backend-config="key=preview-pr-${{ github.event.pull_request.number }}-records.tfstate" \
            -input=false

      # Apply preview Terraform module
      - name: Terraform Apply
        working-directory: infra/layers/20-compute/preview
        env:
          TF_VAR_pr_number: ${{ github.event.pull_request.number }}
          TF_VAR_subsystem: records
          TF_VAR_api_image_tag: "pr-${{ github.event.pull_request.number }}-records"
          TF_VAR_db_schema: "pr_${{ github.event.pull_request.number }}_records"
        run: terraform apply -input=false -auto-approve

      # Capture preview URL from Terraform output
      - id: preview
        run: |
          PREVIEW_URL=$(terraform output -raw preview_url)
          echo "preview_url=$PREVIEW_URL" >> $GITHUB_OUTPUT

      # Seed database schema with test data
      - name: Seed Test Data
        run: |
          npm run db:migrate:dev -w @e-clat/data -- \
            --database-url "postgresql://...?schema=pr_${{ github.event.pull_request.number }}_records"

      # Run smoke tests
      - name: Smoke Tests
        env:
          API_URL: ${{ steps.preview.outputs.preview_url }}
        run: npm run test:smoke

      # Comment on PR with preview URL
      - uses: actions/github-script@v7
        env:
          PREVIEW_URL: ${{ steps.preview.outputs.preview_url }}
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `✅ Preview environment deployed!\n\n- **Service:** Records\n- **URL:** ${process.env.PREVIEW_URL}\n- **Database:** Schema \`pr_${context.issue.number}_records\`\n- **Expires:** 7 days or on PR close\n\n[View Logs](${context.payload.pull_request.html_url}/checks)`
            })
```

### 6.3 Workflow Skeleton: Cleanup Preview

**File:** `.github/workflows/preview-cleanup.yml`

```yaml
name: Cleanup Preview

on:
  pull_request:
    types: [closed]

env:
  TF_IN_AUTOMATION: "true"
  AZURE_CLIENT_ID: ${{ secrets.AZURE_CLIENT_ID_DEV }}
  AZURE_TENANT_ID: ${{ secrets.AZURE_TENANT_ID_DEV }}
  AZURE_SUBSCRIPTION_ID: ${{ secrets.AZURE_SUBSCRIPTION_ID_DEV }}

jobs:
  cleanup:
    runs-on: ubuntu-latest
    environment: dev
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v6
      - uses: azure/login@v2
      - uses: hashicorp/setup-terraform@v4

      # Destroy Records preview
      - name: Terraform Destroy — Records
        working-directory: infra/layers/20-compute/preview
        env:
          TF_VAR_pr_number: ${{ github.event.pull_request.number }}
          TF_VAR_subsystem: records
        run: terraform destroy -auto-approve -input=false

      # Destroy Compliance preview (if exists)
      - name: Terraform Destroy — Compliance
        working-directory: infra/layers/20-compute/preview
        env:
          TF_VAR_pr_number: ${{ github.event.pull_request.number }}
          TF_VAR_subsystem: compliance
        continue-on-error: true
        run: terraform destroy -auto-approve -input=false

      # Drop database schemas
      - name: Drop Test Schemas
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL_DEV }}
        run: |
          psql "$DATABASE_URL" -c "DROP SCHEMA IF EXISTS pr_${{ github.event.pull_request.number }}_records CASCADE;"
          psql "$DATABASE_URL" -c "DROP SCHEMA IF EXISTS pr_${{ github.event.pull_request.number }}_compliance CASCADE;"
```

---

## 7. Terraform Architecture for Previews

### 7.1 Directory Structure

```
infra/
├── layers/
│   ├── 00-foundation/
│   ├── 10-data/
│   ├── 20-compute/
│   │   ├── main.tf (existing — main app)
│   │   ├── preview/ ← NEW
│   │   │   ├── main.tf (preview resource definitions)
│   │   │   ├── variables.tf
│   │   │   ├── outputs.tf
│   │   │   └── versions.tf
│   │   └── ...
│   └── 30-promotion/
└── modules/
    ├── compute/
    ├── compute-records/
    ├── compute-compliance/
    └── compute-preview/ ← NEW (reusable preview module)
```

### 7.2 Preview Module: `infra/modules/compute-preview/main.tf`

Provisions a Container Apps revision for a given PR + subsystem.

```hcl
variable "subsystem" {
  type        = string
  description = "Subsystem key: records, compliance, notifications"
}

variable "pr_number" {
  type        = number
  description = "GitHub PR number"
}

variable "api_image_tag" {
  type        = string
  description = "Container image tag (e.g., pr-123-records)"
}

variable "db_schema" {
  type        = string
  description = "PostgreSQL schema name (e.g., pr_123_records)"
}

variable "container_app_name" {
  type        = string
  description = "Existing Container App to attach revision to"
}

variable "environment" {
  type        = string
  description = "Environment (dev, staging, etc.)"
}

# Outputs
output "preview_url" {
  value = "https://pr-${var.pr_number}--${var.container_app_name}.azurecontainerapps.io"
}

output "revision_name" {
  value = data.azurerm_container_app.main.latest_revision_name
}
```

**Key aspects:**
- No resource creation — purely outputs the computed FQDN
- Assumes Container App exists (provisioned in 20-compute/main.tf)
- Revision suffix (`pr-{PR_NUMBER}`) is applied by GitHub Actions `az containerapp update` command
- Outputs used by GitHub Actions to construct preview URL and test commands

### 7.3 Deployment: `infra/layers/20-compute/preview/main.tf`

Orchestrates the preview module for a specific PR/subsystem:

```hcl
module "preview" {
  source = "../../modules/compute-preview"

  subsystem            = var.subsystem
  pr_number            = var.pr_number
  api_image_tag        = var.api_image_tag
  db_schema            = var.db_schema
  container_app_name   = data.terraform_remote_state.compute.outputs.api_container_app_name
  environment          = var.environment
}

output "preview_url" {
  value = module.preview.preview_url
}
```

### 7.4 State Management for Previews

**Per-preview Terraform state files in Azure Storage:**

```
tfstate/
├── foundation.tfstate (shared)
├── data.tfstate (shared)
├── compute.tfstate (shared main app)
├── preview-pr-123-records.tfstate ← preview-specific
├── preview-pr-123-compliance.tfstate ← preview-specific
└── preview-pr-124-records.tfstate ← another PR's preview
```

**Backend configuration in GitHub Actions:**
```bash
terraform init \
  -backend-config="key=preview-pr-${{ github.event.pull_request.number }}-${{ matrix.subsystem }}.tfstate"
```

This ensures each preview PR has its own isolated state file, avoiding conflicts and enabling parallel preview provisioning across subsystems.

---

## 8. Cost Controls

### 8.1 Resource Limits

**Per-revision constraints in Container Apps:**
- CPU: 0.25 vCPU (half the main app)
- Memory: 512 MB (1/4 the main app)
- Min replicas: 0 (scales to zero when inactive)
- Max replicas: 1 (no auto-scaling)

**Effect:** Idle preview costs near-zero; active preview uses minimal resources.

### 8.2 Max Concurrent Previews

**Policy:** No more than 5 concurrent preview revisions per subsystem (per environment).

**Implementation:**
- Documented quota in `docs/guides/preview-environment-usage.md`
- Enforcement: GitHub Actions workflow comments warn if quota exceeded
- Cleanup: Oldest preview destroyed if quota is breached (automated in cleanup-preview.yml)

### 8.3 Auto-TTL

**Retention:** Preview revisions auto-inactivate after 7 days of no traffic.

**Implementation:**
```hcl
# In compute-preview module
resource "azurerm_container_app" "main" {
  revision_mode = "multiple"
  
  ingress {
    allow_insecure_connections = false
    target_port = 3000
    traffic_weight = [
      {
        latest_revision = true
        percentage = 100
      },
      {
        revision_suffix = "pr-${var.pr_number}"
        percentage = 0
      }
    ]
  }
}

# Scheduled cleanup job (runs nightly)
resource "azurerm_container_app" "cleanup_revisions" {
  trigger_type = "schedule"
  cron_expression = "0 2 * * *"  # 2 AM UTC daily
  # Script: list revisions older than 7 days, deactivate
}
```

---

## 9. Integration with Promotion Pipeline

### 9.1 Positioning in Workflow

```
Developer Push → CI (subsystem lanes)
                 ↓
                 PR Created
                 ↓
                 Label: preview:records? → YES
                 ↓
                 Preview Records Provision (independent of main deployment)
                 ↓
                 Smoke tests, manual validation
                 ↓
                 Merge to main (if approved)
                 ↓
                 CI runs (subsystem lanes) → Build artifact
                 ↓
                 Promotion pipeline (dev→staging→prod, NOT including preview)
                 ↓
                 PR Close → Preview Cleanup
```

**Key points:**
- Previews are **PRE-MAIN**, not part of the promotion chain
- Preview artifacts do NOT flow to dev/staging/prod
- Main branch deployments follow the existing 30-promotion layer (SHA-based, immutable)
- Previews use **pull request-specific container images**, destroyed after PR close

### 9.2 No Impact on Promotion Policy

The 30-promotion layer (dev→staging→prod) remains unchanged:
- Uses SHA-based immutable tags (`sha-abc123`)
- Artifact signing, approval gates, audit trails
- Previews are orthogonal test environments, not part of this chain

---

## 10. Terraform Considerations

### 10.1 Dynamic Resource Naming

**Pattern:** Use `pr_number` and `subsystem` variables to generate unique names.

```hcl
locals {
  revision_suffix = "pr-${var.pr_number}-${var.subsystem}"
  db_schema = "pr_${var.pr_number}_${var.subsystem}"
}
```

### 10.2 Conditional Provisioning

If preview is optional (label-triggered), use a variable:

```hcl
variable "enable_preview" {
  type    = bool
  default = false
}

resource "azurerm_container_app" "preview_revision" {
  count = var.enable_preview ? 1 : 0
  # ... provisioning logic
}
```

### 10.3 State File Isolation

Each preview has its own state file (see section 7.4). This prevents:
- State conflicts when destroying multiple previews in parallel
- Accidental deletion of main app resources
- Cross-PR state pollution

---

## 11. GitHub Actions Integration Details

### 11.1 Environment Variables for Previews

**Required GitHub Secrets (org or repo level):**
```
AZURE_CLIENT_ID_DEV
AZURE_TENANT_ID_DEV
AZURE_SUBSCRIPTION_ID_DEV
ACR_LOGIN_SERVER (Container registry endpoint)
DATABASE_URL_DEV (PostgreSQL connection string)
```

### 11.2 PR Comment Template

Each successful preview provision should post:

```markdown
✅ **Preview environment deployed!**

- Service: Records
- URL: https://pr-123--eclat-records-dev.azurecontainerapps.io
- Database Schema: pr_123_records
- Expires: 7 days or on PR close
- Health: [Link to deployment logs]

**Next steps:**
1. Click the URL to test the API
2. Run `npm run test:smoke -- --base-url <URL>` locally
3. Use Postman/curl to call endpoints (JWT auth required)
4. Merge PR to promote to main branch
```

### 11.3 Parallel Preview Provisioning

Multiple preview workflows can run in parallel for different subsystems:

```yaml
# Preview jobs in the same PR
jobs:
  preview-records:
    if: contains(github.event.pull_request.labels.*.name, 'preview:records')
  preview-compliance:
    if: contains(github.event.pull_request.labels.*.name, 'preview:compliance')
  preview-notifications:
    if: contains(github.event.pull_request.labels.*.name, 'preview:notifications')
```

Each job:
- Uses its own Terraform state file (no conflicts)
- Provisions its own Container Apps revision
- Posts independent PR comments (can be consolidated later)

---

## 12. Cost Estimation Approach

### 12.1 Per-Preview Infrastructure Costs

| Resource | Quantity | Cost (est.) | Notes |
|---|---|---|---|
| Container Apps revision | 1 per preview | $0.04/hour idle, $0.15/hour active | 0.25 vCPU, 512 MB |
| PostgreSQL schema | 1 per preview | $0 (shared DB) | Shared connection pool |
| Storage (logs, audit) | ~100 MB/preview/7d | <$0.01/preview | Negligible |
| **Total per active preview** | — | **~$3.60/day (active)** | Reduces to ~$0.10/day (idle) |

### 12.2 Scenario: 5 Concurrent Previews (2 active, 3 idle)

**Monthly cost estimate:**
```
2 active × 24 hours × 30 days × $0.15/hour = $216
3 idle × 24 hours × 30 days × $0.04/hour = $86
Total ≈ $302/month for 5 previews
```

**Optimization tactics:**
- Set min-replicas to 0 (previews scale to zero when idle)
- Destroy previews after 7 days (TTL policy)
- Enforce max 5 concurrent previews per subsystem
- Monitor and alert on high preview utilization

### 12.3 Cost Visibility

**Logging:** Each preview Container App is tagged with:
```hcl
tags = {
  "cost-center"   = "engineering"
  "service"       = var.subsystem
  "pr-number"     = var.pr_number
  "type"          = "preview"
}
```

Use Azure Cost Management + tagging to track preview spending.

---

## 13. Integration with Smoke Tests

### 13.1 Smoke Test Workflow

After preview provision, run smoke tests against the preview URL:

```bash
npm run test:smoke -- \
  --base-url https://pr-123--eclat-records-dev.azurecontainerapps.io \
  --api-key ${{ secrets.SMOKE_TEST_API_KEY }}
```

**Tests to include:**
- API health check (`GET /health`)
- Auth flow (login, token refresh)
- Records subsystem endpoints (create, read, list)
- Cross-subsystem calls (if preview includes compliance + records)

### 13.2 Failure Handling

If smoke tests fail:
1. PR comment shows `❌ Smoke tests failed`
2. Link to CI logs for debugging
3. Preview remains active (developer can troubleshoot)
4. Cleanup still runs on PR close

---

## 14. Usage Guide (for Developers)

### 14.1 Enable Preview for Your PR

1. **Option A — Label Trigger:**
   - Add label `preview:records` to your PR
   - GitHub Actions auto-provisions the preview

2. **Option B — Path Trigger:**
   - Edit files in `apps/api/src/modules/documents/**` or `apps/api/src/modules/hours/**`
   - CI detects the change and auto-provisions (if configured for auto-trigger)

### 14.2 Access Your Preview

- **Preview URL** posted in PR comment (e.g., `https://pr-123--eclat-records-dev.azurecontainerapps.io`)
- **Health check:** `curl -s <PREVIEW_URL>/health | jq`
- **API calls:** Use Postman or curl with JWT token from dev environment

### 14.3 Test Workflow

```bash
# 1. Get a valid JWT from the preview auth endpoint
JWT=$(curl -s -X POST \
  https://pr-123--eclat-records-dev.azurecontainerapps.io/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@eclat.local","password":"test"}' \
  | jq -r '.token')

# 2. Call the records API
curl -s https://pr-123--eclat-records-dev.azurecontainerapps.io/api/documents \
  -H "Authorization: Bearer $JWT" | jq

# 3. Run local smoke tests against the preview
npm run test:smoke -- --base-url https://pr-123--eclat-records-dev.azurecontainerapps.io
```

### 14.4 Cleanup

- Preview auto-destroys on PR close (no manual action needed)
- Manual cleanup: PR comment includes cleanup command (if needed)

---

## 15. Rollout Phases

### Phase 1: Records Service (MVP, This Sprint)

**Scope:**
- Records subsystem only (`documents`, `hours`)
- Label trigger: `preview:records`
- Single dev environment
- Manual smoke tests

**Acceptance:**
- ✅ 3 concurrent records previews provisioned and destroyed cleanly
- ✅ PR comments with preview URL working
- ✅ Smoke tests pass on preview

### Phase 2: Compliance Service (Next Sprint)

**Scope:**
- Compliance subsystem (`templates`, `qualifications`)
- Label trigger: `preview:compliance`
- Reuse records infrastructure pattern

### Phase 3: Full Automation (Future)

**Scope:**
- All subsystems
- Path-based auto-provisioning (no labels needed)
- Cross-subsystem previews (both records + compliance in one PR)
- Custom domain names (`pr-123-records.dev.eclat.com`)

---

## 16. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **State file corruption** | Preview provisions but can't destroy | Separate state files per preview; versioned backups |
| **Cost overrun** | Too many concurrent previews | Max quota (5/subsystem), TTL (7 days), monitoring alerts |
| **Database contention** | Previews slow down dev/test | Separate connection pool + query limits per schema |
| **Secrets in preview logs** | Credential leaks | Never log request/response bodies in preview revisions |
| **Stale revisions** | Old previews not cleaned up | Nightly cleanup job + TTL policy |

---

## 17. Success Criteria

- [ ] Records preview provisions in < 2 minutes
- [ ] PR comment with valid preview URL appears automatically
- [ ] Smoke tests pass on preview
- [ ] Preview auto-destroys within 1 min of PR close
- [ ] Cost per preview < $5/day (active)
- [ ] Zero credential leaks in preview environments
- [ ] Documentation complete and tested by a new team member

---

## 18. Future Enhancements

1. **Custom domains:** Map `pr-123-records.dev.eclat.com` → preview FQDN
2. **Cross-subsystem previews:** Single PR can provision both records + compliance
3. **Staging previews:** Extend preview pattern to staging environment for UAT
4. **Datadog/monitoring:** Add APM/logging aggregation for preview debugging
5. **Automated rollback:** If smoke tests fail, auto-rollback preview revision
6. **Team approval:** Preview link requires team sign-off before merge
7. **Capacity management:** Dashboard showing preview utilization, cost trends

---

## 19. References

- **Issue #50:** Preview environments for records and compliance
- **Issue #26:** Terraform module stubs (compute-records, compute-compliance)
- **Issue #35:** Subsystem change detection (parallel lanes)
- **Docs:** `docs/specs/pipeline-architecture-spec.md`, `docs/specs/service-architecture-spec.md`
- **Azure Container Apps Docs:** https://learn.microsoft.com/en-us/azure/container-apps/
- **Terraform Azure Provider:** https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/container_app

---

**End of Specification**
