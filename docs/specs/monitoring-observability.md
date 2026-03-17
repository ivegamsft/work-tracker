# Monitoring & Observability IaC Spec — E-CLAT

> **Status:** Infrastructure Specification  
> **Owner:** Daniels (Microservices Engineer)  
> **Date:** 2026-03-19  
> **Issue:** #89  
> **Related Decision:** Decision #10 (OTel + ADX + App Insights Stack)  
> **Applies To:** `infra/layers/10-data`, `infra/modules/observability`, `.github/workflows`

---

## 1. Overview

This spec defines the complete observability stack for E-CLAT: OpenTelemetry (OTel) instrumentation, Azure Data Explorer (ADX) for compliance analytics, Azure Application Insights for APM, and Log Analytics workspaces. The architecture supports cloud (Azure) and on-prem deployments via pluggable exporters.

### Key Principles
- **Vendor-neutral:** OTel SDK + Collector allow swapping backends (App Insights ↔ Jaeger, ADX ↔ ClickHouse)
- **Compliance-first:** ADX cluster stores 7-year audit/telemetry retention for regulated industries
- **Real-time alerting:** App Insights triggers fast alerts on error rate, latency, and availability
- **Cost-aware:** Shared observability pools for SMB tenants; dedicated ADX/Insights per enterprise tenant

---

## 2. Azure Resource Topology

### 2.1 Cloud (Primary)

```
┌─ Log Analytics Workspace (shared per environment)
│  ├─ Destination for API logs, Web logs, system events
│  └─ Retention: 30 days (hot), 7 years (archive)
│
├─ Application Insights (shared or per-tenant)
│  ├─ APM, live metrics, request tracing
│  ├─ Alerting rules (error rate, latency P95, availability)
│  └─ Linked to Log Analytics
│
├─ Azure Data Explorer Cluster
│  ├─ Tables: events, traces, audit_logs, compliance_telemetry
│  ├─ Retention per table (7 years for compliance)
│  ├─ Auto-scaling for bursty workloads
│  └─ Private Link endpoint for secure access
│
├─ OpenTelemetry Collector (Container App or ACI)
│  ├─ Sidecar or standalone topology
│  ├─ OTLP protocol receiver (port 4317 gRPC, 4318 HTTP)
│  ├─ Exporters: OTel→ADX, OTel→App Insights, OTel→Log Analytics
│  └─ Batching, sampling, retry policies
│
└─ Key Vault
   └─ Secrets: ADX connection strings, App Insights keys, OTel endpoint credentials
```

### 2.2 On-Prem Alternative

```
┌─ Jaeger All-in-One or Agent+Collector
│  └─ Trace backend (no longer App Insights)
│
├─ Prometheus + Grafana
│  ├─ Metrics collection and visualization
│  └─ Alert rules on Prometheus
│
├─ ClickHouse or Loki
│  ├─ Log aggregation (replaces ADX)
│  └─ Compliance data retention managed by org
│
└─ Self-managed OTel Collector
   ├─ Deployed on-prem or in self-hosted K8s
   └─ Exporters: OTel→Jaeger, OTel→Prometheus, OTel→ClickHouse
```

---

## 3. Terraform Module Structure

### 3.1 Layer 10-Data: `observability` module

**Path:** `infra/modules/observability/`

```
observability/
├── main.tf                    # Resource definitions
├── outputs.tf                 # Resource IDs, endpoints, connection strings
├── variables.tf               # Tunable parameters
├── log-analytics.tf           # Log Analytics workspace
├── app-insights.tf            # Application Insights
├── adx.tf                      # Azure Data Explorer cluster + tables
├── otel-collector.tf          # Container App for OTel Collector
└── variables/
    ├── alerts.tfvars          # Alerting rules (thresholds)
    ├── adx-retention.tfvars   # Table retention policies
    └── collector-config.tfvars # OTel Collector config snippets
```

### 3.2 Main.tf: Layer 10-Data Instantiation

```hcl
# infra/layers/10-data/main.tf

module "observability" {
  source = "../../modules/observability"

  environment            = var.environment
  location               = data.terraform_remote_state.foundation.outputs.location
  resource_group_name    = data.terraform_remote_state.foundation.outputs.resource_group_name
  key_vault_id           = data.terraform_remote_state.foundation.outputs.key_vault_id
  project_name           = var.project_name

  # Log Analytics
  log_analytics_retention_days = var.log_analytics_retention_days # 30 for hot, archive to 7y
  log_analytics_sku            = var.log_analytics_sku             # "PerGB2018"

  # App Insights
  app_insights_enabled   = var.app_insights_enabled               # true
  app_insights_sampling  = var.app_insights_sampling              # 0.1 (10% sampling in prod)

  # ADX Cluster
  adx_enabled            = var.adx_enabled                        # true
  adx_sku                = var.adx_tier                           # "Standard_D11_v2" for SMB, "Standard_L8s" for enterprise
  adx_capacity           = var.adx_capacity                       # 2-10 nodes
  adx_enable_auto_scale  = var.adx_enable_auto_scale              # true

  # OTel Collector
  collector_cpu          = var.collector_cpu                      # "0.5" to "2"
  collector_memory       = var.collector_memory                   # "1Gi" to "4Gi"
  collector_sampling_rate = var.collector_sampling_rate           # 0.1 (10% of traces sampled)

  # Alerting
  alert_error_rate_threshold   = var.alert_error_rate_threshold   # 0.05 (5%)
  alert_latency_p95_ms         = var.alert_latency_p95_ms         # 1000 (1 second)
  alert_availability_threshold = var.alert_availability_threshold # 0.99 (99%)
}
```

### 3.3 Resource Definitions

#### Log Analytics Workspace

```hcl
# infra/modules/observability/log-analytics.tf

resource "azurerm_log_analytics_workspace" "main" {
  name                = "${var.project_name}-${var.environment}-law"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = var.log_analytics_sku
  retention_in_days   = var.log_analytics_retention_days

  daily_quota_gb = var.environment == "prod" ? -1 : 5 # Unlimited for prod, 5GB/day for dev

  tags = merge(
    local.common_tags,
    {
      component = "observability"
      tier      = "shared"
    }
  )
}

# Data sources: DCR (Data Collection Rule) for Windows, Linux VM monitoring
resource "azurerm_monitor_data_collection_rule" "api" {
  name                        = "${var.project_name}-${var.environment}-dcr-api"
  resource_group_name         = var.resource_group_name
  location                    = var.location
  data_collection_endpoint_id = azurerm_monitor_data_collection_endpoint.main.id

  destinations {
    log_analytics {
      workspace_resource_id = azurerm_log_analytics_workspace.main.id
      name                  = "law-destination"
    }
  }

  data_flow {
    streams      = ["Microsoft-Syslog", "Microsoft-Perf", "Microsoft-Event"]
    destinations = ["law-destination"]
  }

  tags = local.common_tags
}
```

#### Application Insights

```hcl
# infra/modules/observability/app-insights.tf

resource "azurerm_application_insights" "main" {
  name                = "${var.project_name}-${var.environment}-appinsights"
  location            = var.location
  resource_group_name = var.resource_group_name
  workspace_id        = azurerm_log_analytics_workspace.main.id
  application_type    = "web"

  # Sampling: reduce data ingestion cost in high-traffic environments
  sampling_percentage = var.app_insights_sampling * 100

  tags = merge(
    local.common_tags,
    {
      component = "observability"
      tier      = var.app_insights_tier # "shared" or "dedicated"
    }
  )
}

# Store App Insights key in Key Vault for API/web runtime configuration
resource "azurerm_key_vault_secret" "app_insights_key" {
  name         = "app-insights-instrumentation-key"
  value        = azurerm_application_insights.main.instrumentation_key
  key_vault_id = var.key_vault_id

  tags = local.common_tags
}

# Alert Rules
resource "azurerm_monitor_metric_alert" "error_rate" {
  name                = "${var.project_name}-${var.environment}-alert-error-rate"
  resource_group_name = var.resource_group_name
  scopes              = [azurerm_application_insights.main.id]
  description         = "Alert when error rate exceeds threshold"
  severity            = 2

  criteria {
    metric_namespace = "Microsoft.Insights/components"
    metric_name      = "failedRequests"
    aggregation      = "Total"
    operator         = "GreaterThan"
    threshold        = var.alert_error_rate_threshold * 100 # Convert to percentage

    # Evaluate every 5 minutes over a 5-minute window
    evaluation_frequency = "PT5M"
    window_duration      = "PT5M"
  }

  action {
    action_group_id = azurerm_monitor_action_group.main.id
  }

  tags = local.common_tags
}

resource "azurerm_monitor_metric_alert" "latency_p95" {
  name                = "${var.project_name}-${var.environment}-alert-latency-p95"
  resource_group_name = var.resource_group_name
  scopes              = [azurerm_application_insights.main.id]
  description         = "Alert when P95 latency exceeds threshold"
  severity            = 2

  criteria {
    metric_namespace = "Microsoft.Insights/components"
    metric_name      = "requestDuration"
    aggregation      = "Percentile95"
    operator         = "GreaterThan"
    threshold        = var.alert_latency_p95_ms

    evaluation_frequency = "PT5M"
    window_duration      = "PT10M"
  }

  action {
    action_group_id = azurerm_monitor_action_group.main.id
  }

  tags = local.common_tags
}

resource "azurerm_monitor_metric_alert" "availability" {
  name                = "${var.project_name}-${var.environment}-alert-availability"
  resource_group_name = var.resource_group_name
  scopes              = [azurerm_application_insights.main.id]
  description         = "Alert when availability drops below threshold"
  severity            = 1

  criteria {
    metric_namespace = "Microsoft.Insights/components"
    metric_name      = "availabilityResults/availabilityPercentage"
    aggregation      = "Average"
    operator         = "LessThan"
    threshold        = var.alert_availability_threshold * 100

    evaluation_frequency = "PT5M"
    window_duration      = "PT5M"
  }

  action {
    action_group_id = azurerm_monitor_action_group.main.id
  }

  tags = local.common_tags
}

# Action Group (email, webhook, etc.)
resource "azurerm_monitor_action_group" "main" {
  name                = "${var.project_name}-${var.environment}-action-group"
  resource_group_name = var.resource_group_name
  short_name          = "E-CLAT"

  email_receiver {
    name           = "oncall"
    email_address  = var.alert_email
    use_common_alert_schema = true
  }

  tags = local.common_tags
}
```

#### Azure Data Explorer Cluster

```hcl
# infra/modules/observability/adx.tf

resource "azurerm_kusto_cluster" "main" {
  name                = lower("${var.project_name}${var.environment}adx")
  location            = var.location
  resource_group_name = var.resource_group_name

  sku {
    name     = var.adx_sku             # "Standard_D11_v2" or "Standard_L8s"
    capacity = var.adx_capacity        # 2-10
  }

  enable_streaming_ingest = true       # For real-time log ingestion
  enable_auto_scale       = var.adx_enable_auto_scale
  auto_scale_min_capacity = 2
  auto_scale_max_capacity = 10

  # Enable managed identity for secure access to ADLS/Key Vault
  identity {
    type = "SystemAssigned"
  }

  tags = merge(
    local.common_tags,
    {
      component = "observability"
      tier      = var.adx_tier # "shared" or "dedicated"
    }
  )
}

resource "azurerm_kusto_database" "main" {
  name                = "${var.project_name}_${var.environment}_db"
  resource_group_name = var.resource_group_name
  cluster_name        = azurerm_kusto_cluster.main.name
  location            = var.location

  hot_cache_period   = "P30D"  # 30-day hot cache
  soft_delete_period = "P7Y"   # 7-year retention (compliance)
}

# Tables: events, traces, audit_logs, compliance_telemetry
resource "azurerm_kusto_database_principal_assignment" "main" {
  name                = "${var.project_name}-${var.environment}-principal"
  resource_group_name = var.resource_group_name
  cluster_name        = azurerm_kusto_cluster.main.name
  database_name       = azurerm_kusto_database.main.name

  principal_id   = data.azurerm_client_config.current.object_id
  principal_type = "User"
  role           = "Admin"
}

# Store ADX connection string in Key Vault
resource "azurerm_key_vault_secret" "adx_connection_string" {
  name         = "adx-connection-string"
  value        = "https://${azurerm_kusto_cluster.main.name}.${var.location}.kusto.windows.net"
  key_vault_id = var.key_vault_id

  tags = local.common_tags
}

# Private Link endpoint for secure ADX access
resource "azurerm_private_endpoint" "adx" {
  count = var.environment == "prod" ? 1 : 0

  name                = "${var.project_name}-${var.environment}-adx-pe"
  location            = var.location
  resource_group_name = var.resource_group_name
  subnet_id           = var.private_subnet_id # From foundation

  private_service_connection {
    name                 = "${var.project_name}-${var.environment}-adx-psc"
    is_manual_connection = false
    private_connection_resource_id = azurerm_kusto_cluster.main.id
    subresource_names    = ["Cluster"]
  }

  tags = local.common_tags
}
```

#### OTel Collector Container App

```hcl
# infra/modules/observability/otel-collector.tf

locals {
  otel_config = templatefile("${path.module}/otel-config.yaml.tpl", {
    app_insights_key = azurerm_application_insights.main.instrumentation_key
    adx_cluster_uri  = "https://${azurerm_kusto_cluster.main.name}.${var.location}.kusto.windows.net"
    log_analytics_id = azurerm_log_analytics_workspace.main.workspace_id
    sampling_rate    = var.collector_sampling_rate
  })
}

resource "azurerm_container_app" "otel_collector" {
  name                         = "${var.project_name}-${var.environment}-otel-collector"
  container_app_environment_id = var.container_app_environment_id # From compute layer
  resource_group_name          = var.resource_group_name
  revision_mode                = "Single"

  template {
    container {
      name   = "otel-collector"
      image  = "otel/opentelemetry-collector:latest"
      cpu    = var.collector_cpu
      memory = var.collector_memory

      # Pass OTel config via environment variable
      env {
        name  = "OTEL_CONFIG"
        value = base64encode(local.otel_config)
      }

      # Expose OTLP receiver on standard ports
      ports {
        container_port = 4317
        protocol       = "tcp"
      }
      ports {
        container_port = 4318
        protocol       = "tcp"
      }

      liveness_probe {
        http_get {
          path = "/healthz"
          port = 13133
        }
        initial_delay = 10
        interval_seconds = 30
      }
    }

    scale {
      min_replicas = var.environment == "prod" ? 2 : 1
      max_replicas = 5

      # Scale on CPU usage
      dynamic "rules" {
        for_each = var.environment == "prod" ? [1] : []
        content {
          custom_rule_type = "http"
          metadata = {
            concurrency_target_value = "100"
          }
        }
      }
    }
  }

  ingress {
    allow_insecure_connections = false
    external_enabled           = false
    target_port                = 4317

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  tags = merge(
    local.common_tags,
    {
      component = "observability"
      tier      = "shared"
    }
  )
}

# Internal ingress (Internal Load Balancer) for sidecar pattern
resource "azurerm_container_app_ingress" "otel_internal" {
  container_app_id = azurerm_container_app.otel_collector.id
  allow_insecure_connections = false
  external_enabled           = false
  target_port                = 4317
  transport                  = "tcp"
  exposed_port               = 4317

  traffic_weight {
    percentage      = 100
    latest_revision = true
  }
}
```

#### OTel Collector Configuration Template

```yaml
# infra/modules/observability/otel-config.yaml.tpl
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    send_batch_size: 100
    timeout: 10s

  # Sampling: reduce data volume in high-traffic environments
  probabilistic_sampler:
    sampling_percentage: ${sampling_rate * 100}

  resource_detection:
    detectors: [env, system, azure]

  # Add environment/tenant context to all spans
  resource:
    attributes:
      add:
        environment: "${environment}"
        service.name: "e-clat-api"

exporters:
  azuremonitoring:
    instrumentation_key: "${app_insights_key}"

  # ADX exporter (via OTel ADX connector)
  otlp:
    endpoint: "${adx_cluster_uri}:443"
    headers:
      Authorization: "Bearer token-from-msi"

  # Log Analytics exporter
  azuremonitorlogs:
    workspace_id: "${log_analytics_id}"

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch, probabilistic_sampler, resource_detection, resource]
      exporters: [azuremonitoring, otlp]

    metrics:
      receivers: [otlp]
      processors: [batch, resource_detection, resource]
      exporters: [azuremonitoring]

    logs:
      receivers: [otlp]
      processors: [batch, resource_detection, resource]
      exporters: [azuremonitorlogs]
```

---

## 4. Cost Estimates (Azure Pricing, 2026)

### 4.1 SMB/Mid-Market Tier (Shared Observability)

| Component | SKU | Monthly |
|-----------|-----|---------|
| Log Analytics Workspace | PerGB2018, 5GB/day | $25–50 |
| App Insights | 5GB ingestion/month | $30–60 |
| ADX Cluster | Standard_D11_v2, 2 nodes | $600–800 |
| OTel Collector | Container App, 0.5 CPU, 1GB RAM | $15–25 |
| **Total** | Shared pool | **~$700/mo** |

*Shared across up to 10 mid-market tenants: ~$70/tenant/mo*

### 4.2 Enterprise Tier (Dedicated Observability)

| Component | SKU | Monthly |
|-----------|-----|---------|
| Log Analytics Workspace | PerGB2018, unlimited | $200–500 |
| App Insights | 50GB ingestion/month | $150–300 |
| ADX Cluster | Standard_L8s, 4 nodes | $2,000–2,500 |
| OTel Collector | Container App, 2 CPU, 4GB RAM (2 replicas) | $50–100 |
| **Total** | Dedicated | **~$2,500–3,500/mo** |

### 4.3 On-Prem Estimates

| Component | Annual |
|-----------|--------|
| Jaeger All-in-One (Docker) | $0 (open-source) |
| Prometheus + Grafana | $0 (open-source) |
| ClickHouse cluster (3 nodes, self-hosted) | Infra cost only |
| OTel Collector (Docker) | $0 (open-source) |
| **Total** | **Infrastructure only** |

---

## 5. Security Configuration

### 5.1 Network Isolation

```hcl
# API/Web → OTel Collector: private endpoint or service endpoint
resource "azurerm_private_endpoint" "collector_from_api" {
  # Container App (API) has managed identity
  # OTel Collector responds on internal FQDNs only
  # No public endpoint exposed
}

# OTel → ADX: private link (prod)
resource "azurerm_private_endpoint" "adx_from_collector" {
  # Prod: Private Link endpoint to ADX cluster
  # Dev: Service endpoint acceptable
}
```

### 5.2 Identity & Access Control

```hcl
# API Container App (producer)
resource "azurerm_role_assignment" "api_otel_send" {
  scope       = azurerm_container_app.otel_collector.id
  role_definition_name = "Application Insights Component Contributor"
  principal_id = azurerm_container_app.api.identity[0].principal_id
}

# OTel Collector → ADX (producer)
resource "azurerm_role_assignment" "collector_adx_ingest" {
  scope       = azurerm_kusto_cluster.main.id
  role_definition_name = "Kusto Cluster Ingestor"
  principal_id = azurerm_container_app.otel_collector.identity[0].principal_id
}

# Log Analytics access
resource "azurerm_role_assignment" "collector_law" {
  scope       = azurerm_log_analytics_workspace.main.id
  role_definition_name = "Log Analytics Contributor"
  principal_id = azurerm_container_app.otel_collector.identity[0].principal_id
}
```

### 5.3 Secret Management

- **App Insights key:** Stored in Key Vault, mounted as Container App secret
- **ADX connection string:** Stored in Key Vault, rotated annually
- **OTLP endpoint credentials:** Managed identity (no explicit secrets)

### 5.4 Audit & Compliance

```hcl
# Enable diagnostic settings on all resources
resource "azurerm_monitor_diagnostic_setting" "adx_audit" {
  name               = "${var.project_name}-adx-diag"
  target_resource_id = azurerm_kusto_cluster.main.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  enabled_log {
    category = "SucceededIngestion"
  }

  enabled_log {
    category = "FailedIngestion"
  }

  metric {
    category = "AllMetrics"
  }
}
```

---

## 6. Networking

### 6.1 Traffic Flow (Cloud)

```
┌─ API Container App
│  └─ OTLP export (gRPC 4317 or HTTP 4318)
│     └─ OTel Collector (internal FQDN)
│        ├─ → App Insights (public Azure endpoint)
│        ├─ → ADX Cluster (private link in prod)
│        └─ → Log Analytics (HTTPS endpoint)
│
└─ Web (browser)
   └─ No direct telemetry; SDK imports OTel API
      └─ Browser-to-API (App Insights SDK embedded)
```

### 6.2 DNS & Service Discovery

**Cloud:**
- OTel Collector: internal DNS `otel-collector.{environment}.internal`
- ADX: private endpoint DNS (prod) or public FQDN (dev)
- App Insights: public Microsoft endpoint

**On-Prem:**
- OTel Collector: `localhost` or internal service mesh DNS

---

## 7. Deployment Automation

### 7.1 Terraform Apply Order

```bash
# Layer 10-Data (applies observability)
cd infra/layers/10-data
terraform plan -var-file=observability.tfvars
terraform apply

# Output variables (consumed by Layer 20-Compute)
# - otel_collector_internal_fqdn
# - app_insights_instrumentation_key
# - log_analytics_workspace_id
# - adx_cluster_uri
```

### 7.2 GitHub Actions Integration

```yaml
# .github/workflows/deploy-observability.yml
name: Deploy Observability

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment (dev, staging, prod)'
        required: true
        default: 'dev'
      action:
        description: 'Action (plan, apply)'
        required: true
        default: 'plan'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v2
        with:
          terraform_version: 1.5.0

      - name: Login to Azure
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Terraform Plan/Apply
        run: |
          cd infra/layers/10-data
          terraform init
          terraform ${{ github.event.inputs.action }} \
            -var-file="${{ github.event.inputs.environment }}.tfvars" \
            -var="adx_cluster_uri=${{ secrets.ADX_CLUSTER_URI }}"
```

### 7.3 OTel Collector Rollout

```yaml
# Canary deployment: 10% → 50% → 100%
apiVersion: apps/v1
kind: Deployment
metadata:
  name: otel-collector
  annotations:
    deployment.kubernetes.io/revision: "2"
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    spec:
      containers:
        - name: otel-collector
          image: otel/opentelemetry-collector:v0.90.0
          # ...canary annotations
          labels:
            version: v0.90.0
            canary: "true"
```

---

## 8. Scaling & Auto-Scaling

### 8.1 OTel Collector Scaling

```hcl
resource "azurerm_container_app" "otel_collector" {
  template {
    scale {
      min_replicas = var.environment == "prod" ? 2 : 1
      max_replicas = var.environment == "prod" ? 10 : 3

      rules {
        custom_rule_type = "http"
        metadata = {
          concurrency_target_value = "100"  # Scale on request concurrency
        }
      }

      rules {
        custom_rule_type = "cpu"
        metadata = {
          type  = "Utilization"
          value = "70"  # Scale at 70% CPU
        }
      }
    }
  }
}
```

### 8.2 ADX Cluster Scaling

```hcl
resource "azurerm_kusto_cluster" "main" {
  enable_auto_scale       = true
  auto_scale_min_capacity = 2
  auto_scale_max_capacity = 10  # Enterprise; adjust per SLA

  # ADX scales based on ingestion rate and query load
  # Managed by Azure automatically
}
```

---

## 9. On-Prem Alternative: Jaeger + Prometheus + ClickHouse

### 9.1 Docker Compose Stack

```yaml
# docker-compose-observability.yml
version: '3.8'

services:
  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "6831:6831/udp"  # Jaeger agent (UDP)
      - "4317:4317"      # OTLP receiver
      - "16686:16686"    # UI (http://localhost:16686)
    environment:
      COLLECTOR_OTLP_ENABLED: "true"
    volumes:
      - jaeger_data:/badger

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
    volumes:
      - grafana_data:/var/lib/grafana

  clickhouse:
    image: clickhouse/clickhouse-server:latest
    ports:
      - "9000:9000"
      - "8123:8123"
    environment:
      CLICKHOUSE_DB: logs
    volumes:
      - clickhouse_data:/var/lib/clickhouse

  otel-collector:
    image: otel/opentelemetry-collector:latest
    ports:
      - "4317:4317"   # OTLP gRPC
      - "4318:4318"   # OTLP HTTP
    volumes:
      - ./otel-collector-config.yaml:/etc/otel-collector-config.yaml
    command:
      - "--config=/etc/otel-collector-config.yaml"

volumes:
  jaeger_data:
  prometheus_data:
  grafana_data:
  clickhouse_data:
```

### 9.2 Terraform (On-Prem K8s)

```hcl
# infra/modules/observability-onprem/main.tf
# Helm charts for Jaeger, Prometheus, Grafana, ClickHouse
# Assumes Kubernetes cluster with Helm provider

resource "helm_release" "jaeger" {
  name             = "jaeger"
  repository       = "https://jaegertracing.github.io/helm-charts"
  chart            = "jaeger"
  namespace        = "observability"
  create_namespace = true

  values = [
    yamlencode({
      collector = {
        extraPorts = {
          otlp = {
            containerPort = 4317
          }
        }
      }
      storage = {
        type = "badger"
        badger = {
          massif = {
            enabled = true
          }
        }
      }
    })
  ]
}

resource "helm_release" "prometheus" {
  name       = "prometheus"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "kube-prometheus-stack"
  namespace  = "observability"

  values = [
    file("${path.module}/prometheus-values.yaml")
  ]
}

resource "helm_release" "grafana" {
  name       = "grafana"
  repository = "https://grafana.github.io/helm-charts"
  chart      = "grafana"
  namespace  = "observability"

  values = [
    file("${path.module}/grafana-values.yaml")
  ]
}
```

---

## 10. Implementation Checklist

### Phase 1: Foundation (Week 1-2)
- [ ] Create `infra/modules/observability/`
- [ ] Provision Log Analytics Workspace
- [ ] Provision Application Insights
- [ ] Integrate App Insights instrumentation in `apps/api` via env var

### Phase 2: ADX & OTel Collector (Week 3-4)
- [ ] Provision ADX cluster
- [ ] Create ADX database + tables (events, traces, audit_logs)
- [ ] Deploy OTel Collector as Container App
- [ ] Configure OTel SDK in API (`apps/api/src/config/otel.ts`)

### Phase 3: Alerting & Dashboards (Week 5-6)
- [ ] Create alert rules (error rate, latency, availability)
- [ ] Create Azure Dashboard or Grafana dashboard
- [ ] Wire action groups (email, webhook)

### Phase 4: On-Prem Prep (Week 7+)
- [ ] Create Docker Compose for local dev observability stack
- [ ] Document Jaeger + Prometheus + ClickHouse deployment
- [ ] Create Helm charts for K8s on-prem

---

## 11. Maintenance & Operations

### 11.1 ADX Table Retention

```kusto
// Set per-table retention policies
.alter table events policy retention softdelete = 30d recoverability = enabled;
.alter table audit_logs policy retention softdelete = 2555d recoverability = enabled;  // 7 years
.alter table compliance_telemetry policy retention softdelete = 2555d recoverability = enabled;
```

### 11.2 Alerting Tuning

- **First week:** Monitor baseline (error rate, latency) and adjust thresholds
- **Weekly review:** Check false positives and adjust window durations
- **Monthly:** Review alert costs and sampling rates

### 11.3 Cost Controls

- **Sampling:** Enable probabilistic sampling at 10% for traces in production
- **Log retention:** 30-day hot, 7-year archive for compliance; delete transient logs
- **ADX auto-scale:** Set min/max capacity to avoid unexpected costs

---

## 12. Related Documentation

- **Decision #10:** OTel + ADX + App Insights Stack (`.squad/decisions.md`)
- **Compliance Audit Spec:** `docs/specs/proof-compliance-audit.md` (uses ADX for audit trails)
- **OTel SDK Integration:** `docs/plans/otel-instrumentation-plan.md`
- **Operator Runbook:** `docs/guides/observability-runbook.md` (TBD)

---

**Status:** Ready for Terraform implementation  
**Estimated Effort:** 6-8 weeks (foundation to on-prem parity)  
**Owner:** Daniels (Microservices Engineer), DevOps team
