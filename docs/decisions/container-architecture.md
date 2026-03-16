# Container-First Architecture for E-CLAT

## Decision summary

E-CLAT should move from Azure App Service to a **container-first** runtime built on **Azure Container Apps (ACA)**.

- **Keep the 3-layer Terraform model**: `00-foundation` → `10-data` → `20-compute`
- **Put shared container platform primitives in `00-foundation`**: Azure Container Registry (ACR), Log Analytics workspace, and the network primitives required for Private Link
- **Replace App Service compute in `20-compute`** with:
  - `azurerm_container_app_environment`
  - `azurerm_container_app`
- **Keep a single API container for MVP**; web/admin can join later
- **Keep local development container-first** with Docker + `docker-compose`
- **Keep CI lightweight**: validate PRs, but only build/push images on merge to `main`
- **Keep secrets in Key Vault** and use **managed identity + RBAC** everywhere possible

## 1. Azure Container Apps architecture

### 1.1 What replaces what

| Current | Target | Why |
|---|---|---|
| `azurerm_service_plan` | `azurerm_container_app_environment` | ACA Environment is the shared compute boundary for container workloads; it replaces the need for an App Service Plan. |
| `azurerm_linux_web_app` | `azurerm_container_app` | The API becomes a container image deployed as a revisioned Container App. |
| Zip deploy via `azure/webapps-deploy@v3` | Image deploy from ACR | Container-first local/dev/prod parity. |
| App Service Key Vault reference strings | Managed identity-based runtime secret retrieval | ACA does not use App Service `@Microsoft.KeyVault(...)` syntax. |

### 1.2 Target topology

For each environment (`dev`, `staging`, `prod`):

- **00-foundation**
  - Resource group (existing)
  - Key Vault (existing, move to RBAC authorization)
  - **Azure Container Registry** (`Standard`, admin disabled)
  - **Log Analytics workspace** (required by ACA Environment)
  - **Virtual network + subnets + private DNS zones** for Private Link
  - Optional but recommended: **user-assigned managed identity for ACR pull**
- **10-data**
  - PostgreSQL Flexible Server
  - Storage account + documents container
  - PostgreSQL connection string secret written to Key Vault
  - Private endpoints for PostgreSQL and Storage
- **20-compute**
  - ACA Environment attached to the environment VNet/subnet
  - ACA API app with external HTTPS ingress
  - System-assigned managed identity for runtime Azure access
  - Health probes against `/health`

### 1.3 Network model

The security directives require private access for non-public dependencies. The container pivot should therefore target this network shape, even if the current Terraform still has public access enabled:

- **API ingress remains external** over HTTPS on the Container App
- **Key Vault, PostgreSQL, and Storage move behind Private Link**
- **Container App Environment is VNet-integrated** so the API can reach those private endpoints
- **Private DNS zones** resolve:
  - `privatelink.vaultcore.azure.net`
  - `privatelink.postgres.database.azure.com`
  - `privatelink.blob.core.windows.net`

That gives the MVP a public API edge with private east-west traffic.

### 1.4 Managed identity model

Use managed identity intentionally, not generically.

| Identity | Scope | Required role assignments | Notes |
|---|---|---|---|
| **GitHub OIDC deploy identity** | CI/CD | `Contributor` for Terraform scope (existing) + **`AcrPush`** on the ACR | Needed to push images during merge-to-main builds. |
| **Container App system-assigned identity** | Runtime | **`Key Vault Secrets User`** on Key Vault, **`Storage Blob Data Contributor`** on the storage account | Runtime identity for the API process. |
| **ACR pull identity** (recommended user-assigned) | Image pull | **`AcrPull`** on ACR | Azure recommends user-assigned identity for ACA image pulls because it exists before the app revision is created. |

#### Why separate the ACR pull identity?

For runtime access, the system-assigned identity is the clean default. For **image pull**, Azure Container Apps is more reliable with a **user-assigned identity** because the identity can be granted `AcrPull` before the revision is created. That avoids bootstrapping friction in Terraform.

For MVP, the recommended split is:
- **System-assigned identity** for Key Vault and Storage at runtime
- **User-assigned identity** only for ACR pull

That is one extra identity, but it is the only added complexity that materially reduces deployment risk.

### 1.5 Ingress, HTTPS, probes, and ports

Recommended ACA ingress settings:

- `external_enabled = true`
- `transport = "auto"` (HTTP/HTTPS)
- `target_port = 8080`
- `allow_insecure_connections = false`
- `revision_mode = "Single"` for MVP
- Liveness/readiness/startup probes on `GET /health`

### 1.6 Port override decision

**Decision: the existing `PORT` handling in `apps/api/src/config/env.ts` is sufficient for containers.**

Why:
- The API already reads `PORT` from the environment
- The code does not hardcode a socket port
- ACA only needs the container to listen on the same port configured as `target_port`

What changes:
- Keep `PORT`
- Drop App Service-specific `WEBSITES_PORT`
- Set the container default to `8080` in cloud deployments
- Let `docker-compose` override `PORT=3000` locally if desired

### 1.7 Key Vault secret resolution in Container Apps

ACA does **not** use App Service `@Microsoft.KeyVault(...)` app settings. For this repo, the options are:

| Option | Verdict | Why |
|---|---|---|
| a) Init container writes secrets to shared volume | No | Too much plumbing for one API container; adds lifecycle and file-permission failure modes. |
| b) **App code reads Key Vault via Azure SDK + `DefaultAzureCredential`** | **Recommended** | GA, simple, no preview dependency, keeps secrets out of ACA config values, and works cleanly with local `.env` fallbacks. |
| c) ACA secrets with Key Vault references (preview) | No for MVP | Useful, but preview features are the wrong dependency to anchor an MVP runtime on. |
| d) Dapr secret store | No | Adds another platform concept without enough value for one service. |

#### Recommended pattern: option **b**

Use a small runtime bootstrap in the API:

1. If `DATABASE_URL` / `JWT_SECRET` are present, use them directly
   - local dev
   - test runs
   - emergency override
2. Otherwise, if `KEY_VAULT_URI` and `*_SECRET_NAME` values are present, fetch them from Key Vault with:
   - `@azure/identity`
   - `@azure/keyvault-secrets`
   - `DefaultAzureCredential`
3. Cache the fetched values in-process for the life of the container

Recommended runtime settings in ACA:

- `KEY_VAULT_URI`
- `DATABASE_URL_SECRET_NAME`
- `JWT_SECRET_SECRET_NAME`
- `JWT_EXPIRES_IN`
- `JWT_REFRESH_EXPIRES_IN`
- `NODE_ENV`
- `LOG_LEVEL`
- `PORT`
- `STORAGE_ACCOUNT_NAME`
- `STORAGE_BLOB_ENDPOINT`
- `DOCUMENTS_CONTAINER_NAME`
- future optional `*_SECRET_NAME` values for OAuth / SMTP / third-party credentials

This preserves the current security posture: the actual `DATABASE_URL` value remains in Key Vault, not in Terraform outputs, not in GitHub Actions variables, and not in checked-in config.

## 2. Terraform module changes

## 2.1 Layer ownership

### `00-foundation`

**Add here:**
- `azurerm_container_registry`
- `azurerm_log_analytics_workspace`
- virtual network, ACA infrastructure subnet, private-endpoints subnet, and private DNS zones needed for private access
- optional `azurerm_user_assigned_identity` for ACR pull

**Why foundation?**
- ACR is a **shared registry**, not an API-only dependency
- Log Analytics is a shared observability primitive
- Network primitives are shared platform concerns
- Later `apps/web` and `apps/admin` should reuse the same registry and platform network shape

### `10-data`

Keep the current ownership but harden networking:
- PostgreSQL still writes `postgres_connection_secret_name` to Key Vault
- Storage outputs remain `storage_account_name`, `storage_blob_endpoint`, `documents_container_name`
- Add private endpoints and disable public data-plane exposure

### `20-compute`

This layer becomes strictly responsible for:
- the ACA Environment
- the API Container App
- runtime identity RBAC
- JWT secret generation/writing to Key Vault
- wiring the app to the image in ACR

## 2.2 Proposed `infra/modules/compute` resources

Recommended resource inventory for the new compute module:

- `random_password.jwt_secret`
- `azurerm_key_vault_secret.jwt_secret`
- `azurerm_container_app_environment.this`
- `azurerm_container_app.api`
- `azurerm_role_assignment.api_key_vault_secrets_user`
- `azurerm_role_assignment.api_storage_blob_data_contributor`
- `azurerm_role_assignment.api_acr_pull` **only if** the runtime identity is also used for image pull

If the recommended ACR pull identity is used, the `AcrPull` role assignment lives in `00-foundation` instead.

## 2.3 Proposed compute module inputs

The compute module should move away from App Service vocabulary and accept image/runtime inputs directly.

### Required inputs

- `environment`
- `location`
- `resource_group_name`
- `project_name`
- `key_vault_id`
- `key_vault_uri`
- `postgres_connection_secret_name`
- `storage_account_name`
- `storage_blob_endpoint`
- `documents_container_name`
- `container_registry_id`
- `container_registry_login_server`
- `log_analytics_workspace_id`
- `api_image_repository` (example: `api`)
- `api_image_tag` (example: Git SHA)
- `container_app_target_port` (default `8080`)

### Operational inputs

- `container_cpu` (default `0.5`)
- `container_memory` (default `1Gi`)
- `min_replicas` (default `1`; `0` only if cost is more important than cold-start latency)
- `max_replicas` (default `2` or `3` for MVP)
- `extra_env_vars` for non-secret toggles
- `acr_pull_identity_id` if using the recommended user-assigned pull identity
- `infrastructure_subnet_id` if foundation owns the ACA subnet

## 2.4 Proposed compute module outputs

### Module outputs

- `api_container_app_name`
- `api_url`
- `container_app_environment_name` (module-level only; do not surface from the layer unless something actually consumes it)

### Layer outputs (`infra/layers/20-compute/outputs.tf`)

Keep the layer contract minimal:
- `api_container_app_name`
- `api_url`

Do **not** export principal IDs or speculative internals from the layer root.

## 2.5 Foundation outputs needed by downstream layers and workflows

`00-foundation` should add only the outputs that are actually consumed:

- `container_registry_id`
- `container_registry_name`
- `container_registry_login_server`
- `log_analytics_workspace_id`
- `acr_pull_identity_id` (if using a user-assigned pull identity)
- subnet/DNS outputs only if another layer consumes them

## 2.6 Key Vault and RBAC changes

Current Terraform uses Key Vault access policies. That conflicts with the security directive.

**Required adjustment:**
- Enable **RBAC authorization** on Key Vault
- Replace `azurerm_key_vault_access_policy` usage with Azure RBAC role assignments

Recommended Key Vault roles:
- **Deploy identity**: enough rights to create/update secrets during Terraform apply
- **API runtime identity**: `Key Vault Secrets User`

This keeps the runtime model aligned with the user directive: **RBAC only**.

## 3. Local development setup

## 3.1 File placement

Recommended new local-dev files:
- `apps/api/Dockerfile`
- repo-root `docker-compose.yml`
- repo-root `.dockerignore`

## 3.2 Dockerfile approach

Use a multi-stage Dockerfile with a **dev stage** and a **runtime stage**.

### Proposed shape

```dockerfile
# syntax=docker/dockerfile:1.7
FROM node:20-bookworm-slim AS base
WORKDIR /workspace

FROM base AS deps
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build -w @e-clat/api

FROM deps AS dev
COPY . .
ENV NODE_ENV=development
ENV PORT=3000
CMD ["npm", "run", "dev", "-w", "@e-clat/api"]

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY --from=deps /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/api/dist ./apps/api/dist
COPY --from=build /workspace/apps/api/package.json ./apps/api/package.json
COPY package.json package-lock.json ./
EXPOSE 8080
CMD ["node", "apps/api/dist/index.js"]
```

### Notes

- `EXPOSE 8080` documents the cloud default
- `PORT` remains the real listener contract
- Local compose can still override `PORT=3000`
- The runtime image should be pre-built; ACA should never compile TypeScript on startup

## 3.3 `docker-compose.yml`

Recommended services:
- `api`
- `postgres`
- optional `azurite`

### Proposed shape

```yaml
services:
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
      target: dev
    command: npm run dev -w @e-clat/api
    environment:
      PORT: 3000
      NODE_ENV: development
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/eclat
      JWT_SECRET: local-dev-only
      JWT_EXPIRES_IN: 1h
      JWT_REFRESH_EXPIRES_IN: 7d
      LOG_LEVEL: debug
      STORAGE_ACCOUNT_NAME: devstoreaccount1
      STORAGE_BLOB_ENDPOINT: http://azurite:10000/devstoreaccount1
      DOCUMENTS_CONTAINER_NAME: documents
    ports:
      - "3000:3000"
    volumes:
      - .:/workspace
      - root-node-modules:/workspace/node_modules
    depends_on:
      - postgres
      - azurite

  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: eclat
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data

  azurite:
    image: mcr.microsoft.com/azure-storage/azurite
    command: azurite --blobHost 0.0.0.0 --blobPort 10000
    ports:
      - "10000:10000"

volumes:
  postgres-data:
  root-node-modules:
```

## 3.4 Hot reload strategy

For local dev:
- mount the repo into `/workspace`
- use the Dockerfile `dev` target
- run `ts-node-dev` inside the container
- keep `node_modules` in a named volume to avoid host/container mismatch

## 3.5 `.dockerignore`

Recommended contents:

```gitignore
.git
.github
.squad
node_modules
**/node_modules
**/dist
coverage
.terraform
infra/**/.terraform
*.tfstate
*.tfstate.*
.env
.env.*
```

If a checked-in sample env file is needed, explicitly re-include `apps/api/.env.example`.

## 4. CI/CD pipeline changes

## 4.1 Deployment principle

Separate the concerns that App Service currently blurred together:

1. **Validate code**
2. **Build/push image**
3. **Deploy infrastructure**
4. **Deploy application revision**

## 4.2 Recommended workflow split

### A. `ci.yml` — PR validation only

Run on pull requests:
- lint
- typecheck
- test
- optional TypeScript build if it remains cheap

Do **not** build/push a container image on every branch push.

### B. `build-image.yml` — merged PRs to `main`

Trigger options:
- preferred: `pull_request` with `types: [closed]` and `if: github.event.pull_request.merged == true`
- acceptable if branch protection forbids direct pushes: `push` on `main`

Actions:
- `docker buildx build`
- tag image with immutable tag (`${{ github.sha }}`)
- login to Azure with OIDC
- login to ACR
- push image to ACR

### C. `deploy-infra.yml` — Terraform only

Keep staged jobs:
- foundation
- data
- compute

But remove application artifact packaging and `azure/webapps-deploy`.

Compute now publishes:
- `api_container_app_name`
- `api_url`

### D. `deploy-api.yml` — update Container App image

For MVP, prefer **`az containerapp update`** over Terraform for every image rollout.

Why:
- image releases stay fast
- no full Terraform apply for every SHA
- infrastructure remains declarative while app rollout is operational

Recommended deploy step:

```bash
az containerapp update \
  --name "$API_CONTAINER_APP_NAME" \
  --resource-group "$RESOURCE_GROUP_NAME" \
  --image "$ACR_LOGIN_SERVER/api:$GITHUB_SHA"
```

If a revision suffix is desired, add it here.

## 4.3 Early-development cost control

To keep builds minimal during the MVP phase:

- **Build locally during feature development** with Docker / Compose
- **Do not build/push images for every branch push**
- **Run only code validation on PRs**
- **Build/push once on merge to `main`**
- Keep the API as the only deployed container until the backend patterns settle

## 4.4 Required GitHub/Azure permissions changes

- Deployment identity needs **`AcrPush`** on ACR
- Container App pull identity needs **`AcrPull`** on ACR
- Terraform/deploy identity still needs the existing Azure OIDC login path

## 5. Wiring map updates

`docs/infra-wiring-map.md` should be updated as part of the implementation slice.

## 5.1 Section 1: Layer output → input map

Update the contracts to show:

### New `00-foundation` outputs consumed downstream
- `container_registry_id`
- `container_registry_name`
- `container_registry_login_server`
- `log_analytics_workspace_id`
- any subnet output required by `20-compute`

### Updated `20-compute` outputs
- `api_container_app_name`
- `api_url`

Remove App Service-specific language from the consumer notes.

## 5.2 Section 2: Secret flow map

Change the runtime secret flow from:
- Key Vault → App Service Key Vault reference string → process env

to:
- Key Vault secret name + `KEY_VAULT_URI` → Container App env vars → API startup bootstrap (`DefaultAzureCredential`) → in-memory config

The secret flow table should explicitly document:
- `DATABASE_URL_SECRET_NAME`
- `JWT_SECRET_SECRET_NAME`
- future optional third-party secret-name settings

## 5.3 Section 3: GitHub secrets & variables

Add or update entries for:
- ACR push permission expectations
- image-build workflow
- deploy-api workflow

Remove `azure/webapps-deploy@v3` references.

## 5.4 Section 4: App settings map

Replace App Service-specific settings:
- remove `WEBSITES_PORT`
- remove `ENABLE_ORYX_BUILD`
- remove `SCM_DO_BUILD_DURING_DEPLOYMENT`

Add Container App/runtime settings:
- `PORT`
- `KEY_VAULT_URI`
- `DATABASE_URL_SECRET_NAME`
- `JWT_SECRET_SECRET_NAME`
- same non-secret runtime settings already used by the API

## 5.5 Section 5: Bootstrap → infra handoff

Add ACR to the bootstrap-to-runtime story:
- GitHub OIDC identity needs permission to push images
- `00-foundation` becomes the authoritative owner of registry naming and outputs

## 6. Recommended implementation order

1. **Foundation hardening**
   - Add ACR and Log Analytics
   - Move Key Vault to RBAC
   - Add VNet/private-endpoint primitives needed for the non-public services
2. **Compute migration**
   - Replace App Service resources with ACA Environment + Container App
   - Add probes, ingress, and image-based deployment inputs
3. **API runtime bootstrap**
   - Add Key Vault SDK-based secret loading with local `.env` fallback
4. **Pipeline split**
   - PR validation only
   - merge-to-main image build/push
   - separate infra deploy and app deploy
5. **Wiring map refresh**
   - Update `docs/infra-wiring-map.md` to match the new layer contracts and secret flow

## Final recommendation

For MVP, the clean architecture is:

- **Azure Container Apps** for API hosting
- **ACR in `00-foundation`** as the shared registry
- **Log Analytics in `00-foundation`** because ACA Environment requires it
- **ACA Environment + Container App in `20-compute`**
- **System-assigned managed identity** for runtime access to Key Vault and Storage
- **User-assigned pull identity** for ACR image pulls
- **Key Vault secret retrieval in app code via `DefaultAzureCredential`**
- **Local Docker/Compose** for daily development
- **CI image builds only on merge to `main`**

That gives the project local/prod parity, preserves the current environment-variable contract where it already works (`PORT`), respects the security directives, and avoids preview features or AKS-level overhead.