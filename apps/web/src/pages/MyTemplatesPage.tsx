import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageShell from '../components/PageShell';
import MySectionNav, { type MySectionNavItem } from '../components/MySectionNav';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type {
  PaginatedResponse,
  ProofFulfillmentRecord,
  TemplateAssignmentRecord,
} from '../types/my-section';
import { formatDate, getDaysUntil, normalizeKey, toArray, toTitleCase } from './pageHelpers';
import '../styles/my-section.css';
import '../styles/managed-pages.css';
import '../styles/my-templates.css';

const MY_LINKS: MySectionNavItem[] = [
  { to: '/me', label: 'Profile' },
  { to: '/me/qualifications', label: 'Qualifications' },
  { to: '/me/medical', label: 'Medical' },
  { to: '/me/documents', label: 'Documents' },
  { to: '/me/notifications', label: 'Notifications' },
  { to: '/me/hours', label: 'Hours', flag: 'records.hours-ui' },
  { to: '/me/templates', label: 'Templates', flag: 'compliance.templates' },
];

type AssignmentsResponse = TemplateAssignmentRecord[] | PaginatedResponse<TemplateAssignmentRecord>;

interface TemplateAssignmentCard {
  assignment: TemplateAssignmentRecord;
  fulfillments: ProofFulfillmentRecord[];
  completedCount: number;
  pendingReviewCount: number;
  requirementCount: number;
  progress: number;
  statusLabel: string;
  statusClassName: string;
  summary: string;
}

function getTemplateStatus(
  assignment: TemplateAssignmentRecord,
  fulfillments: ProofFulfillmentRecord[],
  completedCount: number,
  pendingReviewCount: number,
  requirementCount: number,
) {
  const normalizedStatuses = fulfillments.map((fulfillment) => normalizeKey(fulfillment.status));
  const dueDays = getDaysUntil(assignment.dueDate);

  if (assignment.completedAt || (requirementCount > 0 && completedCount === requirementCount)) {
    return {
      label: 'Complete',
      className: 'my-badge my-badge--active',
      summary: 'All required proofs are complete.',
    };
  }

  if (!assignment.isActive) {
    return {
      label: 'Inactive',
      className: 'my-badge',
      summary: 'This assignment is no longer active.',
    };
  }

  if (normalizedStatuses.includes('expired') || normalizedStatuses.includes('rejected') || dueDays < 0) {
    return {
      label: 'Needs attention',
      className: 'my-badge my-badge--expired',
      summary: 'One or more proofs need attention before this template can be completed.',
    };
  }

  if (pendingReviewCount > 0) {
    return {
      label: 'Pending review',
      className: 'my-badge my-badge--warning',
      summary: 'Submitted proof is waiting for a reviewer.',
    };
  }

  if (completedCount > 0) {
    return {
      label: 'In progress',
      className: 'my-badge my-badge--warning',
      summary: `${completedCount} of ${requirementCount} requirements are complete.`,
    };
  }

  return {
    label: 'Not started',
    className: 'my-badge',
    summary: 'No proof has been submitted yet.',
  };
}

function buildTemplateCard(
  assignment: TemplateAssignmentRecord,
  fulfillments: ProofFulfillmentRecord[],
): TemplateAssignmentCard {
  const requirementCount = fulfillments.length;
  const completedCount = fulfillments.filter((fulfillment) => normalizeKey(fulfillment.status) === 'fulfilled').length;
  const pendingReviewCount = fulfillments.filter((fulfillment) => normalizeKey(fulfillment.status) === 'pending_review').length;
  const progress = requirementCount === 0 ? 0 : Math.round((completedCount / requirementCount) * 100);
  const status = getTemplateStatus(assignment, fulfillments, completedCount, pendingReviewCount, requirementCount);

  return {
    assignment,
    fulfillments,
    completedCount,
    pendingReviewCount,
    requirementCount,
    progress,
    statusLabel: status.label,
    statusClassName: status.className,
    summary: status.summary,
  };
}

async function getTemplateCards(employeeId: string) {
  const assignmentsResponse = await api.get<AssignmentsResponse>(`/employees/${employeeId}/assignments?page=1&limit=100`);
  const assignments = toArray(assignmentsResponse).filter((assignment) => assignment.isActive);

  const fulfillments = await Promise.all(
    assignments.map((assignment) => api.get<ProofFulfillmentRecord[]>(`/assignments/${assignment.id}/fulfillments`)),
  );

  return assignments.map((assignment, index) => buildTemplateCard(assignment, fulfillments[index] ?? []));
}

function renderTemplateSummary(card: TemplateAssignmentCard) {
  return (
    <>
      <div className="my-page__meta">
        <span className="my-badge">{card.progress}% complete</span>
        <span className="my-badge">{card.requirementCount} requirements</span>
        <span className="my-badge">{card.completedCount} done</span>
      </div>

      <div className="my-templates__progress" aria-label={`${card.assignment.templateName} progress ${card.progress}%`}>
        <span style={{ width: `${card.progress}%` }} />
      </div>

      <div className="managed-page__meta-grid">
        <div className="my-page__field">
          <span className="my-page__field-label">Due date</span>
          <span className="my-page__field-value">{formatDate(card.assignment.dueDate, 'No deadline')}</span>
        </div>
        <div className="my-page__field">
          <span className="my-page__field-label">Status</span>
          <span className={card.statusClassName}>{card.statusLabel}</span>
        </div>
        <div className="my-page__field">
          <span className="my-page__field-label">Pending review</span>
          <span className="my-page__field-value">{card.pendingReviewCount}</span>
        </div>
      </div>

      <p className="my-page__note">{card.summary}</p>
    </>
  );
}

function TemplatesEmptyState() {
  return <div className="my-empty-state">No templates are currently assigned to you.</div>;
}

export function TemplatesFeatureUnavailablePage() {
  return (
    <PageShell
      title="My Templates"
      description="Assigned template workflows are being rolled out gradually."
      breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'My Templates' }]}
    >
      <div className="managed-page my-templates-page">
        <MySectionNav links={MY_LINKS} />
        <section className="my-coming-soon" aria-labelledby="my-templates-coming-soon">
          <div>
            <h2 id="my-templates-coming-soon">Templates are coming soon</h2>
            <p className="my-page__muted">
              Your assigned proof templates are behind a feature flag while the employee fulfillment flow is finalized.
            </p>
          </div>
          <div className="my-page__actions">
            <span className="my-badge my-badge--warning">Feature gated</span>
            <Link to="/standards" className="my-btn my-btn--secondary">
              Open standards library
            </Link>
          </div>
        </section>
      </div>
    </PageShell>
  );
}

export default function MyTemplatesPage() {
  const { user, loading: authLoading } = useAuth();
  const [cards, setCards] = useState<TemplateAssignmentCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    if (authLoading) {
      return () => {
        ignore = true;
      };
    }

    async function fetchTemplates() {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const nextCards = await getTemplateCards(user.id);

        if (!ignore) {
          setCards(nextCards);
          setError('');
        }
      } catch (fetchError) {
        if (!ignore) {
          setCards([]);
          setError(fetchError instanceof Error ? fetchError.message : 'Failed to load your templates');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void fetchTemplates();

    return () => {
      ignore = true;
    };
  }, [authLoading, user]);

  const summary = useMemo(() => {
    const completeCount = cards.filter((card) => card.progress === 100).length;
    const dueSoonCount = cards.filter((card) => {
      const daysUntilDue = getDaysUntil(card.assignment.dueDate);
      return daysUntilDue >= 0 && daysUntilDue <= 14 && card.progress < 100;
    }).length;

    return {
      activeCount: cards.length,
      completeCount,
      dueSoonCount,
    };
  }, [cards]);

  if (authLoading || loading) {
    return (
      <PageShell
        title="My Templates"
        description="Track assigned proof templates and continue outstanding work."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'My Templates' }]}
      >
        <div className="loading">Loading templates...</div>
      </PageShell>
    );
  }

  if (!user) {
    return (
      <PageShell
        title="My Templates"
        description="Track assigned proof templates and continue outstanding work."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'My Templates' }]}
      >
        <div className="my-empty-state">We couldn&apos;t find your employee session.</div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="My Templates"
      description="Track assigned proof templates, monitor progress, and continue outstanding fulfillments."
      breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'My Templates' }]}
      actions={<span className="my-badge my-badge--active">{summary.activeCount} active</span>}
    >
      <div className="managed-page my-templates-page">
        <MySectionNav links={MY_LINKS} />

        {error ? <div className="error">Error: {error}</div> : null}

        <section className="managed-page__summary-grid" aria-label="Template progress summary">
          <div className="my-card managed-page__stat">
            <span className="my-page__field-label">Active templates</span>
            <span className="managed-page__stat-value">{summary.activeCount}</span>
          </div>
          <div className="my-card managed-page__stat">
            <span className="my-page__field-label">Completed</span>
            <span className="managed-page__stat-value">{summary.completeCount}</span>
          </div>
          <div className="my-card managed-page__stat">
            <span className="my-page__field-label">Due soon</span>
            <span className="managed-page__stat-value">{summary.dueSoonCount}</span>
          </div>
        </section>

        {cards.length === 0 ? (
          <TemplatesEmptyState />
        ) : (
          <div className="managed-page__card-grid">
            {cards.map((card) => (
              <Link key={card.assignment.id} to={`/me/templates/${card.assignment.id}`} className="managed-page__card-link">
                <article className="my-card managed-page__clickable-card my-templates__card">
                  <div className="managed-page__section-header">
                    <div className="managed-page__card-title">
                      <span className="my-page__eyebrow">Assigned template</span>
                      <h2>{card.assignment.templateName}</h2>
                    </div>
                    <span className={card.statusClassName}>{card.statusLabel}</span>
                  </div>
                  {renderTemplateSummary(card)}
                </article>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}

export function MyTemplateFulfillmentPage() {
  const { assignmentId = '' } = useParams<{ assignmentId: string }>();
  const { user, loading: authLoading } = useAuth();
  const [assignment, setAssignment] = useState<TemplateAssignmentRecord | null>(null);
  const [fulfillments, setFulfillments] = useState<ProofFulfillmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    if (authLoading) {
      return () => {
        ignore = true;
      };
    }

    async function fetchTemplateDetail() {
      if (!user || !assignmentId) {
        setLoading(false);
        setError('Template assignment identifier is missing.');
        return;
      }

      setLoading(true);

      try {
        const assignmentsResponse = await api.get<AssignmentsResponse>(`/employees/${user.id}/assignments?page=1&limit=100`);
        const assignments = toArray(assignmentsResponse);
        const selectedAssignment = assignments.find((item) => item.id === assignmentId) ?? null;

        if (!selectedAssignment) {
          throw new Error('Template assignment not found.');
        }

        const nextFulfillments = await api.get<ProofFulfillmentRecord[]>(`/assignments/${assignmentId}/fulfillments`);

        if (!ignore) {
          setAssignment(selectedAssignment);
          setFulfillments(nextFulfillments);
          setError('');
        }
      } catch (fetchError) {
        if (!ignore) {
          setAssignment(null);
          setFulfillments([]);
          setError(fetchError instanceof Error ? fetchError.message : 'Failed to load template detail');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void fetchTemplateDetail();

    return () => {
      ignore = true;
    };
  }, [assignmentId, authLoading, user]);

  const card = assignment ? buildTemplateCard(assignment, fulfillments) : null;

  if (authLoading || loading) {
    return (
      <PageShell title="Template Fulfillment" description="Review the proof steps for this template.">
        <div className="loading">Loading template fulfillment...</div>
      </PageShell>
    );
  }

  if (error || !assignment || !card) {
    return (
      <PageShell
        title="Template Fulfillment"
        description="Review the proof steps for this template."
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'My Templates', to: '/me/templates' },
          { label: assignment?.templateName ?? 'Template Fulfillment' },
        ]}
        actions={
          <Link to="/me/templates" className="my-btn my-btn--secondary">
            Back to templates
          </Link>
        }
      >
        <div className="error">Error: {error || 'Template assignment not found.'}</div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={assignment.templateName}
      description="Review each proof requirement and continue the work needed to fulfill this template."
      breadcrumbs={[
        { label: 'Dashboard', to: '/' },
        { label: 'My Templates', to: '/me/templates' },
        { label: assignment.templateName },
      ]}
      actions={
        <Link to="/me/templates" className="my-btn my-btn--secondary">
          Back to templates
        </Link>
      }
    >
      <div className="managed-page my-templates-page">
        <section className="my-card">
          <div className="managed-page__section-header">
            <div className="managed-page__card-title">
              <span className="my-page__eyebrow">Template detail</span>
              <h2>{assignment.templateName}</h2>
            </div>
            <span className={card.statusClassName}>{card.statusLabel}</span>
          </div>
          {renderTemplateSummary(card)}
        </section>

        {fulfillments.length === 0 ? (
          <TemplatesEmptyState />
        ) : (
          <section className="my-card" aria-labelledby="template-fulfillments-list">
            <div>
              <h2 id="template-fulfillments-list">Requirement status</h2>
              <p className="my-page__muted">Each requirement shows its current fulfillment state so you know what to do next.</p>
            </div>
            <div className="managed-page__list">
              {fulfillments.map((fulfillment, index) => (
                <article key={fulfillment.id} className="managed-page__list-item my-templates__requirement-row">
                  <div className="managed-page__list-copy">
                    <strong>{fulfillment.requirement?.name ?? `Requirement ${index + 1}`}</strong>
                    <p>{fulfillment.requirement?.description || 'Proof requirement details will appear here as this flow expands.'}</p>
                  </div>
                  <span className={
                    normalizeKey(fulfillment.status) === 'fulfilled'
                      ? 'my-badge my-badge--active'
                      : normalizeKey(fulfillment.status) === 'pending_review'
                        ? 'my-badge my-badge--warning'
                        : normalizeKey(fulfillment.status) === 'expired' || normalizeKey(fulfillment.status) === 'rejected'
                          ? 'my-badge my-badge--expired'
                          : 'my-badge'
                  }>
                    {toTitleCase(fulfillment.status)}
                  </span>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </PageShell>
  );
}
