import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import DashboardPage from '../DashboardPage';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock the API
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

const MockedDashboardPage = () => (
  <BrowserRouter>
    <AuthProvider>
      <DashboardPage />
    </AuthProvider>
  </BrowserRouter>
);

const mockEmployees = [
  { id: '1', overallStatus: 'compliant' },
  { id: '2', overallStatus: 'compliant' },
  { id: '3', overallStatus: 'at_risk' },
  { id: '4', overallStatus: 'non_compliant' },
];

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('user', JSON.stringify(mockUser));
    localStorage.setItem('token', 'fake-token');
  });

  it('renders welcome message', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);
    
    mockGet.mockResolvedValueOnce(mockEmployees);

    render(<MockedDashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /welcome, admin user/i })).toBeInTheDocument();
    });
  });

  it('shows dashboard stats cards', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);
    
    mockGet.mockResolvedValueOnce(mockEmployees);

    render(<MockedDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/total employees/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: /^compliant$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /at risk/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /non-compliant/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /compliance rate/i })).toBeInTheDocument();
  });

  it('displays correct statistics', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);
    
    mockGet.mockResolvedValueOnce(mockEmployees);

    render(<MockedDashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /welcome, admin user/i })).toBeInTheDocument();
    });

    // Find stats by their card headings and values
    const totalEmployeesCard = screen.getByText(/total employees/i).closest('.stat-card');
    expect(totalEmployeesCard).toHaveTextContent('4');

    const compliantCard = screen.getByRole('heading', { name: /^compliant$/i }).closest('.stat-card');
    expect(compliantCard).toHaveTextContent('2');

    const atRiskCard = screen.getByText(/at risk/i).closest('.stat-card');
    expect(atRiskCard).toHaveTextContent('1');

    const nonCompliantCard = screen.getByText(/non-compliant/i).closest('.stat-card');
    expect(nonCompliantCard).toHaveTextContent('1');

    // Compliance rate: 50%
    expect(screen.getByText('50.0%')).toBeInTheDocument();
  });

  it('shows loading state initially', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);
    
    mockGet.mockImplementation(() => new Promise(() => {}));

    render(<MockedDashboardPage />);

    expect(screen.getByText(/loading dashboard.../i)).toBeInTheDocument();
  });

  it('shows error message when fetch fails', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);
    
    mockGet.mockRejectedValueOnce(new Error('Failed to load stats'));

    render(<MockedDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/error: failed to load stats/i)).toBeInTheDocument();
    });
  });

  it('displays quick actions section', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);
    
    mockGet.mockResolvedValueOnce(mockEmployees);

    render(<MockedDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/quick actions/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: /view all employees/i })).toBeInTheDocument();
  });
});
