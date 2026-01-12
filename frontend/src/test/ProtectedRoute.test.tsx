import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';

const mockUseAuth = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth()
}));

const renderAtProtected = (element: React.ReactElement) => {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/dashboard" element={<div>Dashboard Page</div>} />
        <Route path="/protected" element={element} />
      </Routes>
    </MemoryRouter>
  );
};

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects unauthenticated users to /login', () => {
    mockUseAuth.mockReturnValue({ user: null });

    renderAtProtected(
      <ProtectedRoute>
        <div>Secret</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Secret')).not.toBeInTheDocument();
  });

  it('allows authenticated users when no minRole is required', () => {
    mockUseAuth.mockReturnValue({ user: { id: 1, role: 'user' } });

    renderAtProtected(
      <ProtectedRoute>
        <div>Secret</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Secret')).toBeInTheDocument();
  });

  it('redirects authenticated users without sufficient role to /dashboard', () => {
    mockUseAuth.mockReturnValue({ user: { id: 1, role: 'user' } });

    renderAtProtected(
      <ProtectedRoute minRole="coach">
        <div>Secret</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
    expect(screen.queryByText('Secret')).not.toBeInTheDocument();
  });

  it('allows coach to access coach-protected routes', () => {
    mockUseAuth.mockReturnValue({ user: { id: 2, role: 'coach' } });

    renderAtProtected(
      <ProtectedRoute minRole="coach">
        <div>Secret</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Secret')).toBeInTheDocument();
  });

  it('allows admin to access coach-protected routes', () => {
    mockUseAuth.mockReturnValue({ user: { id: 3, role: 'admin' } });

    renderAtProtected(
      <ProtectedRoute minRole="coach">
        <div>Secret</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Secret')).toBeInTheDocument();
  });

  it('redirects users with unknown role when minRole is required', () => {
    mockUseAuth.mockReturnValue({ user: { id: 4, role: 'superuser' } });

    renderAtProtected(
      <ProtectedRoute minRole="coach">
        <div>Secret</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
    expect(screen.queryByText('Secret')).not.toBeInTheDocument();
  });
});
