import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Layout from '../Layout';
import { AuthProvider } from '../../contexts/AuthContext';

const mockUser = {
  id: '1',
  email: 'admin@example.com',
  name: 'Admin User',
  role: 'Administrator',
};

const MockedLayout = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>
      <Layout>{children}</Layout>
    </AuthProvider>
  </BrowserRouter>
);

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('user', JSON.stringify(mockUser));
    localStorage.setItem('token', 'fake-token');
  });

  it('renders admin navigation links', () => {
    render(
      <MockedLayout>
        <div>Test Content</div>
      </MockedLayout>
    );

    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /my profile/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^team$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /document review/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /standards/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /notifications/i })).toBeInTheDocument();
  });

  it('renders children content', () => {
    render(
      <MockedLayout>
        <div>Test Content</div>
      </MockedLayout>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('displays user information in header', () => {
    render(
      <MockedLayout>
        <div>Test Content</div>
      </MockedLayout>
    );

    expect(screen.getByText(/admin user/i)).toBeInTheDocument();
    expect(screen.getByText(/administrator/i)).toBeInTheDocument();
  });

  it('displays logout button', () => {
    render(
      <MockedLayout>
        <div>Test Content</div>
      </MockedLayout>
    );

    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
  });

  it('displays application title', () => {
    render(
      <MockedLayout>
        <div>Test Content</div>
      </MockedLayout>
    );

    expect(screen.getByRole('heading', { name: /e-clat/i })).toBeInTheDocument();
    expect(screen.getByText(/employee compliance and lifecycle activity tracker/i)).toBeInTheDocument();
  });

  it('has correct navigation link paths', () => {
    render(
      <MockedLayout>
        <div>Test Content</div>
      </MockedLayout>
    );

    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    const teamLink = screen.getByRole('link', { name: /^team$/i });
    const notificationsLink = screen.getByRole('link', { name: /notifications/i });

    expect(dashboardLink).toHaveAttribute('href', '/');
    expect(teamLink).toHaveAttribute('href', '/team');
    expect(notificationsLink).toHaveAttribute('href', '/me/notifications');
  });

  it('handles logout click', async () => {
    const user = userEvent.setup();

    render(
      <MockedLayout>
        <div>Test Content</div>
      </MockedLayout>
    );

    const logoutButton = screen.getByRole('button', { name: /logout/i });

    await user.click(logoutButton);

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });
});
