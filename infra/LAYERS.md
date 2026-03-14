# Terraform Layer Blueprint

## Scope
Based on the current repo, the practical Terraform split is:
- **`00-foundation`** — shared environment base
- **`10-data`** — PostgreSQL + application storage
- **`20-compute`** — API hosting first, then web/admin hosting when those apps become real deployment targets

`bootstrap\` remains outside Terraform layering because it owns backend state storage and deployment identity/OIDC setup.

Do **not** create `30-integration` yet. When APIM, Front Door, CDN, DNS, or custom domains actually land in Terraform, add that as a later downstream layer.

## Target Directory Layout
```text
infra\
├─ LAYERS.md
├─ modules\
│  ├─ foundation\
│  │  ├─ main.tf
│  │  ├─ variables.tf
│  │  └─ outputs.tf
│  ├─ database\
│  │  ├─ main.tf
│  │  ├─ variables.tf
│  │  └─ outputs.tf
│  ├─ storage\
│  │  ├─ main.tf
│  │  ├─ variables.tf
│  │  └─ outputs.tf
│  └─ compute\
│     ├─ main.tf
│     ├─ variables.tf
│     └─ outputs.tf
├─ layers\
│  ├─ 00-foundation\
│  │  ├─ versions.tf
│  │  ├─ providers.tf
│  │  ├─ main.tf
│  │  ├─ variables.tf
│  │  └─ outputs.tf
│  ├─ 10-data\
│  │  ├─ versions.tf
│  │  ├─ providers.tf
│  │  ├─ main.tf
│  │  ├─ variables.tf
│  │  └─ outputs.tf
│  └─ 20-compute\
│     ├─ versions.tf
│     ├─ providers.tf
│     ├─ main.tf
│     ├─ variables.tf
│     └─ outputs.tf
└─ environments\
   ├─ dev\
   │  ├─ foundation.tfbackend
   │  ├─ foundation.tfvars
   │  ├─ data.tfbackend
   │  ├─ data.tfvars
   │  ├─ compute.tfbackend
   │  └─ compute.tfvars
   ├─ staging\
   │  ├─ foundation.tfbackend
   │  ├─ foundation.tfvars
   │  ├─ data.tfbackend
   │  ├─ data.tfvars
   │  ├─ compute.tfbackend
   │  └─ compute.tfvars
   └─ prod\
      ├─ foundation.tfbackend
      ├─ foundation.tfvars
      ├─ data.tfbackend
      ├─ data.tfvars
      ├─ compute.tfbackend
      └─ compute.tfvars
```

## What Goes Where
### `infra\modules\foundation`
Reusable Azure resources that should exist before data or compute.

**Put here:**
- Environment resource group
- Key Vault
- Shared naming/tag helpers if implemented in Terraform

**Do not put here:**
- Terraform backend storage
- Entra deployment service principals
- GitHub OIDC federation

Those remain in `bootstrap\` because Terraform must not bootstrap its own backend and deployment identity chain.

### `infra\modules\database`
Reusable PostgreSQL Flexible Server resources.

**Put here:**
- PostgreSQL server
- Database(s)
- Database-level configuration that belongs to the server

### `infra\modules\storage`
Reusable application data storage resources.

**Put here:**
- Application storage account
- Blob containers for documents or other app artifacts
- Storage settings needed by the API

### `infra\modules\compute`
Reusable application hosting resources.

**Put here:**
- API hosting target
- Later: web/admin hosting targets if those apps become real Azure workloads
- Runtime identity/output wiring needed by downstream consumers

## Layer Roots
### `infra\layers\00-foundation`
First deployable Terraform root.

**Consumes:**
- Environment tfvars only
- Azure subscription/tenant context from the provider

**Exposes:**
- `resource_group_name`
- `resource_group_id`
- `location`
- `key_vault_name`
- `key_vault_id`
- `key_vault_uri`

**Notes:**
- Keep this layer thin. The current repo does not justify mandatory VNets, NSGs, Redis, Log Analytics, or APIM yet.
- If networking or observability becomes required later, this is the layer that should absorb it.

### `infra\layers\10-data`
Second deployable Terraform root.

**Consumes from upstream remote state:**
- `foundation.resource_group_name`
- `foundation.location`
- `foundation.key_vault_id`
- `foundation.key_vault_uri`

**Uses modules:**
- `infra\modules\database`
- `infra\modules\storage`

**Exposes:**
- `postgres_fqdn`
- `postgres_database_name`
- `postgres_connection_secret_name`
- `storage_account_name`
- `storage_blob_endpoint`
- `documents_container_name`

**Notes:**
- Write connection strings or credentials into Key Vault here.
- Do not expose raw secrets through remote-state outputs.

### `infra\layers\20-compute`
Third deployable Terraform root.

**Consumes from upstream remote state:**
- `foundation.resource_group_name`
- `foundation.location`
- `foundation.key_vault_uri`
- `foundation.container_registry_id`
- `foundation.container_registry_login_server`
- `foundation.log_analytics_workspace_id`
- `foundation.acr_pull_identity_id`
- `data.postgres_connection_secret_name`
- `data.storage_account_name`
- `data.storage_blob_endpoint`
- `data.documents_container_name`

**Uses modules:**
- `infra\modules\compute`

**Exposes:**
- `api_container_app_name`
- `api_url`
- Later, optional `web_url` and `admin_url` when those workloads exist

**Notes:**
- This layer creates the runtime target; it does not deploy application code.
- App publish/deploy should run after this layer succeeds.

## Remote State Layout
Use the storage accounts created by `bootstrap\01-tf-state-storage.sh`. Keep a single `tfstate` container per environment and separate the layer roots by key.

### Standard backend keys
For each environment:
- `foundation.tfstate`
- `data.tfstate`
- `compute.tfstate`

### Environment backend files
Example files:
- `infra\environments\dev\foundation.tfbackend`
- `infra\environments\dev\data.tfbackend`
- `infra\environments\dev\compute.tfbackend`

Example contents for `infra\environments\dev\foundation.tfbackend`:
```hcl
resource_group_name  = "eclat-dev-tfstate-rg"
storage_account_name = "eclattfstatedev"
container_name       = "tfstate"
key                  = "foundation.tfstate"
```

For `data.tfbackend` and `compute.tfbackend`, keep the same resource group, storage account, and container, but change the `key`.

> Standardize on the storage account names generated by `bootstrap\variables.sh` (`eclattfstate{env}`). The current `bootstrap\README.md` examples are not aligned with the script output.

## Example Remote-State Consumption
`10-data` and `20-compute` should read upstream outputs with `terraform_remote_state`.

```hcl
data "terraform_remote_state" "foundation" {
  backend = "azurerm"

  config = {
    resource_group_name  = "eclat-${var.environment}-tfstate-rg"
    storage_account_name = "eclattfstate${var.environment}"
    container_name       = "tfstate"
    key                  = "foundation.tfstate"
  }
}
```

`20-compute` should also read `data.tfstate` in the same pattern.

## Deployment Order
1. Run `bootstrap\01-tf-state-storage.sh`
2. Run `bootstrap\02-entra-spns.sh`
3. Run `bootstrap\03-gh-oidc.sh`
4. Apply `infra\layers\00-foundation`
5. Apply `infra\layers\10-data`
6. Apply `infra\layers\20-compute`
7. Deploy the API artifact into the compute target

Future only:
8. Add and apply `30-integration` after compute, if APIM or edge resources are introduced.

## GitHub Actions Mapping
Recommended default:
- Keep **one infra workflow** with staged jobs for `foundation`, `data`, and `compute`
- Make each job depend on the previous one with `needs:`
- Keep **application deployment** in a separate workflow that runs only after compute exists

That gives ordered infra deployment without forcing separate workflow files for every small change.

## Migration Notes
- Replace the current flat root (`infra\main.tf`, `infra\variables.tf`, `infra\outputs.tf`) with the layer roots after the split is ready.
- Keep the existing `infra\modules\database`, `infra\modules\storage`, and `infra\modules\compute` directories; add `infra\modules\foundation`.
- Move existing environment overlays from `infra\environments\{env}\terraform.tfvars` into per-layer files.
- Preserve the current `db_sku` environment setting in `data.tfvars`.
- Keep secret values out of cross-layer outputs.
