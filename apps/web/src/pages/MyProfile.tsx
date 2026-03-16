import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import MySectionNav, { type MySectionNavItem } from '../components/MySectionNav';
import { useAuth } from '../contexts/AuthContext';
import type { ComplianceStatus, EmployeeProfile, MedicalReadinessItem, Readiness, ReadinessItem } from '../types/my-section';
import '../styles/my-section.css';

const MY_LINKS: MySectionNavItem[] = [
  { to: '/me/qualifications', label: 'Qualifications' },
  { to: '/me/medical', label: 'Medical' },
  { to: '/me/documents', label: 'Documents' },
  { to: '/me/notifications', label: 'Notifications' },
  { to: '/me/templates', label: 'Templates', flag: 'compliance.templates' },
  { to: '/me/hours', label: 'Hours', flag: 'records.hours-ui' },
];

function formatDate(value?: string | null) {
  if (!value) {
    return 'Not provided';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not provided' : date.toLocaleDateString();
}

function getStatusLabel(status: ComplianceStatus) {
  switch (status) {
    case 'compliant':
      return 'Compliant';
    case 'at_risk':
      return 'At Risk';
    case 'non_compliant':
      return 'Non-Compliant';
  }
}

function getStatusClass(status: ComplianceStatus) {
  switch (status) {
    case 'compliant':
      return 'my-badge my-badge--active';
    case 'at_risk':
      return 'my-badge my-badge--warning';
    case 'non_compliant':
      return 'my-badge my-badge--expired';
  }
}

function normalizeEmployee(employee: EmployeeProfile) {
  const name = employee.name?.trim() || [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim() || employee.email;
  const department = employee.department?.trim() || employee.departmentId?.trim() || 'Not provided';

  return {
    name,
    department,
    role: employee.role,
    email: employee.email,
    position: employee.position || null,
    hireDate: employee.hireDate || null,
  };
}

function mapQualificationReadinessStatus(item: ReadinessItem): ComplianceStatus {
  if (item.readinessStatus) {
    return item.readinessStatus;
  }

  const normalizedStatus = item.status.toLowerCase();
  if (normalizedStatus === 'active' || normalizedStatus === 'compliant') {
    return 'compliant';
  }

  if (normalizedStatus === 'expiring_soon' || normalizedStatus === 'at_risk') {
    return 'at_risk';
  }

  return 'non_compliant';
}

function mapMedicalReadinessStatus(item: MedicalReadinessItem): ComplianceStatus {
  if (item.readinessStatus) {
    return item.readinessStatus;
  }

  return item.status.toLowerCase() === 'cleared' ? 'compliant' : 'non_compliant';
}

function getMedicalSummary(readiness: Readiness) {
  const firstMedicalItem = readiness.medicalClearances?.[0];

  return {
    status: firstMedicalItem ? mapMedicalReadinessStatus(firstMedicalItem) : readiness.medicalStatus ?? 'non_compliant',
    expiresAt: firstMedicalItem?.expirationDate ?? readiness.medicalExpiresAt ?? null,
  };
}

function calculateReadinessScore(readiness: Readiness) {
  const weights: Record<ComplianceStatus, number> = {
    compliant: 100,
    at_risk: 50,
    non_compliant: 0,
  };

  const statuses: ComplianceStatus[] = readiness.qualifications.map(mapQualificationReadinessStatus);
  if (readiness.medicalClearances?.length) {
    statuses.push(...readiness.medicalClearances.map(mapMedicalReadinessStatus));
  } else if (readiness.medicalStatus) {
    statuses.push(readiness.medicalStatus);
  }

  if (statuses.length === 0) {
    return 0;
  }

  const total = statuses.reduce((sum, status) => sum + weights[status], 0);
  return Math.round(total / statuses.length);
}

export default function MyProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) {
      return;
    }

    async function fetchProfile() {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const [employeeResponse, readinessResponse] = await Promise.all([
          api.get<EmployeeProfile>(`/employees/${user.id}`),
          api.get<Readiness>(`/employees/${user.id}/readiness`),
        ]);

        setEmployee(employeeResponse);
        setReadiness(readinessResponse);
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load your profile');
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [authLoading, user]);

  const employeeSummary = useMemo(() => (employee ? normalizeEmployee(employee) : null), [employee]);
  const medicalSummary = useMemo(() => (readiness ? getMedicalSummary(readiness) : null), [readiness]);
  const readinessScore = useMemo(() => (readiness ? calculateReadinessScore(readiness) : 0), [readiness]);

  if (authLoading || loading) {
    return <div className="loading">Loading profile...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  if (!user || !employeeSummary || !readiness || !medicalSummary) {
    return (
      <div className="my-page">
        <div className="my-empty-state">We couldn&apos;t find a profile for your account yet.</div>
      </div>
    );
  }

  return (
    <div className="my-page">
      <header className="my-page__header">
        <div>
          <p className="my-page__eyebrow">Employee self-service</p>
          <h1 className="my-page__title">My Profile</h1>
          <p className="my-page__description">
            Review your profile details and current readiness status at a glance.
          </p>
        </div>
        <span className={getStatusClass(readiness.overallStatus)}>
          Readiness: {getStatusLabel(readiness.overallStatus)}
        </span>
      </header>

      <MySectionNav links={MY_LINKS} />

      <div className="my-grid my-grid--wide">
        <section className="my-card" aria-labelledby="my-profile-details">
          <div>
            <h2 id="my-profile-details">Profile details</h2>
            <p className="my-page__muted">This is the information currently tied to your employee record.</p>
          </div>
          <div className="my-page__field-list">
            <div className="my-page__field">
              <span className="my-page__field-label">Name</span>
              <span className="my-page__field-value">{employeeSummary.name}</span>
            </div>
            <div className="my-page__field">
              <span className="my-page__field-label">Email</span>
              <span className="my-page__field-value">{employeeSummary.email}</span>
            </div>
            <div className="my-page__field">
              <span className="my-page__field-label">Department</span>
              <span className="my-page__field-value">{employeeSummary.department}</span>
            </div>
            <div className="my-page__field">
              <span className="my-page__field-label">Role</span>
              <span className="my-page__field-value">{employeeSummary.role}</span>
            </div>
            <div className="my-page__field">
              <span className="my-page__field-label">Position</span>
              <span className="my-page__field-value">{employeeSummary.position || 'Not provided'}</span>
            </div>
            <div className="my-page__field">
              <span className="my-page__field-label">Hire date</span>
              <span className="my-page__field-value">{formatDate(employeeSummary.hireDate)}</span>
            </div>
          </div>
        </section>

        <section className="my-card" aria-labelledby="my-readiness-summary">
          <div>
            <h2 id="my-readiness-summary">Readiness summary</h2>
            <p className="my-page__muted">A quick look at your current compliance standing.</p>
          </div>
          <div className="my-grid">
            <div className="my-card">
              <span className="my-page__field-label">Readiness score</span>
              <span className="my-page__field-value">{readinessScore}%</span>
            </div>
            <div className="my-card">
              <span className="my-page__field-label">Overall status</span>
              <span className={getStatusClass(readiness.overallStatus)}>{getStatusLabel(readiness.overallStatus)}</span>
            </div>
            <div className="my-card">
              <span className="my-page__field-label">Medical</span>
              <span className={getStatusClass(medicalSummary.status)}>{getStatusLabel(medicalSummary.status)}</span>
            </div>
            <div className="my-card">
              <span className="my-page__field-label">Qualifications tracked</span>
              <span className="my-page__field-value">{readiness.qualifications.length}</span>
            </div>
          </div>
          <p className="my-page__note">Medical expiry: {formatDate(medicalSummary.expiresAt)}</p>
        </section>
      </div>

      <section className="my-card" aria-labelledby="my-quick-links">
        <div>
          <h2 id="my-quick-links">Quick links</h2>
          <p className="my-page__muted">Jump straight to the self-service areas you use most.</p>
        </div>
        <div className="my-nav-links">
          {MY_LINKS.map((link) => (
            <Link key={`quick-${link.to}`} to={link.to}>
              Open {link.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
