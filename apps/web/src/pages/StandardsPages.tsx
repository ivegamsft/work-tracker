import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageShell from '../components/PageShell';
import { api } from '../api/client';
import type { ComplianceStandardRecord, PaginatedResponse, StandardRequirementRecord } from '../types/my-section';
import { formatDate, getStatusBadgeClass, toArray } from './pageHelpers';
import '../styles/my-section.css';
import '../styles/managed-pages.css';

type StandardsResponse = ComplianceStandardRecord[] | PaginatedResponse<ComplianceStandardRecord>;

function formatRequiredLevel(requirement: StandardRequirementRecord) {
  const parts: string[] = [];

  if (requirement.minimumHours) {
    parts.push(`${requirement.minimumHours} hour${requirement.minimumHours === 1 ? '' : 's'}`);
  }

  if (requirement.recertificationPeriodMonths) {
    parts.push(`Recertify every ${requirement.recertificationPeriodMonths} months`);
  }

  return parts.join(' · ') || 'Standard evidence required';
}

function formatProofType(requirement: StandardRequirementRecord) {
  return requirement.requiredTests && requirement.requiredTests.length > 0
    ? requirement.requiredTests.join(', ')
    : 'Document review';
}

export function StandardsLibraryPage() {
  const [standards, setStandards] = useState<ComplianceStandardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    async function fetchStandards() {
      setLoading(true);

      try {
        const response = await api.get<StandardsResponse>('/standards?page=1&limit=100');
        setStandards(toArray(response));
        setError('');
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load standards');
      } finally {
        setLoading(false);
      }
    }

    fetchStandards();
  }, []);

  const filteredStandards = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return standards.filter((standard) => {
      const matchesStatus =
        statusFilter === 'all' || (statusFilter === 'active' ? standard.isActive : !standard.isActive);
      const matchesQuery =
        !query ||
        standard.name.toLowerCase().includes(query) ||
        standard.code.toLowerCase().includes(query) ||
        standard.description.toLowerCase().includes(query) ||
        standard.issuingBody.toLowerCase().includes(query);

      return matchesStatus && matchesQuery;
    });
  }, [searchQuery, standards, statusFilter]);

  if (loading) {
    return <div className="loading">Loading standards...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <PageShell
      title="Standards Library"
      description="Browse compliance standards, review requirement counts, and drill into requirement details."
      breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Standards' }]}
    >
      <div className="managed-page">
        <section className="my-card">
          <div className="managed-page__search">
            <div className="managed-page__search-field">
              <label className="my-form__group" htmlFor="standards-search">
                <span>Search standards</span>
                <input
                  id="standards-search"
                  className="managed-page__search-input"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by code, name, description, or issuing body"
                />
              </label>
            </div>
            <div className="managed-page__search-field">
              <label className="my-form__group" htmlFor="standards-status-filter">
                <span>Status</span>
                <select
                  id="standards-status-filter"
                  className="managed-page__search-select"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}
                >
                  <option value="all">All standards</option>
                  <option value="active">Active only</option>
                  <option value="inactive">Inactive only</option>
                </select>
              </label>
            </div>
          </div>
        </section>

        <section className="managed-page__summary-grid" aria-label="Standards summary">
          <div className="my-card managed-page__stat">
            <span className="my-page__field-label">Visible standards</span>
            <span className="managed-page__stat-value">{filteredStandards.length}</span>
          </div>
          <div className="my-card managed-page__stat">
            <span className="my-page__field-label">Active</span>
            <span className="managed-page__stat-value">{filteredStandards.filter((standard) => standard.isActive).length}</span>
          </div>
          <div className="my-card managed-page__stat">
            <span className="my-page__field-label">Requirements tracked</span>
            <span className="managed-page__stat-value">
              {filteredStandards.reduce((total, standard) => total + (standard.requirements?.length ?? 0), 0)}
            </span>
          </div>
        </section>

        {filteredStandards.length === 0 ? (
          <div className="my-empty-state">No standards match the current search and filter settings.</div>
        ) : (
          <div className="managed-page__card-grid">
            {filteredStandards.map((standard) => (
              <Link key={standard.id} to={`/standards/${standard.id}`} className="managed-page__card-link">
                <article className="my-card managed-page__clickable-card">
                  <div className="managed-page__section-header">
                    <div className="managed-page__card-title">
                      <span className="my-page__eyebrow">{standard.code}</span>
                      <h2>{standard.name}</h2>
                    </div>
                    <span className={getStatusBadgeClass(standard.isActive ? 'active' : 'inactive')}>
                      {standard.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p>{standard.description}</p>
                  <div className="my-page__meta">
                    <span className="my-badge">{standard.requirements?.length ?? 0} requirements</span>
                    <span className="my-badge">{standard.version}</span>
                  </div>
                  <p className="my-page__note">Issued by {standard.issuingBody}</p>
                </article>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}

export function StandardDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const [standard, setStandard] = useState<ComplianceStandardRecord | null>(null);
  const [requirements, setRequirements] = useState<StandardRequirementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError('Standard identifier is missing.');
      return;
    }

    async function fetchStandardDetail() {
      setLoading(true);

      try {
        const [standardResponse, requirementsResponse] = await Promise.all([
          api.get<ComplianceStandardRecord>(`/standards/${id}`),
          api.get<StandardRequirementRecord[]>(`/standards/${id}/requirements`),
        ]);
        setStandard(standardResponse);
        setRequirements(requirementsResponse.length > 0 ? requirementsResponse : standardResponse.requirements ?? []);
        setError('');
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load standard details');
      } finally {
        setLoading(false);
      }
    }

    fetchStandardDetail();
  }, [id]);

  if (loading) {
    return <div className="loading">Loading standard details...</div>;
  }

  if (error || !standard) {
    return (
      <PageShell
        title="Standard Detail"
        description="Review the selected compliance standard and its requirements."
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Standards', to: '/standards' },
          { label: standard?.name ?? id ?? 'Standard' },
        ]}
        actions={
          <Link to="/standards" className="my-btn my-btn--secondary">
            Back to library
          </Link>
        }
      >
        <div className="error">Error: {error || 'Standard not found'}</div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={standard.name}
      description="Review the selected compliance standard and its requirements."
      breadcrumbs={[
        { label: 'Dashboard', to: '/' },
        { label: 'Standards', to: '/standards' },
        { label: standard.name },
      ]}
      actions={
        <Link to="/standards" className="my-btn my-btn--secondary">
          Back to library
        </Link>
      }
    >
      <div className="managed-page">
        <section className="my-card">
          <div className="managed-page__section-header">
            <div>
              <p className="my-page__eyebrow">{standard.code}</p>
              <h2>Standard overview</h2>
              <p className="my-page__muted">{standard.description}</p>
            </div>
            <span className={getStatusBadgeClass(standard.isActive ? 'active' : 'inactive')}>
              {standard.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="managed-page__meta-grid">
            <div className="my-page__field">
              <span className="my-page__field-label">Issuing body</span>
              <span className="my-page__field-value">{standard.issuingBody}</span>
            </div>
            <div className="my-page__field">
              <span className="my-page__field-label">Version</span>
              <span className="my-page__field-value">{standard.version}</span>
            </div>
            <div className="my-page__field">
              <span className="my-page__field-label">Requirements</span>
              <span className="my-page__field-value">{requirements.length}</span>
            </div>
            <div className="my-page__field">
              <span className="my-page__field-label">Last updated</span>
              <span className="my-page__field-value">{formatDate(standard.updatedAt, 'Unknown')}</span>
            </div>
          </div>
        </section>

        {requirements.length === 0 ? (
          <div className="my-empty-state">No requirements have been recorded for this standard yet.</div>
        ) : (
          <section className="my-card" aria-labelledby="standard-requirements-table">
            <div>
              <h2 id="standard-requirements-table">Requirements</h2>
              <p className="my-page__muted">Each row represents a proof expectation or renewal rule for this standard.</p>
            </div>
            <table className="my-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Proof Type</th>
                  <th>Required Level</th>
                </tr>
              </thead>
              <tbody>
                {requirements.map((requirement) => (
                  <tr key={requirement.id}>
                    <td data-label="Name">{requirement.category}</td>
                    <td data-label="Description">{requirement.description}</td>
                    <td data-label="Proof Type">{formatProofType(requirement)}</td>
                    <td data-label="Required Level">{formatRequiredLevel(requirement)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </PageShell>
  );
}
