import type {
  TemplateAttestationLevel,
  TemplateFulfillmentStatus,
  TemplateProofType,
  TemplateRequirementRecord,
  TemplateStatus,
} from '../../types/templates';
import { normalizeKey, toTitleCase } from '../../pages/pageHelpers';

export const TEMPLATE_PROOF_TYPE_OPTIONS: Array<{ value: TemplateProofType; label: string }> = [
  { value: 'hours', label: 'Hours' },
  { value: 'certification', label: 'Certification' },
  { value: 'training', label: 'Training' },
  { value: 'clearance', label: 'Clearance' },
  { value: 'assessment', label: 'Assessment' },
  { value: 'compliance', label: 'Compliance' },
];

export const TEMPLATE_ATTESTATION_LEVEL_OPTIONS: Array<{ value: TemplateAttestationLevel; label: string }> = [
  { value: 'self_attest', label: 'Self attest' },
  { value: 'upload', label: 'Document upload' },
  { value: 'third_party', label: 'Third-party verification' },
  { value: 'validated', label: 'Manager validation' },
];

export function formatTemplateStatus(status?: string | null) {
  return toTitleCase(status, 'Draft');
}

export function formatTemplateProofType(proofType?: string | null) {
  if (!proofType) {
    return 'Not set';
  }

  return TEMPLATE_PROOF_TYPE_OPTIONS.find((option) => option.value === proofType)?.label ?? toTitleCase(proofType);
}

export function formatAttestationLevel(level?: string | null) {
  return TEMPLATE_ATTESTATION_LEVEL_OPTIONS.find((option) => option.value === level)?.label ?? toTitleCase(level, 'Unknown');
}

export function formatAttestationLevels(levels: string[] = []) {
  if (levels.length === 0) {
    return 'No attestation set';
  }

  return levels.map((level) => formatAttestationLevel(level)).join(' • ');
}

export function getTemplateStatusBadgeClass(status?: string | null) {
  switch (normalizeKey(status)) {
    case 'published':
    case 'fulfilled':
      return 'my-badge my-badge--active';
    case 'draft':
    case 'pending_review':
      return 'my-badge my-badge--warning';
    default:
      return 'my-badge';
  }
}

export function getFulfillmentBadgeClass(status?: TemplateFulfillmentStatus | string | null) {
  switch (normalizeKey(status)) {
    case 'fulfilled':
      return 'my-badge my-badge--active';
    case 'pending_review':
      return 'my-badge my-badge--warning';
    case 'expired':
    case 'rejected':
      return 'my-badge my-badge--expired';
    default:
      return 'my-badge';
  }
}

export function formatFulfillmentStatus(status?: TemplateFulfillmentStatus | string | null) {
  switch (normalizeKey(status)) {
    case 'unfulfilled':
      return 'Not started';
    default:
      return toTitleCase(status, 'Not started');
  }
}

export function getPrimaryProofType(requirements: TemplateRequirementRecord[] = []): TemplateProofType | null {
  const firstRequirement = sortTemplateRequirements(requirements).find((requirement) => requirement.proofType);
  return firstRequirement?.proofType ?? null;
}

export function sortTemplateRequirements(requirements: TemplateRequirementRecord[] = []) {
  return [...requirements].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.name.localeCompare(right.name);
  });
}

export function buildTemplateCategoryOptions(categories: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      categories
        .map((category) => category?.trim())
        .filter((category): category is string => Boolean(category)),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

export function getTemplateCompletion(fulfilledCount: number, totalCount: number) {
  if (totalCount <= 0) {
    return 0;
  }

  return Math.round((fulfilledCount / totalCount) * 100);
}

export function isEditableTemplateStatus(status?: TemplateStatus | string | null) {
  return normalizeKey(status) === 'draft';
}
