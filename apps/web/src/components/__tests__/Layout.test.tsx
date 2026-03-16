import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Layout from '../Layout';
import { AuthProvider } from '../../contexts/AuthContext';
import { FeatureFlagsProvider } from '../../hooks/useFeatureFlags';

vi.mock('../../api/client', () => ({
  api: {
    get: vi.fn(),
  },
}));

const mockUser = {
  id: '1',
  email: 'admin@example.com',
  name: 'Admin User',
  role: 'Administrator',
};

const MockedLayout = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>
      <FeatureFlagsProvider>
        <Layout>{children}</Layout>
      </FeatureFlagsProvider>
    </AuthProvider>
  </BrowserRouter>
);

describe('Layout', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.setItem('user', JSON.stringify(mockUser));
    localStorage.setItem('token', 'fake-token');

    const { api } = await import('../../api/client');
    vi.mocked(api.get).mockResolvedValue({
      'records.hours-ui': true,
      'compliance.templates': true,
      'reference.labels-admin': false,
      'web.team-subnav': true,
    });
  });

  async function renderLayout() {
    render(
      <MockedLayout>
        <div>Test Content</div>
      </MockedLayout>,
    );

    await screen.findByRole('link', { name: /my templates/i });
  }

  it('renders admin navigation links', async () => {
    await renderLayout();

    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /my profile/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /my templates/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^team$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /document review/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /standards/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /notifications/i })).toBeInTheDocument();
  });

  it('renders children content', async () => {
    await renderLayout();

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('displays user information in header', async () => {
    await renderLayout();

    expect(screen.getByText(/admin user/i)).toBeInTheDocument();
    expect(screen.getByText(/administrator/i)).toBeInTheDocument();
  });

  it('displays logout button', async () => {
    await renderLayout();

    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
  });

  it('displays application title', async () => {
    await renderLayout();

    expect(screen.getByRole('heading', { name: /e-clat/i })).toBeInTheDocument();
    expect(screen.getByText(/employee compliance and lifecycle activity tracker/i)).toBeInTheDocument();
  });

  it('has correct navigation link paths', async () => {
    await renderLayout();

    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    const teamLink = screen.getByRole('link', { name: /^team$/i });
    const notificationsLink = screen.getByRole('link', { name: /notifications/i });
    const templatesLink = screen.getByRole('link', { name: /my templates/i });

    expect(dashboardLink).toHaveAttribute('href', '/');
    expect(teamLink).toHaveAttribute('href', '/team');
    expect(notificationsLink).toHaveAttribute('href', '/me/notifications');
    expect(templatesLink).toHaveAttribute('href', '/me/templates');
  });

  it('handles logout click', async () => {
    const user = userEvent.setup();

    await renderLayout();

    const logoutButton = screen.getByRole('button', { name: /logout/i });

    await user.click(logoutButton);

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });
});
