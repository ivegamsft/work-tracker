import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import PageShell from '../components/PageShell';
import TemplateRequirementPanel from '../components/templates/TemplateRequirementPanel';
import {
  formatFulfillmentStatus,
  getFulfillmentBadgeClass,
  getTemplateCompletion,
  sortTemplateRequirements,
} from '../components/templates/templateUtils';
import { useAuth } from '../contexts/AuthContext';
import { formatDate, formatDateTime, toArray } from './pageHelpers';
import type { EmployeeDocument, PaginatedResponse, TemplateAssignmentRecord } from '../types/my-section';
import type { ProofTemplateRecord, TemplateFulfillmentRecord } from '../types/templates';
import '../styles/my-section.css';
import '../styles/managed-pages.css';
import '../styles/my-templates.css';
import '../styles/template-screens.css';

type AssignmentsResponse = TemplateAssignmentRecord[] | PaginatedResponse<TemplateAssignmentRecord>;
type DocumentsResponse = EmployeeDocument[] | PaginatedResponse<EmployeeDocument>;

interface FulfillmentDraft {
  statement: string;
  uploadNote: string;
}

type FulfillmentDraftState = Record<string, FulfillmentDraft>;

function getDraftStorageKey(assignmentId: string) {
  return `template-fulfillment:${assignmentId}`;
}

function readDrafts(assignmentId: string): FulfillmentDraftState {
  if (!assignmentId) {
    return {};
  }

  try {
    const stored = localStorage.getItem(getDraftStorageKey(assignmentId));
    return stored ? (JSON.parse(stored) as FulfillmentDraftState) : {};
  } catch {
    return {};
  }
}

function writeDrafts(assignmentId: string, drafts: FulfillmentDraftState) {
  if (!assignmentId) {
    return;
  }

  localStorage.setItem(getDraftStorageKey(assignmentId), JSON.stringify(drafts));
}

export default function TemplateFulfillmentPage() {
  const { assignmentId = '' } = useParams<{ assignmentId: string }>();
  const { user, loading: authLoading } = useAuth();
  const [assignment, setAssignment] = useState<TemplateAssignmentRecord | null>(null);
  const [template, setTemplate] = useState<ProofTemplateRecord | null>(null);
  const [fulfillments, setFulfillments] = useState<TemplateFulfillmentRecord[]>([]);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [drafts, setDrafts] = useState<FulfillmentDraftState>({});
  const [pendingFiles, setPendingFiles] = useState<Record<string, File | null>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingId, setUploadingId] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    setDrafts(readDrafts(assignmentId));
    setPendingFiles({});
  }, [assignmentId]);

  const loadFulfillmentPage = useCallback(async () => {
    if (authLoading) {
      return;
    }

    if (!user || !assignmentId) {
      setLoading(false);
      setError('Template assignment identifier is missing.');
      return;
    }

    setLoading(true);

    try {
      const assignmentsResponse = await api.get<AssignmentsResponse>(`/employees/${user.id}/assignments?page=1&limit=100`);
      const selectedAssignment = toArray(assignmentsResponse).find((item) => item.id === assignmentId) ?? null;

      if (!selectedAssignment) {
        throw new Error('Template assignment not found.');
      }

      const [templateResponse, fulfillmentsResponse, documentsResponse] = await Promise.all([
        api.get<ProofTemplateRecord>(`/templates/${selectedAssignment.templateId}`),
        api.get<TemplateFulfillmentRecord[]>(`/assignments/${assignmentId}/fulfillments`),
        api.get<DocumentsResponse>(`/documents/employee/${user.id}?page=1&limit=100`),
      ]);

      setAssignment(selectedAssignment);
      setTemplate(templateResponse);
      setFulfillments(fulfillmentsResponse);
      setDocuments(toArray(documentsResponse));
      setError('');
    } catch (fetchError) {
      setAssignment(null);
      setTemplate(null);
      setFulfillments([]);
      setDocuments([]);
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load template fulfillment');
    } finally {
      setLoading(false);
    }
  }, [assignmentId, authLoading, user]);

  useEffect(() => {
    void loadFulfillmentPage();
  }, [loadFulfillmentPage]);

  const updateDraft = (fulfillmentId: string, update: Partial<FulfillmentDraft>) => {
    setDrafts((current) => ({
      ...current,
      [fulfillmentId]: {
        statement: current[fulfillmentId]?.statement ?? '',
        uploadNote: current[fulfillmentId]?.uploadNote ?? '',
        ...update,
      },
    }));
  };

  const documentMap = useMemo(() => new Map(documents.map((document) => [document.id, document])), [documents]);

  const requirementRows = useMemo(() => {
    return sortTemplateRequirements(template?.requirements ?? []).map((requirement) => {
      const fulfillment = fulfillments.find((item) => item.requirementId === requirement.id) ?? null;
      const attachedDocumentId = fulfillment?.documentId ?? fulfillment?.attachedDocumentId ?? null;
      const evidenceDocuments = attachedDocumentId ? [documentMap.get(attachedDocumentId)].filter(Boolean) : [];

      return {
        requirement,
        fulfillment,
        evidenceDocuments,
      };
    });
  }, [documentMap, fulfillments, template]);

  const completedCount = requirementRows.filter((row) => row.fulfillment?.status === 'fulfilled').length;
  const pendingReviewCount = requirementRows.filter((row) => row.fulfillment?.status === 'pending_review').length;
  const progress = getTemplateCompletion(completedCount, requirementRows.length);

  const handleSaveProgress = () => {
    writeDrafts(assignmentId, drafts);
    setSuccessMessage('Draft progress saved locally on this device.');
    setError('');
  };

  const handleSubmitProgress = async () => {
    const targets = requirementRows.filter(({ fulfillment, requirement }) => {
      if (!fulfillment || fulfillment.status === 'fulfilled') {
        return false;
      }

      return requirement.attestationLevels.includes('self_attest') && Boolean(drafts[fulfillment.id]?.statement.trim());
    });

    if (targets.length === 0) {
      setError('Add at least one self-attestation statement before submitting progress.');
      setSuccessMessage('');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccessMessage('');

    try {
      for (const { fulfillment } of targets) {
        if (!fulfillment) {
          continue;
        }

        await api.post(`/fulfillments/${fulfillment.id}/self-attest`, {
          statement: drafts[fulfillment.id]?.statement.trim(),
        });
      }

      const nextDrafts = { ...drafts };
      targets.forEach(({ fulfillment }) => {
        if (fulfillment) {
          nextDrafts[fulfillment.id] = {
            statement: '',
            uploadNote: nextDrafts[fulfillment.id]?.uploadNote ?? '',
          };
        }
      });
      setDrafts(nextDrafts);
      writeDrafts(assignmentId, nextDrafts);
      await loadFulfillmentPage();
      setSuccessMessage(`Submitted ${targets.length} requirement${targets.length === 1 ? '' : 's'} for review.`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to submit fulfillment progress');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadEvidence = async (fulfillmentId: string) => {
    if (!user) {
      return;
    }

    const file = pendingFiles[fulfillmentId];

    if (!file) {
      setError('Choose a file before uploading evidence.');
      setSuccessMessage('');
      return;
    }

    setUploadingId(fulfillmentId);
    setError('');
    setSuccessMessage('');

    try {
      const notes = drafts[fulfillmentId]?.uploadNote.trim();
      const uploadedDocument = await api.post<EmployeeDocument>('/documents/upload', {
        employeeId: user.id,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        description: notes || undefined,
        name: file.name,
        type: file.type || 'application/octet-stream',
        notes: notes || undefined,
      });

      await api.post(`/fulfillments/${fulfillmentId}/attach-document`, {
        documentId: uploadedDocument.id,
      });

      setPendingFiles((current) => ({ ...current, [fulfillmentId]: null }));
      updateDraft(fulfillmentId, { uploadNote: '' });
      await loadFulfillmentPage();
      setSuccessMessage('Evidence uploaded and linked to the requirement.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to upload evidence');
    } finally {
      setUploadingId('');
    }
  };

  if (authLoading || loading) {
    return (
      <PageShell title="Template Fulfillment" description="Track requirement progress and upload evidence.">
        <div className="loading">Loading template fulfillment...</div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={assignment?.templateName ?? 'Template Fulfillment'}
      description="Review every requirement, save your draft progress, and upload supporting evidence files."
      breadcrumbs={[
        { label: 'Dashboard', to: '/' },
        { label: 'My Templates', to: '/me/templates' },
        { label: assignment?.templateName ?? 'Template Fulfillment' },
      ]}
      actions={
        <div className="my-page__actions">
          <Link to="/me/templates" className="my-btn my-btn--secondary">
            Back to templates
          </Link>
          <button type="button" className="my-btn my-btn--secondary" onClick={handleSaveProgress}>
            Save progress
          </button>
          <button type="button" className="my-btn my-btn--primary" onClick={handleSubmitProgress} disabled={submitting || requirementRows.length === 0}>
            {submitting ? 'Submitting...' : 'Submit progress'}
          </button>
        </div>
      }
    >
      <div className="managed-page template-screen">
        {error ? <div className="error">Error: {error}</div> : null}
        {successMessage ? <div className="my-card">{successMessage}</div> : null}

        {assignment && template ? (
          <>
            <section className="my-card">
              <div className="managed-page__section-header">
                <div className="managed-page__card-title">
                  <span className="my-page__eyebrow">Assignment overview</span>
                  <h2>{assignment.templateName}</h2>
                </div>
                <span className="my-badge my-badge--warning">{progress}% complete</span>
              </div>

              <div className="my-templates__progress" aria-label={`${assignment.templateName} progress ${progress}%`}>
                <span style={{ width: `${progress}%` }} />
              </div>

              <div className="template-screen__assignment-summary">
                <div className="my-page__field">
                  <span className="my-page__field-label">Due date</span>
                  <span className="my-page__field-value">{formatDate(assignment.dueDate, 'No deadline')}</span>
                </div>
                <div className="my-page__field">
                  <span className="my-page__field-label">Completed</span>
                  <span className="my-page__field-value">{completedCount} / {requirementRows.length}</span>
                </div>
                <div className="my-page__field">
                  <span className="my-page__field-label">Pending review</span>
                  <span className="my-page__field-value">{pendingReviewCount}</span>
                </div>
                <div className="my-page__field">
                  <span className="my-page__field-label">Template version</span>
                  <span className="my-page__field-value">v{assignment.templateVersion}</span>
                </div>
              </div>
            </section>

            {requirementRows.length === 0 ? (
              <div className="my-empty-state">No requirements were found for this assignment.</div>
            ) : (
              <section className="template-screen__requirement-body" aria-label="Fulfillment requirements">
                {requirementRows.map(({ requirement, fulfillment, evidenceDocuments }, index) => {
                  const draft = fulfillment ? drafts[fulfillment.id] ?? { statement: '', uploadNote: '' } : { statement: '', uploadNote: '' };
                  const evidenceCount = evidenceDocuments.length;

                  return (
                    <TemplateRequirementPanel
                      key={requirement.id}
                      requirement={requirement}
                      index={index}
                      badge={
                        <span className={getFulfillmentBadgeClass(fulfillment?.status)}>
                          {formatFulfillmentStatus(fulfillment?.status)}
                        </span>
                      }
                      meta={
                        <>
                          <div className="my-page__field">
                            <span className="my-page__field-label">Evidence uploads</span>
                            <span className="my-page__field-value">{evidenceCount}</span>
                          </div>
                          <div className="my-page__field">
                            <span className="my-page__field-label">Last updated</span>
                            <span className="my-page__field-value">{formatDateTime(fulfillment?.updatedAt, 'Not started')}</span>
                          </div>
                        </>
                      }
                    >
                      <div className="template-screen__requirement-uploads">
                        <div>
                          <h3>Evidence uploads</h3>
                          <p className="my-page__muted">Upload files for document-based evidence or save notes for your local draft.</p>
                        </div>

                        {evidenceDocuments.length === 0 ? (
                          <div className="template-screen__evidence-empty">No evidence uploaded for this requirement yet.</div>
                        ) : (
                          <div className="template-screen__evidence-list">
                            {evidenceDocuments.map((document) => (
                              <div key={document.id} className="template-screen__evidence-item">
                                <div>
                                  <strong>{document.name || document.fileName || 'Evidence document'}</strong>
                                  <p className="my-page__muted">Status: {document.status}</p>
                                </div>
                                <span className="my-badge my-badge--active">Uploaded</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {fulfillment ? (
                          <>
                            {requirement.attestationLevels.includes('self_attest') ? (
                              <label className="my-form__group">
                                <span>Self-attestation statement</span>
                                <textarea
                                  value={draft.statement}
                                  onChange={(event) => updateDraft(fulfillment.id, { statement: event.target.value })}
                                  placeholder="Describe how you met this requirement."
                                  disabled={fulfillment.status === 'fulfilled'}
                                />
                              </label>
                            ) : null}

                            {requirement.attestationLevels.includes('upload') ? (
                              <div className="template-screen__upload-row">
                                <label className="my-form__group">
                                  <span>Evidence file</span>
                                  <input
                                    type="file"
                                    onChange={(event) =>
                                      setPendingFiles((current) => ({
                                        ...current,
                                        [fulfillment.id]: event.target.files?.[0] ?? null,
                                      }))
                                    }
                                  />
                                  <span className="my-page__muted">
                                    {pendingFiles[fulfillment.id]?.name || 'Select a file to upload evidence metadata.'}
                                  </span>
                                </label>
                                <label className="my-form__group">
                                  <span>Upload note</span>
                                  <textarea
                                    value={draft.uploadNote}
                                    onChange={(event) => updateDraft(fulfillment.id, { uploadNote: event.target.value })}
                                    placeholder="Add context for reviewers or future reference."
                                  />
                                </label>
                              </div>
                            ) : null}

                            <div className="template-screen__requirement-actions">
                              {requirement.attestationLevels.includes('upload') ? (
                                <button
                                  type="button"
                                  className="my-btn my-btn--secondary"
                                  onClick={() => handleUploadEvidence(fulfillment.id)}
                                  disabled={uploadingId === fulfillment.id}
                                >
                                  {uploadingId === fulfillment.id ? 'Uploading...' : 'Upload evidence'}
                                </button>
                              ) : null}
                              {requirement.attestationLevels.includes('validated') || requirement.attestationLevels.includes('third_party') ? (
                                <span className="my-page__muted">Supervisor or external validation will complete the remaining attestation steps.</span>
                              ) : null}
                            </div>
                          </>
                        ) : (
                          <div className="template-screen__evidence-empty">Fulfillment tracking for this requirement is not available yet.</div>
                        )}
                      </div>
                    </TemplateRequirementPanel>
                  );
                })}
              </section>
            )}
          </>
        ) : null}
      </div>
    </PageShell>
  );
}
