import { useMemo, useState } from 'react';
import ProofCard, { getProofFilter, type ProofFilter, type ProofListItem } from './ProofCard';

const FILTER_OPTIONS: Array<{ value: ProofFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'expiring', label: 'Expiring Soon' },
  { value: 'expired', label: 'Expired' },
];

export interface ProofListProps {
  proofs: ProofListItem[];
  title?: string;
  canCreate?: boolean;
  isOwnProfile?: boolean;
  onAddNew?: () => void;
  onSelectProof?: (proof: ProofListItem) => void;
  onUploadEvidence?: (proof: ProofListItem) => void;
  initialFilter?: ProofFilter;
  emptyMessage?: string;
  showUploadAction?: boolean;
}

export default function ProofList({
  proofs,
  title = 'My Qualifications',
  canCreate = false,
  isOwnProfile = true,
  onAddNew,
  onSelectProof,
  onUploadEvidence,
  initialFilter = 'all',
  emptyMessage = 'No qualifications match the current filter.',
  showUploadAction = true,
}: ProofListProps) {
  const [activeFilter, setActiveFilter] = useState<ProofFilter>(initialFilter);
  const showAddButton = canCreate && !isOwnProfile;

  const filteredProofs = useMemo(() => {
    if (activeFilter === 'all') {
      return proofs;
    }

    return proofs.filter((proof) => getProofFilter(proof) === activeFilter);
  }, [activeFilter, proofs]);

  const totalCountLabel = `${proofs.length} qualification${proofs.length === 1 ? '' : 's'}`;

  return (
    <section className="proof-list" aria-label={title}>
      <div className="proof-list__header">
        <div>
          <h2 className="proof-list__title">{title}</h2>
          <p className="proof-list__subtitle">{totalCountLabel}</p>
        </div>

        {showAddButton && (
          <button
            type="button"
            className="proof-list__add-button"
            onClick={onAddNew}
            disabled={!onAddNew}
          >
            ⊕ Add New
          </button>
        )}
      </div>

      <div className="proof-list__filters" role="tablist" aria-label="Qualification filters">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={activeFilter === option.value}
            className={[
              'proof-list__filter',
              activeFilter === option.value ? 'proof-list__filter--active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setActiveFilter(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {filteredProofs.length > 0 ? (
        <div className="proof-list__cards">
          {filteredProofs.map((proof) => (
            <ProofCard
              key={proof.id}
              proof={proof}
              onClick={onSelectProof}
              onUploadEvidence={onUploadEvidence}
              showUploadAction={showUploadAction}
            />
          ))}
        </div>
      ) : (
        <div className="proof-list__empty-state">
          <p className="proof-list__empty-message">{emptyMessage}</p>
        </div>
      )}
    </section>
  );
}
