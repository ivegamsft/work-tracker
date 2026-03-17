export interface ProgressBarProps {
  label: string;
  current: number;
  total: number;
  unit?: string;
}

export default function ProgressBar({ label, current, total, unit = '' }: ProgressBarProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  const bounded = Math.max(0, Math.min(percentage, 100));

  return (
    <div className="mgr-progress" role="group" aria-label={label}>
      <div className="mgr-progress__header">
        <span className="mgr-progress__label">{label}</span>
        <span className="mgr-progress__fraction">
          {current}/{total}{unit ? ` ${unit}` : ''} ({bounded}%)
        </span>
      </div>
      <div
        className="mgr-progress__track"
        role="progressbar"
        aria-valuenow={bounded}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${bounded}%`}
      >
        <span
          className="mgr-progress__fill"
          style={{ width: `${bounded}%` }}
        />
      </div>
    </div>
  );
}
