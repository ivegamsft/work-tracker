export type StatTone = 'healthy' | 'warning' | 'critical' | 'neutral';

export interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  tone?: StatTone;
}

function getToneClass(tone: StatTone) {
  switch (tone) {
    case 'healthy':
      return 'mgr-stat-card mgr-stat-card--healthy';
    case 'warning':
      return 'mgr-stat-card mgr-stat-card--warning';
    case 'critical':
      return 'mgr-stat-card mgr-stat-card--critical';
    default:
      return 'mgr-stat-card mgr-stat-card--neutral';
  }
}

export default function StatCard({ label, value, subtitle, tone = 'neutral' }: StatCardProps) {
  return (
    <div className={getToneClass(tone)} role="group" aria-label={label}>
      <span className="mgr-stat-card__label">{label}</span>
      <strong className="mgr-stat-card__value">{value}</strong>
      {subtitle ? <span className="mgr-stat-card__subtitle">{subtitle}</span> : null}
    </div>
  );
}
