import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import '../styles/page-shell.css';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

export interface TabItem {
  label: string;
  to: string;
  end?: boolean;
}

interface PageShellProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  tabs?: TabItem[];
  actions?: ReactNode;
  children: ReactNode;
}

export default function PageShell({
  title,
  description,
  breadcrumbs = [],
  tabs = [],
  actions,
  children,
}: PageShellProps) {
  return (
    <div className="page-shell">
      {breadcrumbs.length > 0 && (
        <nav className="page-shell__breadcrumbs" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;

            return (
              <span key={`${crumb.label}-${index}`} className="page-shell__breadcrumb-item">
                {crumb.to && !isLast ? <Link to={crumb.to}>{crumb.label}</Link> : <span>{crumb.label}</span>}
                {!isLast && <span className="page-shell__breadcrumb-separator">&gt;</span>}
              </span>
            );
          })}
        </nav>
      )}

      <div className="page-shell__header">
        <div>
          <h1>{title}</h1>
          {description ? <p className="page-shell__description">{description}</p> : null}
        </div>
        {actions ? <div className="page-shell__actions">{actions}</div> : null}
      </div>

      {tabs.length > 0 && (
        <nav className="page-shell__tabs" aria-label={`${title} sections`}>
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                isActive ? 'page-shell__tab page-shell__tab--active' : 'page-shell__tab'
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      )}

      <div className="page-shell__content">{children}</div>
    </div>
  );
}
