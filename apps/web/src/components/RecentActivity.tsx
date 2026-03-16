import { Link } from 'react-router-dom';

export interface DashboardActivityItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  statusLabel: string;
  tone: 'default' | 'warning' | 'critical';
  to?: string;
}

interface RecentActivityProps {
  items: DashboardActivityItem[];
  unavailable?: boolean;
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown time' : date.toLocaleString();
}

function getToneClass(tone: DashboardActivityItem['tone']) {
  switch (tone) {
    case 'warning':
      return 'dashboard-status dashboard-status--warning';
    case 'critical':
      return 'dashboard-status dashboard-status--critical';
    default:
      return 'dashboard-status dashboard-status--neutral';
  }
}

export default function RecentActivity({ items, unavailable = false }: RecentActivityProps) {
  return (
    <section className="dashboard-panel" aria-labelledby="dashboard-recent-activity">
      <div className="dashboard-panel__header">
        <div>
          <p className="dashboard-panel__eyebrow">Last 5 updates</p>
          <h2 id="dashboard-recent-activity">Recent activity</h2>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="dashboard-panel__subtext">
          {unavailable ? 'Recent activity is temporarily unavailable.' : 'You are all caught up. New activity will appear here.'}
        </p>
      ) : (
        <ol className="dashboard-activity-list">
          {items.map((item) => {
            const heading = item.to ? (
              <Link to={item.to} className="dashboard-activity-list__title">
                {item.title}
              </Link>
            ) : (
              <span className="dashboard-activity-list__title">{item.title}</span>
            );

            return (
              <li key={item.id} className="dashboard-activity-list__item">
                <div className="dashboard-activity-list__content">
                  <div className="dashboard-activity-list__header">
                    {heading}
                    <span className={getToneClass(item.tone)}>{item.statusLabel}</span>
                  </div>
                  <p>{item.description}</p>
                </div>
                <time className="dashboard-activity-list__time" dateTime={item.timestamp}>
                  {formatTimestamp(item.timestamp)}
                </time>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
