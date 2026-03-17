# Decision: Observability Foundation — OTel SDK + Health Probes + Structured Logging

**Author:** Bunk (Backend Dev)
**Date:** 2026-03-17
**Issues:** #121, #126, #127, #128
**Spec:** docs/specs/api-telemetry.md
**Status:** Implemented (Phase 1 Foundation)

## Context

E-CLAT had no structured observability. Requests were opaque, no correlation IDs, no metrics baseline, inconsistent logging. This blocks all Phase 3+ work (alerting, dashboards, SLO tracking, compliance audit trails).

## Decisions

### 1. OTel SDK as the telemetry backbone

- OpenTelemetry Node SDK initialized at server startup (`apps/api/src/config/telemetry.ts`)
- Console exporters for development; designed for Azure App Insights swap in production
- Silent in test environment to avoid noise
- Resource attributes: service.name, service.version, deployment.environment

### 2. Correlation ID middleware (W3C Trace Context)

- Every request gets a UUID correlation ID (generated or propagated from `x-correlation-id` header)
- W3C `traceparent` header synthesised when not provided by caller
- Correlation ID echoed on response for client-side tracing
- Attached to `req.correlationId` for downstream use

### 3. Health probes on the platform router

- `/api/v1/platform/health` — lightweight liveness (UP + uptime)
- `/api/v1/platform/ready` — readiness with dependency checks (DB, cache, auth)
- `/api/v1/platform/detailed-health` — full dependency status with latencies
- All public (no auth required) — load balancers need unauthenticated access
- Returns 503 when dependencies fail, enabling proper traffic draining

### 4. Structured logging with OTel bridge

- Winston logger now injects OTel trace/span IDs into every log entry
- Request logger middleware emits structured JSON: correlationId, method, path, status, durationMs
- Log level varies by status code: info (2xx/3xx), warn (4xx), error (5xx)

### 5. OTel metrics from day one

- `http_requests_total` counter (method, status, path)
- `http_request_duration_ms` histogram (method, path)
- `http_active_requests` gauge (in-flight count)
- Path normalization collapses UUIDs/numbers to prevent cardinality explosion
- Business event counters (qualification changes, proof submissions) deferred to Phase 2

### 6. API compatibility note

- `@opentelemetry/resources` v2.x: use `resourceFromAttributes()` not `new Resource()`
- `@opentelemetry/semantic-conventions`: use `SEMRESATTRS_DEPLOYMENT_ENVIRONMENT` (not `ATTR_DEPLOYMENT_ENVIRONMENT_NAME`)

## What's Next (Phase 2)

- Wire Azure App Insights exporter (replace console)
- Add Redis health check when cache layer lands
- Add Entra health check when IdP integration lands
- Prometheus `/metrics` endpoint for scraping
- Business event counters (templates created, proofs submitted, etc.)
- Tenant tagging on all metrics from JWT context
