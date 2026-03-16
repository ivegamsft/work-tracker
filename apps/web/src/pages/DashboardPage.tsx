import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';
import { hasMinimumRole } from '../rbac';
import '../styles/dashboard.css';

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

interface EmployeeRecord {
  id: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
}

interface Stats {
  totalEmployees: number;
  activeCount: number;
  inactiveCount: number;
}

function isForbiddenError(error: unknown): error is { status: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status?: unknown }).status === 403
  );
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [employeeAccessDenied, setEmployeeAccessDenied] = useState(false);

  const canAccessTeam = hasMinimumRole(user?.role, 'supervisor');
  const canReviewDocuments = hasMinimumRole(user?.role, 'manager');
  const showStats = canAccessTeam && !employeeAccessDenied && stats !== null;

  useEffect(() => {
    if (authLoading) {
      return;
    }

    async function fetchStats() {
      if (!user) {
        setLoading(false);
        return;
      }

      if (!canAccessTeam) {
        setEmployeeAccessDenied(true);
        setStats(null);
        setError('');
        setLoading(false);
        return;
      }

      setLoading(true);
      setEmployeeAccessDenied(false);

      try {
        const response = await api.get<PaginatedResponse<EmployeeRecord>>('/employees');
        const employees = response.data;

        const totalEmployees = employees.length;
        const activeCount = employees.filter((employee) => employee.isActive).length;
        const inactiveCount = totalEmployees - activeCount;

        setStats({
          totalEmployees,
          activeCount,
          inactiveCount,
        });
        setError('');
      } catch (err) {
        if (isForbiddenError(err)) {
          setEmployeeAccessDenied(true);
          setStats(null);
          setError('');
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load stats');
        }
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [authLoading, canAccessTeam, user]);

  if (authLoading || loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div className="dashboard">
      <h1>Welcome, {user?.name}</h1>

      {employeeAccessDenied && (
        <p>
          {canAccessTeam
            ? 'Team stats are not available for your account.'
            : "You're signed in with employee access. Quick actions are available below."}
        </p>
      )}

      {showStats && (
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total Employees</h3>
            <div className="stat-value">{stats.totalEmployees}</div>
          </div>

          <div className="stat-card stat-success">
            <h3>Active</h3>
            <div className="stat-value">{stats.activeCount}</div>
          </div>

          <div className="stat-card stat-danger">
            <h3>Inactive</h3>
            <div className="stat-value">{stats.inactiveCount}</div>
          </div>
        </div>
      )}

      <div className="quick-actions">
        <h2>Quick Actions</h2>
        <div className="action-links">
          <Link to="/me" className="action-link">
            Open My Profile
          </Link>
          <Link to="/standards" className="action-link">
            Browse Standards
          </Link>
          <Link to="/me/notifications" className="action-link">
            View Notifications
          </Link>
          {canAccessTeam ? (
            <Link to="/team" className="action-link">
              View Team Directory
            </Link>
          ) : (
            <p>Team directory access is available to supervisors and above.</p>
          )}
          {canReviewDocuments && (
            <Link to="/reviews" className="action-link">
              Open Review Queue
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
