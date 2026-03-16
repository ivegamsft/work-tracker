import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import PageShell from '../components/PageShell';
import {
  isEditableTemplateStatus,
  TEMPLATE_ATTESTATION_LEVEL_OPTIONS,
  TEMPLATE_PROOF_TYPE_OPTIONS,
} from '../components/templates/templateUtils';
import type {
  ProofTemplateRecord,
  TemplateAttestationLevel,
  TemplateProofType,
  TemplateRequirementRecord,
} from '../types/templates';
import '../styles/my-section.css';
import '../styles/managed-pages.css';
import '../styles/template-screens.css';

interface EditableRequirement {
  localId: string;
  id?: string;
  name: string;
  description: string;
  attestationLevels: TemplateAttestationLevel[];
  isRequired: boolean;
}

interface TemplateEditorFormState {
  name: string;
  description: string;
  category: string;
  proofType: TemplateProofType;
  requirements: EditableRequirement[];
}

function createLocalId() {
  return globalThis.crypto?.randomUUID?.() ?? `requirement-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toEditableRequirement(requirement?: TemplateRequirementRecord): EditableRequirement {
  return {
    localId: createLocalId(),
    id: requirement?.id,
    name: requirement?.name ?? '',
    description: requirement?.description ?? '',
    attestationLevels: requirement?.attestationLevels ?? ['upload'],
    isRequired: requirement?.isRequired ?? true,
  };
}

function buildEditorForm(template: ProofTemplateRecord): TemplateEditorFormState {
  const proofType = template.requirements.find((requirement) => requirement.proofType)?.proofType ?? 'compliance';

  return {
    name: template.name,
    description: template.description ?? '',
    category: template.category ?? '',
    proofType,
    requirements: template.requirements.length > 0 ? template.requirements.map((requirement) => toEditableRequirement(requirement)) : [toEditableRequirement()],
  };
}

function validateEditorForm(form: TemplateEditorFormState) {
  const errors: string[] = [];

  if (!form.name.trim()) {
    errors.push('Template name is required.');
  }

  if (!form.proofType) {
    errors.push('Select a proof type.');
  }

  if (form.requirements.length === 0) {
    errors.push('Add at least one requirement before saving.');
  }

  form.requirements.forEach((requirement, index) => {
    if (!requirement.name.trim()) {
      errors.push(`Requirement ${index + 1} needs a name.`);
    }

    if (requirement.attestationLevels.length === 0) {
      errors.push(`Requirement ${index + 1} must include at least one attestation level.`);
    }
  });

  return errors;
}

function buildRequirementPayload(requirement: EditableRequirement, proofType: TemplateProofType) {
  return {
    name: requirement.name.trim(),
    description: requirement.description.trim(),
    attestationLevels: requirement.attestationLevels,
    proofType,
    isRequired: requirement.isRequired,
  };
}

export default function TemplateEditorPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<ProofTemplateRecord | null>(null);
  const [form, setForm] = useState<TemplateEditorFormState | null>(null);
  const [initialSnapshot, setInitialSnapshot] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    let ignore = false;

    async function fetchTemplate() {
      setLoading(true);

      try {
        const response = await api.get<ProofTemplateRecord>(`/templates/${id}`);
        const nextForm = buildEditorForm(response);

        if (!ignore) {
          setTemplate(response);
          setForm(nextForm);
          setInitialSnapshot(JSON.stringify(nextForm));
          setError('');
          setValidationErrors([]);
        }
      } catch (fetchError) {
        if (!ignore) {
          setTemplate(null);
          setForm(null);
          setError(fetchError instanceof Error ? fetchError.message : 'Failed to load template editor');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    if (id) {
      void fetchTemplate();
    } else {
      setLoading(false);
      setError('Template identifier is missing.');
    }

    return () => {
      ignore = true;
    };
  }, [id]);

  const isEditable = isEditableTemplateStatus(template?.status);
  const isDirty = useMemo(() => (form ? JSON.stringify(form) !== initialSnapshot : false), [form, initialSnapshot]);

  const updateRequirement = (localId: string, update: (current: EditableRequirement) => EditableRequirement) => {
    setForm((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        requirements: current.requirements.map((requirement) =>
          requirement.localId === localId ? update(requirement) : requirement,
        ),
      };
    });
  };

  const moveRequirement = (index: number, direction: -1 | 1) => {
    setForm((current) => {
      if (!current) {
        return current;
      }

      const nextIndex = index + direction;

      if (nextIndex < 0 || nextIndex >= current.requirements.length) {
        return current;
      }

      const requirements = [...current.requirements];
      const [moved] = requirements.splice(index, 1);
      requirements.splice(nextIndex, 0, moved);

      return {
        ...current,
        requirements,
      };
    });
  };

  const handleAddRequirement = () => {
    setForm((current) =>
      current
        ? {
            ...current,
            requirements: [...current.requirements, toEditableRequirement()],
          }
        : current,
    );
  };

  const handleRemoveRequirement = (localId: string) => {
    setForm((current) => {
      if (!current || current.requirements.length === 1) {
        return current;
      }

      return {
        ...current,
        requirements: current.requirements.filter((requirement) => requirement.localId !== localId),
      };
    });
  };

  const handleCancel = () => {
    if (isDirty && !window.confirm('Discard your unsaved template changes?')) {
      return;
    }

    navigate(id ? `/templates/${id}` : '/templates');
  };

  const handleSave = async () => {
    if (!form || !template) {
      return;
    }

    const nextValidationErrors = validateEditorForm(form);
    setValidationErrors(nextValidationErrors);

    if (nextValidationErrors.length > 0) {
      return;
    }

    if (!isEditable) {
      setError('Only draft templates can be edited.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      await api.put<ProofTemplateRecord>(`/templates/${template.id}`, {
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category.trim() || null,
      });

      const removedRequirementIds = template.requirements
        .map((requirement) => requirement.id)
        .filter((requirementId) => !form.requirements.some((requirement) => requirement.id === requirementId));

      for (const requirementId of removedRequirementIds) {
        await api.del(`/templates/${template.id}/requirements/${requirementId}`);
      }

      const orderedRequirementIds: string[] = [];

      for (const requirement of form.requirements) {
        const payload = buildRequirementPayload(requirement, form.proofType);

        if (requirement.id) {
          const updated = await api.put<TemplateRequirementRecord>(
            `/templates/${template.id}/requirements/${requirement.id}`,
            payload,
          );
          orderedRequirementIds.push(updated.id);
        } else {
          const created = await api.post<TemplateRequirementRecord>(`/templates/${template.id}/requirements`, payload);
          orderedRequirementIds.push(created.id);
        }
      }

      if (orderedRequirementIds.length > 0) {
        await api.put<TemplateRequirementRecord[]>(`/templates/${template.id}/requirements/reorder`, {
          requirementIds: orderedRequirementIds,
        });
      }

      const refreshedTemplate = await api.get<ProofTemplateRecord>(`/templates/${template.id}`);
      const nextForm = buildEditorForm(refreshedTemplate);
      setTemplate(refreshedTemplate);
      setForm(nextForm);
      setInitialSnapshot(JSON.stringify(nextForm));
      setSuccessMessage('Template changes saved successfully.');
      setValidationErrors([]);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save template changes');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageShell title="Template Editor" description="Update template metadata and requirement steps.">
        <div className="loading">Loading template editor...</div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={template ? `Edit ${template.name}` : 'Template Editor'}
      description="Update template details, requirement order, and attestation configuration before publishing."
      breadcrumbs={[
        { label: 'Dashboard', to: '/' },
        { label: 'Template Library', to: '/templates' },
        { label: template?.name ?? 'Template Detail', to: template ? `/templates/${template.id}` : '/templates' },
        { label: 'Edit' },
      ]}
      actions={
        <div className="my-page__actions">
          <button type="button" className="my-btn my-btn--secondary" onClick={handleCancel}>
            Cancel
          </button>
          <button type="button" className="my-btn my-btn--primary" onClick={handleSave} disabled={saving || !form || !isEditable}>
            {saving ? 'Saving...' : 'Save template'}
          </button>
        </div>
      }
    >
      <div className="managed-page template-screen">
        {error ? <div className="error">Error: {error}</div> : null}
        {successMessage ? <div className="my-card">{successMessage}</div> : null}
        {validationErrors.length > 0 ? (
          <section className="my-card" aria-labelledby="template-editor-validation">
            <h2 id="template-editor-validation">Fix these issues before saving</h2>
            <ul className="template-screen__error-list">
              {validationErrors.map((validationError) => (
                <li key={validationError}>{validationError}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {template && !isEditable ? (
          <section className="my-card">
            <p className="my-page__muted">Published and archived templates are read-only. Create a draft clone before editing requirements.</p>
          </section>
        ) : null}

        {form ? (
          <>
            <section className="my-card" aria-labelledby="template-editor-metadata">
              <div className="managed-page__section-header">
                <div>
                  <h2 id="template-editor-metadata">Template metadata</h2>
                  <p className="my-page__muted">Set the shared template details that library and detail screens rely on.</p>
                </div>
                <span className="my-badge">{form.requirements.length} requirements</span>
              </div>

              <div className="my-form__grid">
                <label className="my-form__group">
                  <span>Template name</span>
                  <input value={form.name} onChange={(event) => setForm((current) => (current ? { ...current, name: event.target.value } : current))} disabled={!isEditable || saving} />
                </label>
                <label className="my-form__group">
                  <span>Category</span>
                  <input value={form.category} onChange={(event) => setForm((current) => (current ? { ...current, category: event.target.value } : current))} disabled={!isEditable || saving} placeholder="Safety, medical, onboarding..." />
                </label>
                <label className="my-form__group">
                  <span>Proof type</span>
                  <select value={form.proofType} onChange={(event) => setForm((current) => (current ? { ...current, proofType: event.target.value as TemplateProofType } : current))} disabled={!isEditable || saving}>
                    {TEMPLATE_PROOF_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="my-form__group">
                <span>Description</span>
                <textarea value={form.description} onChange={(event) => setForm((current) => (current ? { ...current, description: event.target.value } : current))} disabled={!isEditable || saving} />
              </label>
            </section>

            <section className="my-card" aria-labelledby="template-editor-requirements">
              <div className="managed-page__section-header">
                <div>
                  <h2 id="template-editor-requirements">Requirements</h2>
                  <p className="my-page__muted">Add, remove, and reorder template requirements. All requirements save with the selected template proof type.</p>
                </div>
                <button type="button" className="my-btn my-btn--secondary" onClick={handleAddRequirement} disabled={!isEditable || saving}>
                  Add requirement
                </button>
              </div>

              <div className="template-screen__requirement-body">
                {form.requirements.map((requirement, index) => (
                  <article key={requirement.localId} className="template-screen__editor-card">
                    <div className="managed-page__section-header">
                      <div className="template-screen__toolbar-actions">
                        <span className="template-screen__editor-order">{index + 1}</span>
                        <div>
                          <h3>Requirement step</h3>
                          <p className="my-page__muted">Use attestation levels to define how evidence should be fulfilled.</p>
                        </div>
                      </div>
                      <div className="template-screen__requirement-actions">
                        <button type="button" className="my-btn my-btn--secondary" onClick={() => moveRequirement(index, -1)} disabled={!isEditable || saving || index === 0}>
                          Move up
                        </button>
                        <button type="button" className="my-btn my-btn--secondary" onClick={() => moveRequirement(index, 1)} disabled={!isEditable || saving || index === form.requirements.length - 1}>
                          Move down
                        </button>
                        <button type="button" className="my-btn my-btn--secondary" onClick={() => handleRemoveRequirement(requirement.localId)} disabled={!isEditable || saving || form.requirements.length === 1}>
                          Remove
                        </button>
                      </div>
                    </div>

                    <div className="template-screen__editor-grid">
                      <label className="my-form__group">
                        <span>Requirement name</span>
                        <input value={requirement.name} onChange={(event) => updateRequirement(requirement.localId, (current) => ({ ...current, name: event.target.value }))} disabled={!isEditable || saving} />
                      </label>
                      <label className="my-form__group">
                        <span>Required</span>
                        <select value={requirement.isRequired ? 'required' : 'optional'} onChange={(event) => updateRequirement(requirement.localId, (current) => ({ ...current, isRequired: event.target.value === 'required' }))} disabled={!isEditable || saving}>
                          <option value="required">Required</option>
                          <option value="optional">Optional</option>
                        </select>
                      </label>
                    </div>

                    <label className="my-form__group">
                      <span>Description</span>
                      <textarea value={requirement.description} onChange={(event) => updateRequirement(requirement.localId, (current) => ({ ...current, description: event.target.value }))} disabled={!isEditable || saving} />
                    </label>

                    <div className="template-screen__editor-meta">
                      <span className="my-badge">Proof type: {form.proofType}</span>
                      <span className="my-badge">Attestation choices: {requirement.attestationLevels.length}</span>
                    </div>

                    <fieldset className="template-screen__checklist" disabled={!isEditable || saving}>
                      <legend className="my-page__field-label">Attestation levels</legend>
                      {TEMPLATE_ATTESTATION_LEVEL_OPTIONS.map((option) => {
                        const inputId = `${requirement.localId}-${option.value}`;
                        const checked = requirement.attestationLevels.includes(option.value);

                        return (
                          <label key={option.value} htmlFor={inputId}>
                            <input
                              id={inputId}
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                updateRequirement(requirement.localId, (current) => ({
                                  ...current,
                                  attestationLevels: checked
                                    ? current.attestationLevels.filter((level) => level !== option.value)
                                    : [...current.attestationLevels, option.value],
                                }))
                              }
                            />
                            <span>{option.label}</span>
                          </label>
                        );
                      })}
                    </fieldset>
                  </article>
                ))}
              </div>
            </section>

            <section className="my-card">
              <div className="template-screen__save-actions">
                <button type="button" className="my-btn my-btn--secondary" onClick={handleCancel}>
                  Cancel edits
                </button>
                <button type="button" className="my-btn my-btn--primary" onClick={handleSave} disabled={saving || !isEditable}>
                  {saving ? 'Saving...' : 'Save template'}
                </button>
                <span className="my-page__muted">{isDirty ? 'You have unsaved changes.' : 'All changes saved.'}</span>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </PageShell>
  );
}
