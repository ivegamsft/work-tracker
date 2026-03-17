# UI Menu Architecture: Registry-Driven Navigation

**Author:** Daniels (Microservices Engineer)  
**Date:** 2026-03-16  
**Domain:** Frontend Architecture, RBAC, Feature Flags  
**Status:** Design Specification (Pre-Implementation)

---

## Executive Summary

The current navigation in E-CLAT is manually maintained across `Layout.tsx` and `App.tsx`, making it brittle as the application grows across 10+ pages and multiple domains (templates, hours, reviews, dashboard, employees, documents, qualifications, medical, standards, notifications). This specification proposes a **registry-driven menu architecture** where features self-register their routes and menu items, enabling:

- **RBAC-aware rendering** — different menus for EMPLOYEE vs SUPERVISOR vs MANAGER vs ADMIN
- **Feature flag integration** — menu items automatically hidden when features are flagged off
- **Lazy-loaded route groups** — per-domain route registration without monolithic App.tsx
- **Type-safe navigation** — shared TypeScript interfaces for routes, menu items, and domain registration
- **Extensibility** — new domains can register without modifying core Layout or App components

---

## Current State Problems

### 1. **Manual Navigation Maintenance**
- `navItems` array in `Layout.tsx` is hardcoded
- Route definitions scattered across `App.tsx` (40+ routes)
- Adding a new page requires changes to both Layout and App files
- No clear pattern for grouping related routes by domain

### 2. **RBAC Scattered Across Components**
- `useAuth()` hook → extract user role
- `hasMinimumRole()` helper → evaluate access
- Conditional rendering logic mixed with menu layout
- Hard to audit what each role sees

### 3. **Feature Flags Ad-Hoc**
- `FeatureGate` component wraps individual menu items
- Flag names not centralized (e.g., `'compliance.templates'` appears multiple times)
- No guarantee that a feature flag hiding a menu item also hides the route
- No single source of truth for feature-to-route mapping

### 4. **Route Definition Duplication**
- Routes defined in `App.tsx` but menu items replicate similar structure in `Layout.tsx`
- Changing a route path requires updates in two places
- Middleware (ProtectedRoute, FeatureGate) applied inconsistently

---

## Proposed Solution: Registry Pattern

### 1. **Core Concepts**

#### **MenuRegistry**
A centralized object where each domain declares:
- Routes it owns
- Menu items to display
- RBAC requirements (minimum role)
- Feature flags that control visibility

#### **Domain**
A logical grouping of features (e.g., "templates", "hours", "compliance", "records"). Each domain has:
- A registry entry with routes, menu items, and metadata
- A domain-specific provider (optional) for state or context
- Lazy-loaded route definitions (via React Router `lazy()`)

#### **Menu Section**
Groups related menu items for rendering. Examples:
- **My Work** (self-service routes: `/me/*`)
- **Team** (supervisor/manager routes: `/team/*`)
- **Compliance** (audit/compliance routes: `/standards/*`, `/reviews/*`)
- **Administration** (admin-only routes)

---

### 2. **TypeScript Interface Definitions**

```typescript
// types/registry.ts

/**
 * Minimum role required to access a route or menu item.
 * Roles: EMPLOYEE(0) < SUPERVISOR(1) < MANAGER(2) < COMPLIANCE_OFFICER(3) < ADMIN(4)
 */
type MinimumRole = 'employee' | 'supervisor' | 'manager' | 'compliance_officer' | 'admin';

/**
 * A single route definition with metadata.
 */
interface RouteDefinition {
  /** Unique identifier for the route, e.g., 'templates.view' */
  id: string;
  
  /** URL path, e.g., '/me/templates' */
  path: string;
  
  /** React component (lazy-loaded) */
  component: React.LazyExoticComponent<React.ComponentType<any>>;
  
  /** Minimum role to access. Defaults to 'employee'. */
  minRole?: MinimumRole;
  
  /** Feature flag that gates this route. If false, route renders 404. */
  featureFlag?: string;
  
  /** Whether this route appears in the main menu. Defaults to true. */
  showInMenu?: boolean;
}

/**
 * A single menu item (leaf node in the navigation tree).
 */
interface MenuItem {
  /** Unique identifier, e.g., 'templates.my' */
  id: string;
  
  /** Display label, e.g., 'My Templates' */
  label: string;
  
  /** URL path to navigate to */
  path: string;
  
  /** Minimum role to see this menu item. Defaults to 'employee'. */
  minRole?: MinimumRole;
  
  /** Feature flag that controls visibility. */
  featureFlag?: string;
  
  /** Icon name (optional, for future UI enhancement) */
  icon?: string;
  
  /** Badge text for "Coming Soon", "Beta", etc. (optional) */
  badge?: string;
}

/**
 * A grouping of related menu items (e.g., "My Work", "Team", "Compliance").
 */
interface MenuSection {
  /** Unique identifier, e.g., 'my-work' */
  id: string;
  
  /** Display label, e.g., 'My Work' */
  label: string;
  
  /** Menu items in this section */
  items: MenuItem[];
  
  /** Whether to show section header. Defaults to true. */
  showHeader?: boolean;
}

/**
 * Domain registration entry. A domain aggregates routes and menu items.
 */
interface DomainRegistration {
  /** Unique domain identifier, e.g., 'templates', 'hours', 'compliance' */
  id: string;
  
  /** Human-readable domain name */
  name: string;
  
  /** Routes owned by this domain */
  routes: RouteDefinition[];
  
  /** Menu sections to render in the sidebar */
  menuSections: MenuSection[];
}

/**
 * The global menu registry.
 */
interface MenuRegistry {
  /** All domains registered in the application */
  domains: Map<string, DomainRegistration>;
  
  /** Register a new domain */
  register(domain: DomainRegistration): void;
  
  /** Get routes for a specific user role */
  routesForRole(role: MinimumRole): RouteDefinition[];
  
  /** Get menu sections for a specific user role */
  menuForRole(role: MinimumRole): MenuSection[];
  
  /** Get a single route by ID */
  getRoute(routeId: string): RouteDefinition | undefined;
  
  /** Get a single menu item by ID */
  getMenuItem(itemId: string): MenuItem | undefined;
}
```

---

### 3. **Feature Flag Integration**

Feature flags control menu visibility and route access:

```typescript
// hooks/useMenuRegistry.ts

interface UseMenuRegistryOptions {
  userRole: MinimumRole;
  featureFlags: Record<string, boolean>; // { 'compliance.templates': true, ... }
}

function useMenuRegistry({ userRole, featureFlags }: UseMenuRegistryOptions) {
  const registry = useContext(MenuRegistryContext);

  /**
   * Filter menu items by role AND feature flags
   */
  const visibleMenu = useMemo(() => {
    return registry.menuForRole(userRole).map(section => ({
      ...section,
      items: section.items.filter(item => {
        // Check role
        if (item.minRole && !hasMinimumRole(userRole, item.minRole)) {
          return false;
        }
        // Check feature flag
        if (item.featureFlag && !featureFlags[item.featureFlag]) {
          return false;
        }
        return true;
      }),
    })).filter(section => section.items.length > 0); // Remove empty sections
  }, [userRole, featureFlags]);

  /**
   * Filter routes by role AND feature flags
   */
  const visibleRoutes = useMemo(() => {
    return registry.routesForRole(userRole).filter(route => {
      // Check feature flag
      if (route.featureFlag && !featureFlags[route.featureFlag]) {
        return false;
      }
      return true;
    });
  }, [userRole, featureFlags]);

  return {
    visibleMenu,
    visibleRoutes,
    registry,
  };
}
```

---

### 4. **Registry Implementation Pattern**

Each domain creates a **RegistryEntry.ts** file at the module root:

```typescript
// apps/web/src/domains/templates/RegistryEntry.ts

import { lazy } from 'react';
import type { DomainRegistration, MinimumRole } from '../../types/registry';

const MyTemplatesPage = lazy(() => import('./pages/MyTemplatesPage'));
const TemplateLibraryPage = lazy(() => import('./pages/TemplateLibraryPage'));
const TemplateDetailPage = lazy(() => import('./pages/TemplateDetailPage'));

export const templatesRegistry: DomainRegistration = {
  id: 'templates',
  name: 'Templates',

  routes: [
    {
      id: 'templates.my',
      path: '/me/templates',
      component: MyTemplatesPage,
      minRole: 'employee',
      featureFlag: 'compliance.templates',
    },
    {
      id: 'templates.library',
      path: '/team/templates',
      component: TemplateLibraryPage,
      minRole: 'supervisor',
      featureFlag: 'compliance.templates',
    },
    {
      id: 'templates.detail',
      path: '/templates/:id',
      component: TemplateDetailPage,
      minRole: 'supervisor',
      featureFlag: 'compliance.templates',
      showInMenu: false,
    },
  ],

  menuSections: [
    {
      id: 'templates',
      label: 'Templates',
      items: [
        {
          id: 'templates.my',
          label: 'My Templates',
          path: '/me/templates',
          minRole: 'employee',
          featureFlag: 'compliance.templates',
        },
        {
          id: 'templates.library',
          label: 'Team Templates',
          path: '/team/templates',
          minRole: 'supervisor',
          featureFlag: 'compliance.templates',
        },
      ],
    },
  ],
};
```

---

### 5. **Root-Level Registry Initialization**

Create a central registry context and provider:

```typescript
// contexts/MenuRegistryContext.ts

import { createContext, useMemo, ReactNode } from 'react';
import type { MenuRegistry, DomainRegistration } from '../types/registry';

// Placeholder implementation for MenuRegistry
class MenuRegistryImpl implements MenuRegistry {
  domains = new Map<string, DomainRegistration>();

  register(domain: DomainRegistration) {
    this.domains.set(domain.id, domain);
  }

  routesForRole(role: string) {
    const routes: any[] = [];
    for (const domain of this.domains.values()) {
      routes.push(...domain.routes);
    }
    return routes;
  }

  menuForRole(role: string) {
    const sections: any[] = [];
    for (const domain of this.domains.values()) {
      sections.push(...domain.menuSections);
    }
    return sections;
  }

  getRoute(routeId: string) {
    for (const domain of this.domains.values()) {
      const route = domain.routes.find(r => r.id === routeId);
      if (route) return route;
    }
    return undefined;
  }

  getMenuItem(itemId: string) {
    for (const domain of this.domains.values()) {
      for (const section of domain.menuSections) {
        const item = section.items.find(i => i.id === itemId);
        if (item) return item;
      }
    }
    return undefined;
  }
}

export const MenuRegistryContext = createContext<MenuRegistry>(new MenuRegistryImpl());

interface MenuRegistryProviderProps {
  domains: DomainRegistration[];
  children: ReactNode;
}

export function MenuRegistryProvider({ domains, children }: MenuRegistryProviderProps) {
  const registry = useMemo(() => {
    const reg = new MenuRegistryImpl();
    for (const domain of domains) {
      reg.register(domain);
    }
    return reg;
  }, [domains]);

  return (
    <MenuRegistryContext.Provider value={registry}>
      {children}
    </MenuRegistryContext.Provider>
  );
}
```

---

### 6. **Refactored Layout Component**

```typescript
// components/Layout.tsx

import { Suspense, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useMenuRegistry } from '../hooks/useMenuRegistry';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import '../styles/layout.css';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const { flags } = useFeatureFlags();
  const { visibleMenu } = useMenuRegistry({
    userRole: user?.role || 'employee',
    featureFlags: flags,
  });

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>E-CLAT</h1>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" className={({ isActive }) => (isActive ? 'active' : '')}>
            Dashboard
          </NavLink>
          <NavLink to="/me" className={({ isActive }) => (isActive ? 'active' : '')}>
            My Profile
          </NavLink>

          {visibleMenu.map(section => (
            <div key={section.id} className="menu-section">
              {section.showHeader !== false && (
                <h3 className="menu-section-header">{section.label}</h3>
              )}
              {section.items.map(item => (
                <div key={item.id} className="menu-item-wrapper">
                  <NavLink to={item.path} className={({ isActive }) => (isActive ? 'active' : '')}>
                    {item.label}
                  </NavLink>
                  {item.badge && <span className="menu-badge">{item.badge}</span>}
                </div>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="main-container">
        <header className="header">
          <div className="header-content">
            <div className="header-title">Employee Compliance and Lifecycle Activity Tracker</div>
            <div className="header-user">
              <span className="user-info">
                {user?.name} ({user?.role})
              </span>
              <button onClick={logout} className="logout-btn">
                Logout
              </button>
            </div>
          </div>
        </header>

        <main className="main-content">
          <Suspense fallback={<div>Loading...</div>}>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
```

---

### 7. **Refactored App Router**

```typescript
// App.tsx

import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { MenuRegistryProvider } from './contexts/MenuRegistryContext';
import { FeatureFlagsProvider } from './hooks/useFeatureFlags';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';

// Domain registrations
import { templatesRegistry } from './domains/templates/RegistryEntry';
import { hoursRegistry } from './domains/hours/RegistryEntry';
import { complianceRegistry } from './domains/compliance/RegistryEntry';
// ... more domains

// Placeholder 404 component
const NotFoundPage = () => <div>404 - Not Found</div>;

function App() {
  const allDomains = [
    templatesRegistry,
    hoursRegistry,
    complianceRegistry,
    // ... more domains
  ];

  return (
    <AuthProvider>
      <FeatureFlagsProvider>
        <MenuRegistryProvider domains={allDomains}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Routes>
                      {/* Routes from registry */}
                      {allDomains.flatMap(domain =>
                        domain.routes.map(route => (
                          <Route
                            key={route.id}
                            path={route.path}
                            element={
                              <Suspense fallback={<div>Loading...</div>}>
                                <route.component />
                              </Suspense>
                            }
                          />
                        )),
                      )}

                      {/* Fallback */}
                      <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MenuRegistryProvider>
      </FeatureFlagsProvider>
    </AuthProvider>
  );
}

export default App;
```

---

## Menu Structure Proposal

The proposed menu is organized into **4 sections** with different role visibility:

```
┌─ Dashboard (all roles)
├─ My Work (EMPLOYEE+)
│  ├─ My Profile
│  ├─ My Templates (flag: compliance.templates)
│  ├─ My Qualifications
│  ├─ My Medical
│  ├─ My Hours
│  ├─ My Documents
│  └─ My Notifications
├─ Team (SUPERVISOR+)
│  ├─ Team Directory
│  ├─ Team Templates (flag: compliance.templates)
│  ├─ Team Hours
│  ├─ Team Medical
│  ├─ Team Qualifications
│  └─ Team Documents
├─ Compliance (SUPERVISOR+)
│  ├─ Standards Library
│  ├─ Document Review Queue
│  └─ Fulfillment Reviews
└─ Administration (ADMIN)
   ├─ Manage Users
   ├─ System Settings
   └─ Audit Logs
```

**Section Logic:**
- "My Work" shows only EMPLOYEE-accessible routes
- "Team" shows only routes where `minRole >= SUPERVISOR`
- "Compliance" shows compliance/audit workflows
- "Administration" shows admin-only routes (not yet in scope)

---

## Migration Path: Manual → Registry

### **Phase 1: Establish Registry Infrastructure**
1. Create `types/registry.ts` with all interfaces
2. Create `contexts/MenuRegistryContext.tsx` with provider
3. Create `hooks/useMenuRegistry.ts` with filtering logic
4. Add `MenuRegistryProvider` to root App without removing old navigation

### **Phase 2: Migrate Domains (One at a Time)**
For each domain (starting with **templates**, then **hours**, etc.):
1. Create `domains/{domain}/RegistryEntry.ts` with routes and menu items
2. Register domain in `App.tsx` (can coexist with old routes initially)
3. Test new routes and menu items in isolation
4. Remove old route definitions from `App.tsx`
5. Remove old menu items from `Layout.tsx`

### **Phase 3: Cleanup**
1. Remove hardcoded `navItems` array from `Layout.tsx`
2. Remove `FeatureGate` wrapper logic (now in registry filtering)
3. Remove inline route definitions from `App.tsx`
4. Update tests to mock MenuRegistry instead of Layout props

### **Phase 4: Validation & Testing**
- **Audit tests:** Verify each role sees correct menu items
- **Feature flag tests:** Verify menu/routes hide when flag is off
- **Route tests:** Verify all routes are accessible via menu
- **Accessibility:** Verify keyboard navigation works through registry-driven menu

---

## Benefits

| Aspect | Current | Registry-Driven |
|--------|---------|-----------------|
| **Adding a page** | Edit Layout.tsx + App.tsx | Just add RegistryEntry to domain |
| **RBAC logic** | Scattered in multiple places | Centralized in useMenuRegistry hook |
| **Feature flags** | Manual FeatureGate wrappers | Automatic via registry filtering |
| **Menu-route parity** | Must update both independently | Single source of truth (RegistryEntry) |
| **Testing menu** | Mock Layout props | Mock MenuRegistry context |
| **Auditing access** | Query multiple files | Single menuForRole(role) call |

---

## Technical Considerations

### **1. Lazy Loading**
- All page components wrapped with `React.lazy()` in RegistryEntry
- Reduces initial bundle size
- Suspense boundary in Layout or route level

### **2. Type Safety**
- MenuRegistry is fully typed with TypeScript interfaces
- Route IDs are unique across all domains
- MenuItem IDs scoped per section to avoid collisions

### **3. Feature Flags**
- Flags stored in `FeatureFlags` context
- No external flag service initially (repo-backed + env overrides per learning #36)
- Menu and routes filtered consistently

### **4. RBAC Hierarchy**
- Roles are numeric: `EMPLOYEE(0) < SUPERVISOR(1) < MANAGER(2) < COMPLIANCE_OFFICER(3) < ADMIN(4)`
- `hasMinimumRole(actualRole, requiredRole)` checks: `actualRoleValue >= requiredRoleValue`
- Inherited from `@e-clat/shared` package

### **5. Performance**
- MenuRegistry uses `useMemo` to avoid recalculating visible items on every render
- Feature flag changes trigger recomputation (minimal, shallow objects)
- Route rendering deferred via Suspense + lazy()

---

## Future Enhancements

1. **Dynamic menu ordering** — Support sort order per role
2. **Icons & badges** — Enhance MenuItem with icon field (e.g., for sidebar icons)
3. **Nested sections** — Support collapsible menu groups
4. **Breadcrumbs** — Derive from route hierarchy
5. **Analytics** — Track menu clicks via registry IDs
6. **Multi-tenant** — Tenant-specific menu registration
7. **Admin UI** — UI to dynamically enable/disable domains and menu sections

---

## References

- **Current Layout:** `apps/web/src/components/Layout.tsx`
- **Current Router:** `apps/web/src/App.tsx`
- **RBAC Types:** `packages/shared/src/types/rbac.ts`
- **Feature Flags Hook:** `apps/web/src/hooks/useFeatureFlags.ts`
- **Compliance Note:** Audit trail required for all navigation changes per regulated-industry guardrails

---

## Sign-Off

This specification establishes the interface contracts and migration strategy for registry-driven UI navigation. Implementation will proceed domain-by-domain in Phase 2, with full adoption expected by v0.5.0.

**Next:** Implementation PR will include Phase 1 infrastructure + templates domain migration as proof-of-concept.
