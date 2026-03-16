import { useEffect, useMemo, useState } from 'react';
import MySectionNav, { type MySectionNavItem } from '../components/MySectionNav';
import ProofList from '../components/ProofList';
import type { ProofListItem, ProofStatus } from '../components/ProofCard';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { Qualification } from '../types/my-section';
import '../styles/my-section.css';

const MY_LINKS: MySectionNavItem[] = [
  { to: '/me', label: 'Profile' },
  { to: '/me/medical', label: 'Medical' },
  { to: '/me/documents', label: 'Documents' },
  { to: '/me/notifications', label: 'Notifications' },
  { to: '/me/templates', label: 'Templates', flag: 'compliance.templates' },
  { to: '/me/hours', label: 'Hours', flag: 'records.hours-ui' },
];

function normalizeStatus(status: string, expiresAt?: string | null): ProofStatus {
  const normalizedStatus = status.toLowerCase().replace(/\s+/g, '_');

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

function getSummaryTone(status: ProofStatus) {
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

function toProofItem(qualification: Qualification): ProofListItem {
  const expiresAt = qualification.expiresAt ?? qualification.expirationDate ?? null;
  const status = normalizeStatus(qualification.status, expiresAt);
  const documentCount = qualification.documentCount ?? qualification.documentIds?.length ?? 0;
  const requirementsTotal = qualification.requirementsTotal ?? 1;
  const requirementsMet = qualification.requirementsMet ?? (status === 'active' || status === 'compliant' || status === 'expiring_soon' ? 1 : 0);

  return {
    id: qualification.id,
    name:
      qualification.name ??
      qualification.certificationName ??
      qualification.standard?.name ??
      qualification.standardName ??
      'Qualification',
    status,
    issuer: qualification.issuer ?? qualification.issuingBody ?? qualification.standard?.issuingBody ?? null,
    standardName: qualification.standardName ?? qualification.standard?.name ?? null,
    expiresAt,
    requirementsMet,
    requirementsTotal,
    documentCount,
    hasEvidence: documentCount > 0,
  };
}

export default function MyQualificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) {
      return;
    }

    async function fetchQualifications() {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const response = await api.get<Qualification[]>(`/qualifications/employee/${user.id}`);
        setQualifications(response);
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load qualifications');
      } finally {
        setLoading(false);
      }
    }

    fetchQualifications();
  }, [authLoading, user]);

  const proofs = useMemo(() => qualifications.map(toProofItem), [qualifications]);

  const summary = useMemo(() => {
    return proofs.reduce(
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
    );
  }, [proofs]);

  if (authLoading || loading) {
    return <div className="loading">Loading qualifications...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  if (!user) {
    return <div className="my-empty-state">Your employee session is unavailable.</div>;
  }

  if (proofs.length === 0) {
    return (
      <div className="my-page">
        <header className="my-page__header">
          <div>
            <p className="my-page__eyebrow">Employee self-service</p>
            <h1 className="my-page__title">My Qualifications</h1>
            <p className="my-page__description">Track your current credentials and upcoming renewals.</p>
          </div>
        </header>
        <MySectionNav links={MY_LINKS} />
        <div className="my-empty-state">No qualifications are currently assigned to your profile.</div>
      </div>
    );
  }

  return (
    <div className="my-page">
      <header className="my-page__header">
        <div>
          <p className="my-page__eyebrow">Employee self-service</p>
          <h1 className="my-page__title">My Qualifications</h1>
          <p className="my-page__description">Track your current credentials and upcoming renewals.</p>
        </div>
      </header>

      <MySectionNav links={MY_LINKS} />

      <section className="my-grid" aria-label="Qualification summary">
        <div className="my-card">
          <span className="my-page__field-label">Compliant</span>
          <span className={getSummaryTone('compliant')}>{summary.compliant}</span>
        </div>
        <div className="my-card">
          <span className="my-page__field-label">At Risk</span>
          <span className={getSummaryTone('at_risk')}>{summary.atRisk}</span>
        </div>
        <div className="my-card">
          <span className="my-page__field-label">Non-Compliant</span>
          <span className={getSummaryTone('non_compliant')}>{summary.nonCompliant}</span>
        </div>
      </section>

      <section className="my-card">
        <ProofList
          proofs={proofs}
          title="My qualifications"
          isOwnProfile={true}
          emptyMessage="No qualifications match the selected filter."
          showUploadAction={false}
        />
      </section>
    </div>
  );
}
