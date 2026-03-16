import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import EmployeeListPage from '../EmployeeListPage';

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

const mockEmployeeRecords = [
  {
    id: '1',
    employeeNumber: 'E001',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    departmentId: 'Engineering',
    role: 'Developer',
    isActive: true,
  },
  {
    id: '2',
    employeeNumber: 'E002',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane@example.com',
    departmentId: 'Marketing',
    role: 'Manager',
    isActive: false,
  },
  {
    id: '3',
    employeeNumber: 'E003',
    firstName: 'Bob',
    lastName: 'Johnson',
    email: 'bob@example.com',
    departmentId: 'Engineering',
    role: 'Senior Developer',
    isActive: true,
  },
];

const mockPaginatedResponse = {
  data: mockEmployeeRecords,
  total: 3,
  page: 1,
  limit: 20,
};

describe('EmployeeListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);

    mockGet.mockImplementation(() => new Promise(() => {}));
    render(<MockedEmployeeListPage />);

    expect(screen.getByText(/loading employees.../i)).toBeInTheDocument();
  });

  it('renders employee table after data loads', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);

    mockGet.mockResolvedValueOnce(mockPaginatedResponse);
    render(<MockedEmployeeListPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /employees/i })).toBeInTheDocument();
    });

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getAllByText('Engineering')).toHaveLength(2);
    expect(screen.getAllByText('Active')).toHaveLength(2);
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('has search input', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);

    mockGet.mockResolvedValueOnce(mockPaginatedResponse);
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

    mockGet.mockResolvedValueOnce(mockPaginatedResponse);

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

    mockGet.mockResolvedValueOnce(mockPaginatedResponse);
    render(<MockedEmployeeListPage />);

    await waitFor(() => {
      expect(screen.getByText(/showing 3 of 3 employees/i)).toBeInTheDocument();
    });
  });

  it('shows a permission message when the API returns 403', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);

    mockGet.mockRejectedValueOnce({ message: 'Forbidden', status: 403 });
    render(<MockedEmployeeListPage />);

    await waitFor(() => {
      expect(screen.getByText(/you don't have permission to view employees/i)).toBeInTheDocument();
    });
  });

  it('shows the fetch error message for non-permission failures', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);

    mockGet.mockRejectedValueOnce(new Error('Failed to fetch'));
    render(<MockedEmployeeListPage />);

    await waitFor(() => {
      expect(screen.getByText(/failed to fetch/i)).toBeInTheDocument();
    });
  });
});
