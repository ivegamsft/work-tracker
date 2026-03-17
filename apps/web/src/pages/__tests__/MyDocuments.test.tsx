import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import MyDocumentsPage from '../MyDocuments';
import { AuthProvider } from '../../contexts/AuthContext';
import { FeatureFlagsProvider } from '../../hooks/useFeatureFlags';
import type { EmployeeDocument } from '../../types/my-section';
import { ApiError } from '../../api/client';

vi.mock('../../api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
  ApiError: class extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

const mockUser = {
  id: 'employee-1',
  email: 'employee@example.com',
  name: 'Employee User',
  role: 'employee',
};

const mockDocuments: EmployeeDocument[] = [
  {
    id: 'd1',
    name: 'OSHA Certificate',
    fileName: 'osha-cert.pdf',
    type: 'certification',
    mimeType: 'application/pdf',
    status: 'approved',
    uploadedAt: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'd2',
    name: 'Training Record',
    fileName: 'training.pdf',
    type: 'training',
    status: 'pending',
    uploadedAt: '2026-03-10T00:00:00.000Z',
    createdAt: '2026-03-10T00:00:00.000Z',
  },
];

const MockedMyDocumentsPage = () => (
  <BrowserRouter>
    <AuthProvider>
      <FeatureFlagsProvider>
        <MyDocumentsPage />
      </FeatureFlagsProvider>
    </AuthProvider>
  </BrowserRouter>
);

function renderMyDocuments(user = mockUser) {
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('token', 'fake-token');
  render(<MockedMyDocumentsPage />);
}

async function mockApi(options?: {
  documents?: EmployeeDocument[];
  fail?: boolean;
  notFound?: boolean;
}) {
  const { api, ApiError } = await import('../../api/client');
  const mockGet = vi.mocked(api.get);
  const mockPost = vi.mocked(api.post);
  const documents = options?.documents ?? mockDocuments;

  mockGet.mockImplementation((path: string) => {
    if (path === '/v1/platform/feature-flags') {
      return Promise.resolve({
        'records.hours-ui': true,
        'compliance.templates': true,
      });
    }

    if (path.includes('/documents/employee/')) {
      if (options?.notFound) {
        return Promise.reject(new ApiError('Not yet implemented', 404));
      }
      return options?.fail ? Promise.reject(new Error('Documents unavailable')) : Promise.resolve(documents);
    }

    return Promise.reject(new Error(`Unexpected path: ${path}`));
  });

  mockPost.mockResolvedValue({ id: 'd3', status: 'pending' });

  return { mockGet, mockPost };
}

describe('MyDocumentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders without crashing', async () => {
    await mockApi();
    renderMyDocuments();

    expect(await screen.findByRole('heading', { name: /my documents/i })).toBeInTheDocument();
  });

  it('shows loading state initially', async () => {
    const { api } = await import('../../api/client');
    const mockGet = vi.mocked(api.get);
    mockGet.mockImplementation(() => new Promise(() => {}));

    renderMyDocuments();

    expect(screen.getByText(/loading documents.../i)).toBeInTheDocument();
  });

  it('displays documents list', async () => {
    await mockApi();
    renderMyDocuments();

    expect(await screen.findByText('OSHA Certificate')).toBeInTheDocument();
    expect(screen.getByText('Training Record')).toBeInTheDocument();
  });

  it('shows upload document button', async () => {
    await mockApi();
    renderMyDocuments();

    expect(await screen.findByRole('button', { name: /upload document/i })).toBeInTheDocument();
  });

  it('shows upload form when button clicked', async () => {
    await mockApi();
    const user = userEvent.setup();
    renderMyDocuments();

    const uploadButton = await screen.findByRole('button', { name: /upload document/i });
    await user.click(uploadButton);

    expect(screen.getByLabelText(/document name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('shows empty state when no documents', async () => {
    await mockApi({ documents: [] });
    renderMyDocuments();

    expect(await screen.findByText(/no documents uploaded yet/i)).toBeInTheDocument();
  });

  it('shows error message when API fails', async () => {
    await mockApi({ fail: true });
    renderMyDocuments();

    expect(await screen.findByText(/error:/i)).toBeInTheDocument();
    expect(screen.getByText(/documents unavailable/i)).toBeInTheDocument();
  });

  it('shows notice when endpoint is 404', async () => {
    await mockApi({ notFound: true });
    renderMyDocuments();

    expect(await screen.findByText(/document history is not available yet/i)).toBeInTheDocument();
  });

  it('displays document status badges', async () => {
    await mockApi();
    renderMyDocuments();

    expect(await screen.findByText(/approved/i)).toBeInTheDocument();
    expect(screen.getByText(/pending/i)).toBeInTheDocument();
  });

  it('submits upload form successfully', async () => {
    const { mockPost } = await mockApi();
    const user = userEvent.setup();
    renderMyDocuments();

    const uploadButton = await screen.findByRole('button', { name: /upload document/i });
    await user.click(uploadButton);

    await user.type(screen.getByLabelText(/document name/i), 'New Document');
    await user.type(screen.getByLabelText(/type/i), 'certification');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/documents', expect.objectContaining({
        name: 'New Document',
        type: 'certification',
      }));
    });
  });
});
