import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import PageShell from '../components/PageShell';
import '../styles/employee-list.css';

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

interface EmployeeRecord {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  departmentId: string;
  isActive: boolean;
}

interface Employee {
  id: string;
  email: string;
  name: string;
  department: string;
  role: string;
  isActive: boolean;
}

function isForbiddenError(error: unknown): error is { status: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status?: unknown }).status === 403
  );
}

export default function TeamDirectoryPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchEmployees() {
      try {
        const response = await api.get<PaginatedResponse<EmployeeRecord>>('/employees');
        const mapped: Employee[] = response.data.map((employee) => ({
          id: employee.id,
          email: employee.email,
          name: `${employee.firstName} ${employee.lastName}`,
          department: employee.departmentId,
          role: employee.role,
          isActive: employee.isActive,
        }));
        setEmployees(mapped);
        setFilteredEmployees(mapped);
      } catch (err) {
        if (isForbiddenError(err)) {
          setError("You don't have permission to view your team");
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load team directory');
        }
      } finally {
        setLoading(false);
      }
    }

    fetchEmployees();
  }, []);

  useEffect(() => {
    const query = searchQuery.toLowerCase();
    const filtered = employees.filter(
      (employee) =>
        employee.name.toLowerCase().includes(query) ||
        employee.email.toLowerCase().includes(query) ||
        employee.department.toLowerCase().includes(query),
    );
    setFilteredEmployees(filtered);
    setCurrentPage(1);
  }, [searchQuery, employees]);

  const totalPages = Math.ceil(filteredEmployees.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedEmployees = filteredEmployees.slice(startIndex, startIndex + pageSize);

  const getStatusClass = (isActive: boolean) => {
    return isActive ? 'status-compliant' : 'status-non-compliant';
  };

  const getStatusLabel = (isActive: boolean) => {
    return isActive ? 'Active' : 'Inactive';
  };

  if (loading) {
    return <div className="loading">Loading team directory...</div>;
  }

  return (
    <PageShell
      title="Team Directory"
      description="A scoped list of team members and their current access status."
      breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Team' }]}
    >
      <div className="employee-list">
        {error ? (
          <div className="error">{error}</div>
        ) : (
          <>
            <div className="search-bar">
              <input
                type="text"
                placeholder="Search by name, email, or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="results-info">
              Showing {paginatedEmployees.length} of {filteredEmployees.length} team members
            </div>

            <table className="employee-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Department</th>
                  <th>Role</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedEmployees.map((employee) => (
                  <tr
                    key={employee.id}
                    onClick={() => navigate(`/team/${employee.id}`)}
                    className="clickable-row"
                  >
                    <td>{employee.name}</td>
                    <td>{employee.email}</td>
                    <td>{employee.department}</td>
                    <td>{employee.role}</td>
                    <td>
                      <span className={`status-badge ${getStatusClass(employee.isActive)}`}>
                        {getStatusLabel(employee.isActive)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="pagination">
                <button
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                <span className="page-info">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}
