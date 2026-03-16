# E-CLAT Infrastructure Modules

Reusable Terraform modules consumed by the layer stacks in `infra/layers/`.

## Module Inventory

| Module | Purpose |
|--------|---------|
| `compute/` | Shared monolith Container App (current production target) |
| `compute-identity/` | Identity service group — auth, platform |
| `compute-workforce/` | Workforce service group — employees |
| `compute-compliance/` | Compliance service group — qualifications, medical, templates |
| `compute-records/` | Records service group — documents, hours |
| `compute-reference/` | Reference service group — standards, labels |
| `compute-notifications/` | Notifications service group — notifications |
| `database/` | PostgreSQL Flexible Server and related resources |
| `foundation/` | Resource group, Key Vault, ACR, Log Analytics |
| `storage/` | Storage account and blob containers |

## Compute Service-Group Modules

The six `compute-*` modules represent the logical service boundaries defined in
`docs/specs/service-architecture-spec.md`. They align API domain modules to
future independently-deployable Container Apps.

### Current State (Stub)

Each stub module:

1. Accepts `environment`, `project_name`, `resource_group_name`, and
   `container_app_name` as inputs (with validation).
2. Uses a `data "azurerm_container_app"` source to reference the shared
   monolith deployed by the `compute/` module.
3. Exposes three outputs:
   - `service_name` — logical key (e.g. `"identity"`)
   - `health_endpoint` — per-service health-check path (e.g. `/api/auth/health`)
   - `deploy_target` — Container App name used for CI/CD deployments

### Module Structure

```
infra/modules/compute-{group}/
├── main.tf       # Data source for shared Container App + commented future resource
├── variables.tf  # environment, project_name, resource_group_name, container_app_name
└── outputs.tf    # service_name, health_endpoint, deploy_target
```

### Extraction Path

When a service group is ready for independent deployment:

1. Uncomment the `azurerm_container_app` resource block in its `main.tf`.
2. Add service-specific variables (image tag, CPU/memory, secrets, etc.).
3. Switch `deploy_target` from `data.azurerm_container_app.shared.name` to
   the new resource's name.
4. Add required role assignments (Key Vault, Storage, etc.) mirroring the
   pattern in `compute/main.tf`.
5. Update the corresponding `module` block in `infra/layers/20-compute/main.tf`
   to pass the additional variables.

### Service-Group → API Module Mapping

| Service Group | API Modules | Health Endpoint |
|---------------|-------------|-----------------|
| identity | auth, platform | `/api/auth/health` |
| workforce | employees | `/api/employees/health` |
| compliance | qualifications, medical, templates | `/api/qualifications/health` |
| records | documents, hours | `/api/documents/health` |
| reference | standards, labels | `/api/standards/health` |
| notifications | notifications | `/api/notifications/health` |

This mapping is defined in `docs/specs/service-architecture-spec.md` and
governs how the monolith will progressively decompose into microservices.

## Layer Integration

The `infra/layers/20-compute/main.tf` layer:
- Instantiates the original `compute` module (shared Container App)
- Instantiates all six service group modules
- Passes the shared Container App name to each module via `module.compute.api_container_app_name`

The `infra/layers/20-compute/outputs.tf` exposes:
- Original outputs: `api_container_app_name`, `api_url`
- Service group outputs: `identity_service`, `workforce_service`, etc.

## Alignment with Architecture Specs

This module structure implements the compute boundaries defined in:
- `docs/specs/service-architecture-spec.md` — service groupings and domain ownership
- `docs/specs/pipeline-architecture-spec.md` — subsystem map and CI/CD design

The subsystem keys map directly to the module names:
- `identity-platform` → `compute-identity`
- `workforce-core` → `compute-workforce`
- `compliance-service` → `compute-compliance`
- `records-service` → `compute-records`
- `reference-data` → `compute-reference`
- `notifications-service` → `compute-notifications`
