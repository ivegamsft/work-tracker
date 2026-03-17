import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import PageShell from '../components/PageShell';
import { formatDate, getDaysUntil, toTitleCase } from './pageHelpers';
import '../styles/my-section.css';
import '../styles/managed-pages.css';
import '../styles/template-screens.css';

interface TeamAssignmentProgress {
  id: string;
  templateId: string;
  templateName: string;
  status: string;
  dueDate: string | null;
  completedAt: string | null;
  totalRequirements: number;
  fulfilledRequirements: number;
  completionPercentage: number;
  isOverdue: boolean;
  isAtRisk: boolean;
}

interface TeamTemplateProgress {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  assignments: TeamAssignmentProgress[];
  overallCompletionPercentage: number;
}

interface TeamTemplateRow {
  assignmentId: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  templateId: string;
  templateName: string;
  status: string;
  dueDate: string | null;
  completedAt: string | null;
  totalRequirements: number;
  fulfilledRequirements: number;
  completionPercentage: number;
  isOverdue: boolean;
  isAtRisk: boolean;
}

function flattenTeamData(employees: TeamTemplateProgress[]): TeamTemplateRow[] {
  const rows: TeamTemplateRow[] = [];

  for (const employee of employees) {
    for (const assignment of employee.assignments) {
      rows.push({
        assignmentId: assignment.id,
        employeeId: employee.employeeId,
        employeeName: employee.employeeName,
        employeeEmail: employee.employeeEmail,
        templateId: assignment.templateId,
        templateName: assignment.templateName,
        status: assignment.status,
        dueDate: assignment.dueDate,
        completedAt: assignment.completedAt,
        totalRequirements: assignment.totalRequirements,
        fulfilledRequirements: assignment.fulfilledRequirements,
        completionPercentage: assignment.completionPercentage,
        isOverdue: assignment.isOverdue,
        isAtRisk: assignment.isAtRisk,
      });
    }
  }

  return rows;
}

function getStatusBadgeClass(status: string, isOverdue: boolean, isAtRisk: boolean): string {
  if (status === 'completed') return 'my-badge my-badge--active';
  if (isOverdue) return 'my-badge my-badge--expired';
  if (isAtRisk) return 'my-badge my-badge--warning';
  return 'my-badge';
}

function getStatusLabel(status: string, isOverdue: boolean, isAtRisk: boolean): string {
  if (isOverdue) return 'Overdue';
  if (status === 'completed') return 'Completed';
  if (isAtRisk) return 'At Risk';
  return toTitleCase(status);
}

function buildTemplateOptions(rows: TeamTemplateRow[]): string[] {
  const names = new Set(rows.map((row) => row.templateName));
  return Array.from(names).sort();
}

export default function TeamTemplatesPage() {
  const [employees, setEmployees] = useState<TeamTemplateProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [templateFilter, setTemplateFilter] = useState('all');

  useEffect(() => {
    let ignore = false;

    async function fetchTeamTemplates() {
      setLoading(true);

      try {
        const response = await api.get<{ data: TeamTemplateProgress[] }>('/templates/team?page=1&limit=200');

        if (!ignore) {
          setEmployees(response.data);
          setError('');
        }
      } catch (fetchError) {
        if (!ignore) {
          setEmployees([]);

          if (fetchError instanceof ApiError && fetchError.status === 403) {
            setError('Team template view is limited to supervisors and above.');
          } else {
            setError(fetchError instanceof Error ? fetchError.message : 'Failed to load team templates');
          }
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void fetchTeamTemplates();

    return () => {
      ignore = true;
    };
  }, []);

  const allRows = useMemo(() => flattenTeamData(employees), [employees]);
  const templateOptions = useMemo(() => buildTemplateOptions(allRows), [allRows]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return allRows.filter((row) => {
      if (query.length > 0) {
        const matchesSearch =
          row.employeeName.toLowerCase().includes(query) ||
          row.employeeEmail.toLowerCase().includes(query) ||
          row.templateName.toLowerCase().includes(query);

        if (!matchesSearch) return false;
      }

      if (statusFilter !== 'all') {
        if (statusFilter === 'overdue' && !row.isOverdue) return false;
        if (statusFilter === 'at_risk' && !row.isAtRisk) return false;
        if (statusFilter === 'completed' && row.status !== 'completed') return false;
        if (statusFilter === 'in_progress' && (row.status !== 'in_progress' || row.isOverdue || row.isAtRisk))
          return false;
      }

      if (templateFilter !== 'all' && row.templateName !== templateFilter) return false;

      return true;
    });
  }, [allRows, searchQuery, statusFilter, templateFilter]);

  const summaryStats = useMemo(() => {
    const uniqueEmployees = new Set(allRows.map((row) => row.employeeId)).size;
    const totalAssignments = allRows.length;
    const overdueCount = allRows.filter((row) => row.isOverdue).length;
    const atRiskCount = allRows.filter((row) => row.isAtRisk).length;
    const completedCount = allRows.filter((row) => row.status === 'completed').length;

    return { uniqueEmployees, totalAssignments, overdueCount, atRiskCount, completedCount };
  }, [allRows]);

  if (loading) {
    return (
      <PageShell title="Team Templates" description="Monitor team assignment progress and compliance status.">
        <div className="loading">Loading team templates...</div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Team Templates"
      description="Monitor team assignment progress and compliance status across your direct reports."
      breadcrumbs={[
        { label: 'Dashboard', to: '/' },
        { label: 'Team', to: '/team' },
        { label: 'Templates' },
      ]}
      actions={
        <Link to="/templates" className="my-btn my-btn--secondary">
          Template Library
        </Link>
      }
    >
      <div className="managed-page template-screen">
        {error ? <div className="error">Error: {error}</div> : null}

        <div className="managed-page__summary-grid" aria-label="Team template summary">
          <div className="my-card">
            <span className="my-page__eyebrow">Employees</span>
            <span className="my-page__field-value">{summaryStats.uniqueEmployees}</span>
          </div>
          <div className="my-card">
            <span className="my-page__eyebrow">Assignments</span>
            <span className="my-page__field-value">{summaryStats.totalAssignments}</span>
          </div>
          <div className="my-card">
            <span className="my-page__eyebrow">Completed</span>
            <span className="my-page__field-value">{summaryStats.completedCount}</span>
          </div>
          <div className="my-card">
            <span className="my-page__eyebrow">Overdue</span>
            <span className="my-page__field-value">{summaryStats.overdueCount}</span>
          </div>
          <div className="my-card">
            <span className="my-page__eyebrow">At Risk</span>
            <span className="my-page__field-value">{summaryStats.atRiskCount}</span>
          </div>
        </div>

        <section className="my-card" aria-labelledby="team-templates-table">
          <div className="managed-page__section-header">
            <div>
              <h2 id="team-templates-table">Assignment Overview</h2>
              <p className="my-page__muted">
                Showing {filteredRows.length} of {allRows.length} assignment(s)
              </p>
            </div>
          </div>

          <div className="template-screen__upload-row">
            <label className="my-form__group">
              <span>Search</span>
              <input
                className="managed-page__search-input"
                placeholder="Search by employee or template name"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>
            <label className="my-form__group">
              <span>Status</span>
              <select
                aria-label="Status filter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
                <option value="overdue">Overdue</option>
                <option value="at_risk">At risk</option>
              </select>
            </label>
            <label className="my-form__group">
              <span>Template</span>
              <select
                aria-label="Template filter"
                value={templateFilter}
                onChange={(event) => setTemplateFilter(event.target.value)}
              >
                <option value="all">All templates</option>
                {templateOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {filteredRows.length === 0 ? (
            <p className="my-page__muted">No assignments match the current filters.</p>
          ) : (
            <div className="managed-page__table-wrapper">
              <table className="managed-page__table" aria-label="Team template assignments">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Template</th>
                    <th>Status</th>
                    <th>Progress</th>
                    <th>Due Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.assignmentId}>
                      <td>
                        <div>
                          <Link to={`/team/${row.employeeId}`}>{row.employeeName}</Link>
                          <p className="my-page__muted">{row.employeeEmail}</p>
                        </div>
                      </td>
                      <td>
                        <Link to={`/templates/${row.templateId}`}>{row.templateName}</Link>
                      </td>
                      <td>
                        <span className={getStatusBadgeClass(row.status, row.isOverdue, row.isAtRisk)}>
                          {getStatusLabel(row.status, row.isOverdue, row.isAtRisk)}
                        </span>
                      </td>
                      <td>
                        <div className="template-screen__progress-cell">
                          <div className="template-screen__progress-bar" aria-label={`${row.completionPercentage}% complete`}>
                            <div
                              className="template-screen__progress-fill"
                              style={{ width: `${row.completionPercentage}%` }}
                            />
                          </div>
                          <span className="my-page__muted">
                            {row.fulfilledRequirements}/{row.totalRequirements}
                          </span>
                        </div>
                      </td>
                      <td>
                        {row.dueDate ? (
                          <span className={getDaysUntil(row.dueDate) < 0 ? 'my-page__muted my-page__overdue' : ''}>
                            {formatDate(row.dueDate)}
                          </span>
                        ) : (
                          <span className="my-page__muted">No deadline</span>
                        )}
                      </td>
                      <td>
                        <Link to={`/templates/${row.templateId}`} className="my-btn my-btn--secondary my-btn--small">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}
