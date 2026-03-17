# Event-Driven Architecture IaC Spec — E-CLAT

> **Status:** Infrastructure Specification  
> **Owner:** Daniels (Microservices Engineer)  
> **Date:** 2026-03-19  
> **Issue:** #109  
> **Related Decision:** Decision #9 (Event-Driven: Service Bus/Event Grid + WebSocket)  
> **Applies To:** `infra/layers/10-data`, `infra/modules/messaging`, `apps/api/src/modules`

---

## 1. Overview

This spec defines the asynchronous messaging and real-time communication infrastructure for E-CLAT. **Cloud deployments** use Azure Service Bus (commands/queues) + Event Grid (events/topics) + Azure SignalR/Web PubSub for WebSocket. **On-prem deployments** swap to RabbitMQ/NATS + self-hosted WebSocket. The architecture is abstraction-layer–first to enable seamless migration between cloud and on-prem.

### Key Principles
- **Event-driven:** Service Bus for guaranteed delivery (commands); Event Grid for fan-out (events)
- **WebSocket-first:** Real-time nudges, live notifications, and reactive updates via WebSocket
- **Cloud/on-prem parity:** Single abstraction layer that swaps backends
- **Dead-letter + retry:** Configurable retry policies and DLQ monitoring
- **Eventual consistency:** Saga patterns for cross-service transactions

---

## 2. Azure Resource Topology

### 2.1 Cloud: Azure Service Bus + Event Grid + SignalR

```
┌─ Command Bus (Service Bus)
│  │
│  ├─ Namespace: e-clat-{environment}-bus
│  │  │
│  │  ├─ Queues (point-to-point, ordered)
│  │  │  ├─ employee-commands: CREATE_EMPLOYEE, UPDATE_PROFILE
│  │  │  ├─ qualification-commands: AWARD_QUALIFICATION, EXPIRE_QUALIFICATION
│  │  │  ├─ medical-commands: ISSUE_CLEARANCE, REVOKE_CLEARANCE
│  │  │  ├─ document-commands: PROCESS_UPLOAD, EXTRACT_TEXT
│  │  │  ├─ hour-commands: RECONCILE_HOURS, REPORT_DISCREPANCY
│  │  │  └─ notification-commands: SEND_NUDGE, DISPATCH_DIGEST
│  │  │
│  │  └─ Dead-Letter Queues (DLQ)
│  │     └─ e-clat-{queue}-dlq (auto-created)
│  │
│  └─ Connection String → stored in Key Vault
│
├─ Event Bus (Event Grid)
│  │
│  ├─ System Topic per Service Bus namespace
│  │  ├─ Events: ServiceBusQueueMessageReceived, DLQMessageReceived
│  │  └─ Subscriptions (per domain event type)
│  │     ├─ employee-created → compliance service (auto-add to standards)
│  │     ├─ qualification-awarded → notification service (send email)
│  │     ├─ document-processed → qualification service (update proof status)
│  │     └─ [event-type] → [consumer service]
│  │
│  └─ Custom topics (cross-service events)
│     ├─ Topic: compliance-alerts
│     │  └─ Subscription: notification service (forward to user)
│     └─ Topic: audit-trail
│        └─ Subscription: audit service (log + ADX export)
│
├─ Real-Time Signaling (Azure SignalR Service or Web PubSub)
│  │
│  ├─ SignalR Hub: NotificationHub
│  │  ├─ Users authenticated via JWT
│  │  ├─ Groups: tenant-{id}, user-{id}, role-{admin|manager}
│  │  ├─ Messages: nudge, notification-update, document-ready, clearance-status
│  │  └─ Capacity: Auto-scale units
│  │
│  └─ Connection String → stored in Key Vault
│
└─ Key Vault
   ├─ Secret: service-bus-connection-string
   ├─ Secret: event-grid-endpoint
   ├─ Secret: event-grid-key
   └─ Secret: signalr-connection-string
```

### 2.2 On-Prem: RabbitMQ + NATS + Raw WebSocket

```
┌─ Command Bus (RabbitMQ)
│  │
│  ├─ Cluster: rabbitmq-{environment} (Docker Compose or K8s)
│  │  ├─ Virtual Host: /e-clat
│  │  ├─ Exchanges: employee-commands, qualification-commands, etc. (fanout)
│  │  ├─ Queues: [queue-per-consumer] (durable)
│  │  └─ Dead-Letter Exchange (DLX) + DLQ
│  │
│  └─ Connection: amqp://user:pass@rabbitmq:5672/e-clat
│
├─ Event Bus (NATS Streaming)
│  │
│  ├─ NATS Cluster: nats-{environment}
│  │  ├─ Subjects: employee.>, qualification.>, document.>, etc.
│  │  ├─ Stream: e-clat-events (persistent)
│  │  ├─ Consumers per service (durable)
│  │  └─ Retention: 7 days (configurable)
│  │
│  └─ Connection: nats://nats:4222
│
├─ Real-Time Signaling (Raw WebSocket)
│  │
│  ├─ WebSocket Server (Node.js with ws library)
│  │  ├─ URL: ws://localhost:3001
│  │  ├─ Authentication: JWT bearer token
│  │  ├─ Rooms: tenant-{id}, user-{id}, role-admin
│  │  └─ Message format: { type: 'nudge', payload: {...} }
│  │
│  └─ Connection: ws://localhost:3001
│
└─ Local Store (Redis or in-process)
   └─ Session state: connected WebSocket clients
```

---

## 3. Terraform Module Structure

### 3.1 Layer 10-Data: `messaging` module

**Path:** `infra/modules/messaging/`

```
messaging/
├── main.tf                          # Resource definitions
├── outputs.tf
├── variables.tf
├── service-bus.tf                   # Azure Service Bus (cloud)
├── event-grid.tf                    # Azure Event Grid (cloud)
├── signalr.tf                       # Azure SignalR Service
├── rabbitmq-onprem.tf               # On-prem RabbitMQ
├── nats-onprem.tf                   # On-prem NATS
├── websocket-onprem.tf              # On-prem raw WebSocket
└── variables/
    ├── queues.tfvars                # Queue/topic definitions
    └── retry-policies.tfvars        # Retry + DLQ config
```

### 3.2 Main.tf: Layer 10-Data Instantiation

```hcl
# infra/layers/10-data/main.tf (messaging section)

module "messaging" {
  source = "../../modules/messaging"

  environment              = var.environment
  location                 = var.location
  resource_group_name      = var.resource_group_name
  project_name             = var.project_name
  deployment_type          = var.deployment_type  # "cloud" or "onprem"

  # Cloud (Azure)
  service_bus_enabled      = var.deployment_type == "cloud" ? true : false
  service_bus_sku          = var.service_bus_sku             # "Standard" or "Premium"
  service_bus_capacity     = var.service_bus_capacity        # 1–40
  event_grid_enabled       = var.deployment_type == "cloud" ? true : false
  signalr_enabled          = var.deployment_type == "cloud" ? true : false
  signalr_sku              = var.signalr_sku                 # "Free", "Standard_S1", "Premium_P1"
  signalr_unit_count       = var.signalr_unit_count          # 1–100

  # On-Prem
  rabbitmq_enabled         = var.deployment_type == "onprem" ? true : false
  rabbitmq_replicas        = var.rabbitmq_replicas           # 3 for HA
  nats_enabled             = var.deployment_type == "onprem" ? true : false
  nats_replicas            = var.nats_replicas               # 3 for HA

  # Retry + DLQ
  max_delivery_count       = var.max_delivery_count          # 10
  ttl_seconds              = var.message_ttl_seconds         # 86400 (1 day)
  dlq_enabled              = var.dlq_enabled                 # true

  # Key Vault
  key_vault_id             = var.key_vault_id
}
```

### 3.3 Service Bus (Cloud)

```hcl
# infra/modules/messaging/service-bus.tf

resource "azurerm_servicebus_namespace" "main" {
  count = var.service_bus_enabled ? 1 : 0

  name                = "${var.project_name}-${var.environment}-bus"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = var.service_bus_sku
  capacity            = var.service_bus_capacity

  # Premium tier supports VNET integration
  dynamic "network_rule_set" {
    for_each = var.service_bus_sku == "Premium" && var.environment == "prod" ? [1] : []
    content {
      default_action = "Deny"
      ip_rules       = [var.api_subnet_cidr]  # Allow only from API subnet
      virtual_network_rules = [
        {
          subnet_id = var.private_subnet_id
          ignore_missing_vnet_service_endpoint = false
        }
      ]
    }
  }

  tags = merge(
    local.common_tags,
    {
      component = "messaging"
      tier      = var.environment == "prod" ? "premium" : "standard"
    }
  )
}

# Command Queues
locals {
  command_queues = {
    "employee-commands" = {
      partitioned           = true
      default_message_ttl   = "PT24H"
      max_delivery_count    = var.max_delivery_count
      dead_lettering_enabled = var.dlq_enabled
    },
    "qualification-commands" = {
      partitioned           = true
      default_message_ttl   = "PT24H"
      max_delivery_count    = var.max_delivery_count
      dead_lettering_enabled = var.dlq_enabled
    },
    "medical-commands" = {
      partitioned           = false
      default_message_ttl   = "PT24H"
      max_delivery_count    = var.max_delivery_count
      dead_lettering_enabled = var.dlq_enabled
    },
    "document-commands" = {
      partitioned           = true
      default_message_ttl   = "PT48H"  # Longer for large files
      max_delivery_count    = var.max_delivery_count
      dead_lettering_enabled = var.dlq_enabled
    },
    "hour-commands" = {
      partitioned           = true
      default_message_ttl   = "PT72H"  # 3 days for reconciliation
      max_delivery_count    = var.max_delivery_count
      dead_lettering_enabled = var.dlq_enabled
    },
    "notification-commands" = {
      partitioned           = false
      default_message_ttl   = "PT6H"   # Nudges are time-sensitive
      max_delivery_count    = 5        # Lower retry count for nudges
      dead_lettering_enabled = var.dlq_enabled
    },
  }
}

resource "azurerm_servicebus_queue" "commands" {
  for_each = var.service_bus_enabled ? local.command_queues : {}

  name                = each.key
  namespace_name      = azurerm_servicebus_namespace.main[0].name
  resource_group_name = var.resource_group_name

  partitioned_enabled = each.value.partitioned
  default_message_ttl = each.value.default_message_ttl
  max_delivery_count  = each.value.max_delivery_count

  dead_lettering_on_message_expiration = each.value.dead_lettering_enabled
  dead_letter_on_filter_evaluation_error = each.value.dead_lettering_enabled

  # Enable auto-forwarding to DLQ
  requires_duplicate_detection = true
  duplicate_detection_history_time_window = "PT1M"

  enable_batched_operations = true
  forward_dead_lettered_messages_to = each.value.dead_lettering_enabled ? "${each.key}-dlq" : null

  tags = local.common_tags
}

# Subscribers (e.g., service workers listening on queues)
resource "azurerm_servicebus_queue_authorization_rule" "service_listen" {
  for_each = var.service_bus_enabled ? local.command_queues : {}

  name                = "service-listen"
  namespace_name      = azurerm_servicebus_namespace.main[0].name
  queue_name          = azurerm_servicebus_queue.commands[each.key].name
  resource_group_name = var.resource_group_name

  listen = true
  send   = false
  manage = false
}

# Publisher (API service)
resource "azurerm_servicebus_namespace_authorization_rule" "api_publish" {
  count = var.service_bus_enabled ? 1 : 0

  name                = "api-publish"
  namespace_name      = azurerm_servicebus_namespace.main[0].name
  resource_group_name = var.resource_group_name

  listen = false
  send   = true
  manage = false
}

# Store connection string in Key Vault
resource "azurerm_key_vault_secret" "service_bus_connection" {
  count = var.service_bus_enabled ? 1 : 0

  name         = "service-bus-connection-string"
  value        = azurerm_servicebus_namespace.main[0].default_primary_connection_string
  key_vault_id = var.key_vault_id

  tags = local.common_tags
}

# Monitor DLQ for failed messages
resource "azurerm_monitor_metric_alert" "dlq_message_count" {
  count = var.service_bus_enabled && var.dlq_enabled ? 1 : 0

  name                = "${var.project_name}-${var.environment}-dlq-alert"
  resource_group_name = var.resource_group_name
  scopes              = [azurerm_servicebus_namespace.main[0].id]
  description         = "Alert on messages in dead-letter queue"
  severity            = 2

  criteria {
    metric_namespace = "Microsoft.ServiceBus/namespaces"
    metric_name      = "DeadletteredMessages"
    aggregation      = "Total"
    operator         = "GreaterThan"
    threshold        = 10

    evaluation_frequency = "PT5M"
    window_duration      = "PT5M"
  }

  action {
    action_group_id = var.alert_action_group_id
  }

  tags = local.common_tags
}
```

### 3.4 Event Grid (Cloud)

```hcl
# infra/modules/messaging/event-grid.tf

# System topic (auto-created from Service Bus)
resource "azurerm_eventgrid_system_topic" "service_bus" {
  count = var.event_grid_enabled ? 1 : 0

  name                = "${var.project_name}-${var.environment}-bus-events"
  location            = "global"
  resource_group_name = var.resource_group_name
  source_arm_resource_id = azurerm_servicebus_namespace.main[0].id
  topic_type          = "Microsoft.ServiceBus.Namespaces"

  tags = local.common_tags
}

# Custom topics for cross-service events
resource "azurerm_eventgrid_topic" "custom" {
  count = var.event_grid_enabled ? 1 : 0

  name                = "${var.project_name}-${var.environment}-events"
  location            = var.location
  resource_group_name = var.resource_group_name

  identity {
    type = "SystemAssigned"
  }

  tags = local.common_tags
}

# Subscription: employee-created → qualification service
resource "azurerm_eventgrid_event_subscription" "employee_created" {
  count = var.event_grid_enabled ? 1 : 0

  name                = "employee-created-to-qualification"
  scope               = azurerm_eventgrid_topic.custom[0].id
  event_delivery_schema = "EventGridSchema"

  # Route to service bus queue or webhook
  service_bus_queue_endpoint_id = azurerm_servicebus_queue.commands["qualification-commands"].id

  # Filter: only events with type "EmployeeCreated"
  subject_filter {
    subject_begins_with = "employee"
    subject_ends_with   = "created"
    case_sensitive      = false
  }

  event_filter {
    included_event_types = ["EmployeeCreated"]
  }

  retry_policy {
    event_time_to_live = 1440  # Retry for 1 day
    max_delivery_attempts = 30
  }

  dead_letter_endpoint {
    storage_account_id = azurerm_storage_account.dlq[0].id
    storage_blob_container_name = azurerm_storage_container.event_dlq[0].name
  }

  depends_on = [
    azurerm_eventgrid_topic.custom
  ]
}

# Endpoint: publish events to custom topic
resource "azurerm_eventgrid_topic_endpoint_access_key" "main" {
  count = var.event_grid_enabled ? 1 : 0

  topic_id = azurerm_eventgrid_topic.custom[0].id
}

# Store endpoint + key in Key Vault
resource "azurerm_key_vault_secret" "event_grid_endpoint" {
  count = var.event_grid_enabled ? 1 : 0

  name         = "event-grid-endpoint"
  value        = azurerm_eventgrid_topic.custom[0].endpoint
  key_vault_id = var.key_vault_id

  tags = local.common_tags
}

resource "azurerm_key_vault_secret" "event_grid_key" {
  count = var.event_grid_enabled ? 1 : 0

  name         = "event-grid-key"
  value        = azurerm_eventgrid_topic_endpoint_access_key.main[0].primary_access_key
  key_vault_id = var.key_vault_id

  tags = local.common_tags
}
```

### 3.5 Azure SignalR Service

```hcl
# infra/modules/messaging/signalr.tf

resource "azurerm_signalr_service" "main" {
  count = var.signalr_enabled ? 1 : 0

  name                = "${var.project_name}-${var.environment}-signalr"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku {
    name     = var.signalr_sku              # "Free_F1", "Standard_S1", "Premium_P1"
    capacity = var.signalr_unit_count       # 1–100
  }

  service_mode = "Serverless"  # Managed, scalable service
  http_request_logs_enabled = true
  messaging_logs_enabled = true
  connectivity_logs_enabled = true

  cors {
    allowed_origins = [
      "https://${var.app_base_url}",
      "https://app.e-clat.io",
    ]
  }

  identity {
    type = "SystemAssigned"
  }

  tags = merge(
    local.common_tags,
    {
      component = "realtime"
    }
  )
}

# Store connection string in Key Vault
resource "azurerm_key_vault_secret" "signalr_connection" {
  count = var.signalr_enabled ? 1 : 0

  name         = "signalr-connection-string"
  value        = azurerm_signalr_service.main[0].primary_connection_string
  key_vault_id = var.key_vault_id

  tags = local.common_tags
}

# Monitor SignalR connection count
resource "azurerm_monitor_metric_alert" "signalr_connections" {
  count = var.signalr_enabled ? 1 : 0

  name                = "${var.project_name}-${var.environment}-signalr-connections"
  resource_group_name = var.resource_group_name
  scopes              = [azurerm_signalr_service.main[0].id]
  description         = "Alert on high WebSocket connection count"
  severity            = 3

  criteria {
    metric_namespace = "Microsoft.SignalRService/SignalR"
    metric_name      = "ConnectionCount"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 10000  # Adjust per capacity

    evaluation_frequency = "PT5M"
    window_duration      = "PT5M"
  }

  action {
    action_group_id = var.alert_action_group_id
  }

  tags = local.common_tags
}
```

### 3.6 On-Prem: RabbitMQ + NATS (Helm)

```hcl
# infra/modules/messaging/rabbitmq-onprem.tf

resource "helm_release" "rabbitmq" {
  count = var.rabbitmq_enabled ? 1 : 0

  name             = "rabbitmq"
  repository       = "https://charts.bitnami.com/bitnami"
  chart            = "rabbitmq"
  namespace        = "messaging"
  create_namespace = true

  values = [
    yamlencode({
      replicaCount = var.rabbitmq_replicas
      auth = {
        username = var.rabbitmq_username
        password = var.rabbitmq_password
      }
      persistence = {
        enabled = true
        size    = "20Gi"
      }
      rbacEnabled = true
      resources = {
        requests = {
          cpu    = "250m"
          memory = "256Mi"
        }
        limits = {
          cpu    = "500m"
          memory = "512Mi"
        }
      }
      # Clustering
      clustering = {
        enabled = true
      }
    })
  ]
}

# NATS Helm
resource "helm_release" "nats" {
  count = var.nats_enabled ? 1 : 0

  name             = "nats"
  repository       = "https://nats-io.github.io/k8s/helm/charts"
  chart            = "nats"
  namespace        = "messaging"
  create_namespace = true

  values = [
    yamlencode({
      replicas = var.nats_replicas
      persistence = {
        enabled = true
        size    = "10Gi"
      }
      nats = {
        image = "nats:latest"
        resources = {
          requests = {
            cpu    = "200m"
            memory = "256Mi"
          }
        }
      }
      # JetStream (streaming)
      jetstream = {
        enabled = true
        fileStorage = {
          enabled = true
          size    = "10Gi"
        }
      }
    })
  ]
}
```

---

## 4. Message Contracts & Domain Events

### 4.1 Employee Domain

```typescript
// Event: EmployeeCreated
{
  "eventType": "EmployeeCreated",
  "aggregateId": "employee-123",
  "tenantId": "tenant-456",
  "timestamp": "2026-03-19T14:30:00Z",
  "data": {
    "employeeId": "emp-123",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@acme.com",
    "role": "EMPLOYEE"
  }
}

// Command: CreateEmployee
{
  "commandType": "CreateEmployee",
  "correlationId": "req-789",
  "tenantId": "tenant-456",
  "data": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@acme.com"
  }
}
```

### 4.2 Qualification Domain

```typescript
// Event: QualificationAwarded
{
  "eventType": "QualificationAwarded",
  "aggregateId": "qual-111",
  "tenantId": "tenant-456",
  "timestamp": "2026-03-19T15:00:00Z",
  "data": {
    "qualificationId": "qual-111",
    "employeeId": "emp-123",
    "standardId": "std-222",
    "issuedAt": "2026-03-19",
    "expiresAt": "2028-03-19"
  }
}

// Command: AwardQualification
{
  "commandType": "AwardQualification",
  "correlationId": "req-790",
  "tenantId": "tenant-456",
  "data": {
    "employeeId": "emp-123",
    "standardId": "std-222",
    "proofUrl": "https://storage.azure.com/..."
  }
}
```

### 4.3 Real-Time Notification Contract (WebSocket)

```typescript
// Nudge: qualification about to expire
{
  "type": "nudge",
  "payload": {
    "title": "Certification Expiring Soon",
    "message": "Your ISO 9001 certification expires in 30 days.",
    "actionUrl": "/my/qualifications",
    "severity": "warning"
  }
}

// Live Update: document ready for review
{
  "type": "notification-update",
  "payload": {
    "notificationId": "notif-123",
    "status": "ready",
    "documentName": "training-receipt.pdf",
    "reviewerName": "Alice Smith"
  }
}
```

---

## 5. Abstraction Layer: Cloud/On-Prem Parity

### 5.1 TypeScript Interface

```typescript
// apps/api/src/messaging/types.ts

export interface MessageBroker {
  // Commands (guaranteed delivery)
  publishCommand<T>(queue: string, command: T, options?: PublishOptions): Promise<void>;
  subscribeCommand<T>(queue: string, handler: (msg: T) => Promise<void>): void;

  // Events (fan-out)
  publishEvent<T>(topic: string, event: T): Promise<void>;
  subscribeEvent<T>(topic: string, handler: (event: T) => Promise<void>): void;

  // Real-time
  broadcast<T>(room: string, message: T): void;
  notify<T>(userId: string, message: T): void;
}

export interface RealtimeHub {
  // WebSocket groups
  joinGroup(userId: string, groupId: string): void;
  leaveGroup(userId: string, groupId: string): void;
  sendToGroup<T>(groupId: string, message: T): void;
  sendToUser<T>(userId: string, message: T): void;
}
```

### 5.2 Cloud Implementation

```typescript
// apps/api/src/messaging/cloud/service-bus-broker.ts

import { ServiceBusClient } from "@azure/service-bus";
import { EventGridPublisherClient } from "@azure/eventgrid";
import { MessageBroker } from "../types";

export class AzureServiceBusBroker implements MessageBroker {
  private sbClient: ServiceBusClient;
  private egClient: EventGridPublisherClient;

  async publishCommand<T>(queue: string, command: T): Promise<void> {
    const sender = this.sbClient.createSender(queue);
    await sender.sendMessages({
      body: JSON.stringify(command),
      contentType: "application/json",
      label: (command as any).commandType,
      properties: {
        tenantId: (command as any).tenantId,
        correlationId: (command as any).correlationId,
      },
    });
  }

  async publishEvent<T>(topic: string, event: T): Promise<void> {
    await this.egClient.sendEvents([
      {
        eventType: (event as any).eventType,
        subject: `/${topic}`,
        dataVersion: "1.0",
        data: event,
      },
    ]);
  }
}
```

### 5.3 On-Prem Implementation

```typescript
// apps/api/src/messaging/onprem/rabbitmq-broker.ts

import * as amqp from "amqplib";
import { MessageBroker } from "../types";

export class RabbitMQBroker implements MessageBroker {
  private connection: amqp.Connection;
  private channel: amqp.Channel;

  async publishCommand<T>(queue: string, command: T): Promise<void> {
    await this.channel.assertQueue(queue, { durable: true });
    this.channel.sendToQueue(
      queue,
      Buffer.from(JSON.stringify(command)),
      {
        persistent: true,
        contentType: "application/json",
        headers: {
          tenantId: (command as any).tenantId,
          commandType: (command as any).commandType,
        },
      }
    );
  }

  subscribeCommand<T>(queue: string, handler: (msg: T) => Promise<void>): void {
    this.channel.assertQueue(queue, { durable: true });
    this.channel.consume(
      queue,
      async (msg) => {
        if (msg) {
          try {
            const command = JSON.parse(msg.content.toString());
            await handler(command);
            this.channel.ack(msg);
          } catch (err) {
            // Requeue or send to DLX
            this.channel.nack(msg, false, false);
          }
        }
      }
    );
  }
}
```

---

## 6. Cost Estimates

### 6.1 Cloud (Azure)

| Component | Tier | Monthly |
|-----------|------|---------|
| Service Bus | Standard, 1 unit | $50–75 |
| Event Grid | Custom topic | $10–20 |
| SignalR | Standard_S1, 1 unit | $100–150 |
| **Total (Shared)** | Shared tier | **~$175–250/mo** |

*Per enterprise tenant: add +$100–150/mo for premium tier*

### 6.2 On-Prem (Self-Hosted)

| Component | Annual |
|-----------|--------|
| RabbitMQ (OSS) | $0 |
| NATS Streaming (OSS) | $0 |
| WebSocket Server (Node.js) | Infra cost only |
| **Total** | **Infrastructure only** |

---

## 7. Deployment Automation

### 7.1 Service Bus Rollout (GitHub Actions)

```yaml
# .github/workflows/deploy-messaging.yml
name: Deploy Messaging Infrastructure

on:
  workflow_dispatch:
    inputs:
      environment:
        required: true
        default: 'dev'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v2

      - name: Deploy Service Bus + Event Grid
        run: |
          cd infra/layers/10-data
          terraform apply \
            -var-file="${{ github.event.inputs.environment }}.tfvars" \
            -target=module.messaging \
            -auto-approve

      - name: Verify Queues Created
        run: |
          az servicebus queue list \
            --namespace-name ${{ env.SERVICEBUS_NAMESPACE }} \
            --resource-group ${{ env.RESOURCE_GROUP }}
```

### 7.2 RabbitMQ On-Prem (Helm)

```bash
# Deploy RabbitMQ to K8s
helm install rabbitmq bitnami/rabbitmq \
  -n messaging \
  -f infra/modules/messaging/rabbitmq-values.yaml

# Verify
kubectl get pods -n messaging
kubectl logs -n messaging -l app.kubernetes.io/name=rabbitmq
```

---

## 8. Implementation Checklist

### Phase 1: Service Bus (Week 1–2)
- [ ] Create Service Bus namespace
- [ ] Create 6 command queues (employee, qualification, medical, document, hour, notification)
- [ ] Configure DLQ + retry policies
- [ ] Store connection string in Key Vault
- [ ] Test: publish command → queue → consume

### Phase 2: Event Grid (Week 3)
- [ ] Create system topic from Service Bus
- [ ] Create custom Event Grid topic
- [ ] Create subscriptions (employee-created → qualification)
- [ ] Test: publish event → subscription → handler

### Phase 3: SignalR (Week 4)
- [ ] Provision Azure SignalR Service
- [ ] Integrate SignalR SDK in API
- [ ] Implement NotificationHub (SignalR Hub)
- [ ] Test: WebSocket connect → nudge broadcast

### Phase 4: On-Prem (Week 5–6)
- [ ] Deploy RabbitMQ Helm chart
- [ ] Deploy NATS Helm chart
- [ ] Implement abstraction layer
- [ ] Test: cloud ↔ on-prem parity

---

## 9. Related Documentation

- **Decision #9:** Event-Driven: Service Bus + WebSocket (`.squad/decisions.md`)
- **Event Contracts:** `docs/specs/event-contracts.md`
- **Service Architecture:** `docs/specs/service-architecture-spec.md`
- **Runbook:** `docs/guides/messaging-operations-runbook.md` (TBD)

---

**Status:** Ready for Terraform implementation  
**Estimated Effort:** 6–8 weeks (all phases)  
**Owner:** Daniels (Microservices Engineer), Platform team
