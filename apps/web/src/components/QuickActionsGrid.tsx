import { Link } from 'react-router-dom';

export interface QuickActionCard {
  title: string;
  description: string;
  to: string;
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
        {actions.map((action) => (
          <Link key={action.title} to={action.to} className="dashboard-action-card">
            <div className="dashboard-action-card__header">
              <h3>{action.title}</h3>
              <span className="dashboard-action-card__cta">Open</span>
            </div>
            <p>{action.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
