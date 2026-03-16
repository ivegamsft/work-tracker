import { useEffect, useState } from 'react';
import { api } from '../api/client';
import MySectionNav, { type MySectionNavItem } from '../components/MySectionNav';
import { useAuth } from '../contexts/AuthContext';
import type { MedicalRecord } from '../types/my-section';
import '../styles/my-section.css';

const MY_LINKS: MySectionNavItem[] = [
  { to: '/me', label: 'Profile' },
  { to: '/me/qualifications', label: 'Qualifications' },
  { to: '/me/documents', label: 'Documents' },
  { to: '/me/notifications', label: 'Notifications' },
  { to: '/me/hours', label: 'Hours', flag: 'records.hours-ui' },
];

function formatDate(value?: string | null) {
  if (!value) {
    return 'Not provided';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not provided' : date.toLocaleDateString();
}

function getDaysUntil(value?: string | null) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
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

  return record.status.toLowerCase() === 'restricted' ? 'Restrictions are noted on this clearance.' : 'None reported';
}

function getMedicalBadge(record: MedicalRecord) {
  const normalizedStatus = record.status.toLowerCase();
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

function normalizeRecord(record: MedicalRecord) {
  return {
    ...record,
    provider: record.provider ?? record.issuedBy ?? 'Not provided',
    validFrom: record.validFrom ?? record.effectiveDate ?? '',
    validTo: record.validTo ?? record.expirationDate ?? null,
    restrictions: getRestrictionSummary(record),
  };
}

export default function MyMedicalPage() {
  const { user, loading: authLoading } = useAuth();
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) {
      return;
    }

    async function fetchMedical() {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const response = await api.get<MedicalRecord[]>(`/medical/employee/${user.id}`);
        setRecords(response.map(normalizeRecord));
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load medical clearances');
      } finally {
        setLoading(false);
      }
    }

    fetchMedical();
  }, [authLoading, user]);

  if (authLoading || loading) {
    return <div className="loading">Loading medical clearances...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  if (!user) {
    return <div className="my-empty-state">Your employee session is unavailable.</div>;
  }

  if (records.length === 0) {
    return (
      <div className="my-page">
        <header className="my-page__header">
          <div>
            <p className="my-page__eyebrow">Employee self-service</p>
            <h1 className="my-page__title">My Medical</h1>
            <p className="my-page__description">Review your current medical clearances and restrictions.</p>
          </div>
        </header>
        <MySectionNav links={MY_LINKS} />
        <div className="my-empty-state">No medical clearances are on file yet.</div>
      </div>
    );
  }

  return (
    <div className="my-page">
      <header className="my-page__header">
        <div>
          <p className="my-page__eyebrow">Employee self-service</p>
          <h1 className="my-page__title">My Medical</h1>
          <p className="my-page__description">Review your current medical clearances and restrictions.</p>
        </div>
      </header>

      <MySectionNav links={MY_LINKS} />

      <div className="my-grid my-grid--wide">
        {records.map((record) => {
          const badge = getMedicalBadge(record);

          return (
            <section key={record.id} className="my-card" aria-labelledby={`medical-${record.id}`}>
              <div className="my-page__header">
                <div>
                  <h2 id={`medical-${record.id}`}>{record.clearanceType}</h2>
                  <p className="my-page__muted">Provider: {record.provider}</p>
                </div>
                <span className={badge.className}>{badge.label}</span>
              </div>
              <div className="my-page__field-list">
                <div className="my-page__field">
                  <span className="my-page__field-label">Status</span>
                  <span className="my-page__field-value">{record.status}</span>
                </div>
                <div className="my-page__field">
                  <span className="my-page__field-label">Valid from</span>
                  <span className="my-page__field-value">{formatDate(record.validFrom)}</span>
                </div>
                <div className="my-page__field">
                  <span className="my-page__field-label">Valid to</span>
                  <span className="my-page__field-value">{formatDate(record.validTo)}</span>
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
    </div>
  );
}
