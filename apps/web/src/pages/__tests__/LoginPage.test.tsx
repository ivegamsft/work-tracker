import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import LoginPage from '../LoginPage';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock the API
vi.mock('../../api/client', () => ({
  api: {
    post: vi.fn(),
  },
}));

const MockedLoginPage = () => (
  <BrowserRouter>
    <AuthProvider>
      <LoginPage />
    </AuthProvider>
  </BrowserRouter>
);

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders login form with email and password fields', () => {
    render(<MockedLoginPage />);

    expect(screen.getByRole('heading', { name: /e-clat/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /employee compliance tracker/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('has a submit button', () => {
    render(<MockedLoginPage />);

    const submitButton = screen.getByRole('button', { name: /login/i });
    expect(submitButton).toBeInTheDocument();
    expect(submitButton).toHaveAttribute('type', 'submit');
  });

  it('shows error message on failed login', async () => {
    const { api } = await import('../../api/client');
    const mockPost = vi.mocked(api.post);
    
    mockPost.mockRejectedValueOnce(new Error('Invalid credentials'));

    const user = userEvent.setup();
    render(<MockedLoginPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /login/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'wrongpassword');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });

  it('shows loading state during login', async () => {
    const { api } = await import('../../api/client');
    const mockPost = vi.mocked(api.post);
    
    // Make the login promise pending
    mockPost.mockImplementation(() => new Promise(() => {}));

    const user = userEvent.setup();
    render(<MockedLoginPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /login/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /logging in.../i })).toBeInTheDocument();
    });
  });

  it('disables submit button while loading', async () => {
    const { api } = await import('../../api/client');
    const mockPost = vi.mocked(api.post);
    
    mockPost.mockImplementation(() => new Promise(() => {}));

    const user = userEvent.setup();
    render(<MockedLoginPage />);

    const submitButton = screen.getByRole('button', { name: /login/i });
    expect(submitButton).not.toBeDisabled();

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /logging in.../i })).toBeDisabled();
    });
  });
});
