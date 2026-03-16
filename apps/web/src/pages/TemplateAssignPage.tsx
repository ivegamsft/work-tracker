import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import PageShell from '../components/PageShell';
import TemplateStatusBadge from '../components/templates/TemplateStatusBadge';
import { formatTemplateProofType, getPrimaryProofType } from '../components/templates/templateUtils';
import type { EmployeeListRecord, ProofTemplateRecord, AssignTemplateResult } from '../types/templates';
import type { PaginatedResponse } from '../types/my-section';
import '../styles/my-section.css';
import '../styles/managed-pages.css';
import '../styles/template-screens.css';

function getEmployeeName(employee: EmployeeListRecord) {
  return `${employee.firstName} ${employee.lastName}`.trim() || employee.email;
}

export default function TemplateAssignPage() {
  const { id = '' } = useParams<{ id: string }>();
  const [template, setTemplate] = useState<ProofTemplateRecord | null>(null);
  const [employees, setEmployees] = useState<EmployeeListRecord[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());
  const [dueDate, setDueDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    let ignore = false;

    async function fetchAssignData() {
      setLoading(true);

      try {
        const [templateResponse, employeesResponse] = await Promise.all([
          api.get<ProofTemplateRecord>(`/templates/${id}`),
          api.get<PaginatedResponse<EmployeeListRecord>>('/employees'),
        ]);

        if (!ignore) {
          setTemplate(templateResponse);
          setEmployees(employeesResponse.data);
          setError('');
        }
      } catch (fetchError) {
        if (!ignore) {
          setTemplate(null);
          setEmployees([]);
          setError(fetchError instanceof Error ? fetchError.message : 'Failed to load assignment flow');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    if (id) {
      void fetchAssignData();
    } else {
      setLoading(false);
      setError('Template identifier is missing.');
    }

    return () => {
      ignore = true;
    };
  }, [id]);

  const filteredEmployees = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return employees.filter((employee) => {
      const name = getEmployeeName(employee).toLowerCase();
      return (
        query.length === 0 ||
        name.includes(query) ||
        employee.email.toLowerCase().includes(query) ||
        employee.departmentId.toLowerCase().includes(query)
      );
    });
  }, [employees, searchQuery]);

  const selectedEmployees = useMemo(
    () => employees.filter((employee) => selectedEmployeeIds.has(employee.id)),
    [employees, selectedEmployeeIds],
  );

  const handleToggleEmployee = (employeeId: string) => {
    setSelectedEmployeeIds((current) => {
      const next = new Set(current);

      if (next.has(employeeId)) {
        next.delete(employeeId);
      } else {
        next.add(employeeId);
      }

      return next;
    });
  };

  const handleSelectFiltered = () => {
    setSelectedEmployeeIds((current) => {
      const next = new Set(current);
      filteredEmployees.filter((employee) => employee.isActive).forEach((employee) => next.add(employee.id));
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedEmployeeIds(new Set());
  };

  const handleAssign = async () => {
    if (!template) {
      return;
    }

    if (selectedEmployeeIds.size === 0) {
      setError('Select at least one employee to assign this template.');
      return;
    }

    if (!window.confirm(`Assign ${template.name} to ${selectedEmployeeIds.size} employee(s)?`)) {
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccessMessage('');

    try {
      const result = await api.post<AssignTemplateResult>(`/templates/${template.id}/assign`, {
        employeeIds: Array.from(selectedEmployeeIds),
        dueDate: dueDate || undefined,
      });
      setSuccessMessage(`Assigned ${result.created} employee(s). Skipped ${result.skipped} duplicate assignment(s).`);
      setSelectedEmployeeIds(new Set());
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to assign template');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PageShell title="Assign Template" description="Select employees and submit bulk assignments.">
        <div className="loading">Loading template assignment...</div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={template ? `Assign ${template.name}` : 'Assign Template'}
      description="Select employees, set an optional due date, and confirm the bulk assignment request."
      breadcrumbs={[
        { label: 'Dashboard', to: '/' },
        { label: 'Template Library', to: '/templates' },
        { label: template?.name ?? 'Template Detail', to: template ? `/templates/${template.id}` : '/templates' },
        { label: 'Assign' },
      ]}
      actions={
        <div className="my-page__actions">
          <Link to={template ? `/templates/${template.id}` : '/templates'} className="my-btn my-btn--secondary">
            Cancel
          </Link>
          <button
            type="button"
            className="my-btn my-btn--primary"
            onClick={handleAssign}
            disabled={submitting || !template || template.status !== 'published'}
          >
            {submitting ? 'Assigning...' : 'Confirm assignment'}
          </button>
        </div>
      }
    >
      <div className="managed-page template-screen">
        {error ? <div className="error">Error: {error}</div> : null}
        {successMessage ? <div className="my-card">{successMessage}</div> : null}

        {template ? (
          <div className="managed-page__split">
            <section className="template-screen__requirement-body">
              <article className="my-card">
                <div className="managed-page__section-header">
                  <div>
                    <h2>Choose employees</h2>
                    <p className="my-page__muted">Use search to find employees, then assign the template in one bulk action.</p>
                  </div>
                  <div className="template-screen__employee-actions">
                    <button type="button" className="my-btn my-btn--secondary" onClick={handleSelectFiltered}>
                      Select filtered active
                    </button>
                    <button type="button" className="my-btn my-btn--secondary" onClick={handleClearSelection}>
                      Clear selection
                    </button>
                  </div>
                </div>

                <div className="template-screen__upload-row">
                  <label className="my-form__group">
                    <span>Search employees</span>
                    <input
                      className="managed-page__search-input"
                      placeholder="Search by name, email, or department"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                    />
                  </label>
                  <label className="my-form__group">
                    <span>Due date</span>
                    <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
                  </label>
                </div>

                <p className="template-screen__results-count">
                  Showing {filteredEmployees.length} employee(s) • {selectedEmployeeIds.size} selected
                </p>

                <div className="template-screen__employee-list" aria-label="Employee selection list">
                  {filteredEmployees.map((employee) => {
                    const checked = selectedEmployeeIds.has(employee.id);

                    return (
                      <label key={employee.id} className="template-screen__employee-row">
                        <span>
                          <input type="checkbox" checked={checked} onChange={() => handleToggleEmployee(employee.id)} />
                        </span>
                        <div>
                          <strong>{getEmployeeName(employee)}</strong>
                          <p className="my-page__muted">{employee.email}</p>
                        </div>
                        <span className="my-badge">{employee.departmentId || 'Unassigned'}</span>
                        <span className={employee.isActive ? 'my-badge my-badge--active' : 'my-badge'}>
                          {employee.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </article>
            </section>

            <aside className="template-screen__sticky-panel">
              <article className="my-card">
                <div className="managed-page__section-header">
                  <div>
                    <h2>Assignment summary</h2>
                    <p className="my-page__muted">Review details before you submit the bulk assignment.</p>
                  </div>
                  <TemplateStatusBadge status={template.status} />
                </div>

                <div className="template-screen__selection-summary">
                  <div className="my-page__field">
                    <span className="my-page__field-label">Template</span>
                    <span className="my-page__field-value">{template.name}</span>
                  </div>
                  <div className="my-page__field">
                    <span className="my-page__field-label">Proof type</span>
                    <span className="my-page__field-value">{formatTemplateProofType(getPrimaryProofType(template.requirements))}</span>
                  </div>
                  <div className="my-page__field">
                    <span className="my-page__field-label">Requirements</span>
                    <span className="my-page__field-value">{template.requirements.length}</span>
                  </div>
                  <div className="my-page__field">
                    <span className="my-page__field-label">Due date</span>
                    <span className="my-page__field-value">{dueDate || 'No deadline'}</span>
                  </div>
                </div>

                <div>
                  <h3>Selected employees</h3>
                  {selectedEmployees.length === 0 ? (
                    <p className="my-page__muted">No employees selected yet.</p>
                  ) : (
                    <ul className="template-screen__checklist">
                      {selectedEmployees.slice(0, 8).map((employee) => (
                        <li key={employee.id}>{getEmployeeName(employee)}</li>
                      ))}
                      {selectedEmployees.length > 8 ? <li>+ {selectedEmployees.length - 8} more</li> : null}
                    </ul>
                  )}
                </div>

                {template.status !== 'published' ? (
                  <div className="my-coming-soon">Only published templates can be assigned. Publish a draft before using this flow.</div>
                ) : null}
              </article>
            </aside>
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}
