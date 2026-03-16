import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '../components/PageShell';
import { api, ApiError } from '../api/client';
import { formatDateTime, getStatusBadgeClass, toTitleCase } from './pageHelpers';
import { formatTemplateProofType } from '../components/templates/templateUtils';
import type { PaginatedResponse } from '../types/my-section';
import '../styles/my-section.css';
import '../styles/managed-pages.css';

export interface FulfillmentReviewItem {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  templateId: string;
  templateName: string;
  requirementId: string;
  requirementName: string;
  proofType: string | null;
  attestationLevels: string[];
  submittedAt: string;
  status: string;
  isPriority: boolean;
}

export default function FulfillmentReviewQueuePage() {
  const [items, setItems] = useState<FulfillmentReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending_review');
  const [proofTypeFilter, setProofTypeFilter] = useState('all');

  useEffect(() => {
    let ignore = false;

    async function fetchQueue() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (statusFilter && statusFilter !== 'all') {
          params.set('status', statusFilter);
        }
        if (proofTypeFilter && proofTypeFilter !== 'all') {
          params.set('proofType', proofTypeFilter);
        }
        params.set('limit', '50');

        const response = await api.get<PaginatedResponse<FulfillmentReviewItem>>(
          `/fulfillments/reviews?${params.toString()}`,
        );

        if (!ignore) {
          setItems(Array.isArray(response) ? response : response.data);
          setError('');
        }
      } catch (err) {
        if (!ignore) {
          if (err instanceof ApiError && err.status === 403) {
            setError('You do not have permission to view the fulfillment review queue.');
          } else {
            setError(err instanceof Error ? err.message : 'Failed to load review queue');
          }
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    fetchQueue();
    return () => { ignore = true; };
  }, [statusFilter, proofTypeFilter]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;

    const query = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.employeeName.toLowerCase().includes(query) ||
        item.templateName.toLowerCase().includes(query) ||
        item.requirementName.toLowerCase().includes(query),
    );
  }, [items, searchQuery]);

  const priorityCount = items.filter((item) => item.isPriority).length;

  if (loading) {
    return <div className="loading">Loading fulfillment review queue...</div>;
  }

  return (
    <PageShell
      title="Fulfillment Review Queue"
      description="Review pending proof fulfillments submitted by employees. Approve, reject, or request changes."
      breadcrumbs={[
        { label: 'Dashboard', to: '/' },
        { label: 'Reviews', to: '/reviews' },
        { label: 'Template Fulfillments' },
      ]}
      actions={<span className="my-badge">{filteredItems.length} showing</span>}
    >
      <div className="managed-page">
        {error ? <div className="error">Error: {error}</div> : null}

        <section className="managed-page__summary-grid" aria-label="Review queue summary">
          <div className="my-card managed-page__stat">
            <span className="my-page__field-label">Pending reviews</span>
            <span className="managed-page__stat-value">{items.length}</span>
          </div>
          <div className="my-card managed-page__stat">
            <span className="my-page__field-label">Priority items</span>
            <span className="managed-page__stat-value">{priorityCount}</span>
          </div>
        </section>

        <section className="my-card">
          <div className="managed-page__filter-row">
            <label className="my-form__group">
              <span>Search</span>
              <input
                className="managed-page__search-input"
                placeholder="Search by employee, template, or requirement..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </label>
            <label className="my-form__group">
              <span>Status</span>
              <select
                className="managed-page__search-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Status"
              >
                <option value="pending_review">Pending Review</option>
                <option value="all">All Statuses</option>
                <option value="fulfilled">Fulfilled</option>
                <option value="rejected">Rejected</option>
                <option value="expired">Expired</option>
              </select>
            </label>
            <label className="my-form__group">
              <span>Proof type</span>
              <select
                className="managed-page__search-select"
                value={proofTypeFilter}
                onChange={(e) => setProofTypeFilter(e.target.value)}
                aria-label="Proof type"
              >
                <option value="all">All Types</option>
                <option value="hours">Hours</option>
                <option value="certification">Certification</option>
                <option value="training">Training</option>
                <option value="clearance">Clearance</option>
                <option value="assessment">Assessment</option>
                <option value="compliance">Compliance</option>
              </select>
            </label>
          </div>
        </section>

        {filteredItems.length === 0 ? (
          <div className="my-empty-state">No fulfillments are waiting for review right now.</div>
        ) : (
          <section className="my-card" aria-labelledby="fulfillment-review-table">
            <div>
              <h2 id="fulfillment-review-table">Review queue</h2>
              <p className="my-page__muted">
                Open a fulfillment to inspect submitted evidence and complete the review decision.
              </p>
            </div>
            <table className="my-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Template</th>
                  <th>Requirement</th>
                  <th>Proof type</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Priority</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Employee">
                      <Link
                        to={`/reviews/templates/${item.id}`}
                        className="managed-page__table-link"
                      >
                        {item.employeeName}
                      </Link>
                    </td>
                    <td data-label="Template">{item.templateName}</td>
                    <td data-label="Requirement">{item.requirementName}</td>
                    <td data-label="Proof type">{formatTemplateProofType(item.proofType)}</td>
                    <td data-label="Submitted">{formatDateTime(item.submittedAt, 'Unknown')}</td>
                    <td data-label="Status">
                      <span className={getStatusBadgeClass(item.status)}>
                        {toTitleCase(item.status)}
                      </span>
                    </td>
                    <td data-label="Priority">
                      {item.isPriority ? (
                        <span className="my-badge my-badge--expired">Priority</span>
                      ) : (
                        <span className="my-badge">Normal</span>
                      )}
                    </td>
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
