import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type {
  MyNotification,
  NotificationPreferenceRecord,
  NotificationPreferences,
  PaginatedResponse,
} from '../types/my-section';
import '../styles/my-section.css';

const MY_LINKS = [
  { to: '/me', label: 'Profile' },
  { to: '/me/qualifications', label: 'Qualifications' },
  { to: '/me/medical', label: 'Medical' },
  { to: '/me/documents', label: 'Documents' },
  { to: '/me/hours', label: 'Hours' },
];

type NotificationsResponse = MyNotification[] | PaginatedResponse<MyNotification>;
type NotificationPreferencesResponse = NotificationPreferences | NotificationPreferenceRecord[];

function normalizeNotification(record: MyNotification) {
  return {
    id: record.id,
    message: record.message || record.title || 'Notification',
    type: record.type,
    createdAt: record.createdAt,
    read: record.read ?? (record.status === 'read' || Boolean(record.readAt)),
  };
}

function normalizeNotifications(response: NotificationsResponse) {
  const records = Array.isArray(response) ? response : response.data;
  return records.map(normalizeNotification);
}

function normalizePreferences(response: NotificationPreferencesResponse): NotificationPreferences {
  if (!Array.isArray(response)) {
    return response;
  }

  return response.reduce<NotificationPreferences>(
    (preferences, record) => {
      preferences.email = preferences.email || record.channels.includes('email');
      preferences.inApp = preferences.inApp || record.channels.includes('in_app') || record.channels.includes('in-app');
      preferences.categories[record.notificationType] = record.isEnabled;
      return preferences;
    },
    { email: false, inApp: false, categories: {} },
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
}

function getTypeClass(type: string, read: boolean) {
  if (!read) {
    return 'my-badge my-badge--warning';
  }

  if (type.toLowerCase().includes('overdue') || type.toLowerCase().includes('conflict')) {
    return 'my-badge my-badge--expired';
  }

  return 'my-badge my-badge--active';
}

export default function MyNotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState<Array<{ id: string; message: string; type: string; createdAt: string; read: boolean }>>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [activeView, setActiveView] = useState<'list' | 'preferences'>('list');
  const [markingId, setMarkingId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    async function fetchNotifications() {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const response = await api.get<NotificationsResponse>('/notifications');
        setNotifications(normalizeNotifications(response));
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load notifications');
      } finally {
        setLoading(false);
      }
    }

    fetchNotifications();
  }, [authLoading, user]);

  const handleShowPreferences = async () => {
    setActiveView('preferences');

    if (preferences || preferencesLoading) {
      return;
    }

    setPreferencesLoading(true);

    try {
      const response = await api.get<NotificationPreferencesResponse>('/notifications/preferences');
      setPreferences(normalizePreferences(response));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notification preferences');
    } finally {
      setPreferencesLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    setMarkingId(notificationId);

    try {
      const updated = await api.put<MyNotification>(`/notifications/${notificationId}/read`);
      const normalized = normalizeNotification(updated);
      setNotifications((current) =>
        current.map((notification) => (notification.id === notificationId ? normalized : notification)),
      );
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark notification as read');
    } finally {
      setMarkingId(null);
    }
  };

  if (authLoading || loading) {
    return <div className="loading">Loading notifications...</div>;
  }

  if (error && activeView === 'list') {
    return <div className="error">Error: {error}</div>;
  }

  if (!user) {
    return <div className="my-empty-state">Your employee session is unavailable.</div>;
  }

  return (
    <div className="my-page">
      <header className="my-page__header">
        <div>
          <p className="my-page__eyebrow">Employee self-service</p>
          <h1 className="my-page__title">My Notifications</h1>
          <p className="my-page__description">Stay on top of updates, expirations, and account activity.</p>
        </div>
        <div className="my-page__actions">
          <button type="button" className="my-btn my-btn--secondary" onClick={() => setActiveView('list')}>
            Notifications list
          </button>
          <button type="button" className="my-btn my-btn--primary" onClick={handleShowPreferences}>
            Preferences
          </button>
        </div>
      </header>

      <nav className="my-nav-links" aria-label="My pages">
        {MY_LINKS.map((link) => (
          <Link key={link.to} to={link.to}>
            {link.label}
          </Link>
        ))}
      </nav>

      {activeView === 'preferences' ? (
        <section className="my-card" aria-labelledby="notification-preferences">
          <div>
            <h2 id="notification-preferences">Notification preferences</h2>
            <p className="my-page__muted">Your saved communication settings and category coverage.</p>
          </div>
          {preferencesLoading ? (
            <div className="my-empty-state">Loading your preferences...</div>
          ) : preferences ? (
            <>
              <div className="my-grid">
                <div className="my-card">
                  <span className="my-page__field-label">Email alerts</span>
                  <span className={preferences.email ? 'my-badge my-badge--active' : 'my-badge'}>
                    {preferences.email ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="my-card">
                  <span className="my-page__field-label">In-app alerts</span>
                  <span className={preferences.inApp ? 'my-badge my-badge--active' : 'my-badge'}>
                    {preferences.inApp ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
              {Object.keys(preferences.categories).length === 0 ? (
                <div className="my-empty-state">No category-specific preferences have been configured yet.</div>
              ) : (
                <div className="my-page__list">
                  {Object.entries(preferences.categories).map(([category, enabled]) => (
                    <div key={category} className="my-page__list-item">
                      <div>
                        <strong>{category.replace(/_/g, ' ')}</strong>
                      </div>
                      <span className={enabled ? 'my-badge my-badge--active' : 'my-badge'}>
                        {enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="my-empty-state">No preferences are available yet.</div>
          )}
          {error ? <div className="error">Error: {error}</div> : null}
        </section>
      ) : notifications.length === 0 ? (
        <div className="my-empty-state">You&apos;re all caught up. No notifications to review right now.</div>
      ) : (
        <section className="my-card" aria-labelledby="my-notifications-list">
          <div>
            <h2 id="my-notifications-list">Recent notifications</h2>
            <p className="my-page__muted">Unread items stay highlighted until you mark them as read.</p>
          </div>
          <table className="my-table">
            <thead>
              <tr>
                <th>Message</th>
                <th>Type</th>
                <th>Created</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((notification) => (
                <tr key={notification.id}>
                  <td data-label="Message">{notification.message}</td>
                  <td data-label="Type">
                    <span className={getTypeClass(notification.type, notification.read)}>{notification.type}</span>
                  </td>
                  <td data-label="Created">{formatDate(notification.createdAt)}</td>
                  <td data-label="Status">
                    <span className={notification.read ? 'my-badge my-badge--active' : 'my-badge my-badge--warning'}>
                      {notification.read ? 'Read' : 'Unread'}
                    </span>
                  </td>
                  <td data-label="Action">
                    {notification.read ? (
                      <span className="my-page__muted">No action needed</span>
                    ) : (
                      <button
                        type="button"
                        className="my-btn my-btn--secondary"
                        disabled={markingId === notification.id}
                        onClick={() => handleMarkAsRead(notification.id)}
                      >
                        {markingId === notification.id ? 'Updating...' : 'Mark as read'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
