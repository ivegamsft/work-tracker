import { useEffect, useMemo, useState } from 'react';
import PageShell from '../components/PageShell';
import QuickActionsGrid, { type QuickActionCard } from '../components/QuickActionsGrid';
import ReadinessSummary from '../components/ReadinessSummary';
import RecentActivity, { type DashboardActivityItem } from '../components/RecentActivity';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { normalizeRole, type AppRole } from '../rbac';
import type {
  ComplianceStatus,
  MedicalReadinessItem,
  MyNotification,
  PaginatedResponse,
  Readiness,
  ReadinessItem,
} from '../types/my-section';
import { getDaysUntil, normalizeKey, toTitleCase } from './pageHelpers';
import '../styles/dashboard.css';

type QuickActionDefinition = QuickActionCard & {
  flag?: string;
  disabledDescription?: string;
};

const QUICK_ACTIONS: Record<AppRole, QuickActionDefinition[]> = {
  employee: [
    {
      title: 'Clock In',
      description: 'Jump into your hours workspace to review shifts and prepare for time tracking.',
      to: '/me/hours',
      flag: 'records.hours-ui',
      disabledDescription: 'Hours tracking is still rolling out. We will unlock this workspace soon.',
    },
    {
      title: 'Upload Document',
      description: 'Submit new document metadata and keep your profile evidence current.',
      to: '/me/documents',
    },
    {
      title: 'View My Qualifications',
      description: 'Check assigned qualifications, renewal timing, and evidence coverage.',
      to: '/me/qualifications',
    },
    {
      title: 'My Templates',
      description: 'Open your assigned templates to track proof progress and continue outstanding work.',
      to: '/me/templates',
      flag: 'compliance.templates',
      disabledDescription: 'Assigned templates are being staged behind a feature flag and will land soon.',
    },
  ],
  supervisor: [
    {
      title: 'View Team',
      description: 'Open the team directory to review employee status and drill into details.',
      to: '/team',
    },
    {
      title: 'Add Qualification',
      description: 'Start from the team workspace to assign or update qualifications for staff.',
      to: '/team',
    },
    {
      title: 'Team Templates',
      description: 'Monitor team assignment progress and compliance status across your reports.',
      to: '/team/templates',
      flag: 'compliance.templates',
      disabledDescription: 'Template assignment workflows are still being staged for supervisors.',
    },
  ],
  manager: [
    {
      title: 'Review Documents',
      description: 'Open the review queue and move submitted documents toward approval.',
      to: '/reviews',
    },
    {
      title: 'Resolve Conflicts',
      description: 'Check recent notifications and unblock conflicting readiness or review items.',
      to: '/me/notifications',
    },
    {
      title: 'Manager Dashboard',
      description: 'Use the team workspace to monitor staffing readiness and ownership.',
      to: '/team',
    },
  ],
  compliance_officer: [
    {
      title: 'Compliance Overview',
      description: 'Review active standards and requirement coverage across the organization.',
      to: '/standards',
    },
    {
      title: 'Export Report',
      description: 'Open the review workspace to gather the latest compliance evidence before export.',
      to: '/reviews',
    },
    {
      title: 'Audit Log',
      description: 'Use recent notifications as your audit trail for alerts, conflicts, and review work.',
      to: '/me/notifications',
    },
  ],
  admin: [
    {
      title: 'Compliance Overview',
      description: 'Review active standards and requirement coverage across the organization.',
      to: '/standards',
    },
    {
      title: 'Export Report',
      description: 'Open the review workspace to gather the latest compliance evidence before export.',
      to: '/reviews',
    },
    {
      title: 'Audit Log',
      description: 'Use recent notifications as your audit trail for alerts, conflicts, and review work.',
      to: '/me/notifications',
    },
  ],
};

const ROLE_COPY: Record<AppRole, string> = {
  employee: 'Your workspace keeps daily tasks, readiness health, and recent updates in one place.',
  supervisor: 'Support your team from one workspace with shortcuts, readiness insight, and recent activity.',
  manager: 'Focus on document throughput, conflict resolution, and team health from a single workspace.',
  compliance_officer: 'Monitor standards, export-ready work, and audit activity without leaving the dashboard.',
  admin: 'Keep high-level compliance work, audit signals, and review shortcuts in a single workspace.',
};

type NotificationsResponse = MyNotification[] | PaginatedResponse<MyNotification>;

function formatRoleLabel(role: AppRole) {
  return role
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function normalizeNotifications(response: NotificationsResponse) {
  return Array.isArray(response) ? response : response.data;
}

function applyFeatureFlags(actions: QuickActionDefinition[], flags: Record<string, boolean>): QuickActionCard[] {
  return actions.map((action) => {
    if (!action.flag || flags[action.flag]) {
      return action;
    }

    return {
      ...action,
      description: action.disabledDescription ?? action.description,
      disabled: true,
      badgeText: 'Coming soon',
      to: undefined,
    };
  });
}

function mapQualificationReadinessStatus(item: ReadinessItem): ComplianceStatus {
  if (item.readinessStatus) {
    return item.readinessStatus;
  }

  const normalizedStatus = normalizeKey(item.status);

  if (normalizedStatus === 'active' || normalizedStatus === 'compliant') {
    return 'compliant';
  }

  if (normalizedStatus === 'expiring_soon' || normalizedStatus === 'at_risk' || normalizedStatus === 'pending_review') {
    return 'at_risk';
  }

  return 'non_compliant';
}

function mapMedicalReadinessStatus(item: MedicalReadinessItem): ComplianceStatus {
  if (item.readinessStatus) {
    return item.readinessStatus;
  }

  return normalizeKey(item.status) === 'cleared' ? 'compliant' : 'non_compliant';
}

function getSummaryTone(status: ComplianceStatus | null) {
  switch (status) {
    case 'compliant':
      return 'healthy' as const;
    case 'at_risk':
      return 'warning' as const;
    default:
      return 'critical' as const;
  }
}

function buildReadinessSummary(readiness: Readiness | null, unavailable: boolean) {
  if (!readiness) {
    return {
      score: 0,
      overdueCount: 0,
      upcomingExpirationsCount: 0,
      statusLabel: unavailable ? 'Unavailable' : 'No data',
      tone: 'warning' as const,
      unavailable,
    };
  }

  const weights: Record<ComplianceStatus, number> = {
    compliant: 100,
    at_risk: 50,
    non_compliant: 0,
  };

  const qualificationItems = readiness.qualifications.map((item) => ({
    status: mapQualificationReadinessStatus(item),
    expiresAt: item.expiresAt ?? item.expirationDate ?? null,
  }));

  const medicalItems = readiness.medicalClearances?.length
    ? readiness.medicalClearances.map((item) => ({
        status: mapMedicalReadinessStatus(item),
        expiresAt: item.expirationDate ?? null,
      }))
    : readiness.medicalStatus
      ? [
          {
            status: readiness.medicalStatus,
            expiresAt: readiness.medicalExpiresAt ?? null,
          },
        ]
      : [];

  const trackedItems = [...qualificationItems, ...medicalItems];
  const totalWeight = trackedItems.reduce((sum, item) => sum + weights[item.status], 0);
  const score = trackedItems.length === 0 ? 0 : Math.round(totalWeight / trackedItems.length);
  const overdueCount = trackedItems.filter((item) => item.status === 'non_compliant' || getDaysUntil(item.expiresAt) < 0).length;
  const upcomingExpirationsCount = trackedItems.filter((item) => {
    const daysUntil = getDaysUntil(item.expiresAt);
    return daysUntil >= 0 && daysUntil <= 30;
  }).length;

  return {
    score,
    overdueCount,
    upcomingExpirationsCount,
    statusLabel: toTitleCase(readiness.overallStatus),
    tone: getSummaryTone(readiness.overallStatus),
    unavailable,
  };
}

function isReadNotification(notification: MyNotification) {
  return notification.read ?? (normalizeKey(notification.status) === 'read' || Boolean(notification.readAt));
}

function getActivityTone(notification: MyNotification, read: boolean) {
  const normalizedType = normalizeKey(notification.type);

  if (normalizedType.includes('overdue') || normalizedType.includes('conflict') || normalizedType.includes('rejected')) {
    return 'critical' as const;
  }

  if (!read || normalizedType.includes('review') || normalizedType.includes('expiring')) {
    return 'warning' as const;
  }

  return 'default' as const;
}

function buildRecentActivity(notifications: MyNotification[]): DashboardActivityItem[] {
  return notifications
    .map((notification) => {
      const read = isReadNotification(notification);
      const actionUrl = notification.actionUrl ?? undefined;

      return {
        id: notification.id,
        title: toTitleCase(notification.type, 'Activity update'),
        description: notification.message || notification.title || 'New workspace activity is available.',
        timestamp: notification.createdAt,
        statusLabel: read ? 'Read' : 'Needs attention',
        tone: getActivityTone(notification, read),
        to: actionUrl?.startsWith('/') ? actionUrl : undefined,
      };
    })
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
    .slice(0, 5);
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { flags } = useFeatureFlags();
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [notifications, setNotifications] = useState<MyNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [readinessUnavailable, setReadinessUnavailable] = useState(false);
  const [activityUnavailable, setActivityUnavailable] = useState(false);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    let ignore = false;

    async function fetchDashboardData() {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);

      const [readinessResult, notificationsResult] = await Promise.allSettled([
        api.get<Readiness>(`/employees/${user.id}/readiness`),
        api.get<NotificationsResponse>('/notifications'),
      ]);

      if (ignore) {
        return;
      }

      if (readinessResult.status === 'fulfilled') {
        setReadiness(readinessResult.value);
        setReadinessUnavailable(false);
      } else {
        setReadiness(null);
        setReadinessUnavailable(true);
      }

      if (notificationsResult.status === 'fulfilled') {
        setNotifications(normalizeNotifications(notificationsResult.value));
        setActivityUnavailable(false);
      } else {
        setNotifications([]);
        setActivityUnavailable(true);
      }

      setError(
        readinessResult.status === 'rejected' && notificationsResult.status === 'rejected'
          ? 'Dashboard insights are temporarily unavailable.'
          : '',
      );
      setLoading(false);
    }

    void fetchDashboardData();

    return () => {
      ignore = true;
    };
  }, [authLoading, user]);

  const workspaceRole = normalizeRole(user?.role) ?? 'employee';
  const roleLabel = formatRoleLabel(workspaceRole);
  const quickActions = applyFeatureFlags(QUICK_ACTIONS[workspaceRole] ?? QUICK_ACTIONS.employee, flags);
  const readinessSummary = useMemo(
    () => buildReadinessSummary(readiness, readinessUnavailable),
    [readiness, readinessUnavailable],
  );
  const recentActivity = useMemo(() => buildRecentActivity(notifications), [notifications]);

  if (authLoading || loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  if (!user) {
    return (
      <PageShell title="Dashboard" description="Your workspace is unavailable right now.">
        <div className="dashboard-empty-state">We couldn&apos;t find a signed-in user session.</div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={`Welcome back, ${user.name}`}
      description={ROLE_COPY[workspaceRole]}
      actions={<span className="dashboard-role-badge">{roleLabel} workspace</span>}
    >
      <div className="dashboard-workspace">
        {error ? (
          <div className="dashboard-inline-notice" role="status">
            {error}
          </div>
        ) : null}

        <section className="dashboard-hero" aria-labelledby="dashboard-hero-title">
          <div>
            <p className="dashboard-hero__eyebrow">{roleLabel} workspace</p>
            <h2 id="dashboard-hero-title" className="dashboard-hero__title">
              Everything you need to move work forward
            </h2>
            <p className="dashboard-hero__description">
              Launch into the right workflow, scan readiness at a glance, and keep recent activity within reach on any device.
            </p>
          </div>

          <div className="dashboard-hero__highlights" aria-label="Workspace snapshot">
            <div className="dashboard-hero__highlight">
              <span className="dashboard-hero__highlight-label">Quick actions</span>
              <strong>{quickActions.filter((action) => !action.disabled).length}</strong>
            </div>
            <div className="dashboard-hero__highlight">
              <span className="dashboard-hero__highlight-label">Readiness score</span>
              <strong>{readinessSummary.score}%</strong>
            </div>
            <div className="dashboard-hero__highlight">
              <span className="dashboard-hero__highlight-label">Needs attention</span>
              <strong>{readinessSummary.overdueCount}</strong>
            </div>
          </div>
        </section>

        <QuickActionsGrid actions={quickActions} roleLabel={roleLabel} />

        <div className="dashboard-workspace__columns">
          <ReadinessSummary summary={readinessSummary} />
          <RecentActivity items={recentActivity} unavailable={activityUnavailable} />
        </div>
      </div>
    </PageShell>
  );
}
