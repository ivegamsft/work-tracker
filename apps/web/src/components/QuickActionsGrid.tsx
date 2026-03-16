import { Link } from 'react-router-dom';

export interface QuickActionCard {
  title: string;
  description: string;
  to?: string;
  disabled?: boolean;
  badgeText?: string;
}

interface QuickActionsGridProps {
  actions: QuickActionCard[];
  roleLabel: string;
}

export default function QuickActionsGrid({ actions, roleLabel }: QuickActionsGridProps) {
  return (
    <section className="dashboard-panel" aria-labelledby="dashboard-quick-actions">
      <div className="dashboard-panel__header">
        <div>
          <p className="dashboard-panel__eyebrow">Workspace shortcuts</p>
          <h2 id="dashboard-quick-actions">Quick actions</h2>
        </div>
        <span className="dashboard-panel__meta">{roleLabel} workflow</span>
      </div>
      <div className="dashboard-actions-grid">
        {actions.map((action) => {
          if (action.disabled || !action.to) {
            return (
              <article key={action.title} className="dashboard-action-card dashboard-action-card--disabled">
                <div className="dashboard-action-card__header">
                  <div className="dashboard-action-card__title-block">
                    <h3>{action.title}</h3>
                    {action.badgeText ? <span className="dashboard-action-card__badge">{action.badgeText}</span> : null}
                  </div>
                  <span className="dashboard-action-card__cta">Soon</span>
                </div>
                <p>{action.description}</p>
              </article>
            );
          }

          return (
            <Link key={action.title} to={action.to} className="dashboard-action-card">
              <div className="dashboard-action-card__header">
                <h3>{action.title}</h3>
                <span className="dashboard-action-card__cta">Open</span>
              </div>
              <p>{action.description}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
