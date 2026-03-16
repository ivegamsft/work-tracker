import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { HoursRecord, PaginatedResponse } from '../types/my-section';
import '../styles/my-section.css';

const MY_LINKS = [
  { to: '/me', label: 'Profile' },
  { to: '/me/qualifications', label: 'Qualifications' },
  { to: '/me/medical', label: 'Medical' },
  { to: '/me/documents', label: 'Documents' },
  { to: '/me/notifications', label: 'Notifications' },
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

function formatTime(value?: string | null) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MyHoursPage() {
  const { user, loading: authLoading } = useAuth();
  const [hours, setHours] = useState<HoursRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [comingSoon, setComingSoon] = useState(false);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    async function fetchHours() {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const response = await api.get<HoursResponse>(`/hours/employee/${user.id}`);
        setHours(normalizeHours(response));
        setComingSoon(false);
        setError('');
      } catch (err) {
        if (isHoursUnavailable(err)) {
          setComingSoon(true);
          setError('');
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load hours');
        }
      } finally {
        setLoading(false);
      }
    }

    fetchHours();
  }, [authLoading, user]);

  if (authLoading || loading) {
    return <div className="loading">Loading hours...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  if (!user) {
    return <div className="my-empty-state">Your employee session is unavailable.</div>;
  }

  if (comingSoon) {
    return (
      <div className="my-page">
        <header className="my-page__header">
          <div>
            <p className="my-page__eyebrow">Employee self-service</p>
            <h1 className="my-page__title">My Hours</h1>
            <p className="my-page__description">Clocking and time history are on the roadmap and will land in a future release.</p>
          </div>
        </header>

        <nav className="my-nav-links" aria-label="My pages">
          {MY_LINKS.map((link) => (
            <Link key={link.to} to={link.to}>
              {link.label}
            </Link>
          ))}
        </nav>

        <section className="my-coming-soon" aria-labelledby="my-hours-coming-soon">
          <div>
            <h2 id="my-hours-coming-soon">Hours tracking is coming soon</h2>
            <p className="my-page__muted">Here&apos;s the planned layout so employees know what to expect.</p>
          </div>
          <div className="my-page__actions">
            <button type="button" className="my-btn my-btn--primary" disabled>
              Clock In — Coming Soon
            </button>
            <button type="button" className="my-btn my-btn--secondary" disabled>
              Clock Out — Coming Soon
            </button>
          </div>
          <table className="my-table" aria-label="Hours log preview">
            <thead>
              <tr>
                <th>Date</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Total Hours</th>
              </tr>
            </thead>
            <tbody />
          </table>
          <p className="my-page__note">Calendar view reference coming in a future release.</p>
        </section>
      </div>
    );
  }

  if (hours.length === 0) {
    return (
      <div className="my-page">
        <header className="my-page__header">
          <div>
            <p className="my-page__eyebrow">Employee self-service</p>
            <h1 className="my-page__title">My Hours</h1>
            <p className="my-page__description">Review your logged hours and daily time entries.</p>
          </div>
        </header>
        <nav className="my-nav-links" aria-label="My pages">
          {MY_LINKS.map((link) => (
            <Link key={link.to} to={link.to}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="my-empty-state">No hours have been logged yet.</div>
      </div>
    );
  }

  return (
    <div className="my-page">
      <header className="my-page__header">
        <div>
          <p className="my-page__eyebrow">Employee self-service</p>
          <h1 className="my-page__title">My Hours</h1>
          <p className="my-page__description">Review your logged hours and daily time entries.</p>
        </div>
      </header>

      <nav className="my-nav-links" aria-label="My pages">
        {MY_LINKS.map((link) => (
          <Link key={link.to} to={link.to}>
            {link.label}
          </Link>
        ))}
      </nav>

      <section className="my-card" aria-labelledby="my-hours-table">
        <div>
          <h2 id="my-hours-table">Hours log</h2>
          <p className="my-page__muted">A simple record of your recent time entries.</p>
        </div>
        <div className="my-page__actions">
          <button type="button" className="my-btn my-btn--primary" disabled>
            Clock In
          </button>
          <button type="button" className="my-btn my-btn--secondary" disabled>
            Clock Out
          </button>
          <span className="my-page__muted">Calendar view reference coming soon.</span>
        </div>
        <table className="my-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Clock In</th>
              <th>Clock Out</th>
              <th>Total Hours</th>
            </tr>
          </thead>
          <tbody>
            {hours.map((entry) => (
              <tr key={entry.id}>
                <td data-label="Date">{formatDate(entry.date)}</td>
                <td data-label="Clock In">{formatTime(entry.clockIn)}</td>
                <td data-label="Clock Out">{formatTime(entry.clockOut)}</td>
                <td data-label="Total Hours">{entry.totalHours ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
