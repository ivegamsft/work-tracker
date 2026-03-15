import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import EmployeeListPage from '../EmployeeListPage';

// Mock the API
vi.mock('../../api/client', () => ({
  api: {
    get: vi.fn(),
  },
}));

const MockedEmployeeListPage = () => (
  <BrowserRouter>
    <EmployeeListPage />
  </BrowserRouter>
);

const mockEmployees = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    department: 'Engineering',
    role: 'Developer',
    overallStatus: 'compliant' as const,
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    department: 'Marketing',
    role: 'Manager',
    overallStatus: 'at_risk' as const,
  },
  {
    id: '3',
    name: 'Bob Johnson',
    email: 'bob@example.com',
    department: 'Engineering',
    role: 'Senior Developer',
    overallStatus: 'non_compliant' as const,
  },
];

describe('EmployeeListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);
    
    // Keep the promise pending
    mockGet.mockImplementation(() => new Promise(() => {}));

    render(<MockedEmployeeListPage />);

    expect(screen.getByText(/loading employees.../i)).toBeInTheDocument();
  });

  it('renders employee table after data loads', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);
    
    mockGet.mockResolvedValueOnce(mockEmployees);

    render(<MockedEmployeeListPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /employees/i })).toBeInTheDocument();
    });

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getAllByText('Engineering')).toHaveLength(2);
    expect(screen.getByText('Compliant')).toBeInTheDocument();
    expect(screen.getByText('At Risk')).toBeInTheDocument();
    expect(screen.getByText('Non-Compliant')).toBeInTheDocument();
  });

  it('has search input', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);
    
    mockGet.mockResolvedValueOnce(mockEmployees);

    render(<MockedEmployeeListPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /employees/i })).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search by name, email, or department/i);
    expect(searchInput).toBeInTheDocument();
  });

  it('filters employees by search query', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);
    
    mockGet.mockResolvedValueOnce(mockEmployees);

    const user = userEvent.setup();
    render(<MockedEmployeeListPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /employees/i })).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search by name, email, or department/i);
    
    await user.type(searchInput, 'john');

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
    });
  });

  it('displays employee count', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);
    
    mockGet.mockResolvedValueOnce(mockEmployees);

    render(<MockedEmployeeListPage />);

    await waitFor(() => {
      expect(screen.getByText(/showing 3 of 3 employees/i)).toBeInTheDocument();
    });
  });

  it('shows error message when fetch fails', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);
    
    mockGet.mockRejectedValueOnce(new Error('Failed to fetch'));

    render(<MockedEmployeeListPage />);

    await waitFor(() => {
      expect(screen.getByText(/error: failed to fetch/i)).toBeInTheDocument();
    });
  });
});
