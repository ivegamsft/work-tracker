# Multi-Tenant Provisioning & Ring Deployment IaC Spec — E-CLAT

> **Status:** Infrastructure Specification  
> **Owner:** Daniels (Microservices Engineer)  
> **Date:** 2026-03-19  
> **Issue:** #107  
> **Related Decisions:** Decision #1 (Tiered Isolation), Decision #3 (Modular Monolith), Decision #11 (Logical Environments)  
> **Applies To:** `infra/layers/20-compute`, `infra/modules/compute-*`, `.github/workflows`

---

## 1. Overview

This spec defines multi-tenant provisioning automation and ring-based deployment for E-CLAT. Two pricing tiers are provisioned: **shared tier** (row-level isolation in single DB/Redis) and **dedicated tier** (per-tenant DB, Redis, storage). Ring deployment enables canary (1%), 10%, 50%, 100% rollout stages, powered by Azure Container Apps scaling rules and traffic weights.

### Key Principles
- **Tiered isolation:** Shared DB with row filters for SMB; dedicated postgres + Redis for enterprise
- **Logical environments:** Prod/staging/dev scoped to rows in shared tenant table, not separate clusters
- **Independent versioning:** Service modules can be rolled back independently (no hard upgrade coupling)
- **Ring-based rollout:** Canary → 10% → 50% → 100% with automated traffic shifting

---

## 2. Azure Resource Topology

### 2.1 Shared Tier (SMB/Mid-Market)

```
┌─ Multi-Tenant Namespace
│  │
│  ├─ Single PostgreSQL Server (shared)
│  │  └─ Single database: e_clat_prod
│  │     └─ Tenant table (row_level_security via RLS policy)
│  │        ├─ Tenant 1 (row_filter: tenant_id = 1)
│  │        ├─ Tenant 2 (row_filter: tenant_id = 2)
│  │        └─ Tenant N
│  │
│  ├─ Single Redis Cache (shared)
│  │  └─ Key namespace: tenant:{tenant_id}:{session|cache|flag}:{key}
│  │
│  ├─ Single Azure Storage account
│  │  └─ Blob containers: tenant-{tenant_id}/documents, tenant-{tenant_id}/proofs
│  │
│  ├─ Container App (shared API runtime)
│  │  ├─ Replicas: 2–10 (auto-scale on CPU/memory)
│  │  ├─ Environment: tenant_context injected from JWT
│  │  └─ All 6 service modules deployed together
│  │
│  ├─ Service Bus Namespace (shared)
│  │  ├─ Topics: employee-events, qualification-events, document-events, etc.
│  │  ├─ Subscriptions per tenant (filtered by tenant_id in message properties)
│  │  └─ Dead-letter queue (shared)
│  │
│  └─ Key Vault (shared)
│     └─ Secrets: DB connection, Redis, Service Bus connection strings
│
└─ Ring Deployment (canary → 10% → 50% → 100%)
   └─ Container App traffic weights:
      ├─ Canary (1%): New image revision
      ├─ Stage 2 (10%): New image revision
      ├─ Stage 3 (50%): New image revision
      └─ Stable (100%): Old revision (keep until confident)
```

### 2.2 Dedicated Tier (Enterprise)

```
┌─ Dedicated Tenant Namespace
│  │
│  ├─ PostgreSQL Server (per tenant)
│  │  └─ Database: e_clat_{tenant_slug}_prod
│  │     └─ No RLS needed; single tenant
│  │
│  ├─ Redis Cache (per tenant)
│  │  └─ All keys scoped to this tenant
│  │
│  ├─ Azure Storage account (per tenant)
│  │  └─ Blob containers: documents, proofs, archives
│  │
│  ├─ Container App (per tenant, optional)
│  │  ├─ Alternative: shared compute with dedicated backing services
│  │  ├─ Replicas: 2–20 (auto-scale on SLA)
│  │  └─ Environment-specific: prod/staging/dev per tenant
│  │
│  ├─ Service Bus Namespace (per tenant, optional)
│  │  └─ Topics/subscriptions scoped to single tenant
│  │
│  └─ Key Vault (per tenant)
│     └─ Secrets: DB, Redis, Service Bus, IdP credentials
│
└─ Ring Deployment (same as shared, but per tenant)
```

---

## 3. Terraform Module Structure

### 3.1 Layer 20-Compute: Multi-Tenant Provisioning

**Path:** `infra/layers/20-compute/`

```
20-compute/
├── main.tf                        # Main orchestration
├── shared-tier.tf                 # Shared tenant provisioning
├── dedicated-tier.tf              # Enterprise tenant provisioning
├── ring-deployment.tf             # Canary → 100% traffic weights
├── outputs.tf
├── variables.tf
├── locals.tf                       # Tenant registry
└── modules/
    ├── tenant-provisioning/       # Shared tenant factory
    └── ring-deployment/           # Canary stage logic
```

### 3.2 Main.tf: Shared Tier Provisioning

```hcl
# infra/layers/20-compute/main.tf

locals {
  # Tenant registry (source of truth for provisioning)
  shared_tenants = {
    "acme-corp" = {
      tier            = "shared"
      environment     = var.environment
      replicas_min    = 2
      replicas_max    = 10
      db_sku          = "B_Standard_B2s"  # Burstable for SMB
      redis_sku       = "Basic"
    },
    "globex-inc" = {
      tier            = "shared"
      environment     = var.environment
      replicas_min    = 2
      replicas_max    = 8
      db_sku          = "B_Standard_B2s"
      redis_sku       = "Basic"
    },
  }

  dedicated_tenants = {
    "enterprise-alpha" = {
      tier            = "dedicated"
      environment     = var.environment
      replicas_min    = 3
      replicas_max    = 20
      db_sku          = "GP_Standard_D4s_v3"  # General purpose for enterprise
      redis_sku       = "Premium"
      custom_domain   = "alpha.e-clat.io"
    },
  }

  all_tenants = merge(local.shared_tenants, local.dedicated_tenants)
}

# Shared tier: single backing services
module "shared_tier" {
  source = "./modules/shared-tier"

  environment                 = var.environment
  location                    = var.location
  resource_group_name         = var.resource_group_name
  project_name                = var.project_name

  # Shared backing services (deployed once)
  db_sku                      = "Standard_B2s"
  db_backup_retention_days    = 35
  redis_sku                   = "Basic"
  storage_account_tier        = "Standard"

  # Container App configuration
  container_app_environment_id = azurerm_container_app_environment.main.id
  api_image                   = var.api_image  # From CI/CD
  api_cpu                     = "0.5"
  api_memory                  = "1Gi"

  # Service Bus
  service_bus_sku             = "Standard"
  service_bus_capacity        = 1

  key_vault_id                = var.key_vault_id
}

# Dedicated tier: per-tenant provisioning (factory pattern)
module "dedicated_tenant_provisioning" {
  for_each = local.dedicated_tenants

  source = "./modules/dedicated-tier"

  tenant_key              = each.key
  tenant_config           = each.value
  environment             = var.environment
  location                = var.location
  resource_group_name     = var.resource_group_name
  project_name            = var.project_name

  # Use shared API image
  api_image               = var.api_image

  # Separate Key Vault per tenant
  key_vault_id            = azurerm_key_vault.tenant[each.key].id

  depends_on = [
    module.shared_tier
  ]
}

# Ring deployment orchestration
module "ring_deployment" {
  source = "./modules/ring-deployment"

  environment             = var.environment
  location                = var.location
  container_app_name      = module.shared_tier.container_app_name
  resource_group_name     = var.resource_group_name

  # Ring stages: [canary_percent, stage2_percent, stage3_percent, stable_percent]
  ring_stages             = var.ring_stages  # [1, 10, 50, 100]
  ring_duration_minutes   = var.ring_duration_minutes  # Time between stage progression
  current_ring_index      = var.current_ring_index  # 0=canary, 1=10%, 2=50%, 3=100%

  new_image_revision      = var.new_api_image  # New image hash
  stable_revision         = module.shared_tier.stable_api_revision

  # Metrics for auto-progression
  error_rate_threshold    = 0.05  # Auto-rollback if error rate > 5%
  latency_p95_threshold   = 1000  # Auto-rollback if P95 > 1s
  availability_threshold  = 0.99  # Auto-rollback if availability < 99%
}

# Output for downstream pipelines
output "shared_tier_api_endpoint" {
  value = module.shared_tier.api_endpoint
}

output "dedicated_tier_endpoints" {
  value = {
    for tenant_key, module_output in module.dedicated_tenant_provisioning :
    tenant_key => module_output.api_endpoint
  }
}

output "ring_deployment_status" {
  value = module.ring_deployment.status
}
```

### 3.3 Shared Tier Module

```hcl
# infra/modules/shared-tier/main.tf

variable "db_sku" {
  type = string
}

variable "db_backup_retention_days" {
  type    = number
  default = 35
}

variable "redis_sku" {
  type = string
}

variable "service_bus_sku" {
  type = string
}

# PostgreSQL (shared)
resource "azurerm_postgresql_flexible_server" "shared" {
  name                = "${var.project_name}-${var.environment}-shared-db"
  location            = var.location
  resource_group_name = var.resource_group_name

  storage_mb           = 262144  # 256 GB for shared tier
  backup_retention_days = var.db_backup_retention_days

  sku_name = var.db_sku  # B_Standard_B2s for SMB

  high_availability {
    mode = "ZoneRedundant"  # HA for prod
  }

  authentication {
    password_auth_enabled = true
  }

  tags = merge(
    local.common_tags,
    {
      tier = "shared"
      component = "database"
    }
  )
}

# Database: e_clat_prod
resource "azurerm_postgresql_flexible_server_database" "main" {
  name            = "e_clat_${replace(var.environment, \"-\", \"_\")}"
  server_id       = azurerm_postgresql_flexible_server.shared.id
  charset         = "UTF8"
  collation       = "en_US.utf8"
}

# Row-Level Security (RLS) for multi-tenancy
resource "null_resource" "enable_rls" {
  provisioner "local-exec" {
    command = <<-EOT
      psql \
        -h ${azurerm_postgresql_flexible_server.shared.fqdn} \
        -U ${azurerm_postgresql_flexible_server.shared.administrator_login} \
        -d ${azurerm_postgresql_flexible_server_database.main.name} \
        -c "ALTER DATABASE ${azurerm_postgresql_flexible_server_database.main.name} \
            SET row_security = on;"
      
      # Enable RLS on all tables (via migration script)
      psql \
        -h ${azurerm_postgresql_flexible_server.shared.fqdn} \
        -U ${azurerm_postgresql_flexible_server.shared.administrator_login} \
        -d ${azurerm_postgresql_flexible_server_database.main.name} \
        -f ${path.module}/enable-rls.sql
    EOT
  }

  triggers = {
    database_id = azurerm_postgresql_flexible_server_database.main.id
  }
}

# Redis (shared)
resource "azurerm_redis_cache" "shared" {
  name                = "${var.project_name}-${var.environment}-redis"
  location            = var.location
  resource_group_name = var.resource_group_name

  capacity = var.redis_sku == "Basic" ? 0 : 1
  family   = var.redis_sku == "Basic" ? "C" : "P"
  sku_name = var.redis_sku

  minimum_tls_version = "1.2"
  enable_non_ssl_port = false

  tags = merge(
    local.common_tags,
    {
      tier = "shared"
      component = "cache"
    }
  )
}

# Storage (shared)
resource "azurerm_storage_account" "shared" {
  name                     = lower("${var.project_name}${var.environment}shared")
  location                 = var.location
  resource_group_name      = var.resource_group_name
  account_tier             = "Standard"
  account_replication_type = "GRS"  # Geo-redundant for shared tier

  https_traffic_only_enabled = true

  tags = merge(
    local.common_tags,
    {
      tier = "shared"
      component = "storage"
    }
  )
}

# Blob containers per tenant
resource "azurerm_storage_container" "tenant_documents" {
  for_each = local.shared_tenants  # From locals in parent

  name                  = "tenant-${each.key}-documents"
  storage_account_name  = azurerm_storage_account.shared.name
  container_access_type = "private"
}

resource "azurerm_storage_container" "tenant_proofs" {
  for_each = local.shared_tenants

  name                  = "tenant-${each.key}-proofs"
  storage_account_name  = azurerm_storage_account.shared.name
  container_access_type = "private"
}

# Service Bus (shared)
resource "azurerm_servicebus_namespace" "shared" {
  name                = "${var.project_name}-${var.environment}-bus"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = var.service_bus_sku
  capacity            = var.service_bus_capacity

  tags = merge(
    local.common_tags,
    {
      tier = "shared"
      component = "messaging"
    }
  )
}

# Topics per domain event
resource "azurerm_servicebus_topic" "events" {
  for_each = toset([
    "employee-events",
    "qualification-events",
    "medical-events",
    "document-events",
    "hour-events",
    "notification-events",
    "compliance-events",
  ])

  name                = each.value
  namespace_name      = azurerm_servicebus_namespace.shared.name
  resource_group_name = var.resource_group_name
  enable_partitioning = true
  max_message_size_kb = 1024
}

# Subscriptions (per tenant, filtered by tenant_id)
resource "azurerm_servicebus_subscription" "tenant_subscriptions" {
  for_each = local.shared_tenants

  for_each_topic = azurerm_servicebus_topic.events

  name                = "tenant-${each.key}"
  topic_name          = each.value.name
  namespace_name      = azurerm_servicebus_namespace.shared.name
  resource_group_name = var.resource_group_name

  # Filter: only messages with tenant_id matching this tenant
  sql_filter = "tenant_id = '${each.key}'"

  dead_letter_on_filter_evaluation_error = true
  dead_letter_on_message_expiration      = true
  max_delivery_count                     = 10
}

# Container App (shared API runtime)
resource "azurerm_container_app" "api" {
  name                         = "${var.project_name}-${var.environment}-api"
  container_app_environment_id = var.container_app_environment_id
  resource_group_name          = var.resource_group_name
  revision_mode                = "Multiple"  # Enable traffic splitting for ring deployment

  template {
    container {
      name   = "api"
      image  = var.api_image
      cpu    = var.api_cpu
      memory = var.api_memory

      env {
        name  = "ENVIRONMENT"
        value = var.environment
      }

      env {
        name  = "DB_HOST"
        secret_ref = "db-host"
      }

      env {
        name  = "DB_USER"
        secret_ref = "db-user"
      }

      env {
        name  = "DB_PASSWORD"
        secret_ref = "db-password"
      }

      env {
        name  = "REDIS_URL"
        secret_ref = "redis-url"
      }

      env {
        name  = "SERVICE_BUS_CONNECTION_STRING"
        secret_ref = "service-bus-connection"
      }

      ports {
        container_port = 3000
      }

      liveness_probe {
        http_get {
          path = "/health"
          port = 3000
        }
        initial_delay = 15
        interval_seconds = 30
      }
    }

    scale {
      min_replicas = 2
      max_replicas = 10

      rules {
        custom_rule_type = "cpu"
        metadata = {
          type  = "Utilization"
          value = "70"
        }
      }

      rules {
        custom_rule_type = "memory"
        metadata = {
          type  = "Utilization"
          value = "80"
        }
      }
    }
  }

  secret {
    name  = "db-host"
    value = azurerm_postgresql_flexible_server.shared.fqdn
  }

  secret {
    name  = "db-user"
    value = azurerm_postgresql_flexible_server.shared.administrator_login
  }

  secret {
    name  = "db-password"
    value = azurerm_postgresql_flexible_server.shared.administrator_password
  }

  secret {
    name  = "redis-url"
    value = azurerm_redis_cache.shared.primary_connection_string
  }

  secret {
    name  = "service-bus-connection"
    value = azurerm_servicebus_namespace.shared.default_primary_connection_string
  }

  ingress {
    allow_insecure_connections = false
    external_enabled           = true
    target_port                = 3000
    transport                  = "http"

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  tags = merge(
    local.common_tags,
    {
      tier = "shared"
      component = "api"
    }
  )
}

output "api_endpoint" {
  value = azurerm_container_app.api.latest_revision_fqdn
}

output "container_app_name" {
  value = azurerm_container_app.api.name
}

output "stable_api_revision" {
  value = azurerm_container_app.api.latest_revision_name
}
```

### 3.4 Ring Deployment Module

```hcl
# infra/modules/ring-deployment/main.tf

variable "ring_stages" {
  description = "Canary rollout percentages: [1%, 10%, 50%, 100%]"
  type        = list(number)
  default     = [1, 10, 50, 100]
}

variable "current_ring_index" {
  description = "Current ring stage (0=canary, 1=10%, 2=50%, 3=100%)"
  type        = number
  default     = 0
}

variable "new_image_revision" {
  type = string
}

variable "stable_revision" {
  type = string
}

variable "error_rate_threshold" {
  type    = number
  default = 0.05
}

variable "latency_p95_threshold" {
  type    = number
  default = 1000
}

variable "availability_threshold" {
  type    = number
  default = 0.99
}

# Fetch Container App
data "azurerm_container_app" "api" {
  name                = var.container_app_name
  resource_group_name = var.resource_group_name
}

# Update traffic weights based on ring_index
resource "azurerm_container_app" "ring_deployment" {
  name                         = data.azurerm_container_app.api.name
  container_app_environment_id = data.azurerm_container_app.api.container_app_environment_id
  resource_group_name          = var.resource_group_name

  # Copy existing configuration, update traffic weights
  template {
    # ... (copy from existing)
  }

  # Ring deployment traffic weights
  ingress {
    allow_insecure_connections = false
    external_enabled           = true
    target_port                = 3000
    transport                  = "http"

    # Stage 0 (canary): 1% new, 99% stable
    dynamic "traffic_weight" {
      for_each = var.current_ring_index == 0 ? [1] : []
      content {
        percentage      = var.ring_stages[0]  # 1%
        revision_suffix = "canary"
      }
    }

    # Stage 1 (10%): 10% new, 90% stable
    dynamic "traffic_weight" {
      for_each = var.current_ring_index == 1 ? [1] : []
      content {
        percentage      = var.ring_stages[1]  # 10%
        revision_suffix = "stage2"
      }
    }

    # Stage 2 (50%): 50% new, 50% stable
    dynamic "traffic_weight" {
      for_each = var.current_ring_index == 2 ? [1] : []
      content {
        percentage      = var.ring_stages[2]  # 50%
        revision_suffix = "stage3"
      }
    }

    # Stage 3 (100%): 100% new (stable)
    dynamic "traffic_weight" {
      for_each = var.current_ring_index == 3 ? [1] : []
      content {
        percentage      = 100
        latest_revision = true
      }
    }

    # Always keep previous revision for quick rollback
    traffic_weight {
      percentage      = 100 - var.ring_stages[var.current_ring_index]
      revision_suffix = var.current_ring_index > 0 ? "stable" : ""
    }
  }
}

# Alerting: auto-rollback on metrics threshold breach
resource "azurerm_monitor_metric_alert" "ring_error_rate" {
  name                = "${var.container_app_name}-ring-error-rate"
  resource_group_name = var.resource_group_name
  scopes              = [data.azurerm_container_app.api.id]
  description         = "Auto-rollback if error rate exceeds threshold during ring deployment"
  severity            = 1

  criteria {
    metric_namespace = "Microsoft.InsiderThreatManagement/alertsV2"
    metric_name      = "error_rate"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = var.error_rate_threshold * 100

    evaluation_frequency = "PT5M"
    window_duration      = "PT5M"
  }

  action {
    action_group_id = azurerm_monitor_action_group.ring_alerts.id
  }

  tags = {
    environment = var.environment
    component   = "deployment"
  }
}

output "status" {
  value = {
    current_ring_index = var.current_ring_index
    ring_stage_name    = ["canary", "10%", "50%", "100%"][var.current_ring_index]
    traffic_percentage = var.ring_stages[var.current_ring_index]
    new_revision       = var.new_image_revision
    stable_revision    = var.stable_revision
  }
}
```

---

## 4. Cost Estimates

### 4.1 Shared Tier (Per Environment)

| Component | SKU | Monthly |
|-----------|-----|---------|
| PostgreSQL | Standard_B2s (2 vCore) | $150–200 |
| Redis | Basic (1 GB) | $20–30 |
| Storage | Standard (RA-GRS) | $50–100 |
| Container App (replicas 2–10) | 0.5 CPU, 1GB RAM | $100–200 |
| Service Bus | Standard, 1 capacity unit | $50–75 |
| **Total (Shared)** | Per environment | **~$400–700/mo** |

*Shared across all SMB tenants: ~$50–100/tenant/mo*

### 4.2 Dedicated Tier (Enterprise)

| Component | SKU | Monthly |
|-----------|-----|---------|
| PostgreSQL | GP_Standard_D4s_v3 (4 vCore) | $800–1,200 |
| Redis | Premium (6 GB) | $300–500 |
| Storage | Premium (LRS) | $100–200 |
| Container App (replicas 3–20) | 2 CPU, 4GB RAM | $500–1,000 |
| Service Bus (per tenant) | Standard, 2 capacity units | $100–150 |
| **Total (Dedicated)** | Per tenant | **~$2,000–3,200/mo** |

### 4.3 Ring Deployment Overhead

- **No additional cost:** Ring deployment uses existing Container App replicas
- **Monitoring cost:** Alert rules (~$5–10/mo per alert)

---

## 5. Tenant Provisioning Workflow

### 5.1 Shared Tier Onboarding (Day 1)

```bash
# 1. Update locals.tf with new tenant
cat >> infra/layers/20-compute/locals.tf << 'EOF'
    "new-customer" = {
      tier            = "shared"
      environment     = "prod"
      replicas_min    = 2
      replicas_max    = 10
      db_sku          = "B_Standard_B2s"
      redis_sku       = "Basic"
    },
EOF

# 2. Run Terraform
terraform apply -var-file=prod.tfvars

# 3. Create blob containers
terraform apply -target=azurerm_storage_container.tenant_documents["new-customer"]

# 4. Provision tenant row in database
psql -c "
  INSERT INTO tenants (id, name, slug, tier, environment, created_at)
  VALUES (uuid_generate_v4(), 'New Customer', 'new-customer', 'shared', 'prod', NOW());
"

# 5. Configure SCIM provisioning
curl -X POST https://api.e-clat.io/scim/v2/Tenants \
  -H "Authorization: Bearer $SCIM_TOKEN" \
  -d '{
    "tenantSlug": "new-customer",
    "idpType": "entra",
    "idpAppId": "...",
    "idpEndpoint": "..."
  }'
```

### 5.2 Dedicated Tier Onboarding (Week 1)

```bash
# 1. Update locals.tf
cat >> infra/layers/20-compute/locals.tf << 'EOF'
    "enterprise-beta" = {
      tier            = "dedicated"
      environment     = "prod"
      replicas_min    = 3
      replicas_max    = 20
      db_sku          = "GP_Standard_D4s_v3"
      redis_sku       = "Premium"
      custom_domain   = "beta.e-clat.io"
    },
EOF

# 2. Run Terraform (provisions new resources)
terraform apply -target=module.dedicated_tenant_provisioning

# 3. Migrate data (if from shared tier)
pg_dump shared_db | psql enterprise_beta_db

# 4. Update DNS
# beta.e-clat.io → Container App endpoint (or customer's domain)

# 5. Run migrations
terraform apply -target=null_resource.run_migrations["enterprise-beta"]
```

---

## 6. Ring Deployment Workflow

### 6.1 Initiating a Canary Deployment

```bash
# 1. New image is built and pushed to ACR
# 2. CI/CD publishes new image URI

# 3. Manually trigger canary (or auto on all tests passing)
terraform apply \
  -var="current_ring_index=0" \
  -var="new_api_image=acr.azurecr.io/e-clat:v2.3.0-sha-abc123" \
  -target=module.ring_deployment

# 4. Monitor canary (1% traffic) for 15–30 minutes
# Metrics dashboard shows error rate, latency, availability
curl https://api.e-clat.io/health | jq

# 5. If healthy, auto-progress or manually advance to 10%
terraform apply \
  -var="current_ring_index=1" \
  -target=module.ring_deployment
```

### 6.2 Auto-Rollback on Metric Threshold

```hcl
# Monitor error rate and auto-rollback if threshold exceeded
resource "azurerm_monitor_metric_alert" "ring_error_rate_auto_rollback" {
  # ... (defined in module)

  action {
    action_group_id = azurerm_monitor_action_group.auto_rollback.id
  }

  # Webhook: call Terraform to revert current_ring_index
}

# Action Group: webhook to GitHub Actions rollback workflow
resource "azurerm_monitor_action_group" "auto_rollback" {
  name                = "${var.project_name}-auto-rollback"
  resource_group_name = var.resource_group_name
  short_name          = "Rollback"

  webhook_receiver {
    name = "github-actions-rollback"
    service_uri = "${var.github_actions_webhook_url}?event=ringDeploymentAlert"
  }

  tags = local.common_tags
}
```

---

## 7. Implementation Checklist

### Phase 1: Shared Tier (Week 1–2)
- [ ] Create `infra/modules/shared-tier/`
- [ ] Provision PostgreSQL, Redis, Storage (shared)
- [ ] Provision Service Bus namespace + topics
- [ ] Deploy Container App (shared)
- [ ] Test RLS on sample tenant

### Phase 2: Dedicated Tier (Week 3–4)
- [ ] Create `infra/modules/dedicated-tier/`
- [ ] Create factory module for per-tenant provisioning
- [ ] Provision first enterprise tenant
- [ ] Migrate test data to dedicated tier
- [ ] Verify tenant isolation

### Phase 3: Ring Deployment (Week 5–6)
- [ ] Create `infra/modules/ring-deployment/`
- [ ] Implement traffic weight splitting
- [ ] Create monitoring dashboard
- [ ] Test canary → 10% → 50% → 100% progression
- [ ] Implement auto-rollback on error rate

### Phase 4: Automation (Week 7+)
- [ ] GitHub Actions: auto-trigger canary on successful build
- [ ] Terraform: auto-provision new shared tenants
- [ ] API: `/tenants` endpoint for self-service provisioning

---

## 8. Related Documentation

- **Decision #1:** Tiered Isolation (`.squad/decisions.md`)
- **Decision #3:** Modular Monolith (`.squad/decisions.md`)
- **Service Architecture:** `docs/specs/service-architecture-spec.md`
- **Pipeline Architecture:** `docs/specs/pipeline-architecture-spec.md`
- **Runbook:** `docs/guides/ring-deployment-runbook.md` (TBD)

---

**Status:** Ready for Terraform implementation  
**Estimated Effort:** 7–8 weeks (all phases)  
**Owner:** Daniels (Microservices Engineer), Platform team
