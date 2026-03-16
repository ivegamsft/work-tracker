import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import PageShell from '../components/PageShell';
import '../styles/employee-detail.css';

interface Employee {
  id: string;
  email: string;
  name: string;
  department: string;
  role: string;
  overallStatus: 'compliant' | 'at_risk' | 'non_compliant';
  createdAt: string;
  updatedAt: string;
}

interface ReadinessItem {
  qualificationId: string;
  qualificationName: string;
  status: 'compliant' | 'at_risk' | 'non_compliant';
  expiresAt?: string;
  daysUntilExpiry?: number;
}

interface Readiness {
  qualifications: ReadinessItem[];
  medicalStatus: 'compliant' | 'at_risk' | 'non_compliant';
  medicalExpiresAt?: string;
  medicalDaysUntilExpiry?: number;
  overallStatus: 'compliant' | 'at_risk' | 'non_compliant';
}

export default function TeamMemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchData() {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        const [empData, readinessData] = await Promise.all([
          api.get<Employee>(`/employees/${id}`),
          api.get<Readiness>(`/employees/${id}/readiness`),
        ]);
        setEmployee(empData);
        setReadiness(readinessData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load team member data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id]);

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'compliant':
        return 'status-compliant';
      case 'at_risk':
        return 'status-at-risk';
      case 'non_compliant':
        return 'status-non-compliant';
      default:
        return '';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'compliant':
        return 'Compliant';
      case 'at_risk':
        return 'At Risk';
      case 'non_compliant':
        return 'Non-Compliant';
      default:
        return status;
    }
  };

  if (loading) {
    return <div className="loading">Loading team member details...</div>;
  }

  const teamMemberId = employee?.id ?? id ?? 'employee';
  const breadcrumbs = [
    { label: 'Dashboard', to: '/' },
    { label: 'Team', to: '/team' },
    { label: employee?.name ?? teamMemberId },
  ];
  const tabs = [
    { label: 'Overview', to: `/team/${teamMemberId}`, end: true },
    { label: 'Qualifications', to: `/team/${teamMemberId}/qualifications` },
    { label: 'Medical', to: `/team/${teamMemberId}/medical` },
    { label: 'Documents', to: `/team/${teamMemberId}/documents` },
    { label: 'Hours', to: `/team/${teamMemberId}/hours` },
  ];
  const backButton = (
    <button onClick={() => navigate('/team')} className="back-btn">
      ← Back to Team
    </button>
  );

  if (error || !employee) {
    return (
      <PageShell
        title="Employee Detail"
        description="Review this team member's readiness and profile details."
        breadcrumbs={breadcrumbs}
        tabs={tabs}
        actions={backButton}
      >
        <div className="error">
          <p>Error: {error || 'Employee not found'}</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={employee.name}
      description="Review this team member's readiness and profile details."
      breadcrumbs={breadcrumbs}
      tabs={tabs}
      actions={backButton}
    >
      <div className="employee-detail">
        <div className="employee-header">
          <h2>Overall Status</h2>
          <span className={`status-badge ${getStatusClass(readiness?.overallStatus || employee.overallStatus)}`}>
            {getStatusLabel(readiness?.overallStatus || employee.overallStatus)}
          </span>
        </div>

        <div className="employee-info">
          <div className="info-row">
            <span className="info-label">Email:</span>
            <span className="info-value">{employee.email}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Department:</span>
            <span className="info-value">{employee.department}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Role:</span>
            <span className="info-value">{employee.role}</span>
          </div>
        </div>

        <h2>Compliance Status</h2>

        <div className="readiness-section">
          <h3>Medical Clearance</h3>
          <div className={`readiness-card ${getStatusClass(readiness?.medicalStatus || 'non_compliant')}`}>
            <div className="readiness-status">
              {getStatusLabel(readiness?.medicalStatus || 'non_compliant')}
            </div>
            {readiness?.medicalExpiresAt && (
              <div className="readiness-expiry">
                Expires: {new Date(readiness.medicalExpiresAt).toLocaleDateString()}
                {readiness.medicalDaysUntilExpiry !== undefined && (
                  <span> ({readiness.medicalDaysUntilExpiry} days)</span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="readiness-section">
          <h3>Qualifications</h3>
          {readiness?.qualifications && readiness.qualifications.length > 0 ? (
            <div className="qualifications-grid">
              {readiness.qualifications.map((qual) => (
                <div
                  key={qual.qualificationId}
                  className={`readiness-card ${getStatusClass(qual.status)}`}
                >
                  <div className="qualification-name">{qual.qualificationName}</div>
                  <div className="readiness-status">{getStatusLabel(qual.status)}</div>
                  {qual.expiresAt && (
                    <div className="readiness-expiry">
                      Expires: {new Date(qual.expiresAt).toLocaleDateString()}
                      {qual.daysUntilExpiry !== undefined && (
                        <span> ({qual.daysUntilExpiry} days)</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p>No qualifications tracked</p>
          )}
        </div>
      </div>
    </PageShell>
  );
}
