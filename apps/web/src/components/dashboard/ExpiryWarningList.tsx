import { getDaysUntil, formatDate } from '../../pages/pageHelpers';

export interface ExpiryItem {
  id: string;
  name: string;
  employeeName?: string;
  type: 'qualification' | 'medical';
  expiresAt: string;
}

export interface ExpiryWarningListProps {
  items: ExpiryItem[];
  title?: string;
}

type UrgencyBucket = '30' | '60' | '90';

function getUrgencyClass(days: number): string {
  if (days <= 0) return 'mgr-expiry-item mgr-expiry-item--overdue';
  if (days <= 30) return 'mgr-expiry-item mgr-expiry-item--critical';
  if (days <= 60) return 'mgr-expiry-item mgr-expiry-item--warning';
  return 'mgr-expiry-item mgr-expiry-item--caution';
}

function getUrgencyLabel(days: number): string {
  if (days <= 0) return 'Overdue';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}

function bucketLabel(bucket: UrgencyBucket): string {
  switch (bucket) {
    case '30': return 'Due within 30 days';
    case '60': return 'Due within 60 days';
    case '90': return 'Due within 90 days';
  }
}

export default function ExpiryWarningList({ items, title = 'Expiring Items' }: ExpiryWarningListProps) {
  const expiryItems = items
    .map((item) => ({ ...item, daysLeft: getDaysUntil(item.expiresAt) }))
    .filter((item) => item.daysLeft <= 90)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const buckets: Record<UrgencyBucket, typeof expiryItems> = { '30': [], '60': [], '90': [] };
  for (const item of expiryItems) {
    if (item.daysLeft <= 30) buckets['30'].push(item);
    else if (item.daysLeft <= 60) buckets['60'].push(item);
    else buckets['90'].push(item);
  }

  if (expiryItems.length === 0) {
    return (
      <section className="mgr-expiry-panel" aria-labelledby="mgr-expiry-title">
        <h3 id="mgr-expiry-title">{title}</h3>
        <p className="mgr-expiry-empty">No items expiring within 90 days.</p>
      </section>
    );
  }

  return (
    <section className="mgr-expiry-panel" aria-labelledby="mgr-expiry-title">
      <h3 id="mgr-expiry-title">{title}</h3>
      <div className="mgr-expiry-summary">
        <span className="mgr-expiry-summary__count mgr-expiry-summary__count--critical">
          {buckets['30'].length} within 30d
        </span>
        <span className="mgr-expiry-summary__count mgr-expiry-summary__count--warning">
          {buckets['60'].length} within 60d
        </span>
        <span className="mgr-expiry-summary__count mgr-expiry-summary__count--caution">
          {buckets['90'].length} within 90d
        </span>
      </div>
      {(['30', '60', '90'] as UrgencyBucket[]).map((bucket) =>
        buckets[bucket].length > 0 ? (
          <div key={bucket} className="mgr-expiry-bucket">
            <h4 className="mgr-expiry-bucket__title">{bucketLabel(bucket)}</h4>
            <ul className="mgr-expiry-list" role="list">
              {buckets[bucket].map((item) => (
                <li key={item.id} className={getUrgencyClass(item.daysLeft)}>
                  <div className="mgr-expiry-item__info">
                    <span className="mgr-expiry-item__name">{item.name}</span>
                    {item.employeeName ? (
                      <span className="mgr-expiry-item__employee">{item.employeeName}</span>
                    ) : null}
                    <span className="mgr-expiry-item__type">
                      {item.type === 'qualification' ? 'Qualification' : 'Medical Clearance'}
                    </span>
                  </div>
                  <div className="mgr-expiry-item__meta">
                    <span className="mgr-expiry-item__date">Expires {formatDate(item.expiresAt)}</span>
                    <span className="mgr-expiry-item__countdown">{getUrgencyLabel(item.daysLeft)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null,
      )}
    </section>
  );
}
