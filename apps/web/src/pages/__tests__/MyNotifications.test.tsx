import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import MyNotificationsPage from '../MyNotifications';
import { AuthProvider } from '../../contexts/AuthContext';
import { FeatureFlagsProvider } from '../../hooks/useFeatureFlags';
import type { MyNotification } from '../../types/my-section';

vi.mock('../../api/client', () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

const mockUser = {
  id: 'employee-1',
  email: 'employee@example.com',
  name: 'Employee User',
  role: 'employee',
};

const mockNotifications: MyNotification[] = [
  {
    id: 'n1',
    message: 'Your qualification expires in 10 days.',
    type: 'expiring_soon',
    createdAt: '2026-03-20T00:00:00.000Z',
    read: false,
    actionUrl: '/me/qualifications',
  },
  {
    id: 'n2',
    message: 'Document upload was approved.',
    type: 'document_approved',
    createdAt: '2026-03-19T00:00:00.000Z',
    read: true,
  },
  {
    id: 'n3',
    message: 'Annual refresher is due.',
    type: 'conflict_alert',
    createdAt: '2026-03-18T00:00:00.000Z',
    read: false,
  },
];

const MockedMyNotificationsPage = () => (
  <BrowserRouter>
    <AuthProvider>
      <FeatureFlagsProvider>
        <MyNotificationsPage />
      </FeatureFlagsProvider>
    </AuthProvider>
  </BrowserRouter>
);

function renderMyNotifications(user = mockUser) {
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('token', 'fake-token');
  render(<MockedMyNotificationsPage />);
}

async function mockApi(options?: {
  notifications?: MyNotification[];
  fail?: boolean;
}) {
  const { api } = await import('../../api/client');
  const mockGet = vi.mocked(api.get);
  const mockPatch = vi.mocked(api.patch);
  const notifications = options?.notifications ?? mockNotifications;

  mockGet.mockImplementation((path: string) => {
    if (path === '/v1/platform/feature-flags') {
      return Promise.resolve({
        'records.hours-ui': true,
        'compliance.templates': true,
      });
    }

    if (path.includes('/notifications')) {
      return options?.fail ? Promise.reject(new Error('Notifications unavailable')) : Promise.resolve(notifications);
    }

    return Promise.reject(new Error(`Unexpected path: ${path}`));
  });

  mockPatch.mockResolvedValue({ success: true });

  return { mockGet, mockPatch };
}

describe('MyNotificationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders without crashing', async () => {
    await mockApi();
    renderMyNotifications();

    expect(await screen.findByRole('heading', { name: /my notifications/i })).toBeInTheDocument();
  });

  it('shows loading state initially', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);
    mockGet.mockImplementation(() => new Promise(() => {}));

    renderMyNotifications();

    expect(screen.getByText(/loading notifications.../i)).toBeInTheDocument();
  });

  it('displays notifications list', async () => {
    await mockApi();
    renderMyNotifications();

    expect(await screen.findByText(/your qualification expires in 10 days/i)).toBeInTheDocument();
    expect(screen.getByText(/document upload was approved/i)).toBeInTheDocument();
    expect(screen.getByText(/annual refresher is due/i)).toBeInTheDocument();
  });

  it('shows tab navigation for read/unread', async () => {
    await mockApi();
    renderMyNotifications();

    expect(await screen.findByRole('button', { name: /all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /unread/i })).toBeInTheDocument();
  });

  it('shows empty state when no notifications', async () => {
    await mockApi({ notifications: [] });
    renderMyNotifications();

    expect(await screen.findByText(/no notifications yet/i)).toBeInTheDocument();
  });

  it('shows error message when API fails', async () => {
    await mockApi({ fail: true });
    renderMyNotifications();

    expect(await screen.findByText(/error:/i)).toBeInTheDocument();
    expect(screen.getByText(/notifications unavailable/i)).toBeInTheDocument();
  });

  it('displays unread indicator', async () => {
    await mockApi();
    renderMyNotifications();

    const notifications = await screen.findAllByRole('listitem');
    expect(notifications.length).toBeGreaterThan(0);
  });

  it('can mark notification as read', async () => {
    const { mockPatch } = await mockApi();
    const user = userEvent.setup();
    renderMyNotifications();

    const markReadButtons = await screen.findAllByRole('button', { name: /mark as read/i });
    await user.click(markReadButtons[0]);

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith(expect.stringContaining('/notifications/'), expect.any(Object));
    });
  });

  it('shows mark all as read button', async () => {
    await mockApi();
    renderMyNotifications();

    expect(await screen.findByRole('button', { name: /mark all as read/i })).toBeInTheDocument();
  });
});
