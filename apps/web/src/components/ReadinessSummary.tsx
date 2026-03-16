export interface ReadinessSummaryData {
  score: number;
  overdueCount: number;
  upcomingExpirationsCount: number;
  statusLabel: string;
  tone: 'healthy' | 'warning' | 'critical';
  unavailable?: boolean;
}

interface ReadinessSummaryProps {
  summary: ReadinessSummaryData;
}

function getToneClass(tone: ReadinessSummaryData['tone']) {
  switch (tone) {
    case 'healthy':
      return 'dashboard-status dashboard-status--healthy';
    case 'warning':
      return 'dashboard-status dashboard-status--warning';
    default:
      return 'dashboard-status dashboard-status--critical';
  }
}

export default function ReadinessSummary({ summary }: ReadinessSummaryProps) {
  const boundedScore = Math.max(0, Math.min(summary.score, 100));

  return (
    <section className="dashboard-panel dashboard-panel--readiness" aria-labelledby="dashboard-readiness-summary">
      <div className="dashboard-panel__header">
        <div>
          <p className="dashboard-panel__eyebrow">At-a-glance status</p>
          <h2 id="dashboard-readiness-summary">Readiness summary</h2>
        </div>
        <span className={getToneClass(summary.tone)}>{summary.statusLabel}</span>
      </div>

      <div className="dashboard-readiness__score-group">
        <div>
          <p className="dashboard-readiness__score">{boundedScore}%</p>
          <p className="dashboard-panel__subtext">Overall readiness</p>
        </div>
        <div className="dashboard-readiness__progress" aria-hidden="true">
          <span style={{ width: `${boundedScore}%` }} />
        </div>
      </div>

      <div className="dashboard-readiness__metrics">
        <div className="dashboard-readiness__metric">
          <span className="dashboard-readiness__metric-label">Overdue items</span>
          <strong>{summary.overdueCount}</strong>
        </div>
        <div className="dashboard-readiness__metric">
          <span className="dashboard-readiness__metric-label">Upcoming expirations</span>
          <strong>{summary.upcomingExpirationsCount}</strong>
        </div>
      </div>

      <p className="dashboard-panel__subtext">
        {summary.unavailable
          ? 'Readiness details are temporarily unavailable. Your workspace shortcuts are still ready.'
          : 'Track overdue work and upcoming renewals before they become blockers.'}
      </p>
    </section>
  );
}
