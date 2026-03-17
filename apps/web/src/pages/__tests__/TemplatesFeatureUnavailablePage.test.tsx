import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import TemplatesFeatureUnavailablePage from '../TemplatesFeatureUnavailablePage';
import { AuthProvider } from '../../contexts/AuthContext';

vi.mock('../../api/client', () => ({
  api: {
    get: vi.fn(),
  },
}));

const MockedTemplatesFeatureUnavailablePage = () => (
  <BrowserRouter>
    <AuthProvider>
      <TemplatesFeatureUnavailablePage />
    </AuthProvider>
  </BrowserRouter>
);

describe('TemplatesFeatureUnavailablePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders without crashing', () => {
    render(<MockedTemplatesFeatureUnavailablePage />);

    expect(screen.getByRole('heading', { name: /template features are behind a flag/i })).toBeInTheDocument();
  });

  it('displays feature gate message', () => {
    render(<MockedTemplatesFeatureUnavailablePage />);

    expect(screen.getByText(/library, assignment, and fulfillment screens are ready/i)).toBeInTheDocument();
    expect(screen.getByText(/access is controlled by the compliance.templates feature flag/i)).toBeInTheDocument();
  });

  it('shows feature gated badge', () => {
    render(<MockedTemplatesFeatureUnavailablePage />);

    expect(screen.getByText(/feature gated/i)).toBeInTheDocument();
  });

  it('shows link to my assignments', () => {
    render(<MockedTemplatesFeatureUnavailablePage />);

    expect(screen.getByRole('link', { name: /open my assignments/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open my assignments/i })).toHaveAttribute('href', '/me/templates');
  });

  it('shows link to browse standards', () => {
    render(<MockedTemplatesFeatureUnavailablePage />);

    expect(screen.getByRole('link', { name: /browse standards/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /browse standards/i })).toHaveAttribute('href', '/standards');
  });

  it('displays breadcrumbs', () => {
    render(<MockedTemplatesFeatureUnavailablePage />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Templates')).toBeInTheDocument();
  });

  it('displays page title and description', () => {
    render(<MockedTemplatesFeatureUnavailablePage />);

    expect(screen.getByText(/templates/i)).toBeInTheDocument();
    expect(screen.getByText(/template workflows are being rolled out gradually/i)).toBeInTheDocument();
  });
});
