# Frontend Telemetry & Observability Spec — E-CLAT

> **Author:** Kima (Frontend Dev)  
> **Date:** 2026-03-20  
> **Status:** Design Specification (Pre-Implementation)  
> **Issue:** #91 (SA-10)  
> **Related Decision:** Decision 10 (OTel Browser SDK Integration)  
> **Applies To:** `apps/web`, `packages/shared`, error boundaries, performance monitoring  
> **Companion Docs:** `docs/specs/feature-flags-spec.md`, `docs/specs/service-architecture-spec.md`

---

## Executive Summary

E-CLAT needs browser-level observability to understand user behavior, diagnose errors in production, and measure performance. This spec defines an **OpenTelemetry (OTel) browser SDK integration** that:

- Captures error boundaries with context (user ID, tenant, role, feature flags active at crash time)
- Tracks user flows: page views, feature usage, form submission timing
- Monitors Web Vitals (LCP, FID, CLS) and API call performance (latency, error rates)
- Tags all signals per tenant (multi-tenant isolation)
- Uses a React context for feature flags to conditionally render and gate telemetry exports
- Respects GDPR consent status before exporting personally identifiable information

The telemetry backend receives spans and metrics via OTLP/gRPC or HTTP/Protobuf, enabling detection of user-facing regressions before they become incidents.

---

## 1. User Stories

### 1.1 As a Frontend Engineer

I want to **capture all unhandled errors in production** so that I can diagnose runtime crashes without asking users to reproduce.

**Acceptance Criteria:**
- Error boundary catches React component errors + logs them with stack trace, component name, user context
- Fetch/Promise errors auto-caught (global `error` handler + `unhandledrejection` listener)
- Error span includes: exception type, message, stack trace, HTTP status (if applicable), user ID, tenant ID, current page/route
- Errors tagged with severity (error, fatal)

### 1.2 As a Product Manager

I want to **understand which features users actually use** and **how long critical flows take** so I can prioritize high-value UX improvements.

**Acceptance Criteria:**
- Page view events fire on every route change with route name, timestamp
- Feature usage events track template editor opens, assignment submissions, approvals, bulk operations
- Form submission timing captured (form start → validation → submit → response)
- All events tagged with user role, employee scope, feature flags active at event time
- Can filter telemetry by feature flag value to measure A/B impact

### 1.3 As a Performance Engineer

I want to **monitor Web Vitals and API performance per tenant** so that I can detect slow deploys or provider-specific issues early.

**Acceptance Criteria:**
- LCP (Largest Contentful Paint), FID (First Input Delay), CLS (Cumulative Layout Shift) auto-captured
- API call spans include: method, path, status code, duration, bytes sent/received
- Slow API calls (>3s) auto-flagged with error status
- All metrics tagged with tenant ID, environment (dev/staging/prod)
- Browser and network conditions available for correlation with performance degradation

### 1.4 As a Compliance Officer

I want to **ensure personally identifiable information is not exported without consent** so that we remain GDPR compliant.

**Acceptance Criteria:**
- Feature flag `compliance.telemetry-pii-export` controls whether user ID, email, name appear in traces
- Consent check fires at app startup; if user denies, PII attributes removed from all downstream spans
- Audit log records when telemetry consent changes (per user, per session)
- Admin can view/revoke telemetry for any user via compliance dashboard

---

## 2. Architecture Overview

### 2.1 Component Hierarchy

```
App
├── TelemetryProvider (wraps entire app, initializes OTel client)
│   ├── FeatureFlagContext (provides flags, gates telemetry exports)
│   ├── AuthContext (provides user, role, tenant for tagging)
│   ├── ConsentManager (GDPR banner, tracks consent state)
│   └── ErrorBoundary (catches React errors, exports to OTel)
│       └── [All Routes & Pages]
│           ├── ProofList components
│           ├── Form components (with auto-timing instrumentation)
│           └── Dashboard/Management components
```

### 2.2 Telemetry Instrumentation Points

#### **Page Lifecycle**
- `router.beforeEach()` → emit `page_view` event with route name, user role, tenant ID
- `router.afterEach()` → emit `navigation_complete` span with duration

#### **User Interactions**
- Form submission (all `<form onSubmit>` in My section, Team management, Templates)
  - Event: `form_submitted` { form_id, duration_ms, validation_passed, submission_errors }
- Template operations: editor open, publish, assign, fulfill
  - Event: `template_action` { action, template_id, duration_ms }
- Approval/rejection workflows
  - Event: `workflow_action` { action, resource_id, decision, duration_ms }

#### **Network Performance**
- Wrap API client to auto-capture spans for every HTTP request
  - Span: `http.request` { method, path, status, duration_ms, bytes_sent, bytes_received, error? }
- Slow request threshold: >3s auto-marked as `status=error` for alerting

#### **Web Vitals**
- Use `web-vitals` npm package to capture CLS, FID, LCP
  - Metric: `web_vitals.lcp` { value_ms, rating (good/needs_improvement/poor) }
  - Metric: `web_vitals.fid` { value_ms, rating }
  - Metric: `web_vitals.cls` { value, rating }

#### **Error Handling**
- React Error Boundary: catch and export component errors
- Global error handler: catch unhandled fetch rejections, Promise rejections
- Errors include full context: user ID, tenant, role, feature flags, page, stack trace

---

## 3. Feature Flag Integration

### 3.1 Feature Flags Used

| Flag | Purpose | Type |
|------|---------|------|
| `compliance.telemetry-enabled` | Master kill switch; if false, telemetry disabled entirely | ops |
| `compliance.telemetry-pii-export` | Allow user ID, email, name in traces (GDPR consent) | permission |
| `web.error-boundary-verbose` | Include full stack traces in error spans (debug only) | experiment |
| `web.api-timing-spans` | Auto-instrument all API calls; some orgs disable for performance | release |
| `web.web-vitals-tracking` | Capture browser performance metrics | release |

### 3.2 Conditional Rendering in React

```typescript
// In TelemetryProvider.tsx
const { flags } = useFeatureFlags();

if (!flags['compliance.telemetry-enabled']) {
  // Return no-op telemetry client
  return <TelemetryContext.Provider value={createNoOpClient()}>{children}</TelemetryContext.Provider>;
}

// Initialize real OTel client only if flag enabled
const otelClient = initializeOpenTelemetry({
  exportPII: flags['compliance.telemetry-pii-export'],
  verboseErrors: flags['web.error-boundary-verbose'],
});

return <TelemetryContext.Provider value={otelClient}>{children}</TelemetryContext.Provider>;
```

---

## 4. State Management Approach

### 4.1 Telemetry Context

```typescript
// src/contexts/TelemetryContext.ts
interface TelemetryContextValue {
  tracer: Tracer;
  meter: Meter;
  recordError: (error: Error, context?: ErrorContext) => void;
  recordEvent: (name: string, attributes?: Record<string, any>) => void;
  recordMetric: (name: string, value: number, attributes?: Record<string, any>) => void;
  recordTiming: (name: string, duration_ms: number, attributes?: Record<string, any>) => void;
  exporterReady: boolean;
  consentGiven: boolean;
  setConsent: (consent: boolean) => void;
}

export const useTelemetry = (): TelemetryContextValue => {
  const ctx = useContext(TelemetryContext);
  if (!ctx) throw new Error('useTelemetry called outside TelemetryProvider');
  return ctx;
};
```

### 4.2 Consent State

Consent is stored in:
- **localStorage** for persistence across sessions (key: `eclat_telemetry_consent`)
- **TelemetryContext** for runtime access
- Hooks into AuthContext user record for audit trail

On consent change:
1. Update localStorage
2. Update TelemetryContext
3. Emit audit log entry (if user authenticated)
4. Restart OTel exporter with updated PII policy

---

## 5. API Integration Points

### 5.1 Telemetry Export Endpoint

The API exposes a **batch telemetry intake endpoint** (gRPC or HTTP/Protobuf):

```
POST /api/v1/platform/telemetry/spans
POST /api/v1/platform/telemetry/metrics
```

**Schema (OTLP HTTP/Protobuf):**
- `resourceAttributes`: { service.name, service.version, telemetry.sdk.version, ...tenant tags }
- `scopeSpans[]`: span data with timestamps, status, attributes
- `scopeMetrics[]`: metric values (histograms, gauges, counters)

### 5.2 Consent Audit Endpoint

```
POST /api/v1/compliance/telemetry-consent
GET  /api/v1/compliance/telemetry-consent/:employeeId
```

**Request:**
```json
{
  "employeeId": "uuid",
  "consentGiven": boolean,
  "timestamp": "ISO 8601"
}
```

**Response:**
```json
{
  "consentId": "uuid",
  "employeeId": "uuid",
  "consentGiven": boolean,
  "recordedAt": "ISO 8601",
  "consentMethod": "banner" | "settings-page"
}
```

### 5.3 API Client Instrumentation

The centralized `api/client.ts` wraps `fetch`:

```typescript
export const api = createInstrumentedFetch({
  baseURL: process.env.REACT_APP_API_URL,
  telemetryEnabled: flags['web.api-timing-spans'],
  slowRequestThreshold: 3000, // 3 seconds
  onSpan: (span) => telemetry.tracer.addEvent('http_request', span.attributes),
});
```

---

## 6. Wireframe Descriptions (Text-Based)

### 6.1 Error Boundary UI

**Path:** Any page that crashes  
**Description:**
- Full-width error state overlay or fallback UI
- Heading: "Something went wrong"
- Message: "The application encountered an unexpected error. Our team has been notified. Please try refreshing the page."
- "Report details" link → opens drawer showing sanitized error info (stack trace if `web.error-boundary-verbose` flag enabled; user ID always hidden unless `compliance.telemetry-pii-export`)
- "Refresh" button → resets error boundary, navigates back to safe page
- "Contact support" link → mailto with ticket info pre-filled

### 6.2 Consent Banner (GDPR)

**Path:** App startup (first load only)  
**Description:**
- Fixed banner at bottom of screen (not sticky; can scroll past)
- Text: "We use telemetry to improve E-CLAT. Help us understand how you use the app? Your data is encrypted in transit and stored per our privacy policy."
- Two buttons: "Accept" (green), "Decline" (gray)
- Link: "Privacy policy" → external docs link
- On click, banner dismisses; choice persisted to localStorage

### 6.3 Telemetry Settings Page (Future)

**Path:** `/me/settings/telemetry` (Phase 2)  
**Description:**
- Card 1: "Telemetry Consent" toggle with current status
- Card 2: "Data Exported" — read-only list of attributes exported (user ID, tenant, role, page, timestamp, etc.)
- Card 3: "Compliance" — link to download all telemetry data collected about this user (GDPR subject access request)
- Card 4: "Export History" — table of when consent changed, by whom, via which method (banner, settings page)

---

## 7. Accessibility Considerations

### 7.1 Error Boundary

- Heading uses semantic `<h1>` with `role="alert"`
- Stack trace wrapper uses `<details>` for progressive disclosure (summary + expandable details)
- All buttons have descriptive `aria-label` values
- Color alone doesn't convey error state; use text + icon

### 7.2 Consent Banner

- Banner is dismissible (focus trap when active, `Escape` key closes)
- Form controls use proper `<label>` association
- Links are underlined and use `:focus-visible` for keyboard users
- Screen reader announces banner as `role="region" aria-label="Telemetry Consent"`

### 7.3 Telemetry Context

- Avoid rendering telemetry controls in disabled state; instead remove them entirely if telemetry is off
- No inline `<script>` tags that could conflict with page `<meta>` tags
- Performance metrics (Web Vitals) are read-only diagnostics; no interactive elements needed

---

## 8. Responsive Design Notes

### 8.1 Error Boundary

- Mobile: Error card takes full viewport width with padding; buttons stack vertically
- Tablet: Error card is 80% width, centered
- Desktop: Error card is 600px max-width, centered with shadow

### 8.2 Consent Banner

- Mobile: Banner takes full screen width at bottom; text wraps, buttons stack or fit side-by-side with smaller padding
- Desktop: Banner is 100% width at bottom with flex row layout for buttons

### 8.3 Telemetry Settings (Future)

- Mobile: Single-column card layout, full width with margin
- Desktop: Card grid up to 2 columns, max 600px per card
- Tables: Use horizontal scroll on mobile, full table on desktop

---

## 9. Phased Rollout

### **Phase 1 (Sprint 7): MVP Telemetry Core**
- Implement TelemetryProvider with OTel browser SDK (npm: `@opentelemetry/sdk-web`)
- Add ErrorBoundary integration → exports React errors
- Add page view / navigation tracking
- Add global error handler (unhandledrejection, error event listeners)
- Feature flag: `compliance.telemetry-enabled` controls whether client initializes
- **No export endpoint yet** — collect in localStorage, export manually for testing
- Tests: Error boundary catches and exports correctly, feature flag gates initialization
- **Status:** Ready to test locally with mock exporter

### **Phase 2 (Sprint 8): Performance & Export**
- Integrate `web-vitals` package for LCP, FID, CLS metrics
- Instrument API client (`api/client.ts`) with automatic HTTP span creation
- Implement OTLP/HTTP exporter → `/api/v1/platform/telemetry/*` endpoints
- Add `compliance.telemetry-pii-export` flag for PII stripping
- Add ConsentManager + GDPR banner at app startup
- Tests: API spans created, Web Vitals captured, PII stripped based on flag
- **Status:** Full telemetry pipeline working end-to-end

### **Phase 3 (Sprint 9): Compliance & UI**
- Build telemetry consent audit endpoint and audit log recording
- Implement Settings page (`/me/settings/telemetry`) for consent management
- Add telemetry dashboard in admin app (view per-user telemetry, compliance status)
- Finalize error boundary UX with "Report details" drawer
- Smoke tests on staging environment with real OTel collector
- **Status:** Production-ready; GDPR compliance validated

### **Phase 4 (v0.6.0+): Alerting & Analytics**
- Integrate with observability platform (e.g., Grafana, DataDog, New Relic)
- Set up alerts for high error rates, slow API routes, Web Vitals degradation
- Build dashboard for product team (feature usage heatmap, flow funnels)
- Incident runbook: "Telemetry shows error spike on template editor" → diagnosis flow
- **Status:** Production observability enabled; team can respond to regressions

---

## 10. Dependencies & Tech Stack

| Dependency | Version | Purpose |
|------------|---------|---------|
| `@opentelemetry/sdk-web` | ^1.20+ | Core OTel browser SDK |
| `@opentelemetry/api` | ^1.8+ | OTel tracing/metrics API |
| `@opentelemetry/exporter-otlp-http` | ^0.48+ | OTLP HTTP exporter (to backend) |
| `@opentelemetry/sdk-trace-web` | ^1.20+ | Web-specific tracer |
| `@opentelemetry/sdk-metrics` | ^0.48+ | Metrics collection |
| `@opentelemetry/instrumentation` | ^0.48+ | Auto-instrumentation base |
| `@opentelemetry/instrumentation-fetch` | ^0.48+ | Auto-instrument fetch/XHR |
| `@opentelemetry/instrumentation-document-load` | ^0.36+ | Auto-instrument page load |
| `web-vitals` | ^4.0+ | Browser performance metrics |
| `react-error-boundary` (optional) | ^4.0+ | Error boundary wrapper (simpler than custom) |

---

## 11. Testing Strategy

### 11.1 Unit Tests

- **Error Boundary:** Verify error is caught, span is created, `recordError` called with correct attributes
- **Telemetry Context:** Mock OTel client, verify tracer/meter methods called correctly
- **Feature Flag Gate:** When flag is false, verify no OTel client is initialized (no-op instead)
- **Consent:** Verify localStorage updated, audit event fired, PII attributes stripped from spans

### 11.2 Integration Tests

- **API Client Instrumentation:** Wrap a real fetch call, verify span has correct HTTP attributes (method, path, status, duration)
- **Page Navigation:** Simulate route change, verify `page_view` event emitted with correct route name
- **Slow Request Detection:** Mock slow API response (>3s), verify span marked as error
- **Consent Flow:** User dismisses banner, verify consent persisted, subsequent spans lack PII

### 11.3 E2E / Smoke Tests (Staging)

- Deploy to staging with real OTel exporter
- Perform user flow (login → dashboard → create template → assign)
- Verify telemetry backend receives all expected spans + metrics
- Check GDPR banner appears; accept/decline persists across session refresh

---

## 12. Rollback Plan

If telemetry exporter is causing client-side errors:

1. Set `compliance.telemetry-enabled` feature flag to `false` in production
2. Clients will initialize no-op telemetry client; page loads unaffected
3. OTel SDK remains in bundle (unused); no need to redeploy
4. Investigate exporter error in logs; fix and re-enable flag when ready

If backend endpoint is overwhelmed:

1. Reduce exporter batch size (config: `maxExportBatchSize: 16` instead of 512)
2. Increase export interval (config: `exportIntervalMillis: 60000` instead of 30000)
3. Temporary: disable `web.api-timing-spans` flag to reduce span volume
4. Scale backend telemetry receiver pods

---

## 13. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Error detection latency | <5 min from crash to alert | Time from error span export to alert fired |
| Telemetry export overhead | <2% page load time | Measure with/without telemetry SDK |
| Feature usage visibility | All 10+ major features tracked | Confirm event emitted for each major user action |
| Consent compliance | 100% of PII exports respect flag | Audit logs show no PII exported when flag=false |
| Error boundary recovery | 90%+ of errors handled gracefully | Count fallback UI renders vs fatal crashes |

---

## 14. Known Limitations & Future Work

1. **localStorage persistence of consent** — future: move to backend user record for better audit trail
2. **No allowlist sampling** — future: implement per-user or per-role sampling thresholds
3. **No alerting rules** — future: define SLOs and thresholds for auto-escalation
4. **No data retention policy** — future: expire old telemetry data per compliance requirement
5. **No offline telemetry** — future: queue spans when offline, export on reconnection
