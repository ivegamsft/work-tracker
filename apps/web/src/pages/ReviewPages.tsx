import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageShell from '../components/PageShell';
import { api } from '../api/client';
import type {
  EmployeeDocument,
  ExtractionRecord,
  Qualification,
  ReviewQueueItem,
  PaginatedResponse,
} from '../types/my-section';
import {
  formatDate,
  formatDateTime,
  getDaysUntil,
  getStatusBadgeClass,
  getTeamMember,
  normalizeKey,
  toTitleCase,
  type TeamMemberSummary,
} from './pageHelpers';
import '../styles/my-section.css';
import '../styles/managed-pages.css';

interface ReviewQueueRow {
  reviewId: string;
  documentId: string;
  status: string;
  documentName: string;
  documentType: string;
  submittedAt: string;
  submitter: string;
  priority: 'high' | 'medium' | 'normal';
}

function normalizeDocument(record: EmployeeDocument) {
  return {
    ...record,
    name: record.name ?? record.fileName ?? 'Document',
    type: record.type ?? record.classifiedType ?? record.mimeType ?? 'Unknown',
    submittedAt: record.createdAt ?? record.uploadedAt ?? '',
  };
}

function derivePriority(item: ReviewQueueItem, document?: EmployeeDocument | null) {
  const normalizedStatus = normalizeKey(item.status || document?.status);
  const detectedExpirationDays = getDaysUntil(document?.detectedExpiration ?? null);
  const ageDays = getDaysUntil(document?.createdAt ?? item.createdAt);

  if (normalizedStatus === 'review_required' || normalizedStatus === 'rejected' || detectedExpirationDays <= 14) {
    return 'high';
  }

  if (normalizedStatus === 'in_progress' || ageDays <= -3) {
    return 'medium';
  }

  return 'normal';
}

function getPriorityClass(priority: ReviewQueueRow['priority']) {
  switch (priority) {
    case 'high':
      return 'managed-page__priority managed-page__priority--high';
    case 'medium':
      return 'managed-page__priority managed-page__priority--medium';
    default:
      return 'managed-page__priority managed-page__priority--normal';
  }
}

function getPriorityLabel(priority: ReviewQueueRow['priority']) {
  switch (priority) {
    case 'high':
      return 'High';
    case 'medium':
      return 'Medium';
    default:
      return 'Normal';
  }
}

export function ReviewQueuePage() {
  const [rows, setRows] = useState<ReviewQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchQueue() {
      setLoading(true);

      try {
        const queueResponse = await api.get<PaginatedResponse<ReviewQueueItem>>('/documents/review-queue?page=1&limit=50');
        const queueItems = queueResponse.data;

        const documents = await Promise.all(
          queueItems.map(async (item) => {
            try {
              return [item.documentId, normalizeDocument(await api.get<EmployeeDocument>(`/documents/${item.documentId}`))] as const;
            } catch {
              return [item.documentId, null] as const;
            }
          }),
        );

        const documentMap = new Map(documents);
        const employeeIds = [...new Set(documents.map(([, document]) => document?.employeeId).filter(Boolean) as string[])];
        const employees = await Promise.all(
          employeeIds.map(async (employeeId) => {
            try {
              return [employeeId, await getTeamMember(employeeId)] as const;
            } catch {
              return [employeeId, null] as const;
            }
          }),
        );
        const employeeMap = new Map(employees);

        setRows(
          queueItems.map((item) => {
            const document = documentMap.get(item.documentId);
            const employee = document?.employeeId ? employeeMap.get(document.employeeId) : null;
            const priority = derivePriority(item, document);

            return {
              reviewId: item.id,
              documentId: item.documentId,
              status: item.status,
              documentName: document?.name ?? `Document ${item.documentId}`,
              documentType: document?.type ?? 'Unknown',
              submittedAt: document?.submittedAt ?? item.createdAt,
              submitter: employee?.name ?? 'Employee record unavailable',
              priority,
            };
          }),
        );
        setError('');
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load review queue');
      } finally {
        setLoading(false);
      }
    }

    fetchQueue();
  }, []);

  if (loading) {
    return <div className="loading">Loading review queue...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <PageShell
      title="Document Review Queue"
      description="Review pending document submissions, prioritize work, and open individual review details."
      breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Document Review' }]}
    >
      <div className="managed-page">
        <section className="managed-page__summary-grid" aria-label="Review queue summary">
          <div className="my-card managed-page__stat">
            <span className="my-page__field-label">Queued reviews</span>
            <span className="managed-page__stat-value">{rows.length}</span>
          </div>
          <div className="my-card managed-page__stat">
            <span className="my-page__field-label">High priority</span>
            <span className="managed-page__stat-value">{rows.filter((row) => row.priority === 'high').length}</span>
          </div>
          <div className="my-card managed-page__stat">
            <span className="my-page__field-label">In progress</span>
            <span className="managed-page__stat-value">
              {rows.filter((row) => normalizeKey(row.status) === 'in_progress').length}
            </span>
          </div>
        </section>

        {rows.length === 0 ? (
          <div className="my-empty-state">There are no documents waiting for review right now.</div>
        ) : (
          <section className="my-card" aria-labelledby="review-queue-table">
            <div>
              <h2 id="review-queue-table">Review queue</h2>
              <p className="my-page__muted">Open a document to inspect extraction results and complete the approval decision.</p>
            </div>
            <table className="my-table">
              <thead>
                <tr>
                  <th>Document name</th>
                  <th>Submitter</th>
                  <th>Submitted</th>
                  <th>Type</th>
                  <th>Priority</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.reviewId}>
                    <td data-label="Document name">
                      <Link to={`/reviews/${row.documentId}`} className="managed-page__table-link">
                        {row.documentName}
                      </Link>
                    </td>
                    <td data-label="Submitter">{row.submitter}</td>
                    <td data-label="Submitted">{formatDateTime(row.submittedAt, 'Unknown')}</td>
                    <td data-label="Type">{row.documentType}</td>
                    <td data-label="Priority">
                      <span className={getPriorityClass(row.priority)}>{getPriorityLabel(row.priority)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </PageShell>
  );
}

export function ReviewDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const [document, setDocument] = useState<ReturnType<typeof normalizeDocument> | null>(null);
  const [employee, setEmployee] = useState<TeamMemberSummary | null>(null);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [extraction, setExtraction] = useState<ExtractionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [linkedQualificationId, setLinkedQualificationId] = useState('');
  const [correctionDrafts, setCorrectionDrafts] = useState<Record<string, string>>({});

  const loadReviewDetail = async () => {
    if (!id) {
      setLoading(false);
      setError('Document identifier is missing.');
      return;
    }

    setLoading(true);

    try {
      const [documentResponse, extractionResponse] = await Promise.all([
        api.get<EmployeeDocument>(`/documents/${id}`),
        api.get<ExtractionRecord[]>(`/documents/${id}/extraction`),
      ]);
      const normalizedDocument = normalizeDocument(documentResponse);
      setDocument(normalizedDocument);
      setExtraction(extractionResponse);
      setCorrectionDrafts(
        extractionResponse.reduce<Record<string, string>>((drafts, field) => {
          drafts[field.id] = field.correctedValue ?? field.suggestedValue ?? field.extractedValue;
          return drafts;
        }, {}),
      );
      setReviewNotes('');
      setLinkedQualificationId('');

      if (normalizedDocument.employeeId) {
        const [employeeResponse, qualificationsResponse] = await Promise.all([
          getTeamMember(normalizedDocument.employeeId).catch(() => null),
          api.get<Qualification[]>(`/qualifications/employee/${normalizedDocument.employeeId}`).catch(() => []),
        ]);
        setEmployee(employeeResponse);
        setQualifications(qualificationsResponse);
      } else {
        setEmployee(null);
        setQualifications([]);
      }

      setError('');
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load review detail');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReviewDetail();
  }, [id]);

  const handleReviewAction = async (action: 'approve' | 'reject') => {
    if (!id) {
      return;
    }

    setSubmitting(true);
    setSuccessMessage('');

    try {
      await api.post(`/documents/${id}/review`, {
        action,
        notes: reviewNotes || undefined,
        linkedQualificationId: linkedQualificationId || undefined,
      });
      await loadReviewDetail();
      setSuccessMessage(action === 'approve' ? 'Document approved successfully.' : 'Document rejected successfully.');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to submit review decision');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCorrectionSubmit = async (event: FormEvent<HTMLFormElement>, fieldId: string) => {
    event.preventDefault();

    if (!id) {
      return;
    }

    setSubmitting(true);
    setSuccessMessage('');

    try {
      await api.put(`/documents/${id}/extraction/${fieldId}/correct`, {
        correctedValue: correctionDrafts[fieldId],
      });
      await loadReviewDetail();
      setSuccessMessage('Field correction saved.');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to save field correction');
    } finally {
      setSubmitting(false);
    }
  };

  const reviewStatus = useMemo(() => normalizeKey(document?.status), [document?.status]);

  if (loading) {
    return <div className="loading">Loading review detail...</div>;
  }

  if (error || !document) {
    return (
      <PageShell
        title="Review Detail"
        description="Inspect the submitted document, extracted fields, and review actions."
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Document Review', to: '/reviews' },
          { label: document?.name ?? id ?? 'Review' },
        ]}
        actions={
          <Link to="/reviews" className="my-btn my-btn--secondary">
            Back to queue
          </Link>
        }
      >
        <div className="error">Error: {error || 'Document not found'}</div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={document.name}
      description="Inspect the submitted document, extracted fields, and review actions."
      breadcrumbs={[
        { label: 'Dashboard', to: '/' },
        { label: 'Document Review', to: '/reviews' },
        { label: document.name },
      ]}
      actions={
        <Link to="/reviews" className="my-btn my-btn--secondary">
          Back to queue
        </Link>
      }
    >
      <div className="managed-page">
        {successMessage ? <div className="my-card">{successMessage}</div> : null}

        <div className="managed-page__split">
          <section className="my-card">
            <div className="managed-page__section-header">
              <div>
                <h2>Document information</h2>
                <p className="my-page__muted">Review the submission metadata before approving or rejecting it.</p>
              </div>
              <span className={getStatusBadgeClass(document.status)}>{toTitleCase(document.status)}</span>
            </div>
            <div className="managed-page__meta-grid">
              <div className="my-page__field">
                <span className="my-page__field-label">Submitter</span>
                <span className="my-page__field-value">{employee?.name ?? 'Employee record unavailable'}</span>
              </div>
              <div className="my-page__field">
                <span className="my-page__field-label">Document type</span>
                <span className="my-page__field-value">{document.type}</span>
              </div>
              <div className="my-page__field">
                <span className="my-page__field-label">Submitted</span>
                <span className="my-page__field-value">{formatDateTime(document.submittedAt, 'Unknown')}</span>
              </div>
              <div className="my-page__field">
                <span className="my-page__field-label">Detected expiration</span>
                <span className="my-page__field-value">{formatDate(document.detectedExpiration, 'Not detected')}</span>
              </div>
            </div>
          </section>

          <aside className="my-card">
            <div>
              <h2>Review actions</h2>
              <p className="my-page__muted">Complete the decision and optionally link the approved file to a qualification.</p>
            </div>
            <div className="managed-page__pill-row">
              <span className={getStatusBadgeClass(reviewStatus)}>{toTitleCase(reviewStatus, 'Pending review')}</span>
            </div>
            <div className="my-form__group">
              <label htmlFor="review-linked-qualification">Link qualification (optional)</label>
              <select
                id="review-linked-qualification"
                value={linkedQualificationId}
                onChange={(event) => setLinkedQualificationId(event.target.value)}
              >
                <option value="">Do not link</option>
                {qualifications.map((qualification) => (
                  <option key={qualification.id} value={qualification.id}>
                    {qualification.certificationName ?? qualification.standard?.name ?? qualification.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="my-form__group">
              <label htmlFor="review-notes">Review notes</label>
              <textarea
                id="review-notes"
                value={reviewNotes}
                onChange={(event) => setReviewNotes(event.target.value)}
                placeholder="Capture why the document was approved or rejected"
              />
            </div>
            <div className="my-form__actions">
              <button type="button" className="my-btn my-btn--primary" disabled={submitting} onClick={() => void handleReviewAction('approve')}>
                {submitting ? 'Saving...' : 'Approve document'}
              </button>
              <button type="button" className="my-btn my-btn--secondary" disabled={submitting} onClick={() => void handleReviewAction('reject')}>
                Reject document
              </button>
            </div>
          </aside>
        </div>

        <section className="my-card" aria-labelledby="review-extraction-table">
          <div>
            <h2 id="review-extraction-table">Extracted fields</h2>
            <p className="my-page__muted">Confirm OCR output and correct any field values before final approval.</p>
          </div>

          {extraction.length === 0 ? (
            <div className="my-empty-state">No extracted fields are available for this document yet.</div>
          ) : (
            <div className="managed-page__list">
              {extraction.map((field) => (
                <article key={field.id} className="managed-page__muted-box managed-page__field-editor">
                  <div className="managed-page__section-header">
                    <div>
                      <strong>{toTitleCase(field.field)}</strong>
                      <p className="my-page__note">Confidence: {Math.round(field.confidence * 100)}%</p>
                    </div>
                    <span className={getStatusBadgeClass(field.correctedValue ? 'approved' : 'pending_review')}>
                      {field.correctedValue ? 'Corrected' : 'Needs review'}
                    </span>
                  </div>
                  <div className="managed-page__meta-grid">
                    <div className="my-page__field">
                      <span className="my-page__field-label">Extracted value</span>
                      <span className="my-page__field-value">{field.extractedValue || '—'}</span>
                    </div>
                    <div className="my-page__field">
                      <span className="my-page__field-label">Suggested value</span>
                      <span className="my-page__field-value">{field.suggestedValue || '—'}</span>
                    </div>
                    <div className="my-page__field">
                      <span className="my-page__field-label">Corrected value</span>
                      <span className="my-page__field-value">{field.correctedValue || '—'}</span>
                    </div>
                  </div>
                  <form onSubmit={(event) => void handleCorrectionSubmit(event, field.id)} className="managed-page__field-editor-row">
                    <div className="my-form__group">
                      <label htmlFor={`correction-${field.id}`}>Correction</label>
                      <input
                        id={`correction-${field.id}`}
                        value={correctionDrafts[field.id] ?? ''}
                        onChange={(event) =>
                          setCorrectionDrafts((current) => ({
                            ...current,
                            [field.id]: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <button type="submit" className="my-btn my-btn--secondary" disabled={submitting || !correctionDrafts[field.id]}>
                      Save correction
                    </button>
                  </form>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}
