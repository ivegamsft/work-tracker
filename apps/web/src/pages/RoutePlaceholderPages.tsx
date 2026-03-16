import { Link } from 'react-router-dom';
import PageShell from '../components/PageShell';
import MyDocuments from './MyDocuments';
import MyHours from './MyHours';
import MyMedical from './MyMedical';
import MyNotifications from './MyNotifications';
import MyProfile from './MyProfile';
import MyQualifications from './MyQualifications';
import { ReviewDetailPage, ReviewQueuePage } from './ReviewPages';
import { StandardDetailPage, StandardsLibraryPage } from './StandardsPages';
import {
  TeamDocumentsPage,
  TeamHoursPage,
  TeamMedicalPage,
  TeamQualificationsPage,
} from './TeamPages';

export function MyProfilePage() {
  return <MyProfile />;
}

export function MyQualificationsPage() {
  return <MyQualifications />;
}

export function MyMedicalPage() {
  return <MyMedical />;
}

export function MyDocumentsPage() {
  return <MyDocuments />;
}

export function MyHoursPage() {
  return <MyHours />;
}

export function MyNotificationsPage() {
  return <MyNotifications />;
}

export { TeamQualificationsPage, TeamMedicalPage, TeamDocumentsPage, TeamHoursPage };
export { StandardsLibraryPage, StandardDetailPage };
export { ReviewQueuePage, ReviewDetailPage };

export function UnauthorizedPage() {
  return (
    <PageShell
      title="Unauthorized"
      description="You do not have access to this page."
      breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Unauthorized' }]}
    >
      <section className="placeholder-card">
        <span className="placeholder-card__eyebrow">Access denied</span>
        <p>Your account does not include the permissions needed for this route.</p>
        <Link to="/" className="placeholder-link">
          Return to Dashboard
        </Link>
      </section>
    </PageShell>
  );
}

export function NotFoundPage() {
  return (
    <PageShell title="Page Not Found" description="The page you requested does not exist.">
      <section className="placeholder-card">
        <span className="placeholder-card__eyebrow">404</span>
        <p>Check the URL or head back to the dashboard.</p>
        <Link to="/" className="placeholder-link">
          Go to Dashboard
        </Link>
      </section>
    </PageShell>
  );
}
