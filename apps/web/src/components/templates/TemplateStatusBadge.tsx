import { formatTemplateStatus, getTemplateStatusBadgeClass } from './templateUtils';

interface TemplateStatusBadgeProps {
  status?: string | null;
}

export default function TemplateStatusBadge({ status }: TemplateStatusBadgeProps) {
  return <span className={getTemplateStatusBadgeClass(status)}>{formatTemplateStatus(status)}</span>;
}
