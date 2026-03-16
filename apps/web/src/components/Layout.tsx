import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
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
    { path: '/', label: 'Dashboard' },
    { path: '/me', label: 'My Profile' },
    canAccessTeam ? { path: '/team', label: 'Team' } : null,
    canReviewDocuments ? { path: '/reviews', label: 'Document Review' } : null,
    { path: '/standards', label: 'Standards' },
    { path: '/me/notifications', label: 'Notifications' },
  ].filter((item): item is { path: string; label: string } => item !== null);

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>E-CLAT</h1>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              {item.label}
            </NavLink>
          ))}
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
