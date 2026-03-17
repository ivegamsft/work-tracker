# Data Layer IaC Spec — E-CLAT

> **Status:** Infrastructure Specification  
> **Owner:** Daniels (Microservices Engineer)  
> **Date:** 2026-03-19  
> **Issue:** #115  
> **Related Decision:** Decision #1 (Tiered Isolation)  
> **Applies To:** `infra/layers/10-data`, `infra/modules/database`, `infra/modules/storage`, `data/prisma`

---

## 1. Overview

This spec defines the polyglot data store provisioning for E-CLAT: PostgreSQL (relational), Cosmos DB/MongoDB (documents), Azure Storage (blobs), Redis (cache), Azure Data Explorer (telemetry). **Shared tier** uses single instances for SMB tenants; **dedicated tier** provisions per-tenant databases, storage, and cache. Migration strategy enables seamless evolution from single-Postgres to multi-store architecture.

### Key Principles
- **Polyglot persistence:** Right tool for each data type (relational, document, time-series, cache)
- **Tiered isolation:** Shared backing services with RLS for SMB; dedicated resources for enterprise
- **Connection string rotation:** Automated secret rotation via Key Vault
- **Backup/restore per tier:** Daily snapshots for shared, granular per-tenant for dedicated
- **Private Link:** Network isolation for prod; service endpoints for dev
- **Migration path:** Live data migration from single-Postgres to multi-store without downtime

---

## 2. Data Store Topology

### 2.1 Shared Tier (SMB)

```
┌─ PostgreSQL Server (single, shared)
│  ├─ Database: e_clat_prod
│  ├─ Schema: shared (RLS enforced)
│  │  ├─ Table: tenants (row_level_security: tenant_id)
│  │  ├─ Table: employees (RLS: tenant_id filter)
│  │  ├─ Table: qualifications (RLS: via employee.tenant_id)
│  │  ├─ Table: documents (RLS: tenant_id)
│  │  ├─ Table: audit_logs (RLS: tenant_id)
│  │  └─ ... (all tables with RLS policies)
│  │
│  ├─ SKU: Standard_B2s (2 vCore, 4GB RAM) for shared tier
│  ├─ Storage: 256 GB (expandable)
│  ├─ Backup: Daily snapshots (35-day retention)
│  └─ Replica: Zone-redundant HA for prod
│
├─ MongoDB/Cosmos DB (shared, optional)
│  ├─ Database: e_clat
│  ├─ Collections: documents (JSON blobs), proof_artifacts
│  ├─ Throughput: Shared (autoscale 400–4000 RU/s)
│  └─ Replicated across 3 regions (multi-region writes for prod)
│
├─ Azure Storage Account (shared)
│  ├─ Blob containers per tenant
│  │  ├─ tenant-{id}-documents (employee-uploaded files)
│  │  ├─ tenant-{id}-proofs (proof evidence artifacts)
│  │  ├─ tenant-{id}-reports (exported compliance reports)
│  │  └─ tenant-{id}-archives (7-year retention, cold tier)
│  │
│  ├─ Tier: Standard_GRS (geo-redundant)
│  ├─ Replication: Geo-Redundant Storage (GRS)
│  └─ Lifecycle: Hot → Cool → Archive (automated)
│
├─ Redis Cache (shared)
│  ├─ Tier: Basic (1 GB) for dev, Standard (6 GB) for prod
│  ├─ Key namespacing: tenant:{tenant_id}:{object_type}:{key}
│  │  ├─ tenant:123:session:user-456-abc123
│  │  ├─ tenant:123:cache:employees-list
│  │  └─ tenant:123:flag:feature-x
│  │
│  ├─ TTL: 24 hours (sessions), 1 hour (cache), 7 days (flags)
│  └─ Max Memory Policy: allkeys-lru (evict LRU when full)
│
└─ Azure Data Explorer (shared)
   ├─ Cluster: Standard_D11_v2, 2 nodes
   ├─ Database: e_clat_{environment}_db
   ├─ Tables:
   │  ├─ events (OTel spans, traces)
   │  ├─ logs (application logs)
   │  ├─ audit_logs (compliance audit trail)
   │  ├─ compliance_telemetry (time-series metrics)
   │  └─ performance_metrics (latency, throughput, errors)
   │
   ├─ Retention: 30 days (hot), 2555 days (archive for compliance)
   └─ Pricing: Shared across all SMB tenants
```

### 2.2 Dedicated Tier (Enterprise)

```
┌─ PostgreSQL Server (per tenant)
│  ├─ Database: e_clat_{tenant_slug}_{environment}
│  ├─ SKU: GP_Standard_D4s_v3 (4 vCore, 16GB RAM)
│  ├─ Storage: 512 GB (expandable per SLA)
│  ├─ Backup: Continuous (PITR 35 days)
│  ├─ Replica: Zone-redundant + geo-replica (prod)
│  └─ No RLS needed (single tenant)
│
├─ MongoDB/Cosmos DB (per tenant, optional)
│  ├─ Database: e_clat_{tenant_slug}
│  ├─ Throughput: Dedicated (dedicated container: 10,000+ RU/s)
│  └─ Multi-region writes (regional failover)
│
├─ Azure Storage Account (per tenant)
│  ├─ Blob containers
│  │  ├─ documents (all employee files)
│  │  ├─ proofs (proof evidence)
│  │  ├─ reports (exports)
│  │  └─ archives (7-year retention, cold tier)
│  │
│  ├─ Tier: Premium_LRS (high-performance, locally redundant)
│  └─ Lifecycle: Hot → Cool → Archive per 90-day policy
│
├─ Redis Cache (per tenant)
│  ├─ Tier: Premium (6–64 GB)
│  ├─ Cluster: 3 nodes with replicas (HA)
│  ├─ Persistence: RDB snapshots + AOF logging
│  └─ Throughput: 50,000+ ops/sec
│
└─ Azure Data Explorer (per tenant, optional)
   ├─ Cluster: Standard_L8s, 4 nodes
   ├─ Database: e_clat_{tenant_slug}_{environment}_db
   ├─ Tables: same as shared
   └─ Dedicated for large-scale analytics
```

---

## 3. Terraform Module Structure

### 3.1 Layer 10-Data: `database`, `storage`, `cache` modules

**Path:** `infra/modules/`

```
modules/
├── database/
│  ├── main.tf                 # PostgreSQL provisioning
│  ├── rls.tf                   # Row-Level Security setup
│  ├── outputs.tf
│  └── variables.tf
│
├── storage/
│  ├── main.tf                 # Azure Storage provisioning
│  ├── lifecycle-policies.tf    # Hot → Cool → Archive
│  ├── outputs.tf
│  └── variables.tf
│
└── cache/
   ├── main.tf                 # Redis provisioning
   ├── clustering.tf           # HA cluster (dedicated tier)
   ├── outputs.tf
   └── variables.tf
```

### 3.2 Main.tf: Layer 10-Data Instantiation

```hcl
# infra/layers/10-data/main.tf

module "database" {
  source = "../../modules/database"

  environment                 = var.environment
  location                    = var.location
  resource_group_name         = var.resource_group_name
  project_name                = var.project_name

  # Shared tier
  db_sku_shared               = "Standard_B2s"
  db_storage_shared_gb        = 256
  db_backup_retention_days    = 35
  db_ha_enabled               = var.environment == "prod" ? true : false

  # Dedicated tier (factory)
  dedicated_tier_enabled      = true
  dedicated_db_sku            = "GP_Standard_D4s_v3"
  dedicated_db_storage_gb     = 512

  # RLS
  rls_enabled                 = true
  rls_enforcement_strict      = var.environment == "prod" ? true : false

  # Network
  private_endpoint_enabled    = var.environment == "prod" ? true : false
  private_subnet_id           = azurerm_subnet.private.id

  key_vault_id                = var.key_vault_id
}

module "storage" {
  source = "../../modules/storage"

  environment                 = var.environment
  location                    = var.location
  resource_group_name         = var.resource_group_name
  project_name                = var.project_name

  # Shared tier
  storage_tier_shared         = "Standard"
  storage_replication_shared  = "GRS"
  storage_lifecycle_enabled   = true
  archive_days                = 90

  # Dedicated tier
  dedicated_tier_enabled      = true
  storage_tier_dedicated      = "Premium"
  storage_replication_dedicated = "LRS"

  # Network
  private_endpoint_enabled    = var.environment == "prod" ? true : false
  private_subnet_id           = azurerm_subnet.private.id

  key_vault_id                = var.key_vault_id
}

module "cache" {
  source = "../../modules/cache"

  environment                 = var.environment
  location                    = var.location
  resource_group_name         = var.resource_group_name
  project_name                = var.project_name

  # Shared tier
  redis_sku_shared            = var.environment == "prod" ? "Standard" : "Basic"
  redis_capacity_shared       = var.environment == "prod" ? 1 : 0

  # Dedicated tier
  dedicated_tier_enabled      = true
  redis_sku_dedicated         = "Premium"
  redis_capacity_dedicated    = 2  # 6 GB minimum for premium

  # Clustering (dedicated)
  redis_cluster_enabled       = var.environment == "prod" ? true : false
  redis_cluster_shards        = 3

  # Network
  private_endpoint_enabled    = var.environment == "prod" ? true : false
  private_subnet_id           = azurerm_subnet.private.id

  key_vault_id                = var.key_vault_id
}
```

### 3.3 PostgreSQL Module

```hcl
# infra/modules/database/main.tf

# Shared PostgreSQL
resource "azurerm_postgresql_flexible_server" "shared" {
  name                = "${var.project_name}-${var.environment}-shared-db"
  location            = var.location
  resource_group_name = var.resource_group_name

  storage_mb           = var.db_storage_shared_gb * 1024
  backup_retention_days = var.db_backup_retention_days

  sku_name = var.db_sku_shared  # "B_Standard_B2s" for dev, "Standard_D2s_v3" for prod

  high_availability {
    mode = var.db_ha_enabled ? "ZoneRedundant" : "SameZone"
  }

  authentication {
    password_auth_enabled = true
  }

  # Network isolation (prod)
  dynamic "network_rule_set" {
    for_each = var.private_endpoint_enabled ? [1] : []
    content {
      default_action                 = "Deny"
      public_network_access_enabled  = false
    }
  }

  tags = merge(
    local.common_tags,
    {
      tier      = "shared"
      component = "database"
    }
  )
}

# Shared database
resource "azurerm_postgresql_flexible_server_database" "shared" {
  name            = "e_clat_${replace(var.environment, \"-\", \"_\")}"
  server_id       = azurerm_postgresql_flexible_server.shared.id
  charset         = "UTF8"
  collation       = "en_US.utf8"
}

# Private endpoint (prod)
resource "azurerm_private_endpoint" "db_shared" {
  count = var.private_endpoint_enabled ? 1 : 0

  name                = "${var.project_name}-${var.environment}-db-pe"
  location            = var.location
  resource_group_name = var.resource_group_name
  subnet_id           = var.private_subnet_id

  private_service_connection {
    name                 = "${var.project_name}-${var.environment}-db-psc"
    is_manual_connection = false
    private_connection_resource_id = azurerm_postgresql_flexible_server.shared.id
    subresource_names    = ["postgresqlServer"]
  }

  tags = local.common_tags
}

# Store connection string in Key Vault
resource "azurerm_key_vault_secret" "db_connection_shared" {
  name         = "db-connection-string-shared"
  value        = "postgresql://${azurerm_postgresql_flexible_server.shared.administrator_login}:${azurerm_postgresql_flexible_server.shared.administrator_password}@${azurerm_postgresql_flexible_server.shared.fqdn}:5432/${azurerm_postgresql_flexible_server_database.shared.name}"
  key_vault_id = var.key_vault_id

  tags = local.common_tags
}

# Dedicated PostgreSQL (per tenant, factory pattern)
resource "azurerm_postgresql_flexible_server" "dedicated" {
  for_each = var.dedicated_tier_enabled ? local.dedicated_tenants : {}

  name                = "${var.project_name}-${each.key}-${var.environment}-db"
  location            = var.location
  resource_group_name = var.resource_group_name

  storage_mb           = var.dedicated_db_storage_gb * 1024
  backup_retention_days = var.db_backup_retention_days

  sku_name = var.dedicated_db_sku  # GP_Standard_D4s_v3

  high_availability {
    mode = "ZoneRedundant"
  }

  authentication {
    password_auth_enabled = true
  }

  # Network isolation
  dynamic "network_rule_set" {
    for_each = var.private_endpoint_enabled ? [1] : []
    content {
      default_action                 = "Deny"
      public_network_access_enabled  = false
    }
  }

  tags = merge(
    local.common_tags,
    {
      tier      = "dedicated"
      tenant_id = each.key
      component = "database"
    }
  )
}

# Dedicated database
resource "azurerm_postgresql_flexible_server_database" "dedicated" {
  for_each = var.dedicated_tier_enabled ? local.dedicated_tenants : {}

  name      = "e_clat_${replace(each.key, \"-\", \"_\")}_${replace(var.environment, \"-\", \"_\")}"
  server_id = azurerm_postgresql_flexible_server.dedicated[each.key].id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

# Store connection strings in Key Vault (per tenant)
resource "azurerm_key_vault_secret" "db_connection_dedicated" {
  for_each = var.dedicated_tier_enabled ? local.dedicated_tenants : {}

  name         = "db-connection-string-${each.key}"
  value        = "postgresql://${azurerm_postgresql_flexible_server.dedicated[each.key].administrator_login}:${azurerm_postgresql_flexible_server.dedicated[each.key].administrator_password}@${azurerm_postgresql_flexible_server.dedicated[each.key].fqdn}:5432/${azurerm_postgresql_flexible_server_database.dedicated[each.key].name}"
  key_vault_id = var.key_vault_id

  tags = merge(
    local.common_tags,
    {
      tenant_id = each.key
    }
  )
}
```

### 3.4 Row-Level Security (RLS)

```hcl
# infra/modules/database/rls.tf

# Enable RLS on shared database
resource "null_resource" "enable_rls_shared" {
  provisioner "local-exec" {
    command = <<-EOT
      psql \
        -h ${azurerm_postgresql_flexible_server.shared.fqdn} \
        -U ${azurerm_postgresql_flexible_server.shared.administrator_login} \
        -d ${azurerm_postgresql_flexible_server_database.shared.name} \
        <<'SQL'

      -- Enable RLS at database level
      ALTER DATABASE ${azurerm_postgresql_flexible_server_database.shared.name} SET row_security = on;

      -- Example: RLS policy for employees table
      CREATE POLICY employees_tenant_isolation ON public.employees
        FOR ALL
        USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

      -- Similar policies for all tenant-scoped tables
      CREATE POLICY qualifications_tenant_isolation ON public.qualifications
        FOR ALL
        USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

      CREATE POLICY documents_tenant_isolation ON public.documents
        FOR ALL
        USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

      CREATE POLICY audit_logs_tenant_isolation ON public.audit_logs
        FOR ALL
        USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

      -- Grant execute on all functions to reduce policy complexity
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO public;
SQL
    EOT
  }

  depends_on = [
    azurerm_postgresql_flexible_server_database.shared
  ]

  triggers = {
    database_id = azurerm_postgresql_flexible_server_database.shared.id
  }
}
```

### 3.5 Azure Storage Module

```hcl
# infra/modules/storage/main.tf

# Shared Storage Account
resource "azurerm_storage_account" "shared" {
  name                     = lower("${var.project_name}${var.environment}shared")
  location                 = var.location
  resource_group_name      = var.resource_group_name
  account_tier             = var.storage_tier_shared    # "Standard"
  account_replication_type = var.storage_replication_shared  # "GRS"

  https_traffic_only_enabled = true
  min_tls_version           = "TLS1_2"

  # Network isolation
  dynamic "network_rules" {
    for_each = var.private_endpoint_enabled ? [1] : []
    content {
      default_action = "Deny"
      bypass         = ["AzureServices"]
    }
  }

  tags = merge(
    local.common_tags,
    {
      tier      = "shared"
      component = "storage"
    }
  )
}

# Blob containers per shared tenant
resource "azurerm_storage_container" "shared_tenant_documents" {
  for_each = local.shared_tenants

  name                  = "tenant-${each.key}-documents"
  storage_account_name  = azurerm_storage_account.shared.name
  container_access_type = "private"
}

resource "azurerm_storage_container" "shared_tenant_proofs" {
  for_each = local.shared_tenants

  name                  = "tenant-${each.key}-proofs"
  storage_account_name  = azurerm_storage_account.shared.name
  container_access_type = "private"
}

resource "azurerm_storage_container" "shared_tenant_archives" {
  for_each = local.shared_tenants

  name                  = "tenant-${each.key}-archives"
  storage_account_name  = azurerm_storage_account.shared.name
  container_access_type = "private"
}

# Dedicated Storage Account (per tenant)
resource "azurerm_storage_account" "dedicated" {
  for_each = var.dedicated_tier_enabled ? local.dedicated_tenants : {}

  name                     = lower("${var.project_name}${each.key}${var.environment}")
  location                 = var.location
  resource_group_name      = var.resource_group_name
  account_tier             = var.storage_tier_dedicated    # "Premium"
  account_replication_type = var.storage_replication_dedicated  # "LRS"

  https_traffic_only_enabled = true
  min_tls_version           = "TLS1_2"

  # Network isolation
  network_rules {
    default_action = "Deny"
    bypass         = ["AzureServices"]
  }

  tags = merge(
    local.common_tags,
    {
      tier      = "dedicated"
      tenant_id = each.key
      component = "storage"
    }
  )
}

# Blob containers (dedicated)
resource "azurerm_storage_container" "dedicated_documents" {
  for_each = var.dedicated_tier_enabled ? local.dedicated_tenants : {}

  name                  = "documents"
  storage_account_name  = azurerm_storage_account.dedicated[each.key].name
  container_access_type = "private"
}

# Lifecycle policy: Hot → Cool → Archive
resource "azurerm_storage_management_policy" "lifecycle" {
  count = var.storage_lifecycle_enabled ? 1 : 0

  storage_account_id = azurerm_storage_account.shared.id

  rule {
    name    = "archive-old-documents"
    enabled = true

    filters {
      prefix_match = ["tenant-", "documents/"]
      blob_types   = ["blockBlob"]
    }

    actions {
      base_blob {
        tier_to_cool_after_days_since_modification_greater_than   = 30
        tier_to_archive_after_days_since_modification_greater_than = var.archive_days
        delete_after_days_since_modification_greater_than          = 2555  # 7 years
      }
    }
  }
}

# Store connection strings in Key Vault
resource "azurerm_key_vault_secret" "storage_connection_shared" {
  name         = "storage-connection-string-shared"
  value        = azurerm_storage_account.shared.primary_blob_connection_string
  key_vault_id = var.key_vault_id

  tags = local.common_tags
}

resource "azurerm_key_vault_secret" "storage_connection_dedicated" {
  for_each = var.dedicated_tier_enabled ? local.dedicated_tenants : {}

  name         = "storage-connection-string-${each.key}"
  value        = azurerm_storage_account.dedicated[each.key].primary_blob_connection_string
  key_vault_id = var.key_vault_id

  tags = merge(
    local.common_tags,
    {
      tenant_id = each.key
    }
  )
}
```

### 3.6 Redis Cache Module

```hcl
# infra/modules/cache/main.tf

# Shared Redis
resource "azurerm_redis_cache" "shared" {
  name                = "${var.project_name}-${var.environment}-redis"
  location            = var.location
  resource_group_name = var.resource_group_name

  capacity = var.redis_capacity_shared
  family   = var.redis_sku_shared == "Basic" ? "C" : "P"
  sku_name = var.redis_sku_shared

  minimum_tls_version = "1.2"
  enable_non_ssl_port = false

  # Network isolation (prod)
  dynamic "network_rule_set" {
    for_each = var.private_endpoint_enabled ? [1] : []
    content {
      default_action = "Deny"
      bypass_policies = ["AzureServices"]
    }
  }

  tags = merge(
    local.common_tags,
    {
      tier      = "shared"
      component = "cache"
    }
  )
}

# Dedicated Redis Cluster (per tenant)
resource "azurerm_redis_cache" "dedicated" {
  for_each = var.dedicated_tier_enabled ? local.dedicated_tenants : {}

  name                = "${var.project_name}-${each.key}-redis"
  location            = var.location
  resource_group_name = var.resource_group_name

  capacity = var.redis_capacity_dedicated
  family   = "P"  # Premium
  sku_name = var.redis_sku_dedicated

  minimum_tls_version = "1.2"
  enable_non_ssl_port = false

  # High Availability (prod)
  dynamic "zones" {
    for_each = var.redis_cluster_enabled ? ["1", "2", "3"] : []
    content {
      zones = [zones.value]
    }
  }

  # Persistence
  rdb_backup_enabled            = true
  rdb_backup_frequency          = "60"  # Every 60 minutes
  rdb_backup_max_snapshot_count = 1
  aof_backup_enabled            = true

  tags = merge(
    local.common_tags,
    {
      tier      = "dedicated"
      tenant_id = each.key
      component = "cache"
    }
  )
}

# Store connection strings in Key Vault
resource "azurerm_key_vault_secret" "redis_connection_shared" {
  name         = "redis-connection-string-shared"
  value        = azurerm_redis_cache.shared.primary_connection_string
  key_vault_id = var.key_vault_id

  tags = local.common_tags
}

resource "azurerm_key_vault_secret" "redis_connection_dedicated" {
  for_each = var.dedicated_tier_enabled ? local.dedicated_tenants : {}

  name         = "redis-connection-string-${each.key}"
  value        = azurerm_redis_cache.dedicated[each.key].primary_connection_string
  key_vault_id = var.key_vault_id

  tags = merge(
    local.common_tags,
    {
      tenant_id = each.key
    }
  )
}
```

---

## 4. Connection String Rotation

### 4.1 Automated Rotation (Azure Key Vault)

```hcl
# Rotate DB password every 90 days
resource "azurerm_key_vault_secret" "db_password_rotation" {
  name         = "db-admin-password"
  value        = random_password.db_admin.result
  key_vault_id = var.key_vault_id

  rotation_rules {
    automatically_rotate = true
    expire_after         = "P90D"
    notify_before_expire = 14  # Alert 14 days before
  }

  depends_on = [
    azurerm_postgresql_flexible_server.shared
  ]
}

resource "random_password" "db_admin" {
  length  = 32
  special = true
}
```

### 4.2 Manual Rotation Script

```bash
#!/bin/bash
# scripts/rotate-secrets.sh

# Rotate PostgreSQL password
az postgres flexible-server parameter set \
  --resource-group ${RESOURCE_GROUP} \
  --server-name ${SERVER_NAME} \
  --name password \
  --value $(openssl rand -base64 32)

# Update Key Vault
az keyvault secret set \
  --vault-name ${VAULT_NAME} \
  --name "db-admin-password" \
  --value $(az postgres flexible-server show-connection-string ...)

# Notify services (via webhook or pub/sub)
```

---

## 5. Migration: Single-Postgres → Multi-Store

### 5.1 Phase 1: Dual Write (Weeks 1–2)

```typescript
// apps/api/src/data/migration-layer.ts

export class MigrationLayer {
  async saveEmployee(employee: Employee): Promise<void> {
    // Write to shared PostgreSQL (existing)
    await prisma.employee.create({ data: employee });

    // Write to Cosmos DB (new, fire-and-forget)
    try {
      await cosmosDB.container("employees").items.create(employee);
    } catch (err) {
      logger.warn("Cosmos write failed, but continuing", err);
    }
  }

  async getEmployee(id: string): Promise<Employee> {
    // Read from PostgreSQL (source of truth)
    const pg = await prisma.employee.findUnique({ where: { id } });
    
    // Return after logging read to Cosmos for comparison
    return pg;
  }
}
```

### 5.2 Phase 2: Dual Read (Weeks 3–4)

```typescript
export class MigrationLayer {
  async getEmployee(id: string): Promise<Employee> {
    // Read from PostgreSQL
    const pg = await prisma.employee.findUnique({ where: { id } });

    // Read from Cosmos in parallel (background)
    const cosmos = await cosmosDB.container("employees").item(id).read();

    // Verify consistency
    if (JSON.stringify(pg) !== JSON.stringify(cosmos)) {
      logger.warn("Data mismatch detected", { pg, cosmos });
      await auditLog.record("DATA_INCONSISTENCY", { id });
    }

    return pg; // Still returning PostgreSQL source of truth
  }
}
```

### 5.3 Phase 3: Switchover (Week 5)

```bash
# 1. Pause writes (maintenance window, 5 minutes)
# 2. Verify Cosmos is caught up
# 3. Switch primary read to Cosmos
# 4. Keep PostgreSQL as read replica for 2 weeks
# 5. After validation, retire PostgreSQL
```

---

## 6. Cost Estimates

### 6.1 Shared Tier (Monthly)

| Component | SKU | Cost |
|-----------|-----|------|
| PostgreSQL | B_Standard_B2s (shared) | $150–200 |
| Storage | 256 GB, GRS | $50–75 |
| Redis | Basic, 1 GB | $20–30 |
| ADX | Standard_D11_v2, 2 nodes | $600–800 |
| **Total** | Shared | **~$850–1,100/mo** |

*Per SMB tenant: ~$85–110/mo*

### 6.2 Dedicated Tier (Monthly)

| Component | SKU | Cost |
|-----------|-----|------|
| PostgreSQL | GP_D4s_v3 (dedicated) | $800–1,200 |
| Storage | 512 GB, LRS | $100–150 |
| Redis | Premium, 6 GB | $300–500 |
| ADX | Standard_L8s, 4 nodes | $2,000–2,500 |
| **Total** | Dedicated | **~$3,200–4,500/mo** |

---

## 7. Implementation Checklist

### Phase 1: Shared Tier (Week 1–2)
- [ ] Provision PostgreSQL (shared)
- [ ] Enable RLS on all tenant-scoped tables
- [ ] Provision Azure Storage (shared)
- [ ] Configure lifecycle policies (Hot → Cool → Archive)
- [ ] Provision Redis (shared)
- [ ] Store all connection strings in Key Vault

### Phase 2: Dedicated Tier (Week 3–4)
- [ ] Create database module (factory for per-tenant provisioning)
- [ ] Provision first enterprise PostgreSQL
- [ ] Provision first enterprise Storage account
- [ ] Provision first enterprise Redis
- [ ] Test tenant isolation (RLS on shared, no RLS on dedicated)

### Phase 3: Data Migration (Week 5–6)
- [ ] Implement dual-write layer
- [ ] Migrate test data to dedicated tier
- [ ] Run consistency checks
- [ ] Implement dual-read layer
- [ ] Prepare switchover script

### Phase 4: Backup/Restore (Week 7)
- [ ] Implement daily snapshots (shared tier)
- [ ] Implement per-tenant granular backups (dedicated tier)
- [ ] Test restore procedures
- [ ] Document RTO/RPO by tier

---

## 8. Related Documentation

- **Decision #1:** Tiered Isolation (`.squad/decisions.md`)
- **Service Architecture:** `docs/specs/service-architecture-spec.md`
- **Compliance Audit:** `docs/specs/proof-compliance-audit.md` (ADX usage)
- **Runbook:** `docs/guides/data-layer-operations-runbook.md` (TBD)

---

**Status:** Ready for Terraform implementation  
**Estimated Effort:** 7–8 weeks (all phases)  
**Owner:** Daniels (Microservices Engineer), Data Platform team
