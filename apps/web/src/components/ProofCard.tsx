import type { KeyboardEvent, MouseEvent } from 'react';
import '../styles/proof-list.css';

export type ProofStatus =
  | 'active'
  | 'expiring_soon'
  | 'expired'
  | 'pending_review'
  | 'suspended'
  | 'compliant'
  | 'at_risk'
  | 'non_compliant'
  | 'missing';

export type ProofFilter = 'all' | 'active' | 'expiring' | 'expired';

type ProofTone = 'success' | 'warning' | 'danger';

export interface ProofListItem {
  id: string;
  name: string;
  status: ProofStatus;
  issuer?: string | null;
  standardName?: string | null;
  expiresAt?: string | Date | null;
  requirementsMet: number;
  requirementsTotal: number;
  documentCount?: number;
  hasEvidence?: boolean;
}

export interface ProofCardProps {
  proof: ProofListItem;
  onClick?: (proof: ProofListItem) => void;
  onUploadEvidence?: (proof: ProofListItem) => void;
  showUploadAction?: boolean;
}

function normalizeDate(value?: string | Date | null) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getDaysUntilExpiration(expiresAt?: string | Date | null) {
  const expirationDate = normalizeDate(expiresAt);

  if (!expirationDate) {
    return null;
  }

  const today = startOfDay(new Date()).getTime();
  const expiry = startOfDay(expirationDate).getTime();
  return Math.round((expiry - today) / (1000 * 60 * 60 * 24));
}

function clampPercentage(value: number) {
  return Math.min(100, Math.max(0, value));
}

export function getProofCompletionPercentage(proof: Pick<ProofListItem, 'requirementsMet' | 'requirementsTotal'>) {
  if (proof.requirementsTotal <= 0) {
    return 0;
  }

  return clampPercentage((proof.requirementsMet / proof.requirementsTotal) * 100);
}

export function getProofFilter(proof: Pick<ProofListItem, 'status' | 'expiresAt'>): Exclude<ProofFilter, 'all'> {
  const daysUntilExpiration = getDaysUntilExpiration(proof.expiresAt);

  if (daysUntilExpiration !== null && daysUntilExpiration < 0) {
    return 'expired';
  }

  switch (proof.status) {
    case 'expired':
    case 'non_compliant':
    case 'missing':
    case 'suspended':
      return 'expired';
    case 'expiring_soon':
    case 'at_risk':
    case 'pending_review':
      return 'expiring';
    default:
      return 'active';
  }
}

function getProofTone(proof: ProofListItem): ProofTone {
  const filter = getProofFilter(proof);

  if (filter === 'expired') {
    return 'danger';
  }

  if (filter === 'expiring') {
    return 'warning';
  }

  const completion = getProofCompletionPercentage(proof);

  if (completion >= 80) {
    return 'success';
  }

  if (completion >= 50) {
    return 'warning';
  }

  return 'danger';
}

function getStatusIcon(tone: ProofTone) {
  switch (tone) {
    case 'success':
      return '✅';
    case 'warning':
      return '⚠️';
    case 'danger':
      return '❌';
  }
}

function getStatusLabel(tone: ProofTone, proof: ProofListItem) {
  if (tone === 'danger') {
    return getProofFilter(proof) === 'expired' ? 'Expired' : 'Needs attention';
  }

  if (tone === 'warning') {
    return getProofFilter(proof) === 'expiring' ? 'Expiring soon' : 'In progress';
  }

  return 'Compliant';
}

function formatProofSubtitle(proof: ProofListItem) {
  const parts: string[] = [];

  if (proof.standardName) {
    parts.push(proof.standardName);
  }

  if (proof.issuer) {
    parts.push(`Issued by ${proof.issuer}`);
  }

  return parts.join(' · ') || 'Issuer information pending';
}

function formatExpiryDate(expiresAt?: string | Date | null) {
  const date = normalizeDate(expiresAt);

  if (!date) {
    return 'No expiration date';
  }

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatRelativeExpiry(expiresAt?: string | Date | null) {
  const daysUntilExpiration = getDaysUntilExpiration(expiresAt);

  if (daysUntilExpiration === null) {
    return 'No renewal due';
  }

  if (daysUntilExpiration === 0) {
    return 'Expires today';
  }

  if (daysUntilExpiration > 0) {
    return `Expires in ${daysUntilExpiration} day${daysUntilExpiration === 1 ? '' : 's'}`;
  }

  const elapsedDays = Math.abs(daysUntilExpiration);
  return `Expired ${elapsedDays} day${elapsedDays === 1 ? '' : 's'} ago`;
}

function getEvidenceLabel(proof: ProofListItem) {
  const documentCount = proof.documentCount ?? 0;

  if (documentCount > 1) {
    return `📎 ${documentCount} files attached`;
  }

  return '📎 Document attached';
}

export default function ProofCard({
  proof,
  onClick,
  onUploadEvidence,
  showUploadAction = true,
}: ProofCardProps) {
  const completion = getProofCompletionPercentage(proof);
  const tone = getProofTone(proof);
  const hasEvidence = proof.hasEvidence ?? (proof.documentCount ?? 0) > 0;
  const progressSummary =
    proof.requirementsTotal > 0
      ? `${proof.requirementsMet}/${proof.requirementsTotal} requirements met`
      : 'Requirements pending';
  const cardClassName = [
    'proof-card',
    `proof-card--${tone}`,
    onClick ? 'proof-card--interactive' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const handleUploadClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onUploadEvidence?.(proof);
  };

  const content = (
    <>
      <div className="proof-card__main">
        <div className="proof-card__status" aria-label={getStatusLabel(tone, proof)}>
          <span aria-hidden="true">{getStatusIcon(tone)}</span>
        </div>

        <div className="proof-card__body">
          <div className="proof-card__top-row">
            <div className="proof-card__copy">
              <h3 className="proof-card__title">{proof.name}</h3>
              <p className="proof-card__subtitle">{formatProofSubtitle(proof)}</p>
            </div>

            <div className="proof-card__expiry">
              <span className="proof-card__expiry-date">{formatExpiryDate(proof.expiresAt)}</span>
              <span className="proof-card__expiry-relative">{formatRelativeExpiry(proof.expiresAt)}</span>
            </div>
          </div>

          <div className="proof-card__progress-section">
            <div className="proof-card__progress-header">
              <span className="proof-card__progress-label">{progressSummary}</span>
              <span className="proof-card__status-label">{getStatusLabel(tone, proof)}</span>
            </div>
            <div className="proof-card__progress-track" aria-hidden="true">
              <span
                className="proof-card__progress-fill"
                style={{ width: `${completion}%` }}
              />
            </div>
          </div>

          <div className="proof-card__footer">
            <div className="proof-card__evidence">
              {hasEvidence ? (
                <span className="proof-card__evidence-label">{getEvidenceLabel(proof)}</span>
              ) : showUploadAction ? (
                <button
                  type="button"
                  className="proof-card__upload-link"
                  onClick={handleUploadClick}
                  disabled={!onUploadEvidence}
                >
                  Upload
                </button>
              ) : (
                <span className="proof-card__evidence-missing">Evidence missing</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );

  if (onClick) {
    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onClick(proof);
      }
    };

    return (
      <div
        className={cardClassName}
        onClick={() => onClick(proof)}
        onKeyDown={handleKeyDown}
        aria-label={`Open details for ${proof.name}`}
        role="button"
        tabIndex={0}
      >
        {content}
      </div>
    );
  }

  return <div className={cardClassName}>{content}</div>;
}
