import { Link } from 'react-router-dom';
import PageShell from '../components/PageShell';
import '../styles/my-section.css';
import '../styles/managed-pages.css';
import '../styles/template-screens.css';

export default function TemplatesFeatureUnavailablePage() {
  return (
    <PageShell
      title="Templates"
      description="Template workflows are being rolled out gradually across the product."
      breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Templates' }]}
      actions={
        <Link to="/me/templates" className="my-btn my-btn--secondary">
          Open my assignments
        </Link>
      }
    >
      <section className="my-coming-soon template-screen__feature-fallback" aria-labelledby="templates-feature-gate-title">
        <div>
          <h2 id="templates-feature-gate-title">Template features are behind a flag</h2>
          <p className="my-page__muted">
            Library, assignment, and fulfillment screens are ready, but access is controlled by the compliance.templates feature flag.
          </p>
        </div>
        <div className="my-page__actions">
          <span className="my-badge my-badge--warning">Feature gated</span>
          <Link to="/standards" className="my-btn my-btn--secondary">
            Browse standards
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
