import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageShell from '../components/PageShell';
import ProofList from '../components/ProofList';
import type { ProofListItem, ProofStatus } from '../components/ProofCard';
import { api } from '../api/client';
import { useFeatureFlag } from '../hooks/useFeatureFlags';
import type {
  ComplianceStandardRecord,
  EmployeeDocument,
  MedicalRecord,
  PaginatedResponse,
  Qualification,
} from '../types/my-section';
import {
  buildTeamBreadcrumbs,
  buildTeamTabs,
  formatDate,
  getDaysUntil,
  getStatusBadgeClass,
  getTeamMember,
  isUnavailableError,
  normalizeKey,
  toArray,
  toTitleCase,
  type TeamMemberSummary,
} from './pageHelpers';
import '../styles/my-section.css';
import '../styles/managed-pages.css';

type StandardsResponse = ComplianceStandardRecord[] | PaginatedResponse<ComplianceStandardRecord>;
type DocumentsResponse = EmployeeDocument[] | PaginatedResponse<EmployeeDocument>;

const initialQualificationForm = {
  standardId: '',
  certificationName: '',
  issuingBody: '',
  issueDate: '',
  expirationDate: '',
};

const initialQualificationEditForm = {
  certificationName: '',
  issuingBody: '',
  expirationDate: '',
  status: 'active',
};

const initialMedicalForm = {
  clearanceType: '',
  issuedBy: '',
  status: 'cleared',
  effectiveDate: '',
  expirationDate: '',
  visualAcuityResult: '',
  colorVisionResult: '',
};

const initialMedicalEditForm = {
  status: 'cleared',
  expirationDate: '',
  visualAcuityResult: '',
  colorVisionResult: '',
};

const initialDocumentForm = {
  name: '',
  type: '',
  notes: '',
};

function useTeamMemberContext(currentPage: string) {
  const { id } = useParams<{ id: string }>();
  const employeeId = id ?? '';
  const hoursEnabled = useFeatureFlag('records.hours-ui');
  const teamSubnavEnabled = useFeatureFlag('web.team-subnav');
  const [employee, setEmployee] = useState<TeamMemberSummary | null>(null);
  const [employeeLoading, setEmployeeLoading] = useState(true);
  const [employeeError, setEmployeeError] = useState('');

  useEffect(() => {
    if (!employeeId) {
      setEmployee(null);
      setEmployeeLoading(false);
      setEmployeeError('Team member identifier is missing.');
      return;
    }

    async function fetchEmployee() {
      setEmployeeLoading(true);

      try {
        const response = await getTeamMember(employeeId);
        setEmployee(response);
        setEmployeeError('');
      } catch (error) {
        setEmployee(null);
        setEmployeeError(error instanceof Error ? error.message : 'Failed to load employee details');
      } finally {
        setEmployeeLoading(false);
      }
    }

    fetchEmployee();
  }, [employeeId]);

  const employeeLabel = employee?.name ?? employeeId ?? 'Employee';

  return {
    employeeId,
    employee,
    employeeLabel,
    employeeLoading,
    employeeError,
    breadcrumbs: buildTeamBreadcrumbs(employeeId || 'employee', employeeLabel, currentPage),
    tabs: teamSubnavEnabled ? buildTeamTabs(employeeId || 'employee', { showHours: hoursEnabled }) : [],
  };
}

function normalizeQualificationStatus(status: string, expiresAt?: string | null): ProofStatus {
  const normalizedStatus = normalizeKey(status);

  if (
    normalizedStatus === 'active' ||
    normalizedStatus === 'expiring_soon' ||
    normalizedStatus === 'expired' ||
    normalizedStatus === 'pending_review' ||
    normalizedStatus === 'suspended' ||
    normalizedStatus === 'compliant' ||
    normalizedStatus === 'at_risk' ||
    normalizedStatus === 'non_compliant' ||
    normalizedStatus === 'missing'
  ) {
    return normalizedStatus;
  }

  if (expiresAt) {
    const expiryDate = new Date(expiresAt);

    if (!Number.isNaN(expiryDate.getTime())) {
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry < 0) {
        return 'expired';
      }

      if (daysUntilExpiry <= 30) {
        return 'expiring_soon';
      }
    }
  }

  return 'pending_review';
}

function getQualificationSummaryTone(status: ProofStatus) {
  switch (status) {
    case 'compliant':
    case 'active':
      return 'my-badge my-badge--active';
    case 'at_risk':
    case 'expiring_soon':
    case 'pending_review':
      return 'my-badge my-badge--warning';
    default:
      return 'my-badge my-badge--expired';
  }
}

function getQualificationName(qualification: Qualification) {
  return (
    qualification.name ??
    qualification.certificationName ??
    qualification.standard?.name ??
    qualification.standardName ??
    'Qualification'
  );
}

function getQualificationIssuer(qualification: Qualification) {
  return qualification.issuer ?? qualification.issuingBody ?? qualification.standard?.issuingBody ?? null;
}

function getQualificationExpiry(qualification: Qualification) {
  return qualification.expiresAt ?? qualification.expirationDate ?? null;
}

function toProofItem(qualification: Qualification): ProofListItem {
  const expiresAt = getQualificationExpiry(qualification);
  const status = normalizeQualificationStatus(qualification.status, expiresAt);
  const documentCount = qualification.documentCount ?? qualification.documentIds?.length ?? 0;
  const requirementsTotal = qualification.requirementsTotal ?? 1;
  const requirementsMet =
    qualification.requirementsMet ??
    (status === 'active' || status === 'compliant' || status === 'expiring_soon' ? 1 : 0);

  return {
    id: qualification.id,
    name: getQualificationName(qualification),
    status,
    issuer: getQualificationIssuer(qualification),
    standardName: qualification.standardName ?? qualification.standard?.name ?? null,
    expiresAt,
    requirementsMet,
    requirementsTotal,
    documentCount,
    hasEvidence: documentCount > 0,
  };
}

function getRestrictionSummary(record: MedicalRecord) {
  if (record.restrictions?.trim()) {
    return record.restrictions;
  }

  const notes = [
    record.visualAcuityResult ? `Visual acuity: ${record.visualAcuityResult}` : null,
    record.colorVisionResult ? `Color vision: ${record.colorVisionResult}` : null,
  ].filter(Boolean);

  if (notes.length > 0) {
    return notes.join(' · ');
  }

  return normalizeKey(record.status) === 'restricted' ? 'Restrictions are noted on this clearance.' : 'None reported';
}

function normalizeMedicalRecord(record: MedicalRecord) {
  return {
    ...record,
    provider: record.provider ?? record.issuedBy ?? 'Not provided',
    validFrom: record.validFrom ?? record.effectiveDate ?? '',
    validTo: record.validTo ?? record.expirationDate ?? null,
    restrictions: getRestrictionSummary(record),
  };
}

function getMedicalBadge(record: MedicalRecord) {
  const normalizedStatus = normalizeKey(record.status);
  const validTo = record.validTo ?? record.expirationDate ?? null;
  const daysUntilExpiry = getDaysUntil(validTo);

  if (normalizedStatus === 'expired' || daysUntilExpiry < 0) {
    return { className: 'my-badge my-badge--expired', label: 'Expired' };
  }

  if (normalizedStatus === 'pending') {
    return { className: 'my-badge my-badge--warning', label: 'Pending' };
  }

  if (normalizedStatus === 'restricted') {
    return { className: 'my-badge my-badge--warning', label: 'Restricted' };
  }

  if (daysUntilExpiry <= 30) {
    return { className: 'my-badge my-badge--warning', label: 'Expiring soon' };
  }

  return { className: 'my-badge my-badge--active', label: 'Active' };
}

function normalizeDocument(record: EmployeeDocument) {
  return {
    id: record.id,
    employeeId: record.employeeId,
    name: record.name ?? record.fileName ?? 'Document',
    type: record.type ?? record.classifiedType ?? record.mimeType ?? 'Unknown',
    uploadedAt: record.uploadedAt ?? record.createdAt ?? '',
    status: record.status,
  };
}

function renderTeamError(title: string, description: string, context: ReturnType<typeof useTeamMemberContext>, message: string) {
  return (
    <PageShell title={title} description={description} breadcrumbs={context.breadcrumbs} tabs={context.tabs}>
      <div className="error">Error: {message}</div>
    </PageShell>
  );
}

export function TeamQualificationsPage() {
  const context = useTeamMemberContext('Qualifications');
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [standards, setStandards] = useState<ComplianceStandardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(initialQualificationForm);
  const [editForm, setEditForm] = useState(initialQualificationEditForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (!context.employeeId) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      setLoading(true);

      try {
        const [qualificationsResponse, standardsResponse] = await Promise.all([
          api.get<Qualification[]>(`/qualifications/employee/${context.employeeId}`),
          api.get<StandardsResponse>('/standards?page=1&limit=100'),
        ]);
        setQualifications(qualificationsResponse);
        setStandards(toArray(standardsResponse));
        setError('');
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load team qualifications');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [context.employeeId]);

  const reloadQualifications = async () => {
    if (!context.employeeId) {
      return;
    }

    const response = await api.get<Qualification[]>(`/qualifications/employee/${context.employeeId}`);
    setQualifications(response);
  };

  const proofs = useMemo(() => qualifications.map(toProofItem), [qualifications]);

  const summary = useMemo(
    () =>
      proofs.reduce(
        (counts, proof) => {
          if (proof.status === 'compliant' || proof.status === 'active') {
            counts.compliant += 1;
          } else if (
            proof.status === 'at_risk' ||
            proof.status === 'expiring_soon' ||
            proof.status === 'pending_review'
          ) {
            counts.atRisk += 1;
          } else {
            counts.nonCompliant += 1;
          }

          return counts;
        },
        { compliant: 0, atRisk: 0, nonCompliant: 0 },
      ),
    [proofs],
  );

  const editingQualification = qualifications.find((qualification) => qualification.id === editingId) ?? null;

  const openAddForm = () => {
    setEditingId(null);
    setEditForm(initialQualificationEditForm);
    setShowAddForm((current) => !current);
    setSuccessMessage('');
  };

  const openEditForm = (qualification: Qualification) => {
    setShowAddForm(false);
    setEditingId(qualification.id);
    setEditForm({
      certificationName: qualification.certificationName ?? getQualificationName(qualification),
      issuingBody: qualification.issuingBody ?? getQualificationIssuer(qualification) ?? '',
      expirationDate: getQualificationExpiry(qualification)?.toString().slice(0, 10) ?? '',
      status: normalizeQualificationStatus(qualification.status, getQualificationExpiry(qualification)),
    });
    setSuccessMessage('');
  };

  const handleAddQualification = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!context.employeeId) {
      return;
    }

    setSubmitting(true);
    setSuccessMessage('');

    try {
      await api.post<Qualification>('/qualifications', {
        employeeId: context.employeeId,
        standardId: addForm.standardId,
        certificationName: addForm.certificationName,
        issuingBody: addForm.issuingBody,
        issueDate: addForm.issueDate,
        expirationDate: addForm.expirationDate || null,
        documentIds: [],
      });
      await reloadQualifications();
      setAddForm(initialQualificationForm);
      setShowAddForm(false);
      setError('');
      setSuccessMessage(`Qualification added for ${context.employeeLabel}.`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to add qualification');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditQualification = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingId) {
      return;
    }

    setSubmitting(true);
    setSuccessMessage('');

    try {
      await api.put<Qualification>(`/qualifications/${editingId}`, {
        certificationName: editForm.certificationName,
        issuingBody: editForm.issuingBody,
        expirationDate: editForm.expirationDate || null,
        status: editForm.status,
      });
      await reloadQualifications();
      setEditingId(null);
      setEditForm(initialQualificationEditForm);
      setError('');
      setSuccessMessage(`Qualification updated for ${context.employeeLabel}.`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to update qualification');
    } finally {
      setSubmitting(false);
    }
  };

  if (context.employeeLoading || loading) {
    return <div className="loading">Loading team qualifications...</div>;
  }

  if (context.employeeError || error) {
    return renderTeamError(
      'Employee Qualifications',
      'Manage qualification records, status, and supporting document coverage for this team member.',
      context,
      context.employeeError || error,
    );
  }

  const actions = (
    <div className="my-page__actions">
      <Link to={`/team/${context.employeeId || ''}`} className="my-btn my-btn--secondary">
        Team overview
      </Link>
      <button type="button" className="my-btn my-btn--primary" onClick={openAddForm}>
        {showAddForm ? 'Hide form' : 'Add qualification'}
      </button>
    </div>
  );

  return (
    <PageShell
      title={`${context.employeeLabel} — Qualifications`}
      description="Manage qualification records, status, and supporting document coverage for this team member."
      breadcrumbs={context.breadcrumbs}
      tabs={context.tabs}
      actions={actions}
    >
      <div className="managed-page">
        {successMessage ? <div className="my-card">{successMessage}</div> : null}

        {showAddForm && (
          <section className="my-card" aria-labelledby="team-add-qualification">
            <div className="managed-page__section-header">
              <div>
                <h2 id="team-add-qualification">Add qualification</h2>
                <p className="my-page__muted">Create a new qualification record for {context.employeeLabel}.</p>
              </div>
            </div>
            <form className="my-form" onSubmit={handleAddQualification}>
              <div className="my-form__grid">
                <div className="my-form__group">
                  <label htmlFor="qualification-standard">Standard</label>
                  <select
                    id="qualification-standard"
                    value={addForm.standardId}
                    onChange={(event) => {
                      const selected = standards.find((standard) => standard.id === event.target.value);
                      setAddForm((current) => ({
                        ...current,
                        standardId: event.target.value,
                        certificationName: current.certificationName || selected?.name || '',
                        issuingBody: current.issuingBody || selected?.issuingBody || '',
                      }));
                    }}
                    required
                  >
                    <option value="">Select a standard</option>
                    {standards.map((standard) => (
                      <option key={standard.id} value={standard.id}>
                        {standard.code} — {standard.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="my-form__group">
                  <label htmlFor="qualification-name">Qualification name</label>
                  <input
                    id="qualification-name"
                    value={addForm.certificationName}
                    onChange={(event) => setAddForm((current) => ({ ...current, certificationName: event.target.value }))}
                    required
                  />
                </div>
                <div className="my-form__group">
                  <label htmlFor="qualification-issuer">Issuing body</label>
                  <input
                    id="qualification-issuer"
                    value={addForm.issuingBody}
                    onChange={(event) => setAddForm((current) => ({ ...current, issuingBody: event.target.value }))}
                    required
                  />
                </div>
                <div className="my-form__group">
                  <label htmlFor="qualification-issued">Issue date</label>
                  <input
                    id="qualification-issued"
                    type="date"
                    value={addForm.issueDate}
                    onChange={(event) => setAddForm((current) => ({ ...current, issueDate: event.target.value }))}
                    required
                  />
                </div>
                <div className="my-form__group">
                  <label htmlFor="qualification-expiry">Expiration date</label>
                  <input
                    id="qualification-expiry"
                    type="date"
                    value={addForm.expirationDate}
                    onChange={(event) => setAddForm((current) => ({ ...current, expirationDate: event.target.value }))}
                  />
                </div>
              </div>
              <div className="my-form__actions">
                <button type="submit" className="my-btn my-btn--primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save qualification'}
                </button>
                <button
                  type="button"
                  className="my-btn my-btn--secondary"
                  onClick={() => {
                    setAddForm(initialQualificationForm);
                    setShowAddForm(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

        {editingQualification && (
          <section className="my-card" aria-labelledby="team-edit-qualification">
            <div className="managed-page__section-header">
              <div>
                <h2 id="team-edit-qualification">Edit qualification</h2>
                <p className="my-page__muted">Adjust renewal status and metadata for {getQualificationName(editingQualification)}.</p>
              </div>
            </div>
            <form className="my-form" onSubmit={handleEditQualification}>
              <div className="my-form__grid">
                <div className="my-form__group">
                  <label htmlFor="qualification-edit-name">Qualification name</label>
                  <input
                    id="qualification-edit-name"
                    value={editForm.certificationName}
                    onChange={(event) => setEditForm((current) => ({ ...current, certificationName: event.target.value }))}
                    required
                  />
                </div>
                <div className="my-form__group">
                  <label htmlFor="qualification-edit-issuer">Issuing body</label>
                  <input
                    id="qualification-edit-issuer"
                    value={editForm.issuingBody}
                    onChange={(event) => setEditForm((current) => ({ ...current, issuingBody: event.target.value }))}
                    required
                  />
                </div>
                <div className="my-form__group">
                  <label htmlFor="qualification-edit-status">Status</label>
                  <select
                    id="qualification-edit-status"
                    value={editForm.status}
                    onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value }))}
                  >
                    <option value="active">Active</option>
                    <option value="expiring_soon">Expiring soon</option>
                    <option value="expired">Expired</option>
                    <option value="pending_review">Pending review</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
                <div className="my-form__group">
                  <label htmlFor="qualification-edit-expiry">Expiration date</label>
                  <input
                    id="qualification-edit-expiry"
                    type="date"
                    value={editForm.expirationDate}
                    onChange={(event) => setEditForm((current) => ({ ...current, expirationDate: event.target.value }))}
                  />
                </div>
              </div>
              <div className="my-form__actions">
                <button type="submit" className="my-btn my-btn--primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Update qualification'}
                </button>
                <button
                  type="button"
                  className="my-btn my-btn--secondary"
                  onClick={() => {
                    setEditingId(null);
                    setEditForm(initialQualificationEditForm);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="managed-page__summary-grid" aria-label="Qualification summary">
          <div className="my-card managed-page__stat">
            <span className="my-page__field-label">Compliant</span>
            <span className={getQualificationSummaryTone('compliant')}>{summary.compliant}</span>
          </div>
          <div className="my-card managed-page__stat">
            <span className="my-page__field-label">At Risk</span>
            <span className={getQualificationSummaryTone('at_risk')}>{summary.atRisk}</span>
          </div>
          <div className="my-card managed-page__stat">
            <span className="my-page__field-label">Non-Compliant</span>
            <span className={getQualificationSummaryTone('non_compliant')}>{summary.nonCompliant}</span>
          </div>
        </section>

        {proofs.length === 0 ? (
          <div className="my-empty-state">No qualifications are on file for {context.employeeLabel} yet.</div>
        ) : (
          <>
            <section className="my-card">
              <ProofList
                proofs={proofs}
                title={`${context.employeeLabel}'s qualifications`}
                canCreate={true}
                isOwnProfile={false}
                onAddNew={() => {
                  setShowAddForm(true);
                  setEditingId(null);
                }}
                onSelectProof={(proof) => {
                  const selected = qualifications.find((qualification) => qualification.id === proof.id);
                  if (selected) {
                    openEditForm(selected);
                  }
                }}
                emptyMessage="No qualifications match the selected filter."
                showUploadAction={false}
              />
            </section>

            <section className="my-card" aria-labelledby="team-qualifications-table">
              <div className="managed-page__section-header">
                <div>
                  <h2 id="team-qualifications-table">Qualification records</h2>
                  <p className="my-page__muted">Use the table for fast updates to status, expiry, and document coverage.</p>
                </div>
              </div>
              <table className="my-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Expiry</th>
                    <th>Documents</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {qualifications.map((qualification) => {
                    const proof = toProofItem(qualification);
                    const documentCount = qualification.documentCount ?? qualification.documentIds?.length ?? 0;

                    return (
                      <tr key={qualification.id}>
                        <td data-label="Name">{getQualificationName(qualification)}</td>
                        <td data-label="Status">
                          <span className={getStatusBadgeClass(proof.status)}>{toTitleCase(proof.status)}</span>
                        </td>
                        <td data-label="Expiry">{formatDate(getQualificationExpiry(qualification), 'No expiry date')}</td>
                        <td data-label="Documents">{documentCount}</td>
                        <td data-label="Action">
                          <button type="button" className="my-btn my-btn--secondary" onClick={() => openEditForm(qualification)}>
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          </>
        )}
      </div>
    </PageShell>
  );
}

export function TeamMedicalPage() {
  const context = useTeamMemberContext('Medical');
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(initialMedicalForm);
  const [editForm, setEditForm] = useState(initialMedicalEditForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (!context.employeeId) {
      setLoading(false);
      return;
    }

    async function fetchMedical() {
      setLoading(true);

      try {
        const response = await api.get<MedicalRecord[]>(`/medical/employee/${context.employeeId}`);
        setRecords(response.map(normalizeMedicalRecord));
        setError('');
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load medical records');
      } finally {
        setLoading(false);
      }
    }

    fetchMedical();
  }, [context.employeeId]);

  const reloadMedical = async () => {
    if (!context.employeeId) {
      return;
    }

    const response = await api.get<MedicalRecord[]>(`/medical/employee/${context.employeeId}`);
    setRecords(response.map(normalizeMedicalRecord));
  };

  const summary = useMemo(
    () =>
      records.reduce(
        (counts, record) => {
          const badge = getMedicalBadge(record);

          if (badge.label === 'Active') {
            counts.active += 1;
          } else if (badge.label === 'Expired') {
            counts.expired += 1;
          } else {
            counts.attention += 1;
          }

          return counts;
        },
        { active: 0, attention: 0, expired: 0 },
      ),
    [records],
  );

  const editingRecord = records.find((record) => record.id === editingId) ?? null;

  const openEditForm = (record: MedicalRecord) => {
    setShowAddForm(false);
    setEditingId(record.id);
    setEditForm({
      status: normalizeKey(record.status) || 'cleared',
      expirationDate: (record.validTo ?? record.expirationDate)?.toString().slice(0, 10) ?? '',
      visualAcuityResult: record.visualAcuityResult ?? '',
      colorVisionResult: record.colorVisionResult ?? '',
    });
    setSuccessMessage('');
  };

  const handleAddMedical = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!context.employeeId) {
      return;
    }

    setSubmitting(true);
    setSuccessMessage('');

    try {
      await api.post<MedicalRecord>('/medical', {
        employeeId: context.employeeId,
        clearanceType: addForm.clearanceType,
        status: addForm.status,
        effectiveDate: addForm.effectiveDate,
        expirationDate: addForm.expirationDate || null,
        visualAcuityResult: addForm.visualAcuityResult || null,
        colorVisionResult: addForm.colorVisionResult || null,
        issuedBy: addForm.issuedBy,
      });
      await reloadMedical();
      setAddForm(initialMedicalForm);
      setShowAddForm(false);
      setError('');
      setSuccessMessage(`Medical clearance added for ${context.employeeLabel}.`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to add medical record');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditMedical = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingId) {
      return;
    }

    setSubmitting(true);
    setSuccessMessage('');

    try {
      await api.put<MedicalRecord>(`/medical/${editingId}`, {
        status: editForm.status,
        expirationDate: editForm.expirationDate || null,
        visualAcuityResult: editForm.visualAcuityResult || null,
        colorVisionResult: editForm.colorVisionResult || null,
      });
      await reloadMedical();
      setEditingId(null);
      setEditForm(initialMedicalEditForm);
      setError('');
      setSuccessMessage(`Medical clearance updated for ${context.employeeLabel}.`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to update medical record');
    } finally {
      setSubmitting(false);
    }
  };

  if (context.employeeLoading || loading) {
    return <div className="loading">Loading team medical records...</div>;
  }

  if (context.employeeError || error) {
    return renderTeamError(
      'Employee Medical',
      'Track current medical clearance, validity windows, and restriction notes for this team member.',
      context,
      context.employeeError || error,
    );
  }

  const actions = (
    <div className="my-page__actions">
      <Link to={`/team/${context.employeeId || ''}`} className="my-btn my-btn--secondary">
        Team overview
      </Link>
      <button
        type="button"
        className="my-btn my-btn--primary"
        onClick={() => {
          setEditingId(null);
          setShowAddForm((current) => !current);
          setSuccessMessage('');
        }}
      >
        {showAddForm ? 'Hide form' : 'Add medical record'}
      </button>
    </div>
  );

  return (
    <PageShell
      title={`${context.employeeLabel} — Medical`}
      description="Track current medical clearance, validity windows, and restriction notes for this team member."
      breadcrumbs={context.breadcrumbs}
      tabs={context.tabs}
      actions={actions}
    >
      <div className="managed-page">
        {successMessage ? <div className="my-card">{successMessage}</div> : null}

        {showAddForm && (
          <section className="my-card" aria-labelledby="team-add-medical">
            <div>
              <h2 id="team-add-medical">Add medical record</h2>
              <p className="my-page__muted">Capture a new clearance for {context.employeeLabel}.</p>
            </div>
            <form className="my-form" onSubmit={handleAddMedical}>
              <div className="my-form__grid">
                <div className="my-form__group">
                  <label htmlFor="medical-type">Clearance type</label>
                  <input
                    id="medical-type"
                    value={addForm.clearanceType}
                    onChange={(event) => setAddForm((current) => ({ ...current, clearanceType: event.target.value }))}
                    required
                  />
                </div>
                <div className="my-form__group">
                  <label htmlFor="medical-provider">Provider</label>
                  <input
                    id="medical-provider"
                    value={addForm.issuedBy}
                    onChange={(event) => setAddForm((current) => ({ ...current, issuedBy: event.target.value }))}
                    required
                  />
                </div>
                <div className="my-form__group">
                  <label htmlFor="medical-status">Status</label>
                  <select
                    id="medical-status"
                    value={addForm.status}
                    onChange={(event) => setAddForm((current) => ({ ...current, status: event.target.value }))}
                  >
                    <option value="cleared">Cleared</option>
                    <option value="pending">Pending</option>
                    <option value="restricted">Restricted</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
                <div className="my-form__group">
                  <label htmlFor="medical-effective">Effective date</label>
                  <input
                    id="medical-effective"
                    type="date"
                    value={addForm.effectiveDate}
                    onChange={(event) => setAddForm((current) => ({ ...current, effectiveDate: event.target.value }))}
                    required
                  />
                </div>
                <div className="my-form__group">
                  <label htmlFor="medical-expiration">Expiration date</label>
                  <input
                    id="medical-expiration"
                    type="date"
                    value={addForm.expirationDate}
                    onChange={(event) => setAddForm((current) => ({ ...current, expirationDate: event.target.value }))}
                  />
                </div>
                <div className="my-form__group">
                  <label htmlFor="medical-visual">Visual acuity</label>
                  <select
                    id="medical-visual"
                    value={addForm.visualAcuityResult}
                    onChange={(event) => setAddForm((current) => ({ ...current, visualAcuityResult: event.target.value }))}
                  >
                    <option value="">Not recorded</option>
                    <option value="pass">Pass</option>
                    <option value="fail">Fail</option>
                  </select>
                </div>
                <div className="my-form__group">
                  <label htmlFor="medical-color">Color vision</label>
                  <select
                    id="medical-color"
                    value={addForm.colorVisionResult}
                    onChange={(event) => setAddForm((current) => ({ ...current, colorVisionResult: event.target.value }))}
                  >
                    <option value="">Not recorded</option>
                    <option value="pass">Pass</option>
                    <option value="fail">Fail</option>
                  </select>
                </div>
              </div>
              <div className="my-form__actions">
                <button type="submit" className="my-btn my-btn--primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save medical record'}
                </button>
                <button
                  type="button"
                  className="my-btn my-btn--secondary"
                  onClick={() => {
                    setAddForm(initialMedicalForm);
                    setShowAddForm(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

        {editingRecord && (
          <section className="my-card" aria-labelledby="team-edit-medical">
            <div>
              <h2 id="team-edit-medical">Edit medical record</h2>
              <p className="my-page__muted">Update status and expiry for {editingRecord.clearanceType}.</p>
            </div>
            <form className="my-form" onSubmit={handleEditMedical}>
              <div className="my-form__grid">
                <div className="my-form__group">
                  <label htmlFor="medical-edit-status">Status</label>
                  <select
                    id="medical-edit-status"
                    value={editForm.status}
                    onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value }))}
                  >
                    <option value="cleared">Cleared</option>
                    <option value="pending">Pending</option>
                    <option value="restricted">Restricted</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
                <div className="my-form__group">
                  <label htmlFor="medical-edit-expiration">Expiration date</label>
                  <input
                    id="medical-edit-expiration"
                    type="date"
                    value={editForm.expirationDate}
                    onChange={(event) => setEditForm((current) => ({ ...current, expirationDate: event.target.value }))}
                  />
                </div>
                <div className="my-form__group">
                  <label htmlFor="medical-edit-visual">Visual acuity</label>
                  <select
                    id="medical-edit-visual"
                    value={editForm.visualAcuityResult}
                    onChange={(event) => setEditForm((current) => ({ ...current, visualAcuityResult: event.target.value }))}
                  >
                    <option value="">Not recorded</option>
                    <option value="pass">Pass</option>
                    <option value="fail">Fail</option>
                  </select>
                </div>
                <div className="my-form__group">
                  <label htmlFor="medical-edit-color">Color vision</label>
                  <select
                    id="medical-edit-color"
                    value={editForm.colorVisionResult}
                    onChange={(event) => setEditForm((current) => ({ ...current, colorVisionResult: event.target.value }))}
                  >
                    <option value="">Not recorded</option>
                    <option value="pass">Pass</option>
                    <option value="fail">Fail</option>
                  </select>
                </div>
              </div>
              <div className="my-form__actions">
                <button type="submit" className="my-btn my-btn--primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Update medical record'}
                </button>
                <button
                  type="button"
                  className="my-btn my-btn--secondary"
                  onClick={() => {
                    setEditingId(null);
                    setEditForm(initialMedicalEditForm);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="managed-page__summary-grid" aria-label="Medical summary">
          <div className="my-card managed-page__stat">
            <span className="my-page__field-label">Active</span>
            <span className="my-badge my-badge--active">{summary.active}</span>
          </div>
          <div className="my-card managed-page__stat">
            <span className="my-page__field-label">Needs Attention</span>
            <span className="my-badge my-badge--warning">{summary.attention}</span>
          </div>
          <div className="my-card managed-page__stat">
            <span className="my-page__field-label">Expired</span>
            <span className="my-badge my-badge--expired">{summary.expired}</span>
          </div>
        </section>

        {records.length === 0 ? (
          <div className="my-empty-state">No medical clearances are on file for {context.employeeLabel} yet.</div>
        ) : (
          <div className="my-grid my-grid--wide">
            {records.map((record) => {
              const badge = getMedicalBadge(record);

              return (
                <section key={record.id} className="my-card" aria-labelledby={`team-medical-${record.id}`}>
                  <div className="managed-page__section-header">
                    <div>
                      <h2 id={`team-medical-${record.id}`}>{record.clearanceType}</h2>
                      <p className="my-page__muted">Provider: {record.provider}</p>
                    </div>
                    <div className="my-page__actions">
                      <span className={badge.className}>{badge.label}</span>
                      <button type="button" className="my-btn my-btn--secondary" onClick={() => openEditForm(record)}>
                        Edit
                      </button>
                    </div>
                  </div>
                  <div className="my-page__field-list">
                    <div className="my-page__field">
                      <span className="my-page__field-label">Status</span>
                      <span className="my-page__field-value">{toTitleCase(record.status)}</span>
                    </div>
                    <div className="my-page__field">
                      <span className="my-page__field-label">Valid from</span>
                      <span className="my-page__field-value">{formatDate(record.validFrom, 'Not provided')}</span>
                    </div>
                    <div className="my-page__field">
                      <span className="my-page__field-label">Valid to</span>
                      <span className="my-page__field-value">{formatDate(record.validTo, 'No expiration date')}</span>
                    </div>
                    <div className="my-page__field">
                      <span className="my-page__field-label">Restrictions</span>
                      <span className="my-page__field-value">{record.restrictions}</span>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </PageShell>
  );
}

export function TeamDocumentsPage() {
  const context = useTeamMemberContext('Documents');
  const [documents, setDocuments] = useState<Array<ReturnType<typeof normalizeDocument>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [formState, setFormState] = useState(initialDocumentForm);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (!context.employeeId) {
      setLoading(false);
      return;
    }

    async function fetchDocuments() {
      setLoading(true);

      try {
        const response = await api.get<DocumentsResponse>(`/documents/employee/${context.employeeId}`);
        setDocuments(toArray(response).map(normalizeDocument));
        setNotice('');
        setError('');
      } catch (fetchError) {
        if (isUnavailableError(fetchError)) {
          setDocuments([]);
          setNotice('Document history is not available yet. You can still upload metadata for this employee.');
          setError('');
        } else {
          setError(fetchError instanceof Error ? fetchError.message : 'Failed to load documents');
        }
      } finally {
        setLoading(false);
      }
    }

    fetchDocuments();
  }, [context.employeeId]);

  const reloadDocuments = async () => {
    if (!context.employeeId) {
      return;
    }

    try {
      const response = await api.get<DocumentsResponse>(`/documents/employee/${context.employeeId}`);
      setDocuments(toArray(response).map(normalizeDocument));
      setNotice('');
    } catch (fetchError) {
      if (isUnavailableError(fetchError)) {
        setDocuments([]);
        setNotice('Document history is not available yet. You can still upload metadata for this employee.');
        return;
      }

      throw fetchError;
    }
  };

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!context.employeeId) {
      return;
    }

    setSubmitting(true);
    setSuccessMessage('');

    try {
      await api.post<unknown>('/documents/upload', {
        employeeId: context.employeeId,
        fileName: formState.name,
        mimeType: formState.type,
        description: formState.notes,
        name: formState.name,
        type: formState.type,
        notes: formState.notes,
      });
      await reloadDocuments();
      setFormState(initialDocumentForm);
      setShowUploadForm(false);
      setError('');
      setSuccessMessage(`Document metadata submitted for ${context.employeeLabel}.`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to submit document metadata');
    } finally {
      setSubmitting(false);
    }
  };

  if (context.employeeLoading || loading) {
    return <div className="loading">Loading team documents...</div>;
  }

  if (context.employeeError || error) {
    return renderTeamError(
      'Employee Documents',
      'Review uploaded documents, document types, and current review state for this team member.',
      context,
      context.employeeError || error,
    );
  }

  const actions = (
    <div className="my-page__actions">
      <Link to={`/team/${context.employeeId || ''}`} className="my-btn my-btn--secondary">
        Team overview
      </Link>
      <button
        type="button"
        className="my-btn my-btn--primary"
        onClick={() => {
          setShowUploadForm((current) => !current);
          setSuccessMessage('');
        }}
      >
        {showUploadForm ? 'Hide form' : 'Upload document'}
      </button>
    </div>
  );

  return (
    <PageShell
      title={`${context.employeeLabel} — Documents`}
      description="Review uploaded documents, document types, and current review state for this team member."
      breadcrumbs={context.breadcrumbs}
      tabs={context.tabs}
      actions={actions}
    >
      <div className="managed-page">
        {notice ? <div className="my-card">{notice}</div> : null}
        {successMessage ? <div className="my-card">{successMessage}</div> : null}

        {showUploadForm && (
          <section className="my-card" aria-labelledby="team-upload-document">
            <div>
              <h2 id="team-upload-document">Upload document metadata</h2>
              <p className="my-page__muted">Submit metadata for a file that belongs to {context.employeeLabel}.</p>
            </div>
            <form className="my-form" onSubmit={handleUpload}>
              <div className="my-form__grid">
                <div className="my-form__group">
                  <label htmlFor="team-document-name">Document name</label>
                  <input
                    id="team-document-name"
                    value={formState.name}
                    onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
                    required
                  />
                </div>
                <div className="my-form__group">
                  <label htmlFor="team-document-type">MIME type / category</label>
                  <input
                    id="team-document-type"
                    value={formState.type}
                    onChange={(event) => setFormState((current) => ({ ...current, type: event.target.value }))}
                    placeholder="application/pdf"
                    required
                  />
                </div>
              </div>
              <div className="my-form__group">
                <label htmlFor="team-document-notes">Notes</label>
                <textarea
                  id="team-document-notes"
                  value={formState.notes}
                  onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))}
                />
              </div>
              <div className="my-form__actions">
                <button type="submit" className="my-btn my-btn--primary" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit metadata'}
                </button>
                <button
                  type="button"
                  className="my-btn my-btn--secondary"
                  onClick={() => {
                    setFormState(initialDocumentForm);
                    setShowUploadForm(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

        {documents.length === 0 ? (
          <div className="my-empty-state">No documents are currently listed for {context.employeeLabel}.</div>
        ) : (
          <section className="my-card" aria-labelledby="team-documents-table">
            <div>
              <h2 id="team-documents-table">Employee documents</h2>
              <p className="my-page__muted">Track the files already submitted and their review status.</p>
            </div>
            <table className="my-table">
              <thead>
                <tr>
                  <th>Document name</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr key={document.id}>
                    <td data-label="Document name">{document.name}</td>
                    <td data-label="Type">{document.type}</td>
                    <td data-label="Date">{formatDate(document.uploadedAt, 'Unknown')}</td>
                    <td data-label="Status">
                      <span className={getStatusBadgeClass(document.status)}>{toTitleCase(document.status)}</span>
                    </td>
                    <td data-label="Action">
                      <button
                        type="button"
                        className="my-btn my-btn--secondary"
                        onClick={() => window.open(`/api/documents/${document.id}`, '_blank', 'noopener')}
                      >
                        Download
                      </button>
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

export function TeamHoursPage() {
  const context = useTeamMemberContext('Hours');

  if (context.employeeLoading) {
    return <div className="loading">Loading team hours...</div>;
  }

  if (context.employeeError) {
    return renderTeamError(
      'Employee Hours',
      'Hours tracking is not implemented yet, but this page outlines the supervisor workflow.',
      context,
      context.employeeError,
    );
  }

  const actions = (
    <div className="my-page__actions">
      <Link to={`/team/${context.employeeId || ''}`} className="my-btn my-btn--secondary">
        Team overview
      </Link>
      <button type="button" className="my-btn my-btn--primary" disabled>
        Approve entries — Coming soon
      </button>
    </div>
  );

  return (
    <PageShell
      title={`${context.employeeLabel} — Hours`}
      description="Hours tracking is not implemented yet, but this page outlines the supervisor workflow."
      breadcrumbs={context.breadcrumbs}
      tabs={context.tabs}
      actions={actions}
    >
      <div className="managed-page">
        <section className="my-coming-soon" aria-labelledby="team-hours-coming-soon">
          <div>
            <h2 id="team-hours-coming-soon">Hours API is coming soon</h2>
            <p className="my-page__muted">The supervisor view will surface time logs, summaries, and approvals as soon as the hours service is ready.</p>
          </div>

          <section className="managed-page__summary-grid" aria-label="Hours summary preview">
            <div className="my-card managed-page__stat">
              <span className="my-page__field-label">Week to date</span>
              <span className="managed-page__stat-value">—</span>
              <span className="my-page__note">Planned rollup of approved and pending hours.</span>
            </div>
            <div className="my-card managed-page__stat">
              <span className="my-page__field-label">Pending approvals</span>
              <span className="managed-page__stat-value">—</span>
              <span className="my-page__note">Supervisor actions will land here.</span>
            </div>
            <div className="my-card managed-page__stat">
              <span className="my-page__field-label">Latest sync</span>
              <span className="managed-page__stat-value">—</span>
              <span className="my-page__note">Source-system refresh timestamp placeholder.</span>
            </div>
          </section>

          <div className="my-page__actions">
            <button type="button" className="my-btn my-btn--primary" disabled>
              Approve selected
            </button>
            <button type="button" className="my-btn my-btn--secondary" disabled>
              Request correction
            </button>
            <button type="button" className="my-btn my-btn--secondary" disabled>
              Export week
            </button>
          </div>

          <table className="my-table" aria-label="Hours log preview">
            <thead>
              <tr>
                <th>Date</th>
                <th>Source</th>
                <th>Total Hours</th>
                <th>Status</th>
                <th>Supervisor Action</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td data-label="Date">—</td>
                <td data-label="Source">—</td>
                <td data-label="Total Hours">—</td>
                <td data-label="Status">
                  <span className="my-badge my-badge--warning">Coming soon</span>
                </td>
                <td data-label="Supervisor Action">Approval workflow placeholder</td>
              </tr>
            </tbody>
          </table>

          <p className="my-page__note">Planned experience includes daily log review, weekly summaries, and approval history.</p>
        </section>
      </div>
    </PageShell>
  );
}
