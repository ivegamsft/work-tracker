import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import '../styles/employee-list.css';

interface Employee {
  id: string;
  email: string;
  name: string;
  department: string;
  role: string;
  overallStatus: 'compliant' | 'at_risk' | 'non_compliant';
}

export default function EmployeeListPage() {
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
        const data = await api.get<Employee[]>('/employees');
        setEmployees(data);
        setFilteredEmployees(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load employees');
      } finally {
        setLoading(false);
      }
    }

    fetchEmployees();
  }, []);

  useEffect(() => {
    const query = searchQuery.toLowerCase();
    const filtered = employees.filter(
      (emp) =>
        emp.name.toLowerCase().includes(query) ||
        emp.email.toLowerCase().includes(query) ||
        emp.department.toLowerCase().includes(query),
    );
    setFilteredEmployees(filtered);
    setCurrentPage(1);
  }, [searchQuery, employees]);

  const totalPages = Math.ceil(filteredEmployees.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedEmployees = filteredEmployees.slice(startIndex, startIndex + pageSize);

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'compliant': return 'status-compliant';
      case 'at_risk': return 'status-at-risk';
      case 'non_compliant': return 'status-non-compliant';
      default: return '';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'compliant': return 'Compliant';
      case 'at_risk': return 'At Risk';
      case 'non_compliant': return 'Non-Compliant';
      default: return status;
    }
  };

  if (loading) {
    return <div className="loading">Loading employees...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div className="employee-list">
      <h1>Employees</h1>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search by name, email, or department..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="results-info">
        Showing {paginatedEmployees.length} of {filteredEmployees.length} employees
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
              onClick={() => navigate(`/employees/${employee.id}`)}
              className="clickable-row"
            >
              <td>{employee.name}</td>
              <td>{employee.email}</td>
              <td>{employee.department}</td>
              <td>{employee.role}</td>
              <td>
                <span className={`status-badge ${getStatusClass(employee.overallStatus)}`}>
                  {getStatusLabel(employee.overallStatus)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          <span className="page-info">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
