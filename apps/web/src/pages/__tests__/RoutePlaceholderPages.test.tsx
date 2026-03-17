import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { UnauthorizedPage } from '../RoutePlaceholderPages';

const MockedUnauthorizedPage = () => (
  <BrowserRouter>
    <UnauthorizedPage />
  </BrowserRouter>
);

describe('UnauthorizedPage', () => {
  it('renders without crashing', () => {
    render(<MockedUnauthorizedPage />);

    expect(screen.getByRole('heading', { name: /unauthorized/i })).toBeInTheDocument();
  });

  it('displays unauthorized message', () => {
    render(<MockedUnauthorizedPage />);

    expect(screen.getByText(/you do not have access to this page/i)).toBeInTheDocument();
  });

  it('shows link back to dashboard', () => {
    render(<MockedUnauthorizedPage />);

    expect(screen.getByRole('link', { name: /back to dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to dashboard/i })).toHaveAttribute('href', '/');
  });

  it('displays breadcrumbs', () => {
    render(<MockedUnauthorizedPage />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Unauthorized')).toBeInTheDocument();
  });
});
