# API Observability & Telemetry — E-CLAT Platform

> **Status:** Specification  
> **Owner:** Bunk (Backend Dev)  
> **Created:** 2026-03-21  
> **Issue:** #90  
> **Applies To:** `apps/api` (all modules), `packages/shared` (telemetry types), Docker/Kubernetes infrastructure  
> **Related Decisions:** Decision 10 (OTel + ADX + App Insights), Decision 1 (Tiered isolation)  
> **Companion Docs:** [Service Architecture Spec](./service-architecture-spec.md) · [App Spec](./app-spec.md) · [API v1 Namespace](./api-v1-namespace.md)

---

## 1. Problem Statement

E-CLAT operates in regulated industries where observability is not optional—it's mandatory. Current observability gaps:

1. **No structured tracing** — Request lifecycle (auth → service → DB) is opaque to debugging
2. **No correlation IDs** — Multi-step workflows (template assignment → fulfillment → audit) lose context across calls
3. **No metrics baseline** — Request latency, error rates, and business metrics (e.g., "templates created per hour") are invisible
4. **Inconsistent logging** — Mix of `console.log`, `winston` calls, and missing context makes root-cause analysis hard
5. **No tenant/user tagging** — Metrics cannot be sliced by tenant or role, breaking SLO tracking
6. **Health/readiness unclear** — Load balancers cannot reliably drain traffic or validate service startup
7. **No error tracking backend** — Errors go to console; they're not aggregated or alerted on

**Impact:** Cannot meet compliance audit requirements (traceability), cannot debug production issues (no context), cannot establish SLOs (no metrics), cannot scale intelligently (no visibility into bottlenecks).

---

## 2. Solution Overview

Implement **OpenTelemetry (OTel)** integration with three backends:
- **Azure App Insights** (primary, cloud-ready, managed)
- **Azure Data Explorer (ADX)** (long-term analytics & compliance queries)
- **Local console/file** (dev mode, Docker Compose)

**Core Pillars:**

| Pillar | Implementation |
|--------|---|
| **Tracing** | Correlation IDs + distributed trace context propagation (W3C Trace Context) |
| **Metrics** | Request counts, latency percentiles (p50/p95/p99), error rates, business events (templates/assignments/proofs) |
| **Logs** | Structured JSON logging with context injection (winston → OTel bridge) |
| **Health Probes** | Liveness (`/health`), readiness (`/ready`), detailed (`/api/v1/platform/health`) |
| **Tenant Tagging** | All traces/metrics labeled with `tenant_id`, `user_id`, `role` from JWT |

---

## 3. API Endpoints

### 3.1 Health & Readiness Probes

| Endpoint | Method | Purpose | Status Codes |
|----------|--------|---------|---|
| `GET /health` | GET | Liveness probe (is API running?) | 200 (alive), 503 (dead) |
| `GET /ready` | GET | Readiness probe (can accept traffic?) | 200 (ready), 503 (not ready) |
| `GET /api/v1/platform/health` | GET | Detailed health with dependencies | 200, 503 |

#### Response Schemas

**`GET /health` (Liveness)**

```json
{
  "status": "UP",
  "timestamp": "2026-03-21T10:30:45.123Z",
  "uptime_seconds": 3600
}
```

**`GET /ready` (Readiness)**

```json
{
  "status": "READY",
  "timestamp": "2026-03-21T10:30:45.123Z",
  "checks": {
    "database": "OK",
    "cache": "OK",
    "auth": "OK"
  }
}
```

Status is `READY` only if **all** checks pass. A single failing check returns 503.

**`GET /api/v1/platform/health` (Detailed)**

```json
{
  "status": "UP",
  "timestamp": "2026-03-21T10:30:45.123Z",
  "version": "0.4.0",
  "git_commit": "abc1234",
  "environment": "production",
  "uptime_seconds": 3600,
  "dependencies": {
    "database": {
      "status": "OK",
      "latency_ms": 2
    },
    "cache": {
      "status": "OK",
      "latency_ms": 1
    },
    "auth_provider": {
      "status": "OK",
      "latency_ms": 15
    }
  },
  "metrics_snapshot": {
    "requests_total": 45230,
    "errors_total": 12,
    "avg_latency_ms": 28
  }
}
```

---

### 3.2 Metrics & Telemetry Endpoints

| Endpoint | Method | Purpose | Notes |
|----------|--------|---------|---|
| `GET /metrics` | GET | Prometheus-format metrics export | Scraped by OTel Collector or Prometheus |
| `POST /telemetry/events` | POST | Custom event submission (admin only) | For synthetic testing |

#### Response Schemas

**`GET /metrics` (Prometheus Text Format)**

```
# HELP http_requests_total Total HTTP requests by method/status/path
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200",path="/api/v1/workforce/employees",tenant_id="t1"} 1250
http_requests_total{method="POST",status="201",path="/api/v1/compliance/templates",tenant_id="t1"} 42
http_requests_total{method="POST",status="400",path="/api/v1/compliance/templates",tenant_id="t1"} 3

# HELP http_request_duration_ms HTTP request latency in milliseconds
# TYPE http_request_duration_ms histogram
http_request_duration_ms_bucket{le="10",method="GET",path="/api/v1/workforce/employees"} 800
http_request_duration_ms_bucket{le="50",method="GET",path="/api/v1/workforce/employees"} 1150
http_request_duration_ms_bucket{le="100",method="GET",path="/api/v1/workforce/employees"} 1210

# HELP proof_fulfillments_created_total Proofs submitted by type and attestation level
# TYPE proof_fulfillments_created_total counter
proof_fulfillments_created_total{proof_type="hours",level="self_attest",tenant_id="t1"} 89
proof_fulfillments_created_total{proof_type="certification",level="upload",tenant_id="t1"} 45
```

---

## 4. Validation Schemas (Zod)

### 4.1 Correlation ID Propagation

```typescript
// apps/api/src/modules/telemetry/validators.ts

import { z } from 'zod';

// Trace context (W3C Trace Context standard)
export const traceContextSchema = z.object({
  traceId: z.string().regex(/^[0-9a-f]{32}$/),
  spanId: z.string().regex(/^[0-9a-f]{16}$/),
  traceFlags: z.string().regex(/^[0-1]{2}$/),
});

// Correlation ID (UUID or custom format)
export const correlationIdSchema = z.string().uuid().or(
  z.string().regex(/^[a-zA-Z0-9-]{20,}$/)
);

// Request metadata injected by middleware
export const requestMetadataSchema = z.object({
  correlationId: correlationIdSchema,
  traceId: z.string(),
  spanId: z.string(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  userRole: z.enum(['EMPLOYEE', 'SUPERVISOR', 'MANAGER', 'COMPLIANCE_OFFICER', 'ADMIN']),
  timestamp: z.string().datetime(),
  path: z.string(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
});

export type RequestMetadata = z.infer<typeof requestMetadataSchema>;

// Health check response
export const healthCheckResponseSchema = z.object({
  status: z.enum(['UP', 'DOWN', 'DEGRADED']),
  timestamp: z.string().datetime(),
  uptime_seconds: z.number().int().nonnegative(),
});

export const readinessCheckResponseSchema = z.object({
  status: z.enum(['READY', 'NOT_READY']),
  timestamp: z.string().datetime(),
  checks: z.record(z.enum(['OK', 'FAILED'])),
});

export const detailedHealthResponseSchema = z.object({
  status: z.enum(['UP', 'DOWN']),
  timestamp: z.string().datetime(),
  version: z.string(),
  git_commit: z.string(),
  environment: z.enum(['development', 'staging', 'production']),
  uptime_seconds: z.number().int().nonnegative(),
  dependencies: z.record(z.object({
    status: z.enum(['OK', 'FAILED']),
    latency_ms: z.number().int().nonnegative(),
  })),
  metrics_snapshot: z.object({
    requests_total: z.number().int(),
    errors_total: z.number().int(),
    avg_latency_ms: z.number(),
  }),
});
```

---

## 5. Data Model Changes (Prisma)

### 5.1 New Models

```prisma
// data/prisma/schema.prisma

// Telemetry events (immutable, for compliance audit trail)
model TelemetryEvent {
  id        String   @id @default(uuid())
  timestamp DateTime @default(now())
  
  // Trace context
  traceId   String
  spanId    String
  correlationId String
  
  // Request metadata
  tenantId  String
  userId    String?
  method    String   // GET, POST, etc.
  path      String
  statusCode Int
  latency_ms Int
  
  // Error tracking
  errorCode String?
  errorMessage String?
  
  // Business metrics
  eventType String?  // "template_created", "proof_submitted", etc.
  metadata  Json?
  
  @@index([tenantId, timestamp])
  @@index([traceId])
  @@index([correlationId])
  @@index([errorCode])
}

// Metrics snapshot (periodic, for long-term analysis)
model MetricsSnapshot {
  id        String   @id @default(uuid())
  timestamp DateTime @default(now())
  
  tenantId  String
  metricName String // e.g., "http_requests_total", "proof_fulfillments_created"
  value     Float
  labels    Json?   // {"method": "POST", "status": "201", "proof_type": "hours"}
  
  @@index([tenantId, timestamp])
  @@index([metricName])
}

// Health check history (for SLO tracking)
model HealthCheckRecord {
  id        String   @id @default(uuid())
  timestamp DateTime @default(now())
  
  checkType String   // "liveness", "readiness", "detailed"
  status    String   // "UP", "DOWN", "DEGRADED", "READY", "NOT_READY"
  latency_ms Int
  
  dependencies Json?  // {"database": "OK", "cache": "OK"}
  
  @@index([timestamp])
  @@index([checkType])
}
```

---

## 6. RBAC Rules

### 6.1 Telemetry Endpoints

| Endpoint | EMPLOYEE | SUPERVISOR | MANAGER | COMPLIANCE_OFFICER | ADMIN |
|----------|:---:|:---:|:---:|:---:|:---:|
| `GET /health` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /ready` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /api/v1/platform/health` | ✗ | ✗ | ✓ | ✓ | ✓ |
| `GET /metrics` | ✗ | ✗ | ✗ | ✓ | ✓ |
| `POST /telemetry/events` | ✗ | ✗ | ✗ | ✗ | ✓ |

**Notes:**
- `/health` and `/ready` are **public** — accessed by load balancers and infra probes
- `/api/v1/platform/health` requires `MANAGER+` role
- `/metrics` requires `COMPLIANCE_OFFICER+` role (sensitive performance data)
- Custom event submission restricted to `ADMIN` only

---

## 7. Error Responses

All error responses follow the standard AppError format:

```json
{
  "error": {
    "code": "TELEMETRY_ERROR",
    "message": "Failed to record telemetry event",
    "details": {
      "reason": "Database unavailable"
    }
  }
}
```

| Scenario | HTTP Code | Error Code |
|----------|---|---|
| Dependency check fails (readiness) | 503 | `SERVICE_UNAVAILABLE` |
| Database unavailable | 503 | `DATABASE_UNAVAILABLE` |
| Health check timeout (>5s) | 504 | `GATEWAY_TIMEOUT` |
| Invalid trace context header | 400 | `BAD_REQUEST` |
| Metrics export fails | 500 | `INTERNAL_ERROR` |

---

## 8. Security Considerations

### 8.1 PII & Compliance

- **No PII in traces** — Correlation IDs are UUIDs only; user identity via `user_id` (not email/name)
- **No query parameters logged** — Could contain sensitive data; only method + path
- **No request/response bodies in traces** — Logged separately at INFO+ level for compliance team only
- **Audit trail immutability** — `TelemetryEvent` records are append-only; never updated/deleted

### 8.2 Performance Impact

- **Non-blocking** — All telemetry writes async; request latency not impacted
- **Batching** — OTel SDK batches spans before export; max 2MB/minute to ADX
- **Sampling** — At scale, sample 5% of non-error requests; 100% of errors
- **Timeout** — Telemetry export max 2s; failures do not fail the request

### 8.3 Multi-Tenant Isolation

- **Tenant tagging mandatory** — Every trace/metric includes `tenant_id` from JWT
- **Query isolation** — All telemetry queries must filter by `tenantId`
- **Cross-tenant data leak** — Any write without valid tenant context rejected
- **ADX access control** — Role-based access at ADX table level (compliance team reads their tenant only)

### 8.4 Credential Management

- **No API keys in code** — OTel exporter uses Azure managed identity (DefaultAzureCredential)
- **Key Vault secrets** — ADX connection string stored in Key Vault, injected at startup
- **Rotation** — Credentials rotated quarterly; old credentials rejected after 7-day window

---

## 9. Implementation Architecture

### 9.1 Middleware Stack

```
Request → correlationIdMiddleware (inject/propagate)
       → traceContextMiddleware (W3C Trace Context)
       → requestMetadataMiddleware (attach user, tenant, role)
       → ← Response ← errorHandlerMiddleware (log errors + emit metrics)
       → telemetryEmitterMiddleware (record latency + success metrics)
```

### 9.2 OTel SDK Configuration

**File:** `apps/api/src/config/telemetry.ts`

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { AzureMonitorTraceExporter } from '@azure/monitor-opentelemetry-exporter';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';

const sdk = new NodeSDK({
  resource: new Resource({
    'service.name': 'e-clat-api',
    'service.version': process.env.APP_VERSION,
    'deployment.environment': process.env.NODE_ENV,
  }),
  traceExporter: new AzureMonitorTraceExporter({
    connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
  }),
  metricReader: new PeriodicExportingMetricReader(
    new AzureMonitorMetricExporter({
      connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
    })
  ),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
```

### 9.3 Winston → OTel Bridge

```typescript
// apps/api/src/config/logger.ts
import winston from 'winston';
import { WinstonTransport } from '@opentelemetry/sdk-node-auto';

const logger = winston.createLogger({
  format: winston.format.json(),
  transports: [
    new WinstonTransport({
      level: process.env.LOG_LEVEL || 'info',
    }),
  ],
});
```

---

## 10. Phased Rollout

### Phase 1 (Sprint 5) — Foundation

- [x] Define telemetry schema and Prisma models
- [ ] Implement OTel SDK initialization
- [ ] Add `/health` and `/ready` endpoints
- [ ] Set up winston → OTel bridge
- [ ] Deploy to dev environment; validate traces flow to App Insights
- **Success Criteria:** All requests traced, dev telemetry live, zero performance degradation

### Phase 2 (Sprint 6) — Metrics & Health

- [ ] Implement `/api/v1/platform/health` endpoint with dependency checks
- [ ] Emit request latency metrics (histogram)
- [ ] Emit business metrics (templates created, proofs submitted, etc.)
- [ ] Set up `/metrics` endpoint (Prometheus format)
- [ ] Configure ADX data sink
- [ ] Deploy to staging; validate metrics aggregation
- **Success Criteria:** All critical metrics emitted, Prometheus scraping works, SLO dashboard operational

### Phase 3 (Sprint 7) — Alerting & Dashboards

- [ ] Set up App Insights alert rules (error rate >1%, latency p99 >500ms)
- [ ] Create compliance audit dashboard in ADX
- [ ] Set up PagerDuty integration for P0 alerts
- [ ] Documentation for observability runbooks
- **Success Criteria:** Alerts trigger correctly, on-call team trained, no false positives

### Phase 4 (Production, 2026-Q2) — Production Rollout

- [ ] Enable sampling policy (5% normal, 100% errors)
- [ ] Migrate load balancer health checks to `/ready`
- [ ] Decommission old logging approach (cloudwatch, etc.)
- [ ] Full SLO dashboard operational
- **Success Criteria:** Zero observability gaps, all SLOs tracked, compliance audit trail complete

---

## 11. Acceptance Criteria

✅ **Acceptance criteria for Phase 1:**

- [ ] Correlation IDs flow through all request → service → DB calls
- [ ] Every unhandled error caught and traced with stack context
- [ ] `/health` probe responds in <500ms, always
- [ ] `/ready` fails correctly when DB unreachable
- [ ] Zero telemetry writes cause request failures
- [ ] All traces appear in App Insights within 30s
- [ ] Audit team can query compliance event trail in ADX

---

## 12. Compliance Notes

- **SOC 2 Type II** — Immutable audit trail required; `TelemetryEvent` is append-only ✓
- **HIPAA/PCI** — No PII in spans; encryption in transit (HTTPS/TLS) ✓
- **Regulatory** — 7-year retention for `TelemetryEvent` table (archival to cold storage after 1 year) ✓

---

## 13. Related Specs

- **Service Architecture:** `service-architecture-spec.md` (Decision 10)
- **API v1 Namespace:** `api-v1-namespace.md` (phased rollout pattern)
- **RBAC:** `rbac-api-spec.md` (role checks for `/metrics`, `/health`)

