import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import PageShell from '../components/PageShell';
import TemplateRequirementPanel from '../components/templates/TemplateRequirementPanel';
import TemplateStatusBadge from '../components/templates/TemplateStatusBadge';
import {
  formatTemplateProofType,
  getPrimaryProofType,
  sortTemplateRequirements,
} from '../components/templates/templateUtils';
import { useAuth } from '../contexts/AuthContext';
import { hasMinimumRole } from '../rbac';
import type { AssignTemplateResult, ProofTemplateRecord, TemplateAssignmentEmployeeRecord } from '../types/templates';
import type { PaginatedResponse } from '../types/my-section';
import { formatDate, toArray } from './pageHelpers';
import '../styles/my-section.css';
import '../styles/managed-pages.css';
import '../styles/template-screens.css';

type AssignmentHistoryResponse = TemplateAssignmentEmployeeRecord[] | PaginatedResponse<TemplateAssignmentEmployeeRecord>;

export default function TemplateDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [template, setTemplate] = useState<ProofTemplateRecord | null>(null);
  const [assignmentHistory, setAssignmentHistory] = useState<TemplateAssignmentEmployeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function fetchTemplate() {
      setLoading(true);

      try {
        const [templateResponse, assignmentsResponse] = await Promise.all([
          api.get<ProofTemplateRecord>(`/templates/${id}`),
          hasMinimumRole(user?.role, 'supervisor')
            ? api.get<AssignmentHistoryResponse>(`/templates/${id}/assignments?page=1&limit=50`)
                .catch(() => [] as TemplateAssignmentEmployeeRecord[])
            : Promise.resolve([] as TemplateAssignmentEmployeeRecord[]),
        ]);

        if (!ignore) {
          setTemplate(templateResponse);
          setAssignmentHistory(toArray(assignmentsResponse as AssignmentHistoryResponse));
          setError('');
        }
      } catch (fetchError) {
        if (!ignore) {
          setTemplate(null);
          setAssignmentHistory([]);
          setError(fetchError instanceof Error ? fetchError.message : 'Failed to load template detail');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    if (id) {
      void fetchTemplate();
    } else {
      setLoading(false);
      setError('Template identifier is missing.');
    }

    return () => {
      ignore = true;
    };
  }, [id, user?.role]);

  const canAssignToSelf = hasMinimumRole(user?.role, 'supervisor');
  const canEditTemplate = hasMinimumRole(user?.role, 'manager');
  const sortedRequirements = useMemo(() => sortTemplateRequirements(template?.requirements ?? []), [template]);
  const proofType = getPrimaryProofType(sortedRequirements);

  const handlePrimaryAction = async () => {
    if (!template || !user) {
      return;
    }

    if (!canAssignToSelf) {
      setNotice('Assignment request sent. A supervisor can complete the assignment workflow for you.');
      return;
    }

    setSubmitting(true);
    setNotice('');

    try {
      const result = await api.post<AssignTemplateResult>(`/templates/${template.id}/assign`, {
        employeeIds: [user.id],
      });
      setNotice(result.created > 0 ? 'Template assigned to you successfully.' : 'You already have an active assignment for this template.');
    } catch (submitError) {
      setNotice(submitError instanceof Error ? submitError.message : 'Failed to assign template to yourself');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PageShell title="Template Detail" description="Review template requirements and assignment options.">
        <div className="loading">Loading template detail...</div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={template?.name ?? 'Template Detail'}
      description="Review template requirements, proof expectations, and assignment actions."
      breadcrumbs={[
        { label: 'Dashboard', to: '/' },
        { label: 'Template Library', to: '/templates' },
        { label: template?.name ?? 'Template Detail' },
      ]}
      actions={
        <div className="my-page__actions">
          <Link to="/templates" className="my-btn my-btn--secondary">
            Back to library
          </Link>
          <button type="button" className="my-btn my-btn--primary" onClick={handlePrimaryAction} disabled={submitting || !template}>
            {submitting ? 'Working...' : canAssignToSelf ? 'Assign to me' : 'Request assignment'}
          </button>
        </div>
      }
    >
      <div className="managed-page template-screen">
        {error ? <div className="error">Error: {error}</div> : null}
        {notice ? <div className="my-card">{notice}</div> : null}

        {template ? (
          <>
            <section className="my-card">
              <div className="managed-page__section-header">
                <div className="managed-page__card-title">
                  <span className="my-page__eyebrow">Template overview</span>
                  <h2>{template.name}</h2>
                </div>
                <div className="template-screen__status-stack">
                  <TemplateStatusBadge status={template.status} />
                  <span className="my-badge">Version {template.version}</span>
                </div>
              </div>

              <p className="template-screen__card-description">{template.description || 'No description provided for this template yet.'}</p>

              <div className="template-screen__card-meta">
                <div className="my-page__field">
                  <span className="my-page__field-label">Proof type</span>
                  <span className="my-page__field-value">{formatTemplateProofType(proofType)}</span>
                </div>
                <div className="my-page__field">
                  <span className="my-page__field-label">Category</span>
                  <span className="my-page__field-value">{template.category || 'Uncategorized'}</span>
                </div>
                <div className="my-page__field">
                  <span className="my-page__field-label">Requirements</span>
                  <span className="my-page__field-value">{sortedRequirements.length}</span>
                </div>
                <div className="my-page__field">
                  <span className="my-page__field-label">Standard link</span>
                  <span className="my-page__field-value">{template.standardId || 'Not linked'}</span>
                </div>
              </div>

              <div className="template-screen__card-footer">
                {hasMinimumRole(user?.role, 'supervisor') ? (
                  <Link to={`/templates/${template.id}/assign`} className="my-btn my-btn--secondary">
                    Open assign flow
                  </Link>
                ) : null}
                {canEditTemplate ? (
                  <Link to={`/templates/${template.id}/edit`} className="my-btn my-btn--secondary">
                    Edit template
                  </Link>
                ) : null}
              </div>
            </section>

            <section className="template-screen__requirement-body" aria-label="Template requirements">
              {sortedRequirements.map((requirement, index) => (
                <TemplateRequirementPanel
                  key={requirement.id}
                  requirement={requirement}
                  index={index}
                  badge={<span className="my-badge">{requirement.attestationLevels.length} attestation steps</span>}
                  meta={
                    <>
                      <div className="my-page__field">
                        <span className="my-page__field-label">Renewal warning</span>
                        <span className="my-page__field-value">
                          {requirement.renewalWarningDays ? `${requirement.renewalWarningDays} days` : 'Not set'}
                        </span>
                      </div>
                      <div className="my-page__field">
                        <span className="my-page__field-label">Validity</span>
                        <span className="my-page__field-value">
                          {requirement.validityDays ? `${requirement.validityDays} days` : 'Not set'}
                        </span>
                      </div>
                    </>
                  }
                />
              ))}
            </section>

            {hasMinimumRole(user?.role, 'supervisor') ? (
              <section className="my-card" aria-labelledby="assignment-history-heading">
                <div className="managed-page__section-header">
                  <div className="managed-page__card-title">
                    <span className="my-page__eyebrow">Assignment tracking</span>
                    <h2 id="assignment-history-heading">Assignment history</h2>
                  </div>
                  <span className="my-badge">{assignmentHistory.length} assignment{assignmentHistory.length === 1 ? '' : 's'}</span>
                </div>

                {assignmentHistory.length === 0 ? (
                  <div className="my-empty-state">No employees have been assigned this template yet.</div>
                ) : (
                  <div className="managed-page__list">
                    {assignmentHistory.map((assignment) => (
                      <article key={assignment.id} className="managed-page__list-item template-screen__employee-row">
                        <div className="managed-page__list-copy">
                          <strong>{assignment.employeeName || assignment.employeeEmail || 'Unknown employee'}</strong>
                          <p className="my-page__muted">
                            Assigned {formatDate(assignment.createdAt)} · Due {formatDate(assignment.dueDate, 'No deadline')}
                          </p>
                        </div>
                        <div className="template-screen__employee-meta">
                          {assignment.department ? <span className="my-badge">{assignment.department}</span> : null}
                          <span className={assignment.completedAt ? 'my-badge my-badge--active' : assignment.isActive ? 'my-badge my-badge--warning' : 'my-badge'}>
                            {assignment.completedAt ? 'Completed' : assignment.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </PageShell>
  );
}
