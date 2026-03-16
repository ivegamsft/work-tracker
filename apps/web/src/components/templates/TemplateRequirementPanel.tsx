import type { ReactNode } from 'react';
import type { TemplateRequirementRecord } from '../../types/templates';
import { formatAttestationLevel, formatTemplateProofType } from './templateUtils';

interface TemplateRequirementPanelProps {
  requirement: TemplateRequirementRecord;
  index: number;
  badge?: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
}

export default function TemplateRequirementPanel({
  requirement,
  index,
  badge,
  meta,
  children,
}: TemplateRequirementPanelProps) {
  return (
    <article className="my-card template-screen__requirement">
      <div className="managed-page__section-header">
        <div className="managed-page__card-title">
          <span className="my-page__eyebrow">Requirement {index + 1}</span>
          <h2>{requirement.name}</h2>
        </div>
        {badge}
      </div>

      <p className="my-page__muted">{requirement.description || 'Requirement details are still being finalized.'}</p>

      <div className="managed-page__pill-row">
        <span className="my-badge">{requirement.isRequired ? 'Required' : 'Optional'}</span>
        <span className="my-badge">{formatTemplateProofType(requirement.proofType)}</span>
        {requirement.attestationLevels.map((level) => (
          <span key={level} className="my-badge my-badge--warning">
            {formatAttestationLevel(level)}
          </span>
        ))}
      </div>

      {meta ? <div className="template-screen__requirement-meta">{meta}</div> : null}
      {children ? <div className="template-screen__requirement-body">{children}</div> : null}
    </article>
  );
}
