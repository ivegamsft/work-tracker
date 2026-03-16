import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageShell from '../components/PageShell';
import { api, ApiError } from '../api/client';
import {
  formatDate,
  formatDateTime,
  getStatusBadgeClass,
  normalizeKey,
  toTitleCase,
} from './pageHelpers';
import {
  formatAttestationLevels,
  formatFulfillmentStatus,
  formatTemplateProofType,
  getFulfillmentBadgeClass,
} from '../components/templates/templateUtils';
import '../styles/my-section.css';
import '../styles/managed-pages.css';

interface ReviewHistoryEntry {
  id: string;
  action: string;
  performedBy: string;
  performedByName: string;
  performedAt: string;
  notes: string | null;
}

interface FulfillmentReviewDetail {
  id: string;
  assignmentId: string;
  requirementId: string;
  employeeId: string;
  status: string;
  selfAttestedAt?: string | null;
  selfAttestation?: string | null;
  uploadedAt?: string | null;
  documentId?: string | null;
  attachedDocumentId?: string | null;
  thirdPartyVerifiedAt?: string | null;
  validatedAt?: string | null;
  validatorNotes?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  expiresAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  employeeName: string;
  employeeEmail: string;
  templateName: string;
  requirementName: string;
  requirementDescription?: string;
  canReview: boolean;
  reviewHistory: ReviewHistoryEntry[];
  requirement?: {
    id: string;
    name: string;
    description?: string;
    attestationLevels?: string[];
    proofType?: string | null;
  };
}

type ReviewDecision = 'approve' | 'reject' | 'request_changes';

export default function FulfillmentReviewDetailPage() {
  const { fulfillmentId = '' } = useParams<{ fulfillmentId: string }>();
  const [detail, setDetail] = useState<FulfillmentReviewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  const loadDetail = async () => {
    if (!fulfillmentId) {
      setLoading(false);
      setError('Fulfillment identifier is missing.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.get<FulfillmentReviewDetail>(
        `/fulfillments/${fulfillmentId}/review`,
      );
      setDetail(response);
      setError('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError('You do not have permission to review this fulfillment.');
      } else if (err instanceof ApiError && err.status === 404) {
        setError('Fulfillment not found.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load review detail');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDetail();
  }, [fulfillmentId]);

  const handleReviewAction = async (decision: ReviewDecision) => {
    if (!fulfillmentId || !detail) return;

    if (!reviewNotes.trim()) {
      setError('Review notes are required.');
      return;
    }

    if (decision === 'reject' && !rejectionReason.trim()) {
      setError('A rejection reason is required when rejecting a fulfillment.');
      return;
    }

    setSubmitting(true);
    setSuccessMessage('');
    setError('');

    try {
      await api.post(`/fulfillments/${fulfillmentId}/review`, {
        decision,
        notes: reviewNotes.trim(),
        reason: decision === 'reject' ? rejectionReason.trim() : undefined,
      });
      setReviewNotes('');
      setRejectionReason('');
      await loadDetail();

      const labels: Record<ReviewDecision, string> = {
        approve: 'approved',
        reject: 'rejected',
        request_changes: 'returned for changes',
      };
      setSuccessMessage(`Fulfillment ${labels[decision]} successfully.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit review decision');
    } finally {
      setSubmitting(false);
    }
  };

  const currentStatus = useMemo(() => normalizeKey(detail?.status), [detail?.status]);
  const isPendingReview = currentStatus === 'pending_review';

  const evidenceSections = useMemo(() => {
    if (!detail) return [];

    const sections: Array<{ label: string; value: string; timestamp: string | null }> = [];

    if (detail.selfAttestation || detail.selfAttestedAt) {
      sections.push({
        label: 'Self-attestation statement',
        value: detail.selfAttestation ?? 'Statement submitted (no text provided)',
        timestamp: detail.selfAttestedAt ?? null,
      });
    }

    if (detail.documentId || detail.attachedDocumentId) {
      sections.push({
        label: 'Uploaded document',
        value: detail.documentId ?? detail.attachedDocumentId ?? 'Document attached',
        timestamp: detail.uploadedAt ?? null,
      });
    }

    if (detail.thirdPartyVerifiedAt) {
      sections.push({
        label: 'Third-party verification',
        value: 'Verified by external source',
        timestamp: detail.thirdPartyVerifiedAt,
      });
    }

    if (detail.validatedAt) {
      sections.push({
        label: 'Manager validation',
        value: detail.validatorNotes ?? 'Validated',
        timestamp: detail.validatedAt,
      });
    }

    return sections;
  }, [detail]);

  if (loading) {
    return <div className="loading">Loading review detail...</div>;
  }

  if (error && !detail) {
    return (
      <PageShell
        title="Fulfillment Review"
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Reviews', to: '/reviews' },
          { label: 'Template Fulfillments', to: '/reviews/templates' },
          { label: 'Detail' },
        ]}
        actions={
          <Link to="/reviews/templates" className="my-btn my-btn--secondary">
            Back to queue
          </Link>
        }
      >
        <div className="error">Error: {error}</div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={detail?.requirementName ?? 'Fulfillment Review'}
      description="Review submitted evidence and make a review decision."
      breadcrumbs={[
        { label: 'Dashboard', to: '/' },
        { label: 'Reviews', to: '/reviews' },
        { label: 'Template Fulfillments', to: '/reviews/templates' },
        { label: detail?.requirementName ?? 'Detail' },
      ]}
      actions={
        <Link to="/reviews/templates" className="my-btn my-btn--secondary">
          Back to queue
        </Link>
      }
    >
      <div className="managed-page">
        {successMessage ? <div className="my-card">{successMessage}</div> : null}
        {error ? <div className="error">Error: {error}</div> : null}

        {detail && (
          <>
            <div className="managed-page__split">
              {/* Left: Fulfillment info */}
              <section className="my-card">
                <div className="managed-page__section-header">
                  <div>
                    <h2>Fulfillment information</h2>
                    <p className="my-page__muted">
                      Review the submission metadata before making a decision.
                    </p>
                  </div>
                  <span className={getFulfillmentBadgeClass(detail.status)}>
                    {formatFulfillmentStatus(detail.status)}
                  </span>
                </div>
                <div className="managed-page__meta-grid">
                  <div className="my-page__field">
                    <span className="my-page__field-label">Employee</span>
                    <span className="my-page__field-value">{detail.employeeName}</span>
                  </div>
                  <div className="my-page__field">
                    <span className="my-page__field-label">Email</span>
                    <span className="my-page__field-value">{detail.employeeEmail}</span>
                  </div>
                  <div className="my-page__field">
                    <span className="my-page__field-label">Template</span>
                    <span className="my-page__field-value">{detail.templateName}</span>
                  </div>
                  <div className="my-page__field">
                    <span className="my-page__field-label">Requirement</span>
                    <span className="my-page__field-value">{detail.requirementName}</span>
                  </div>
                  {detail.requirementDescription ? (
                    <div className="my-page__field">
                      <span className="my-page__field-label">Description</span>
                      <span className="my-page__field-value">{detail.requirementDescription}</span>
                    </div>
                  ) : null}
                  {detail.requirement?.proofType ? (
                    <div className="my-page__field">
                      <span className="my-page__field-label">Proof type</span>
                      <span className="my-page__field-value">
                        {formatTemplateProofType(detail.requirement.proofType)}
                      </span>
                    </div>
                  ) : null}
                  {detail.requirement?.attestationLevels ? (
                    <div className="my-page__field">
                      <span className="my-page__field-label">Attestation levels</span>
                      <span className="my-page__field-value">
                        {formatAttestationLevels(detail.requirement.attestationLevels)}
                      </span>
                    </div>
                  ) : null}
                  {detail.expiresAt ? (
                    <div className="my-page__field">
                      <span className="my-page__field-label">Expires</span>
                      <span className="my-page__field-value">{formatDate(detail.expiresAt)}</span>
                    </div>
                  ) : null}
                  {detail.rejectedAt ? (
                    <div className="my-page__field">
                      <span className="my-page__field-label">Rejected at</span>
                      <span className="my-page__field-value">
                        {formatDateTime(detail.rejectedAt)}
                      </span>
                    </div>
                  ) : null}
                  {detail.rejectionReason ? (
                    <div className="my-page__field">
                      <span className="my-page__field-label">Rejection reason</span>
                      <span className="my-page__field-value">{detail.rejectionReason}</span>
                    </div>
                  ) : null}
                </div>
              </section>

              {/* Right: Review actions */}
              <aside className="my-card">
                <div>
                  <h2>Review actions</h2>
                  <p className="my-page__muted">
                    {detail.canReview && isPendingReview
                      ? 'Make a review decision on this fulfillment submission.'
                      : 'This fulfillment is not available for review.'}
                  </p>
                </div>
                <div className="managed-page__pill-row">
                  <span className={getStatusBadgeClass(currentStatus)}>
                    {toTitleCase(currentStatus, 'Pending Review')}
                  </span>
                </div>

                {detail.canReview && isPendingReview ? (
                  <>
                    <div className="my-form__group">
                      <label htmlFor="review-notes">Review notes (required)</label>
                      <textarea
                        id="review-notes"
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="Explain why you are approving, rejecting, or requesting changes"
                        rows={3}
                      />
                    </div>
                    <div className="my-form__group">
                      <label htmlFor="rejection-reason">
                        Rejection reason (required for rejection)
                      </label>
                      <textarea
                        id="rejection-reason"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Provide a reason if rejecting"
                        rows={2}
                      />
                    </div>
                    <div className="my-form__actions">
                      <button
                        type="button"
                        className="my-btn my-btn--primary"
                        disabled={submitting}
                        onClick={() => void handleReviewAction('approve')}
                      >
                        {submitting ? 'Saving...' : 'Approve'}
                      </button>
                      <button
                        type="button"
                        className="my-btn my-btn--secondary"
                        disabled={submitting}
                        onClick={() => void handleReviewAction('request_changes')}
                      >
                        Request Changes
                      </button>
                      <button
                        type="button"
                        className="my-btn my-btn--secondary"
                        disabled={submitting}
                        onClick={() => void handleReviewAction('reject')}
                      >
                        Reject
                      </button>
                    </div>
                  </>
                ) : !detail.canReview ? (
                  <p className="my-page__muted">
                    You cannot review your own fulfillment submission.
                  </p>
                ) : (
                  <p className="my-page__muted">
                    This fulfillment is no longer pending review.
                  </p>
                )}
              </aside>
            </div>

            {/* Submitted evidence */}
            <section className="my-card" aria-labelledby="evidence-section">
              <div>
                <h2 id="evidence-section">Submitted evidence</h2>
                <p className="my-page__muted">
                  Evidence submitted by the employee for this requirement.
                </p>
              </div>
              {evidenceSections.length === 0 ? (
                <div className="my-empty-state">No evidence has been submitted yet.</div>
              ) : (
                <div className="managed-page__list">
                  {evidenceSections.map((section, index) => (
                    <article key={index} className="managed-page__muted-box">
                      <div className="managed-page__section-header">
                        <strong>{section.label}</strong>
                        {section.timestamp ? (
                          <span className="my-page__muted">
                            {formatDateTime(section.timestamp)}
                          </span>
                        ) : null}
                      </div>
                      <p className="my-page__field-value">{section.value}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {/* Review history */}
            <section className="my-card" aria-labelledby="review-history-section">
              <div>
                <h2 id="review-history-section">Review history</h2>
                <p className="my-page__muted">Audit trail of review actions on this fulfillment.</p>
              </div>
              {detail.reviewHistory.length === 0 ? (
                <div className="my-empty-state">No review history yet.</div>
              ) : (
                <div className="managed-page__list">
                  {detail.reviewHistory.map((entry) => (
                    <article key={entry.id} className="managed-page__muted-box">
                      <div className="managed-page__section-header">
                        <div>
                          <strong>{toTitleCase(entry.action)}</strong>
                          <span className="my-page__muted"> by {entry.performedByName}</span>
                        </div>
                        <span className="my-page__muted">
                          {formatDateTime(entry.performedAt)}
                        </span>
                      </div>
                      {entry.notes ? (
                        <p className="my-page__field-value">{entry.notes}</p>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </PageShell>
  );
}
