import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, api } from '../api/client';
import MySectionNav, { type MySectionNavItem } from '../components/MySectionNav';
import { useAuth } from '../contexts/AuthContext';
import type { DocumentUploadPayload, EmployeeDocument, PaginatedResponse } from '../types/my-section';
import '../styles/my-section.css';

const MY_LINKS: MySectionNavItem[] = [
  { to: '/me', label: 'Profile' },
  { to: '/me/qualifications', label: 'Qualifications' },
  { to: '/me/medical', label: 'Medical' },
  { to: '/me/notifications', label: 'Notifications' },
  { to: '/me/templates', label: 'Templates', flag: 'compliance.templates' },
  { to: '/me/hours', label: 'Hours', flag: 'records.hours-ui' },
];

const initialFormState = {
  name: '',
  type: '',
  notes: '',
};

type DocumentsResponse = EmployeeDocument[] | PaginatedResponse<EmployeeDocument>;

function isUnavailableError(error: unknown) {
  return error instanceof ApiError && (error.status === 404 || error.status === 501 || /not yet implemented/i.test(error.message));
}

function normalizeDocuments(response: DocumentsResponse) {
  const records = Array.isArray(response) ? response : response.data;

  return records.map((record) => ({
    id: record.id,
    name: record.name ?? record.fileName ?? 'Document',
    type: record.type ?? record.classifiedType ?? record.mimeType ?? 'Unknown',
    uploadedAt: record.uploadedAt ?? record.createdAt ?? '',
    status: record.status,
  }));
}

function formatDate(value?: string | null) {
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleDateString();
}

function getStatusClass(status: string) {
  const normalizedStatus = status.toLowerCase();

  if (normalizedStatus === 'approved' || normalizedStatus === 'uploaded' || normalizedStatus === 'active') {
    return 'my-badge my-badge--active';
  }

  if (normalizedStatus === 'pending' || normalizedStatus === 'processing' || normalizedStatus === 'review_required' || normalizedStatus === 'classified') {
    return 'my-badge my-badge--warning';
  }

  return 'my-badge my-badge--expired';
}

export default function MyDocumentsPage() {
  const { user, loading: authLoading } = useAuth();
  const [documents, setDocuments] = useState<Array<{ id: string; name: string; type: string; uploadedAt: string; status: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [formState, setFormState] = useState(initialFormState);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    async function fetchDocuments() {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const response = await api.get<DocumentsResponse>(`/documents/employee/${user.id}`);
        setDocuments(normalizeDocuments(response));
        setNotice('');
        setError('');
      } catch (err) {
        if (isUnavailableError(err)) {
          setDocuments([]);
          setNotice('Document history is not available yet. You can still submit new document metadata.');
          setError('');
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load documents');
        }
      } finally {
        setLoading(false);
      }
    }

    fetchDocuments();
  }, [authLoading, user]);

  const reloadDocuments = async () => {
    if (!user) {
      return;
    }

    try {
      const response = await api.get<DocumentsResponse>(`/documents/employee/${user.id}`);
      setDocuments(normalizeDocuments(response));
      setNotice('');
    } catch (err) {
      if (isUnavailableError(err)) {
        setDocuments([]);
        setNotice('Document history is not available yet. You can still submit new document metadata.');
        return;
      }

      throw err;
    }
  };

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) {
      return;
    }

    setSubmitting(true);
    setSuccessMessage('');

    try {
      const payload: DocumentUploadPayload = {
        employeeId: user.id,
        fileName: formState.name,
        mimeType: formState.type,
        description: formState.notes,
        name: formState.name,
        type: formState.type,
        notes: formState.notes,
      };

      await api.post<unknown>('/documents/upload', payload);
      await reloadDocuments();
      setFormState(initialFormState);
      setShowUploadForm(false);
      setSuccessMessage('Document metadata submitted successfully.');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit document metadata');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return <div className="loading">Loading documents...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  if (!user) {
    return <div className="my-empty-state">Your employee session is unavailable.</div>;
  }

  return (
    <div className="my-page">
      <header className="my-page__header">
        <div>
          <p className="my-page__eyebrow">Employee self-service</p>
          <h1 className="my-page__title">My Documents</h1>
          <p className="my-page__description">Review uploaded files and send new document metadata for processing.</p>
        </div>
        <div className="my-page__actions">
          <button
            type="button"
            className="my-btn my-btn--primary"
            onClick={() => setShowUploadForm((current) => !current)}
          >
            {showUploadForm ? 'Hide upload form' : 'Upload document'}
          </button>
        </div>
      </header>

      <MySectionNav links={MY_LINKS} />

      {notice ? <div className="my-card">{notice}</div> : null}

      {showUploadForm && (
        <section className="my-card" aria-labelledby="document-upload-form">
          <div>
            <h2 id="document-upload-form">Document metadata</h2>
            <p className="my-page__muted">The backend currently accepts metadata only, so no file attachment is required yet.</p>
          </div>
          <form className="my-form" onSubmit={handleUpload}>
            <div className="my-form__grid">
              <div className="my-form__group">
                <label htmlFor="document-name">Document name</label>
                <input
                  id="document-name"
                  value={formState.name}
                  onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
                  required
                />
              </div>
              <div className="my-form__group">
                <label htmlFor="document-type">MIME type / category</label>
                <input
                  id="document-type"
                  value={formState.type}
                  onChange={(event) => setFormState((current) => ({ ...current, type: event.target.value }))}
                  placeholder="application/pdf"
                  required
                />
              </div>
            </div>
            <div className="my-form__group">
              <label htmlFor="document-notes">Notes</label>
              <textarea
                id="document-notes"
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
                  setFormState(initialFormState);
                  setShowUploadForm(false);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {successMessage ? <div className="my-card">{successMessage}</div> : null}

      {documents.length === 0 ? (
        <div className="my-empty-state">No documents have been uploaded for your profile yet.</div>
      ) : (
        <section className="my-card" aria-labelledby="my-documents-table">
          <div>
            <h2 id="my-documents-table">Uploaded documents</h2>
            <p className="my-page__muted">Keep track of what has been submitted and what still needs review.</p>
          </div>
          <table className="my-table">
            <thead>
              <tr>
                <th>Document name</th>
                <th>Type</th>
                <th>Upload date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.id}>
                  <td data-label="Document name">{document.name}</td>
                  <td data-label="Type">{document.type}</td>
                  <td data-label="Upload date">{formatDate(document.uploadedAt)}</td>
                  <td data-label="Status">
                    <span className={getStatusClass(document.status)}>{document.status}</span>
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
  );
}
