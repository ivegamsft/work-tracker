import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, api } from '../api/client';
import MySectionNav, { type MySectionNavItem } from '../components/MySectionNav';
import { useAuth } from '../contexts/AuthContext';
import type { HoursRecord, PaginatedResponse } from '../types/my-section';
import '../styles/my-section.css';

const MY_LINKS: MySectionNavItem[] = [
  { to: '/me', label: 'Profile' },
  { to: '/me/qualifications', label: 'Qualifications' },
  { to: '/me/medical', label: 'Medical' },
  { to: '/me/documents', label: 'Documents' },
  { to: '/me/notifications', label: 'Notifications' },
  { to: '/me/templates', label: 'Templates', flag: 'compliance.templates' },
];

type HoursResponse = HoursRecord[] | PaginatedResponse<HoursRecord>;

function normalizeHours(response: HoursResponse) {
  const records = Array.isArray(response) ? response : response.data;

  return records.map((record) => ({
    ...record,
    totalHours: record.totalHours ?? record.hours ?? null,
  }));
}

function isHoursUnavailable(error: unknown) {
  return error instanceof ApiError && (error.status === 404 || error.status === 501 || /not yet implemented/i.test(error.message));
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleDateString();
}

function formatSource(source?: string) {
  if (!source) {
    return '—';
  }

  return source
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

function getSourceBadgeClass(source?: string) {
  switch (source) {
    case 'clock_in_out':
      return 'my-badge my-badge--active';
    case 'manual_entry':
      return 'my-badge my-badge--warning';
    default:
      return 'my-badge';
  }
}

const initialManualForm = {
  date: '',
  hours: '',
  qualificationCategory: '',
  description: '',
  attestation: '',
};

export default function MyHoursPage() {
  const { user, loading: authLoading } = useAuth();
  const [hours, setHours] = useState<HoursRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState(initialManualForm);

  const fetchHours = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const response = await api.get<HoursResponse>(`/hours/employee/${user.id}`);
      setHours(normalizeHours(response));
      setNotice('');
      setError('');
    } catch (err) {
      if (isHoursUnavailable(err)) {
        setHours([]);
        setNotice('Hours data is not available yet. You can still clock in/out and log manual entries.');
        setError('');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load hours');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) {
      return;
    }

    fetchHours();
  }, [authLoading, user]);

  const handleClockIn = async () => {
    if (!user) {
      return;
    }

    setSubmitting(true);
    setActionMessage('');
    setActionError('');

    try {
      await api.post('/hours/clock-in', { employeeId: user.id });
      setActionMessage('Clocked in successfully.');
      await fetchHours();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to clock in');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClockOut = async () => {
    if (!user) {
      return;
    }

    setSubmitting(true);
    setActionMessage('');
    setActionError('');

    try {
      await api.post('/hours/clock-out', { employeeId: user.id });
      setActionMessage('Clocked out successfully.');
      await fetchHours();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to clock out');
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualEntry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) {
      return;
    }

    setSubmitting(true);
    setActionMessage('');
    setActionError('');

    try {
      await api.post('/hours/manual', {
        employeeId: user.id,
        date: manualForm.date,
        hours: Number(manualForm.hours),
        qualificationCategory: manualForm.qualificationCategory,
        description: manualForm.description,
        attestation: manualForm.attestation,
      });

      setActionMessage('Manual hours entry submitted.');
      setManualForm(initialManualForm);
      setShowManualForm(false);
      await fetchHours();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to submit manual entry');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return <div className="loading">Loading hours...</div>;
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
          <h1 className="my-page__title">My Hours</h1>
          <p className="my-page__description">Review your logged hours and daily time entries.</p>
        </div>
        <div className="my-page__actions">
          <button
            type="button"
            className="my-btn my-btn--primary"
            disabled={submitting}
            onClick={handleClockIn}
          >
            {submitting ? 'Processing...' : 'Clock In'}
          </button>
          <button
            type="button"
            className="my-btn my-btn--secondary"
            disabled={submitting}
            onClick={handleClockOut}
          >
            {submitting ? 'Processing...' : 'Clock Out'}
          </button>
          <button
            type="button"
            className="my-btn my-btn--secondary"
            onClick={() => setShowManualForm((current) => !current)}
          >
            {showManualForm ? 'Hide manual entry' : 'Log hours manually'}
          </button>
        </div>
      </header>

      <MySectionNav links={MY_LINKS} />

      {notice ? <div className="my-card">{notice}</div> : null}
      {actionMessage ? <div className="my-card">{actionMessage}</div> : null}
      {actionError ? <div className="error">Error: {actionError}</div> : null}

      {showManualForm && (
        <section className="my-card" aria-labelledby="manual-entry-form">
          <div>
            <h2 id="manual-entry-form">Log hours manually</h2>
            <p className="my-page__muted">Submit a manual time entry with attestation.</p>
          </div>
          <form className="my-form" onSubmit={handleManualEntry}>
            <div className="my-form__grid">
              <div className="my-form__group">
                <label htmlFor="entry-date">Date</label>
                <input
                  id="entry-date"
                  type="date"
                  value={manualForm.date}
                  onChange={(e) => setManualForm((f) => ({ ...f, date: e.target.value }))}
                  required
                />
              </div>
              <div className="my-form__group">
                <label htmlFor="entry-hours">Hours</label>
                <input
                  id="entry-hours"
                  type="number"
                  step="0.25"
                  min="0.25"
                  max="24"
                  value={manualForm.hours}
                  onChange={(e) => setManualForm((f) => ({ ...f, hours: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="my-form__grid">
              <div className="my-form__group">
                <label htmlFor="entry-category">Qualification category</label>
                <input
                  id="entry-category"
                  value={manualForm.qualificationCategory}
                  onChange={(e) => setManualForm((f) => ({ ...f, qualificationCategory: e.target.value }))}
                  placeholder="e.g. field_hours, classroom"
                  required
                />
              </div>
              <div className="my-form__group">
                <label htmlFor="entry-description">Description</label>
                <input
                  id="entry-description"
                  value={manualForm.description}
                  onChange={(e) => setManualForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description of work performed"
                  required
                />
              </div>
            </div>
            <div className="my-form__group">
              <label htmlFor="entry-attestation">Attestation</label>
              <textarea
                id="entry-attestation"
                value={manualForm.attestation}
                onChange={(e) => setManualForm((f) => ({ ...f, attestation: e.target.value }))}
                placeholder="I attest that the hours recorded above are accurate..."
                required
              />
            </div>
            <div className="my-form__actions">
              <button type="submit" className="my-btn my-btn--primary" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit entry'}
              </button>
              <button
                type="button"
                className="my-btn my-btn--secondary"
                onClick={() => {
                  setManualForm(initialManualForm);
                  setShowManualForm(false);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {hours.length === 0 ? (
        <div className="my-empty-state">No hours have been logged yet.</div>
      ) : (
        <section className="my-card" aria-labelledby="my-hours-table">
          <div>
            <h2 id="my-hours-table">Hours log</h2>
            <p className="my-page__muted">A record of your recent time entries.</p>
          </div>
          <table className="my-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Hours</th>
                <th>Category</th>
                <th>Source</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {hours.map((entry) => (
                <tr key={entry.id}>
                  <td data-label="Date">{formatDate(entry.date)}</td>
                  <td data-label="Hours">{entry.totalHours ?? entry.hours ?? '—'}</td>
                  <td data-label="Category">{entry.qualificationCategory ?? '—'}</td>
                  <td data-label="Source">
                    <span className={getSourceBadgeClass(entry.source)}>{formatSource(entry.source)}</span>
                  </td>
                  <td data-label="Description">{entry.description || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
