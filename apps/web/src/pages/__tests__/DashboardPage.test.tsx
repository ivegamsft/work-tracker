import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import DashboardPage from '../DashboardPage';
import { AuthProvider } from '../../contexts/AuthContext';

vi.mock('../../api/client', () => ({
  api: {
    get: vi.fn(),
  },
}));

const adminUser = {
  id: '1',
  email: 'admin@example.com',
  name: 'Admin User',
  role: 'admin',
};

const employeeUser = {
  id: '2',
  email: 'employee@example.com',
  name: 'Employee User',
  role: 'employee',
};

const MockedDashboardPage = () => (
  <BrowserRouter>
    <AuthProvider>
      <DashboardPage />
    </AuthProvider>
  </BrowserRouter>
);

const mockPaginatedResponse = {
  data: [
    { id: '1', firstName: 'Alice', lastName: 'Smith', isActive: true },
    { id: '2', firstName: 'Bob', lastName: 'Jones', isActive: true },
    { id: '3', firstName: 'Carol', lastName: 'Davis', isActive: true },
    { id: '4', firstName: 'Dave', lastName: 'Wilson', isActive: false },
  ],
  total: 4,
  page: 1,
  limit: 20,
};

function renderDashboard(user = adminUser) {
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('token', 'fake-token');

  render(<MockedDashboardPage />);
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders welcome message', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);

    mockGet.mockResolvedValueOnce(mockPaginatedResponse);
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /welcome, admin user/i })).toBeInTheDocument();
    });
  });

  it('shows dashboard stats cards for users with employee access', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);

    mockGet.mockResolvedValueOnce(mockPaginatedResponse);
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/total employees/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: /^active$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^inactive$/i })).toBeInTheDocument();
  });

  it('displays correct statistics', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);

    mockGet.mockResolvedValueOnce(mockPaginatedResponse);
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /welcome, admin user/i })).toBeInTheDocument();
    });

    const totalEmployeesCard = screen.getByText(/total employees/i).closest('.stat-card');
    expect(totalEmployeesCard).toHaveTextContent('4');

    const activeCard = screen.getByRole('heading', { name: /^active$/i }).closest('.stat-card');
    expect(activeCard).toHaveTextContent('3');

    const inactiveCard = screen.getByRole('heading', { name: /^inactive$/i }).closest('.stat-card');
    expect(inactiveCard).toHaveTextContent('1');
  });

  it('shows loading state initially', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);

    mockGet.mockImplementation(() => new Promise(() => {}));
    renderDashboard();

    expect(screen.getByText(/loading dashboard.../i)).toBeInTheDocument();
  });

  it('shows error message when fetch fails', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);

    mockGet.mockRejectedValueOnce(new Error('Failed to load stats'));
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/error: failed to load stats/i)).toBeInTheDocument();
    });
  });

  it('shows a simplified dashboard for employee users without fetching stats', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);

    renderDashboard(employeeUser);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /welcome, employee user/i })).toBeInTheDocument();
    });

    expect(mockGet).not.toHaveBeenCalled();
    expect(screen.queryByText(/total employees/i)).not.toBeInTheDocument();
    expect(screen.getByText(/team directory access is available to supervisors and above/i)).toBeInTheDocument();
  });

  it('falls back to the simplified dashboard on forbidden responses', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);

    mockGet.mockRejectedValueOnce({ message: 'Forbidden', status: 403 });
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/team stats are not available for your account/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/error:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/total employees/i)).not.toBeInTheDocument();
  });

  it('displays quick actions section', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);

    mockGet.mockResolvedValueOnce(mockPaginatedResponse);
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/quick actions/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: /view team directory/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open review queue/i })).toBeInTheDocument();
  });
});
