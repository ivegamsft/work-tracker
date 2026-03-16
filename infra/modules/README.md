# Service Group Compute Modules

## Overview

This directory contains Terraform modules for each logical service group in the E-CLAT platform. Currently, all service groups deploy to a single shared Container App, but the module boundaries are defined to enable future independent deployment without Terraform refactoring.

## Service Groups

| Module | Service Group | API Modules | Deploy Target (Current) | Deploy Target (Future) |
|--------|---------------|-------------|-------------------------|------------------------|
| `compute-identity` | Identity Platform | `auth`, platform features | Shared Container App | `eclat-{env}-identity-api` |
| `compute-workforce` | Workforce Core | `employees` | Shared Container App | `eclat-{env}-workforce-api` |
| `compute-compliance` | Compliance Service | `qualifications`, `medical`, `templates` | Shared Container App | `eclat-{env}-compliance-api` |
| `compute-records` | Records Service | `documents`, `hours` | Shared Container App | `eclat-{env}-records-api` |
| `compute-reference` | Reference Data | `standards`, `labels` | Shared Container App | `eclat-{env}-reference-api` |
| `compute-notifications` | Notifications Service | `notifications` | Shared Container App | `eclat-{env}-notifications-api` |

## Current State

### What's Working Now

- All modules reference the shared Container App via `data.azurerm_container_app.shared`
- Each module exposes a consistent interface:
  - `service_name` — deployment target name
  - `health_endpoint` — service-specific health check URL
  - `deploy_target` — Container App resource ID
- The 20-compute layer wires all modules together and passes the shared Container App name
- Outputs are structured to support future routing and health monitoring

### Module Structure

Each module follows the same pattern:

```hcl
infra/modules/compute-{group}/
├── main.tf       # Data source for shared Container App + commented future resource
├── variables.tf  # Current: environment, project_name, resource_group_name, container_app_name
├── outputs.tf    # service_name, health_endpoint, deploy_target
```

## Future Extraction Path

When a service group is ready for independent deployment:

1. **Uncomment the `azurerm_container_app` resource** in the module's `main.tf`
2. **Enable commented variables** in `variables.tf` (container_app_environment_id, image_repository, etc.)
3. **Update the outputs** to reference the new resource instead of the data source
4. **Update the 20-compute layer** to pass the new variables instead of `container_app_name`
5. **Build and push** a service-specific container image
6. **Run `terraform apply`** — the new Container App will be created alongside the existing one

### No Breaking Changes Required

- Downstream consumers already use the module outputs (`module.compute_identity.health_endpoint`, etc.)
- Output names and structure remain stable during extraction
- The shared Container App can remain deployed during the transition
- Rollback is simple: re-comment the resource and revert to the data source

## Layer Integration

The `infra/layers/20-compute/main.tf` layer:
- Instantiates the original `compute` module (shared Container App)
- Instantiates all six service group modules
- Passes the shared Container App name to each module via `module.compute.api_container_app_name`

The `infra/layers/20-compute/outputs.tf` exposes:
- Original outputs: `api_container_app_name`, `api_url`
- Service group outputs: `identity_service`, `workforce_service`, etc.

## Usage

### Current Deployment

```bash
cd infra/layers/20-compute
terraform init
terraform plan -var="environment=dev"
terraform apply -var="environment=dev"
```

All service modules will reference the same Container App.

### After Extraction (Example: Identity Service)

1. Edit `infra/modules/compute-identity/main.tf`:
   - Comment out the `data "azurerm_container_app"` block
   - Uncomment the `resource "azurerm_container_app"` block

2. Edit `infra/modules/compute-identity/variables.tf`:
   - Uncomment the deployment variables

3. Edit `infra/modules/compute-identity/outputs.tf`:
   - Update to reference `azurerm_container_app.identity` instead of `data.azurerm_container_app.shared`

4. Edit `infra/layers/20-compute/main.tf`:
   - Update `module.compute_identity` to pass deployment variables instead of `container_app_name`

5. Deploy:
   ```bash
   terraform apply -var="environment=dev"
   ```

## Alignment with Architecture Specs

This module structure implements the compute boundaries defined in:
- `docs/specs/service-architecture-spec.md` — Section 5 (Proposed Logical Service Groupings)
- `docs/specs/pipeline-architecture-spec.md` — Section 4 (Proposed Subsystem Map)

The subsystem keys from the pipeline spec map directly to the module names:
- `identity-platform` → `compute-identity`
- `workforce-core` → `compute-workforce`
- `compliance-service` → `compute-compliance`
- `records-service` → `compute-records`
- `reference-data` → `compute-reference`
- `notifications-service` → `compute-notifications`

## Testing

Before extraction:
```bash
# Validate current shared-app deployment
terraform validate
terraform plan

# Check module outputs
terraform output identity_service
```

After extraction:
```bash
# Smoke test the new Container App
curl https://{identity-app-fqdn}/health

# Verify independent scaling
az containerapp show --name eclat-dev-identity-api --resource-group eclat-dev-rg
```

## Migration Strategy

**Recommended order** (based on architectural coupling):

1. **Reference Data** (`compute-reference`) — lowest coupling, admin-curated catalogs
2. **Notifications** (`compute-notifications`) — event-driven, can consume from existing services
3. **Identity** (`compute-identity`) — central but stable, well-defined interface
4. **Records** (`compute-records`) — ingestion pipelines, independent processing
5. **Compliance** (`compute-compliance`) — tightly coupled to workforce and reference data
6. **Workforce** (`compute-workforce`) — core aggregate, many dependencies

**Pre-extraction checklist:**
- [ ] Service contract defined in `packages/shared`
- [ ] Health endpoint implemented
- [ ] Container image built and pushed to ACR
- [ ] Environment variables documented
- [ ] Smoke tests written
- [ ] Rollback plan documented

## Related Files

- `infra/layers/20-compute/` — layer that instantiates these modules
- `infra/modules/compute/` — original shared Container App module
- `docs/specs/service-architecture-spec.md` — domain ownership model
- `docs/specs/pipeline-architecture-spec.md` — subsystem map and CI/CD design
