# Infrastructure / App Wiring Map

This document is the contract map between bootstrap, Terraform layers, GitHub Actions, Key Vault, and the API runtime. Update it whenever any file under `infra/`, `bootstrap/`, `.github/workflows/`, `apps/api/.env.example`, `apps/api/src/config/env.ts`, or `apps/api/src/index.ts` changes.

## 7. Keeping This Map in Sync

**Update this document when:**
- a Terraform layer/module adds, renames, or removes an output or input
- a workflow adds or removes a GitHub secret/variable reference
- bootstrap changes naming, identities, backend storage, or OIDC setup
- the API adds, removes, or changes environment variables in `.env.example` or `env.ts`
- production app settings or Key Vault references change in `infra/modules/compute`

**PR review checklist:**
- [ ] Every changed Terraform output is either consumed downstream or marked intentionally unused.
- [ ] Every new secret has a documented origin, storage location, consumer, and rotation/provisioning path.
- [ ] Every workflow secret or variable reference is reflected in Section 3.
- [ ] Every `.env.example` / `env.ts` key is either wired in production or called out with ⚠️.
- [ ] Remote-state contracts (`foundation.tfstate`, `data.tfstate`, `compute.tfstate`) still match downstream readers.
- [ ] Key Vault references still point at existing secret names and the API managed identity still has `Get`/`List` access.
- [ ] Bootstrap naming still matches `.tfbackend` files and layer backend locals.

## 1. Layer Output → Input Map

> Layer outputs proxy module outputs; notes below call out the backing module output where helpful.

| Source Layer | Output Name | Consumer | Consumption Method | Notes |
|-------------|-------------|----------|-------------------|-------|
| `00-foundation` | `resource_group_name` | `10-data` → `module.database.resource_group_name`, `module.storage.resource_group_name` | `terraform_remote_state.foundation.outputs.resource_group_name` | Proxy of `module.foundation.resource_group_name` in the foundation layer. |
| `00-foundation` | `resource_group_name` | `20-compute` → `module.compute.resource_group_name` | `terraform_remote_state.foundation.outputs.resource_group_name` | Used to place the App Service plan and Linux Web App in the environment RG. |
| `00-foundation` | `location` | `10-data` → `module.database.location`, `module.storage.location` | `terraform_remote_state.foundation.outputs.location` | Single source of truth for region. |
| `00-foundation` | `location` | `20-compute` → `module.compute.location` | `terraform_remote_state.foundation.outputs.location` | Keeps compute in same region as foundation/data. |
| `00-foundation` | `key_vault_name` | `20-compute` → `module.compute.key_vault_name` | `terraform_remote_state.foundation.outputs.key_vault_name` | Used to build App Service Key Vault references like `@Microsoft.KeyVault(VaultName=...;SecretName=...)`. |
| `00-foundation` | `key_vault_id` | `10-data` → `module.database.key_vault_id` | `terraform_remote_state.foundation.outputs.key_vault_id` | Data layer stores DB connection string in the shared Key Vault. |
| `00-foundation` | `key_vault_id` | `20-compute` → `module.compute.key_vault_id` | `terraform_remote_state.foundation.outputs.key_vault_id` | Compute layer creates the JWT secret in the same Key Vault and adds web app access policy. |
| `00-foundation` | `key_vault_uri` | `20-compute` → `module.compute.key_vault_uri` | `terraform_remote_state.foundation.outputs.key_vault_uri` | Exposed again to the app as `KEY_VAULT_URI`. |
| `10-data` | `postgres_connection_secret_name` | `20-compute` → `module.compute.postgres_connection_secret_name` | `terraform_remote_state.data.outputs.postgres_connection_secret_name` | Compute turns this secret name into the `DATABASE_URL` Key Vault reference. |
| `10-data` | `storage_account_name` | `20-compute` → `module.compute.storage_account_name` | `terraform_remote_state.data.outputs.storage_account_name` | Surfaced to the app as plain app setting `STORAGE_ACCOUNT_NAME`. |
| `10-data` | `storage_blob_endpoint` | `20-compute` → `module.compute.storage_blob_endpoint` | `terraform_remote_state.data.outputs.storage_blob_endpoint` | Surfaced to the app as plain app setting `STORAGE_BLOB_ENDPOINT`. |
| `10-data` | `documents_container_name` | `20-compute` → `module.compute.documents_container_name` | `terraform_remote_state.data.outputs.documents_container_name` | Surfaced to the app as plain app setting `DOCUMENTS_CONTAINER_NAME`. |
| `20-compute` | `api_app_name` | `.github/workflows/deploy.yml` → job `deploy-api` | `terraform output -raw api_app_name` → job output `needs.compute.outputs.api_app_name` | Proxy of `module.compute.api_app_name`; used by `azure/webapps-deploy@v3`. |
| `20-compute` | `api_url` | `.github/workflows/deploy.yml` → deployment summary | `terraform output -raw api_url` → job output `needs.compute.outputs.api_url` | Proxy of `module.compute.api_url`; currently only echoed after deployment. |

### Layer contracts by environment (dev)

| Layer | Backend File | State Key | Variable File | Notes |
|------|--------------|-----------|---------------|-------|
| `00-foundation` | `infra/environments/dev/foundation.tfbackend` | `foundation.tfstate` | `infra/environments/dev/foundation.tfvars` | `environment = "dev"`, `location = "eastus2"`, `project_name = "eclat"` |
| `10-data` | `infra/environments/dev/data.tfbackend` | `data.tfstate` | `infra/environments/dev/data.tfvars` | `db_sku = "B_Standard_B1ms"`, `database_name = "eclat"` |
| `20-compute` | `infra/environments/dev/compute.tfbackend` | `compute.tfstate` | `infra/environments/dev/compute.tfvars` | `app_service_sku = "B1"`; no `extra_app_settings` supplied in dev. |

## 2. Secret Flow Map

| Secret | Origin | Storage | Consumer | Access Method |
|--------|--------|---------|----------|--------------|
| `DATABASE_URL` | `10-data` / `modules/database`: assembled from PostgreSQL FQDN, database name, generated admin login, and `random_password.administrator` | Azure Key Vault secret `eclat-dev-postgres-connection` (pattern: `${project_name}-${environment}-postgres-connection`) | API App Service | `20-compute` sets `DATABASE_URL = @Microsoft.KeyVault(VaultName=${key_vault_name};SecretName=${postgres_connection_secret_name})` |
| PostgreSQL admin password (raw) | `modules/database.random_password.administrator` | ⚠️ Not stored as a standalone secret; only embedded inside the Key Vault connection string value | PostgreSQL server creation + indirect app use via `DATABASE_URL` | Terraform uses the raw password for server creation; app only ever sees the connection string secret |
| `JWT_SECRET` | `20-compute` / `modules/compute.random_password.jwt_secret` | Azure Key Vault secret `eclat-dev-jwt-secret` (pattern: `${project_name}-${environment}-jwt-secret`) | API App Service | `20-compute` sets `JWT_SECRET = @Microsoft.KeyVault(VaultName=${key_vault_name};SecretName=${azurerm_key_vault_secret.jwt_secret.name})` |
| `OAUTH_CLIENT_SECRET` | ⚠️ External/manual provision | ⚠️ No storage wired in repo today | API runtime, if OAuth calendar sync is enabled | ⚠️ No production wiring; would need manual App Service setting or Key Vault-backed `extra_app_settings` |
| `AWS_ACCESS_KEY_ID` | ⚠️ External/manual provision | ⚠️ No storage wired in repo today | API runtime, if AWS Textract is used | ⚠️ No production wiring |
| `AWS_SECRET_ACCESS_KEY` | ⚠️ External/manual provision | ⚠️ No storage wired in repo today | API runtime, if AWS Textract is used | ⚠️ No production wiring |
| `SMTP_PASS` | ⚠️ External/manual provision | ⚠️ No storage wired in repo today | API runtime, if SMTP notifications are implemented | ⚠️ No production wiring |

**Key Vault access path:**
- `00-foundation` creates the shared environment Key Vault and grants the deploying identity secret `Set/Get/List/...` rights through the inline access policy in `infra/modules/foundation/main.tf`.
- `10-data` writes the DB connection string into that vault.
- `20-compute` writes the JWT secret into that vault.
- `20-compute` grants the API system-assigned managed identity `Get` and `List` on the vault so App Service Key Vault references can resolve at runtime.

## 3. GitHub Secrets & Variables

| Name | Type | Set By | Used By | Purpose |
|------|------|--------|---------|---------|
| `AZURE_CLIENT_ID_DEV` | GitHub environment secret | `bootstrap/03-gh-oidc.sh` (`gh secret set`) | `.github/workflows/deploy.yml` | Azure OIDC login for `dev` deployments |
| `AZURE_TENANT_ID_DEV` | GitHub environment secret | `bootstrap/03-gh-oidc.sh` (`gh secret set`) | `.github/workflows/deploy.yml` | Azure tenant for `dev` deployments |
| `AZURE_SUBSCRIPTION_ID_DEV` | GitHub environment secret | `bootstrap/03-gh-oidc.sh` (`gh secret set`) | `.github/workflows/deploy.yml` | Azure subscription for `dev` deployments |
| `AZURE_CLIENT_ID_STAGING` | GitHub environment secret | `bootstrap/03-gh-oidc.sh` (`gh secret set`) | `.github/workflows/deploy.yml` | Azure OIDC login for `staging` deployments |
| `AZURE_TENANT_ID_STAGING` | GitHub environment secret | `bootstrap/03-gh-oidc.sh` (`gh secret set`) | `.github/workflows/deploy.yml` | Azure tenant for `staging` deployments |
| `AZURE_SUBSCRIPTION_ID_STAGING` | GitHub environment secret | `bootstrap/03-gh-oidc.sh` (`gh secret set`) | `.github/workflows/deploy.yml` | Azure subscription for `staging` deployments |
| `AZURE_CLIENT_ID_PROD` | GitHub environment secret | `bootstrap/03-gh-oidc.sh` (`gh secret set`) | `.github/workflows/deploy.yml` | Azure OIDC login for `prod` deployments |
| `AZURE_TENANT_ID_PROD` | GitHub environment secret | `bootstrap/03-gh-oidc.sh` (`gh secret set`) | `.github/workflows/deploy.yml` | Azure tenant for `prod` deployments |
| `AZURE_SUBSCRIPTION_ID_PROD` | GitHub environment secret | `bootstrap/03-gh-oidc.sh` (`gh secret set`) | `.github/workflows/deploy.yml` | Azure subscription for `prod` deployments |

**Workflow notes:**
- `deploy.yml` is the only workflow that reads GitHub secrets in the current repo.
- `ci.yml` uses no GitHub secrets and no GitHub variables.
- No workflow currently references `vars.*`; all environment selection is done with `inputs.environment` plus `secrets.AZURE_*_{ENV}`.

## 4. App Settings Map

### `.env.example` / `env.ts` contract → production wiring

| App Setting | `.env.example` Key | Source in Production | Wiring |
|------------|--------------------|----------------------|--------|
| `PORT` | `PORT` | `20-compute` hardcoded value `8080` | `modules/compute` sets both `PORT = "8080"` and `WEBSITES_PORT = "8080"`; `apps/api/src/index.ts` listens on `env.PORT`. |
| `NODE_ENV` | `NODE_ENV` | `20-compute` derived from Terraform environment | `NODE_ENV = var.environment == "dev" ? "development" : "production"`. |
| `DATABASE_URL` | `DATABASE_URL` | Key Vault secret created by `10-data` | `modules/compute` sets a Key Vault reference using `postgres_connection_secret_name`. ⚠️ `env.ts` marks this optional even though production wiring assumes it exists. |
| `JWT_SECRET` | `JWT_SECRET` | Key Vault secret created by `20-compute` | `modules/compute` sets a Key Vault reference to the JWT secret it creates. |
| `JWT_EXPIRES_IN` | `JWT_EXPIRES_IN` | `20-compute` hardcoded `1h` | Direct app setting in `modules/compute`. |
| `JWT_REFRESH_EXPIRES_IN` | `JWT_REFRESH_EXPIRES_IN` | `20-compute` hardcoded `7d` | Direct app setting in `modules/compute`. |
| `OAUTH_CLIENT_ID` | `OAUTH_CLIENT_ID` | ⚠️ Not wired | No current Terraform app setting. Only possible escape hatch is `extra_app_settings`. |
| `OAUTH_CLIENT_SECRET` | `OAUTH_CLIENT_SECRET` | ⚠️ Not wired | No current Terraform app setting. Should be Key Vault-backed if added. |
| `OAUTH_REDIRECT_URI` | `OAUTH_REDIRECT_URI` | ⚠️ Not wired | No current Terraform app setting. Expected value likely needs to follow `${api_url}/api/auth/oauth/callback`. |
| `DOCUMENT_PROCESSOR` | `DOCUMENT_PROCESSOR` | `20-compute` hardcoded `azure-form-recognizer` | Direct app setting in `modules/compute`. ⚠️ `.env.example` / `env.ts` default is `aws-textract`, so the documented local default and production default diverge. |
| `AWS_REGION` | `AWS_REGION` | ⚠️ Not wired | Present in `.env.example`, absent from `env.ts`, and absent from compute app settings. |
| `AWS_ACCESS_KEY_ID` | `AWS_ACCESS_KEY_ID` | ⚠️ Not wired | Present in `.env.example`, absent from `env.ts`, and absent from compute app settings. |
| `AWS_SECRET_ACCESS_KEY` | `AWS_SECRET_ACCESS_KEY` | ⚠️ Not wired | Present in `.env.example`, absent from `env.ts`, and absent from compute app settings. |
| `SMTP_HOST` | `SMTP_HOST` | ⚠️ Not wired | Present in `.env.example`, absent from `env.ts`, and absent from compute app settings. |
| `SMTP_PORT` | `SMTP_PORT` | ⚠️ Not wired | Present in `.env.example`, absent from `env.ts`, and absent from compute app settings. |
| `SMTP_USER` | `SMTP_USER` | ⚠️ Not wired | Present in `.env.example`, absent from `env.ts`, and absent from compute app settings. |
| `SMTP_PASS` | `SMTP_PASS` | ⚠️ Not wired | Present in `.env.example`, absent from `env.ts`, and absent from compute app settings. |
| `LOG_LEVEL` | `LOG_LEVEL` | `20-compute` derived from Terraform environment | `LOG_LEVEL = var.environment == "dev" ? "debug" : "info"`; consumed by `apps/api/src/common/utils/logger.ts`. |

### Additional production app settings injected by Terraform

These are real production app settings even though they are not declared in `.env.example`.

| App Setting | Source in Production | Wiring | Notes |
|------------|----------------------|--------|-------|
| `KEY_VAULT_URI` | `00-foundation.key_vault_uri` | `20-compute` passes `key_vault_uri` into `modules/compute`, which sets the app setting | Not currently validated in `env.ts`; available to runtime if needed. |
| `STORAGE_ACCOUNT_NAME` | `10-data.storage_account_name` | `terraform_remote_state.data` → `module.compute.storage_account_name` → app setting | Not validated in `env.ts`. |
| `STORAGE_BLOB_ENDPOINT` | `10-data.storage_blob_endpoint` | `terraform_remote_state.data` → `module.compute.storage_blob_endpoint` → app setting | Not validated in `env.ts`. |
| `DOCUMENTS_CONTAINER_NAME` | `10-data.documents_container_name` | `terraform_remote_state.data` → `module.compute.documents_container_name` → app setting | Not validated in `env.ts`. |
| `WEBSITES_PORT` | `20-compute` hardcoded `8080` | Direct app setting in `modules/compute` | Azure platform setting for Linux Web Apps. |
| `ENABLE_ORYX_BUILD` | `20-compute` hardcoded `true` | Direct app setting in `modules/compute` | Enables Oryx build behavior during deployment. |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `20-compute` hardcoded `true` | Direct app setting in `modules/compute` | Build-on-deploy flag for App Service deployment. |

### API startup behavior

- `apps/api/src/config/env.ts` loads `process.env` via `dotenv`, validates the schema with Zod, and exits the process if validation fails.
- `apps/api/src/index.ts` only reads `env.PORT` and `env.NODE_ENV` directly during startup, then starts the Express server and logs the environment.
- Other runtime values in `env.ts` are part of the environment contract even if this scaffold does not yet consume all of them at startup.

## 5. Bootstrap → Infra Handoff

| Bootstrap Output | Script | Terraform / Pipeline Consumer | How Referenced |
|-----------------|--------|-------------------------------|----------------|
| Backend resource group `eclat-{env}-tfstate-rg` | `bootstrap/01-tf-state-storage.sh` via `resource_group_name()` | All Terraform layers | Stored in `infra/environments/<env>/*.tfbackend`; also mirrored by backend locals in `infra/layers/10-data/main.tf` and `infra/layers/20-compute/main.tf`. |
| Backend storage account `eclattfstate{env}` | `bootstrap/01-tf-state-storage.sh` via `storage_account_name()` | All Terraform layers | Stored in `infra/environments/<env>/*.tfbackend`; also mirrored by backend locals in `infra/layers/10-data/main.tf` and `infra/layers/20-compute/main.tf`. |
| Backend blob container `tfstate` | `bootstrap/01-tf-state-storage.sh` via `container_name()` | All Terraform layers | Stored in `infra/environments/<env>/*.tfbackend`; used by `terraform init -backend-config=...`. |
| Blob versioning on backend storage | `bootstrap/01-tf-state-storage.sh` | State safety for all Terraform layers | Not referenced in HCL, but protects `foundation.tfstate`, `data.tfstate`, and `compute.tfstate`. |
| App registration `eclat-{env}-deploy` | `bootstrap/02-entra-spns.sh` via `spn_name()` | `.github/workflows/deploy.yml` Azure login / Terraform applies | `bootstrap/03-gh-oidc.sh` resolves the app registration and publishes its app ID as `AZURE_CLIENT_ID_{ENV}`. |
| Service principal for each app registration | `bootstrap/02-entra-spns.sh` | `.github/workflows/deploy.yml` Azure login / Terraform applies | The OIDC login in `deploy.yml` authenticates as this identity. |
| Subscription-scope `Contributor` role assignment | `bootstrap/02-entra-spns.sh` | Terraform execution identity | Grants the deployment identity rights to create/update Azure resources during layer applies. |
| Federated credential `repo:<owner>/<repo>:ref:refs/heads/main` | `bootstrap/03-gh-oidc.sh` | GitHub Actions OIDC | Attached to each environment app registration so GitHub can exchange its OIDC token for Azure auth. |
| Federated credential `repo:<owner>/<repo>:environment:<env>` | `bootstrap/03-gh-oidc.sh` | GitHub Actions OIDC | Supports environment-scoped deployment jobs. |
| GitHub environment secrets `AZURE_CLIENT_ID_{ENV}`, `AZURE_TENANT_ID_{ENV}`, `AZURE_SUBSCRIPTION_ID_{ENV}` | `bootstrap/03-gh-oidc.sh` | `.github/workflows/deploy.yml` | Workflow-level `env:` block selects the correct secret trio based on `inputs.environment`. |

## 6. Gaps & Recommendations

### Gaps

- **Dead layer outputs (RESOLVED):** All five dead outputs have been pruned from the remote-state contract per decision `freamon-output-justification.md`:
  - `00-foundation.resource_group_id` — Removed; RG name is sufficient for downstream placement.
  - `10-data.postgres_fqdn` — Removed; debuggable from portal or state; runtime uses secret name.
  - `10-data.postgres_database_name` — Removed; database name is embedded in connection string.
  - `20-compute.api_default_hostname` — Removed; superseded by custom `api_url`.
  - `20-compute.api_principal_id` — Removed; module implementation detail, not a layer contract.

- **App settings with no production wiring yet**
  - `OAUTH_CLIENT_ID`
  - `OAUTH_CLIENT_SECRET`
  - `OAUTH_REDIRECT_URI`
  - `AWS_REGION`
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `SMTP_HOST`
  - `SMTP_PORT`
  - `SMTP_USER`
  - `SMTP_PASS`

- **Secrets that still require manual provisioning**
  - `OAUTH_CLIENT_SECRET`
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `SMTP_PASS`
  - likely companion non-secret settings such as `OAUTH_CLIENT_ID`, `OAUTH_REDIRECT_URI`, `AWS_REGION`, `SMTP_HOST`, `SMTP_PORT`, and `SMTP_USER`

- **Mismatches / missing connections**
  - ⚠️ `DOCUMENT_PROCESSOR` defaults diverge: `.env.example` and `env.ts` default to `aws-textract`, while production hardcodes `azure-form-recognizer`.
  - ⚠️ `DATABASE_URL` is optional in `apps/api/src/config/env.ts`, but infrastructure treats it as a required production dependency.
  - ⚠️ `.env.example` includes AWS and SMTP settings that are not represented in `env.ts` or production Terraform wiring.
  - ⚠️ `compute.tfvars` currently does not use `extra_app_settings`, so the repository has no codified production path for optional third-party credentials.
  - ⚠️ `bootstrap/01-tf-state-storage.sh` prints `key = "terraform.tfstate"`, but the real backend contract is split across `foundation.tfstate`, `data.tfstate`, and `compute.tfstate`.
  - ⚠️ `OAUTH_REDIRECT_URI` is not derived from `20-compute.api_url`; if OAuth is enabled, that linkage is still manual.

### Recommendations

1. **Promote third-party runtime credentials to first-class infra contract.** Add explicit Key Vault secrets and/or documented `extra_app_settings` conventions for OAuth, AWS, and SMTP instead of leaving them as manual drift.
2. **Align the API env contract with production reality.** Either make `DATABASE_URL` required in `env.ts` and document the production-only defaults, or intentionally relax infrastructure expectations if DB-less startup is valid.
3. **Resolve the document-processor split.** Choose one default (`aws-textract` vs `azure-form-recognizer`) and then wire the matching credential/config set.
4. **Fix bootstrap/backend messaging.** Update the bootstrap script output (or supporting docs) so operators are told about the three real state keys, not the old single-root `terraform.tfstate` example.
