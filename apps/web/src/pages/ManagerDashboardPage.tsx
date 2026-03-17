import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '../components/PageShell';
import { StatCard, ProgressBar, ComplianceStatusBadge, ExpiryWarningList } from '../components/dashboard';
import type { ExpiryItem } from '../components/dashboard';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { normalizeKey, toArray } from './pageHelpers';
import type {
  ComplianceStatus,
  EmployeeProfile,
  Qualification,
  MedicalRecord,
  PaginatedResponse,
  TemplateAssignmentRecord,
} from '../types/my-section';
import '../styles/manager-dashboard.css';

interface TeamEmployee {
  id: string;
  name: string;
  status: ComplianceStatus;
}

interface DashboardData {
  employees: TeamEmployee[];
  assignments: TemplateAssignmentRecord[];
  expiryItems: ExpiryItem[];
}

type AssignmentsResponse = TemplateAssignmentRecord[] | PaginatedResponse<TemplateAssignmentRecord>;
type QualificationsResponse = Qualification[] | PaginatedResponse<Qualification>;
type MedicalResponse = MedicalRecord[] | PaginatedResponse<MedicalRecord>;
type EmployeesResponse = EmployeeProfile[] | PaginatedResponse<EmployeeProfile>;

function resolveComplianceStatus(status?: string | null): ComplianceStatus {
  const key = normalizeKey(status);
  if (key === 'compliant' || key === 'active') return 'compliant';
  if (key === 'at_risk' || key === 'expiring_soon' || key === 'pending_review') return 'at_risk';
  return 'non_compliant';
}

function resolveEmployeeName(e: EmployeeProfile): string {
  return `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim() || e.name || e.email;
}

export default function ManagerDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;

    let ignore = false;

    async function fetchData() {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      const [empResult, assignResult, qualResult, medResult] = await Promise.allSettled([
        api.get<EmployeesResponse>('/employees'),
        api.get<AssignmentsResponse>('/assignments/team'),
        api.get<QualificationsResponse>('/qualifications'),
        api.get<MedicalResponse>('/medical'),
      ]);

      if (ignore) return;

      const failCount = [empResult, assignResult, qualResult, medResult].filter(
        (r) => r.status === 'rejected',
      ).length;

      if (failCount === 4) {
        setError('Dashboard data is temporarily unavailable. Please try again later.');
        setData(null);
        setLoading(false);
        return;
      }

      const employees: TeamEmployee[] =
        empResult.status === 'fulfilled'
          ? toArray(empResult.value).map((e) => ({
              id: e.id,
              name: resolveEmployeeName(e),
              status: resolveComplianceStatus(e.overallStatus),
            }))
          : [];

      const assignments: TemplateAssignmentRecord[] =
        assignResult.status === 'fulfilled' ? toArray(assignResult.value) : [];

      const employeeMap = new Map<string, string>();
      if (empResult.status === 'fulfilled') {
        toArray(empResult.value).forEach((e) => employeeMap.set(e.id, resolveEmployeeName(e)));
      }

      const expiryItems: ExpiryItem[] = [];

      if (qualResult.status === 'fulfilled') {
        toArray(qualResult.value).forEach((q) => {
          const expiresAt = q.expiresAt ?? q.expirationDate;
          if (expiresAt) {
            expiryItems.push({
              id: q.id,
              name: q.certificationName ?? q.name ?? q.standard?.name ?? 'Qualification',
              employeeName: q.employeeId ? employeeMap.get(q.employeeId) : undefined,
              type: 'qualification',
              expiresAt,
            });
          }
        });
      }

      if (medResult.status === 'fulfilled') {
        toArray(medResult.value).forEach((m) => {
          const expiresAt = m.validTo ?? m.expirationDate;
          if (expiresAt) {
            expiryItems.push({
              id: m.id,
              name: m.clearanceType,
              employeeName: m.employeeId ? employeeMap.get(m.employeeId) : undefined,
              type: 'medical',
              expiresAt,
            });
          }
        });
      }

      if (failCount > 0) {
        setError('Some dashboard sections could not load. Showing available data.');
      }

      setData({ employees, assignments, expiryItems });
      setLoading(false);
    }

    void fetchData();

    return () => {
      ignore = true;
    };
  }, [authLoading, user]);

  const stats = useMemo(() => {
    if (!data) return null;

    const total = data.employees.length;
    const compliant = data.employees.filter((e) => e.status === 'compliant').length;
    const atRisk = data.employees.filter((e) => e.status === 'at_risk').length;
    const nonCompliant = data.employees.filter((e) => e.status === 'non_compliant').length;
    const compliantPct = total > 0 ? Math.round((compliant / total) * 100) : 0;

    const totalAssignments = data.assignments.length;
    const completedAssignments = data.assignments.filter((a) => a.completedAt !== null).length;

    return {
      total,
      compliant,
      atRisk,
      nonCompliant,
      compliantPct,
      totalAssignments,
      completedAssignments,
    };
  }, [data]);

  if (authLoading || loading) {
    return <div className="loading">Loading manager dashboard...</div>;
  }

  if (!user) {
    return (
      <PageShell title="Manager Dashboard" description="Dashboard is unavailable.">
        <div className="dashboard-empty-state">We couldn&apos;t find a signed-in user session.</div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Manager Dashboard"
      description="Team compliance status, assignment progress, and expiring items at a glance."
      breadcrumbs={[
        { label: 'Dashboard', to: '/' },
        { label: 'Manager Analytics' },
      ]}
      actions={
        <span className="dashboard-role-badge">Analytics</span>
      }
    >
      <div className="mgr-dashboard">
        {error ? (
          <div className="dashboard-inline-notice" role="status">
            {error}
          </div>
        ) : null}

        {stats ? (
          <>
            {/* Team Compliance Overview */}
            <section className="mgr-dashboard__section" aria-labelledby="mgr-compliance-title">
              <h2 id="mgr-compliance-title">Team Compliance</h2>
              <div className="mgr-stat-grid">
                <StatCard
                  label="Team Members"
                  value={stats.total}
                  subtitle="Total headcount"
                  tone="neutral"
                />
                <StatCard
                  label="Compliant"
                  value={stats.compliant}
                  subtitle={`${stats.compliantPct}% of team`}
                  tone="healthy"
                />
                <StatCard
                  label="At Risk"
                  value={stats.atRisk}
                  subtitle="Expiring or pending"
                  tone="warning"
                />
                <StatCard
                  label="Non-Compliant"
                  value={stats.nonCompliant}
                  subtitle="Overdue or expired"
                  tone="critical"
                />
              </div>
              <div className="mgr-compliance-bar">
                <ProgressBar
                  label="Overall Team Compliance"
                  current={stats.compliant}
                  total={stats.total}
                  unit="members"
                />
              </div>
            </section>

            {/* Compliance Breakdown */}
            {stats.total > 0 ? (
              <section className="mgr-dashboard__section" aria-labelledby="mgr-breakdown-title">
                <h2 id="mgr-breakdown-title">Team Members by Status</h2>
                <div className="mgr-employee-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data!.employees.map((emp) => (
                        <tr key={emp.id}>
                          <td>
                            <Link to={`/team/${emp.id}`} className="mgr-employee-link">
                              {emp.name}
                            </Link>
                          </td>
                          <td>
                            <ComplianceStatusBadge status={emp.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {/* Template Assignment Progress */}
            <section className="mgr-dashboard__section" aria-labelledby="mgr-assignments-title">
              <h2 id="mgr-assignments-title">Template Assignments</h2>
              <div className="mgr-stat-grid mgr-stat-grid--compact">
                <StatCard
                  label="Total Assignments"
                  value={stats.totalAssignments}
                  tone="neutral"
                />
                <StatCard
                  label="Completed"
                  value={stats.completedAssignments}
                  tone="healthy"
                />
                <StatCard
                  label="In Progress"
                  value={stats.totalAssignments - stats.completedAssignments}
                  tone={stats.totalAssignments - stats.completedAssignments > 0 ? 'warning' : 'healthy'}
                />
              </div>
              <div className="mgr-compliance-bar">
                <ProgressBar
                  label="Assignment Completion"
                  current={stats.completedAssignments}
                  total={stats.totalAssignments}
                  unit="assignments"
                />
              </div>
            </section>

            {/* Expiring Items */}
            <ExpiryWarningList
              items={data!.expiryItems}
              title="Expiring Qualifications & Clearances"
            />

            {/* Quick Actions */}
            <section className="mgr-dashboard__section" aria-labelledby="mgr-actions-title">
              <h2 id="mgr-actions-title">Quick Actions</h2>
              <div className="mgr-quick-actions">
                <Link to="/team/templates" className="mgr-quick-action">
                  Assign Template
                </Link>
                <Link to="/reviews/templates" className="mgr-quick-action">
                  Review Fulfillments
                </Link>
                <Link to="/team" className="mgr-quick-action">
                  View Team Directory
                </Link>
                <Link to="/reviews" className="mgr-quick-action">
                  Document Review Queue
                </Link>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </PageShell>
  );
}
