import { Link } from 'react-router-dom';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import '../styles/my-section.css';

export interface MySectionNavItem {
  to: string;
  label: string;
  flag?: string;
}

interface MySectionNavProps {
  links: MySectionNavItem[];
  ariaLabel?: string;
}

export default function MySectionNav({ links, ariaLabel = 'My pages' }: MySectionNavProps) {
  const { flags, loading } = useFeatureFlags();

  return (
    <nav className="my-nav-links" aria-label={ariaLabel}>
      {links.map((link) => {
        const enabled = !link.flag || flags[link.flag];

        if (loading && link.flag) {
          return null;
        }

        if (enabled) {
          return (
            <Link key={link.to} to={link.to}>
              {link.label}
            </Link>
          );
        }

        return (
          <span key={link.to} className="my-nav-links__item my-nav-links__item--disabled">
            <span>{link.label}</span>
            <span className="my-badge my-badge--warning">Coming soon</span>
          </span>
        );
      })}
    </nav>
  );
}
