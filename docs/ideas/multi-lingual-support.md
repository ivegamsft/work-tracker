# Multi-Lingual Support

## Problem

E-CLAT targets regulated industries that operate across borders — healthcare systems with multilingual staff, manufacturing with international contractors, financial services with global compliance teams. Today all UI text, template content, notification messages, and compliance documents are English-only. Organizations with non-English-speaking employees cannot effectively deploy E-CLAT without manual workarounds.

## Proposal

Add first-class internationalization (i18n) and localization (l10n) across the platform — UI, API responses, templates, notifications, documents, and compliance reports.

## Scope

### What Gets Localized

| Layer | What | How |
|-------|------|-----|
| **Web UI** | All labels, buttons, menus, error messages, help text | i18n framework (react-intl or i18next) with JSON locale bundles |
| **API error messages** | Validation errors, business rule violations | Accept-Language header → localized error strings |
| **Notifications** | Email subjects/bodies, in-app alerts, escalation messages | Per-user language preference in profile |
| **Templates** | Template names, descriptions, requirement text | Multi-locale content fields on ProofTemplate |
| **Compliance reports** | Dashboard labels, export headers, PDF reports | Locale-aware report generation |
| **Audit trail** | Event descriptions in audit log | Store canonical (English) + display locale |
| **System enums** | Status labels, role names, proof types, attestation levels | Locale lookup tables |

### What Stays English

| Item | Reason |
|------|--------|
| API field names / JSON keys | Technical contract — no localization |
| Database column names | Schema is developer-facing |
| Log messages (server-side) | Ops/debugging — English standard |
| Code comments | Developer-facing |
| Regulatory standard codes | Industry identifiers (e.g., OSHA 1910.120) are universal |

## Architecture

### Language Resolution Order

1. **User preference** — stored in employee profile (`preferred_locale`)
2. **Tenant default** — configured by tenant admin (`tenant.default_locale`)
3. **Browser/client** — `Accept-Language` header or `navigator.language`
4. **Platform default** — `en-US`

### Locale Data Structure

```yaml
# locales/en-US/common.json
{
  "nav.dashboard": "Dashboard",
  "nav.employees": "Employees",
  "status.compliant": "Compliant",
  "status.expiring_soon": "Expiring Soon",
  "status.non_compliant": "Non-Compliant",
  "action.submit": "Submit",
  "action.approve": "Approve",
  "error.required_field": "{{field}} is required",
  "error.unauthorized": "You do not have permission to perform this action"
}
```

### Template Multi-Locale Content

```typescript
// ProofTemplate extension
interface TemplateLocaleContent {
  locale: string;           // e.g., "es-MX"
  name: string;             // localized template name
  description: string;      // localized description
  body_markdown?: string;   // localized policy/declaration text
  requirement_labels: Record<string, string>; // requirement ID → localized label
}

// On ProofTemplate model
locales: TemplateLocaleContent[];  // array of locale overrides
default_locale: string;            // fallback locale for this template
```

### Notification Localization

```typescript
// Notification rendered per-user
function renderNotification(template: NotificationTemplate, user: Employee): LocalizedNotification {
  const locale = user.preferred_locale ?? tenant.default_locale ?? 'en-US';
  const strings = loadLocaleStrings(locale, 'notifications');
  return {
    subject: interpolate(strings[template.subject_key], template.variables),
    body: interpolate(strings[template.body_key], template.variables),
    locale,
  };
}
```

## Priority Languages

| Tier | Languages | Rationale |
|------|-----------|-----------|
| **Tier 1 (launch)** | English (en-US), Spanish (es-MX, es-ES) | US workforce demographics — ~13% Spanish-speaking |
| **Tier 2 (fast follow)** | French (fr-FR, fr-CA), Portuguese (pt-BR), German (de-DE) | Canada bilingual mandate, Brazil/EU expansion |
| **Tier 3 (demand-driven)** | Chinese (zh-CN), Japanese (ja-JP), Korean (ko-KR), Arabic (ar-SA) | APAC/MENA regulated industries |

## Key Design Decisions Needed

### 1. i18n Framework

- **react-intl (FormatJS)** — ICU message syntax, built-in plurals/dates/numbers, React-native integration
- **i18next + react-i18next** — Plugin ecosystem, namespace support, lazy loading, framework-agnostic
- **Recommendation:** i18next — more flexible, better namespace support for modular architecture, easier to add server-side rendering later

### 2. Translation Management

- **Git-based** — locale JSON files in repo, PRs for translation updates
- **External TMS** — Crowdin, Lokalise, or Phrase connected via CI/CD
- **Hybrid** — developers add English keys, TMS handles translations, CI syncs back
- **Recommendation:** Hybrid. English keys in repo, TMS for professional translations with CI sync.

### 3. RTL Support

Arabic, Hebrew, and other RTL languages need:
- CSS logical properties (`margin-inline-start` instead of `margin-left`)
- `dir="rtl"` on document root
- Mirrored layouts for navigation and tables
- **Recommendation:** Use CSS logical properties from the start (low cost, future-proof). Full RTL layout support in Tier 3.

### 4. Date/Time/Number Formatting

- Use `Intl.DateTimeFormat`, `Intl.NumberFormat` (browser-native, locale-aware)
- Dates displayed in user's locale format (not hardcoded MM/DD/YYYY)
- Currency formatting where applicable
- **Recommendation:** Wrap all formatting in locale-aware helpers from day one.

### 5. Audit Trail Language

- **Option A:** Store events in user's locale (readable but inconsistent across users)
- **Option B:** Store canonical English, render in user's locale at display time
- **Recommendation:** Option B — canonical English in DB, locale-aware rendering. Ensures audit integrity across locales.

## Database Changes

```prisma
model Employee {
  // ... existing fields
  preferred_locale  String?  @default("en-US")
}

model Tenant {
  // ... existing fields
  default_locale    String   @default("en-US")
  supported_locales String[] @default(["en-US"])
}

model TemplateLocale {
  id              String        @id @default(uuid())
  template_id     String
  template        ProofTemplate @relation(fields: [template_id], references: [id])
  locale          String
  name            String
  description     String
  body_markdown   String?
  @@unique([template_id, locale])
}
```

## Implementation Phases

### Phase A — Foundation
- Install i18next + react-i18next
- Create locale directory structure (`locales/{locale}/{namespace}.json`)
- Extract all hardcoded English strings from web app into locale files
- Add `preferred_locale` to Employee model
- Wrap all date/number formatting in locale-aware helpers

### Phase B — API + Notifications
- Accept-Language header parsing middleware
- Localized API error responses
- Per-user notification rendering with locale preference
- Template multi-locale content fields

### Phase C — Content + Reports
- Template builder supports multi-locale content entry
- Compliance reports rendered in requested locale
- PDF export with locale-aware formatting
- Admin UI for managing supported locales per tenant

### Phase D — RTL + Expansion
- CSS logical properties migration
- RTL layout support
- Tier 2 and Tier 3 language packs
- Translation management system integration
