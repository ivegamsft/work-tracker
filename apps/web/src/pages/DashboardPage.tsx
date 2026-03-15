import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';
import '../styles/dashboard.css';

interface Stats {
  totalEmployees: number;
  compliantCount: number;
  atRiskCount: number;
  nonCompliantCount: number;
  complianceRate: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchStats() {
      try {
        const employees = await api.get<Array<{ id: string; overallStatus: string }>>('/employees');
        
        const totalEmployees = employees.length;
        const compliantCount = employees.filter(e => e.overallStatus === 'compliant').length;
        const atRiskCount = employees.filter(e => e.overallStatus === 'at_risk').length;
        const nonCompliantCount = employees.filter(e => e.overallStatus === 'non_compliant').length;
        const complianceRate = totalEmployees > 0 ? (compliantCount / totalEmployees) * 100 : 0;

        setStats({
          totalEmployees,
          compliantCount,
          atRiskCount,
          nonCompliantCount,
          complianceRate,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stats');
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div className="dashboard">
      <h1>Welcome, {user?.name}</h1>
      
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Employees</h3>
          <div className="stat-value">{stats?.totalEmployees || 0}</div>
        </div>

        <div className="stat-card stat-success">
          <h3>Compliant</h3>
          <div className="stat-value">{stats?.compliantCount || 0}</div>
        </div>

        <div className="stat-card stat-warning">
          <h3>At Risk</h3>
          <div className="stat-value">{stats?.atRiskCount || 0}</div>
        </div>

        <div className="stat-card stat-danger">
          <h3>Non-Compliant</h3>
          <div className="stat-value">{stats?.nonCompliantCount || 0}</div>
        </div>

        <div className="stat-card stat-primary">
          <h3>Compliance Rate</h3>
          <div className="stat-value">{stats?.complianceRate.toFixed(1)}%</div>
        </div>
      </div>

      <div className="quick-actions">
        <h2>Quick Actions</h2>
        <div className="action-links">
          <Link to="/employees" className="action-link">
            View All Employees
          </Link>
        </div>
      </div>
    </div>
  );
}
