import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import FeatureGate from './FeatureGate';
import { hasMinimumRole } from '../rbac';
import '../styles/layout.css';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const canAccessTeam = hasMinimumRole(user?.role, 'supervisor');
  const canReviewDocuments = hasMinimumRole(user?.role, 'manager');

  const navItems = [
    canAccessTeam ? { path: '/team', label: 'Team' } : null,
    canAccessTeam ? { path: '/team/templates', label: 'Team Templates', flag: 'compliance.templates' } : null,
    canReviewDocuments ? { path: '/reviews', label: 'Document Review' } : null,
    { path: '/standards', label: 'Standards' },
    { path: '/me/notifications', label: 'Notifications' },
  ].filter((item): item is { path: string; label: string; flag?: string } => item !== null);

  const renderNavLink = (path: string, label: string) => (
    <NavLink key={path} to={path} end={path === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
      {label}
    </NavLink>
  );

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>E-CLAT</h1>
        </div>
        <nav className="sidebar-nav">
          {renderNavLink('/', 'Dashboard')}
          {renderNavLink('/me', 'My Profile')}
          <FeatureGate
            flag="compliance.templates"
            fallback={
              <span className="sidebar-nav__item sidebar-nav__item--disabled">
                <span>My Templates</span>
                <span className="sidebar-nav__badge">Coming soon</span>
              </span>
            }
          >
            {renderNavLink('/me/templates', 'My Templates')}
          </FeatureGate>
          {navItems.map((item) =>
            item.flag ? (
              <FeatureGate key={item.path} flag={item.flag} fallback={null}>
                {renderNavLink(item.path, item.label)}
              </FeatureGate>
            ) : (
              renderNavLink(item.path, item.label)
            ),
          )}
        </nav>
      </aside>

      <div className="main-container">
        <header className="header">
          <div className="header-content">
            <div className="header-title">
              Employee Compliance and Lifecycle Activity Tracker
            </div>
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

        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
