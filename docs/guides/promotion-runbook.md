# Artifact Promotion Runbook

This runbook documents the process for promoting immutable Docker images through E-CLAT environments: **dev → staging → prod**.

## Overview

The artifact promotion pipeline ensures that the same Docker image built once is promoted through environments without rebuilding, maintaining immutability and traceability.

### Promotion Path

```
dev-{SHA}  →  staging-{SHA}  →  prod-{SHA}
```

- **dev**: Auto-deployed on every successful commit to main
- **staging**: Manual trigger, requires CI passed + automated approval
- **prod**: Manual trigger, requires manual approval gate

## Prerequisites

1. **Image must exist in dev:** Image tagged `dev-{SHA}` is already in container registry
2. **CI must have passed:** For staging promotion, CI workflow must have succeeded on the commit
3. **GitHub Actions permissions:** Must have `packages: write` scope (automatic for repo workflows)
4. **Environment secrets:** Azure credentials configured for each environment (automated by Terraform)

## Promotion Workflow

### Step 1: Identify the Image to Promote

Get the image SHA from a successful dev deployment:

```bash
# Option A: Check GitHub Actions workflow output
# - Go to .github/workflows/ci.yml successful run
# - Note the image tag: dev-abc123def456...

# Option B: Query container registry directly
az acr repository show-manifests \
  --registry eclat \
  --repository api \
  --query "[].tags" | grep "^dev-"
```

Extract the SHA portion (without the `dev-` prefix):
```
dev-abc123def456... → abc123def456...
```

### Step 2: Trigger Promotion to Staging

```bash
gh workflow run promote.yml \
  -f source_environment=dev \
  -f target_environment=staging \
  -f image_sha=abc123def456
```

**What happens:**
1. ✅ **Validation:** Confirms dev→staging is a valid path
2. ✅ **CI Check:** Verifies CI passed for this commit
3. ✅ **Approval:** Staging environment gate (automatic, no user action required)
4. 🐳 **Retag:** Pulls `dev-abc123...`, retagges as `staging-abc123...`, pushes to registry
5. 📝 **Audit:** Records promotion metadata to storage account

**Expected duration:** ~3–5 minutes

### Step 3: Verify Staging Deployment

After promotion, deploy the staging image to the staging container app:

```bash
# Manual trigger to deploy staging image
gh workflow run deploy.yml -f environment=staging
```

Or, if auto-deployment is enabled on staging promotion, the image deploys automatically.

### Step 4: Validate Staging Environment

Smoke tests:
```bash
curl https://api-staging.eclat.example.com/health
curl https://staging.eclat.example.com/ -I
```

Check logs:
```bash
az containerapp logs show \
  --name eclat-api-staging \
  --resource-group eclat-staging \
  --follow
```

If issues found, **do not promote to prod**. Troubleshoot or rollback staging.

### Step 5: Trigger Promotion to Production

Once staging is validated:

```bash
gh workflow run promote.yml \
  -f source_environment=staging \
  -f target_environment=prod \
  -f image_sha=abc123def456
```

**Note:** The workflow will attempt source environment as `dev` → this is a known limitation; for now, manually verify you are promoting from staging to prod.

**What happens:**
1. ✅ **Validation:** Confirms staging→prod is valid (or dev→prod blocks with error)
2. ⏸️ **Approval:** Production environment gate (MANUAL APPROVAL REQUIRED)
3. 🐳 **Retag:** Pulls `staging-abc123...`, retagges as `prod-abc123...`, pushes
4. 📝 **Audit:** Records promotion to production audit log

**Expected duration:** Approval may take hours; workflow execution is ~3–5 minutes after approval.

### Step 6: Complete Production Deployment

```bash
gh workflow run deploy.yml -f environment=prod
```

Then validate:
```bash
curl https://api.eclat.example.com/health
curl https://eclat.example.com/ -I
```

## Rollback Procedure

### Rollback to Previous Image (e.g., dev→staging)

If the promoted image has a critical bug:

1. **Identify the previous image:**
   ```bash
   az acr repository show-manifests --registry eclat --repository api --query "[].tags" | grep "^staging-" | sort | tail -2
   ```

2. **Re-promote the known-good image:**
   ```bash
   gh workflow run promote.yml \
     -f source_environment=dev \
     -f target_environment=staging \
     -f image_sha=previous_sha_that_was_good
   ```

3. **Redeploy:**
   ```bash
   gh workflow run deploy.yml -f environment=staging
   ```

### Emergency Rollback (in-place container restart with previous image)

If promotion+deploy took too long and you need fast rollback:

```bash
# Get the previous revision of the container app
az containerapp revision list \
  --name eclat-api-prod \
  --resource-group eclat-prod \
  --query "[?active==false] | [0]" | jq '.name'

# Activate previous revision
az containerapp revision activate \
  --name eclat-api-prod \
  --resource-group eclat-prod \
  --revision <previous-revision-name>
```

This does NOT re-promote in the artifact registry, but switches the container app to run the previous revision (faster for emergency recovery).

## Troubleshooting

### Promotion Workflow Fails: "CI not found"

**Problem:** CI workflow status cannot be retrieved for the image SHA.

**Solution:**
1. Verify the commit SHA actually exists: `git log --oneline | grep abc123`
2. Verify CI ran for that commit: `gh run list --branch main --workflow ci.yml | grep abc123`
3. If CI run is very recent, wait ~30 seconds and retry
4. If CI never ran, manually trigger it: `git push origin main` (or push a dummy commit)

### Image Not Found in dev

**Problem:** "Failed to pull source image: dev-abc123..."

**Solution:**
1. Verify image was built and pushed: `az acr repository show-manifests --registry eclat --repository api | grep dev-`
2. Check CI build logs: `gh run list --workflow ci.yml --status completed | head -1`
3. If missing, re-run CI: `gh workflow run ci.yml --ref main`

### Staging Environment Stuck in "Waiting for Approval"

**Problem:** Workflow hung on approval gate.

**Solution:**
1. Check GitHub environment protections: Go to repo Settings → Environments → staging
2. Verify your GitHub user is authorized to approve (member of required team, or no restrictions)
3. Go to workflow run in Actions tab, click "Review deployments", select "Approve"

### Artifact Already Promoted

**Problem:** "Conflict: image tag already exists"

**Solution:** This is expected if you promote the same image twice. Options:
- If intentional: Override the tag by deleting and re-promoting
  ```bash
  # Delete the tag from registry
  az acr repository delete --registry eclat --image api:staging-abc123 --yes
  # Re-run promotion
  gh workflow run promote.yml ...
  ```
- If unintentional: Check promotion audit logs to confirm it already reached target environment

## Audit Trail & Compliance

All promotions are logged to the promotion audit container in Azure Storage:

```bash
# List all promotions in staging
az storage blob list \
  --account-name eclat{env}prom{suffix} \
  --container-name promotion-audit \
  --query "[?tags.environment=='staging']" \
  --output table
```

Each promotion metadata file contains:
- Timestamp (UTC)
- Source and target environments
- Image SHA and tag
- Promoted by (GitHub user)
- Workflow run ID
- Commit SHA

This metadata is immutable and supports compliance audits.

## Feature Flags & Staged Rollouts

Image promotion only moves the artifact; **runtime behavior** (feature flags, configuration) is controlled separately:

- Environment-specific feature flags are in `.env.{environment}` or Key Vault
- Promote the image → Deploy container app → Flag behavior changes apply at startup

This separation allows:
1. Promote image to staging
2. A/B test flags in staging without re-deploying
3. Decide on flag state for prod
4. Promote same image to prod
5. Flags activate in prod at deployment time

See `docs/guides/feature-flags.md` for flag management.

## Performance Expectations

| Operation | Duration | Notes |
|-----------|----------|-------|
| Image pull (dev→registry) | 30–60s | Depends on image size (~500MB API image) |
| Retag | 10–20s | Local operation |
| Image push | 30–90s | Network-bound; smaller layers cache |
| Approval gate | 1min–hours | Depends on reviewer availability |
| **Total: validation + retag + push** | ~3–5min | No approval or failures |

## Related Documentation

- `.github/workflows/promote.yml` — Workflow definition
- `infra/layers/30-promotion/` — Terraform infrastructure
- `docs/guides/deployment.md` — Deployment procedures
- `.github/workflows/ci.yml` — CI workflow (produces dev-tagged images)
