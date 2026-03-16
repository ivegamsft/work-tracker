import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, api } from '../api/client';
import PageShell from '../components/PageShell';
import TemplateStatusBadge from '../components/templates/TemplateStatusBadge';
import {
  buildTemplateCategoryOptions,
  formatTemplateProofType,
  getPrimaryProofType,
  sortTemplateRequirements,
  TEMPLATE_PROOF_TYPE_OPTIONS,
} from '../components/templates/templateUtils';
import type { PaginatedResponse } from '../types/my-section';
import type { ProofTemplateRecord } from '../types/templates';
import { toArray } from './pageHelpers';
import '../styles/my-section.css';
import '../styles/managed-pages.css';
import '../styles/template-screens.css';

type TemplatesResponse = ProofTemplateRecord[] | PaginatedResponse<ProofTemplateRecord>;

export default function TemplateLibraryPage() {
  const [templates, setTemplates] = useState<ProofTemplateRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProofType, setSelectedProofType] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    async function fetchTemplates() {
      setLoading(true);

      try {
        const response = await api.get<TemplatesResponse>('/templates?page=1&limit=100');

        if (!ignore) {
          setTemplates(toArray(response));
          setError('');
        }
      } catch (fetchError) {
        if (!ignore) {
          if (fetchError instanceof ApiError && fetchError.status === 403) {
            setError('Template library access is currently limited to supervisors and above.');
          } else {
            setError(fetchError instanceof Error ? fetchError.message : 'Failed to load templates');
          }
          setTemplates([]);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void fetchTemplates();

    return () => {
      ignore = true;
    };
  }, []);

  const categoryOptions = useMemo(
    () => buildTemplateCategoryOptions(templates.map((template) => template.category)),
    [templates],
  );

  const filteredTemplates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return [...templates]
      .filter((template) => {
        const proofType = getPrimaryProofType(template.requirements);
        const category = template.category?.trim() ?? '';
        const matchesSearch =
          query.length === 0 ||
          template.name.toLowerCase().includes(query) ||
          template.description.toLowerCase().includes(query) ||
          category.toLowerCase().includes(query) ||
          template.requirements.some((requirement) => requirement.name.toLowerCase().includes(query));
        const matchesProofType = selectedProofType === 'all' || proofType === selectedProofType;
        const matchesCategory = selectedCategory === 'all' || category === selectedCategory;

        return matchesSearch && matchesProofType && matchesCategory;
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [searchQuery, selectedCategory, selectedProofType, templates]);

  const publishedCount = templates.filter((template) => template.status === 'published').length;

  if (loading) {
    return (
      <PageShell
        title="Template Library"
        description="Browse reusable proof templates across compliance programs."
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Template Library' }]}
      >
        <div className="loading">Loading template library...</div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Template Library"
      description="Browse reusable proof templates, compare requirements, and jump into assignment workflows."
      breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Template Library' }]}
      actions={<span className="my-badge my-badge--active">{filteredTemplates.length} showing</span>}
    >
      <div className="managed-page template-screen">
        {error ? <div className="error">Error: {error}</div> : null}

        <section className="managed-page__summary-grid" aria-label="Template library summary">
          <article className="my-card managed-page__stat">
            <span className="my-page__field-label">Templates available</span>
            <span className="managed-page__stat-value">{templates.length}</span>
          </article>
          <article className="my-card managed-page__stat">
            <span className="my-page__field-label">Published</span>
            <span className="managed-page__stat-value">{publishedCount}</span>
          </article>
          <article className="my-card managed-page__stat">
            <span className="my-page__field-label">Categories</span>
            <span className="managed-page__stat-value">{categoryOptions.length}</span>
          </article>
        </section>

        <section className="my-card" aria-labelledby="template-library-filters">
          <div className="managed-page__search">
            <div className="template-screen__results-copy">
              <h2 id="template-library-filters">Browse templates</h2>
              <p className="template-screen__results-count">
                Showing {filteredTemplates.length} of {templates.length} templates
              </p>
            </div>
          </div>
          <div className="template-screen__upload-row">
            <label className="my-form__group">
              <span>Search templates</span>
              <input
                className="managed-page__search-input"
                placeholder="Search by name, category, description, or requirement"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>
            <label className="my-form__group">
              <span>Proof type</span>
              <select
                className="managed-page__search-select"
                value={selectedProofType}
                onChange={(event) => setSelectedProofType(event.target.value)}
              >
                <option value="all">All proof types</option>
                {TEMPLATE_PROOF_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="my-form__group">
              <span>Category</span>
              <select
                className="managed-page__search-select"
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
              >
                <option value="all">All categories</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {filteredTemplates.length === 0 ? (
          <div className="my-empty-state">No templates matched your current filters.</div>
        ) : (
          <section className="managed-page__card-grid" aria-label="Template cards">
            {filteredTemplates.map((template) => {
              const requirements = sortTemplateRequirements(template.requirements);
              const proofType = getPrimaryProofType(requirements);

              return (
                <Link key={template.id} to={`/templates/${template.id}`} className="managed-page__card-link">
                  <article className="my-card managed-page__clickable-card">
                    <div className="managed-page__section-header">
                      <div className="managed-page__card-title">
                        <span className="my-page__eyebrow">Template library</span>
                        <h2>{template.name}</h2>
                      </div>
                      <TemplateStatusBadge status={template.status} />
                    </div>

                    <p className="template-screen__card-description">{template.description || 'No description added yet.'}</p>

                    <div className="template-screen__card-meta">
                      <div className="my-page__field">
                        <span className="my-page__field-label">Proof type</span>
                        <span className="my-page__field-value">{formatTemplateProofType(proofType)}</span>
                      </div>
                      <div className="my-page__field">
                        <span className="my-page__field-label">Category</span>
                        <span className="my-page__field-value">{template.category || 'Uncategorized'}</span>
                      </div>
                      <div className="my-page__field">
                        <span className="my-page__field-label">Requirements</span>
                        <span className="my-page__field-value">{requirements.length}</span>
                      </div>
                    </div>

                    <div className="template-screen__card-footer">
                      <span className="my-badge">Version {template.version}</span>
                      <span className="my-badge my-badge--warning">View detail</span>
                    </div>
                  </article>
                </Link>
              );
            })}
          </section>
        )}
      </div>
    </PageShell>
  );
}
