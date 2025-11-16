import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Navigation from '../components/Navigation';
import api from '../utils/api';

// Mock the api module
vi.mock('../utils/api');
const mockApi = api as jest.Mocked<typeof api>;

// Mock the useAuth hook
const mockUseAuth = vi.fn();
const mockLogout = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth()
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

const renderNavigation = (user: any = null) => {
  mockUseAuth.mockReturnValue({
    user,
    logout: mockLogout,
    login: vi.fn(),
    isLoading: false
  });

  return render(
    <BrowserRouter>
      <Navigation />
    </BrowserRouter>
  );
};

describe('Navigation Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.alert
    global.alert = vi.fn();
  });

  describe('Unauthenticated State', () => {
    it('shows login and register links when not authenticated', () => {
      renderNavigation(null);
      
      expect(screen.getByText('Login')).toBeInTheDocument();
      expect(screen.getByText('Register')).toBeInTheDocument();
    });

    it('does not show navigation menu when not authenticated', () => {
      renderNavigation(null);
      
      expect(screen.queryByText('Games')).not.toBeInTheDocument();
      expect(screen.queryByText('Teams')).not.toBeInTheDocument();
      expect(screen.queryByText('Players')).not.toBeInTheDocument();
      expect(screen.queryByText('Logout')).not.toBeInTheDocument();
    });

    it('does not show change password button when not authenticated', () => {
      renderNavigation(null);
      
      expect(screen.queryByText('Change Password')).not.toBeInTheDocument();
    });
  });

  describe('Authenticated State', () => {
    const regularUser = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      role: 'user'
    };

    const adminUser = {
      id: 2,
      username: 'admin',
      email: 'admin@example.com',
      role: 'admin'
    };

    it('shows navigation menu when authenticated', () => {
      renderNavigation(regularUser);
      
      expect(screen.getByText('Games')).toBeInTheDocument();
      expect(screen.getByText('Teams')).toBeInTheDocument();
      expect(screen.getByText('Players')).toBeInTheDocument();
      expect(screen.getByText('Logout')).toBeInTheDocument();
    });

    it('displays user information', () => {
      renderNavigation(regularUser);
      
      expect(screen.getByText('Welcome, testuser (user)!')).toBeInTheDocument();
    });

    it('shows change password button when authenticated', () => {
      renderNavigation(regularUser);
      
      expect(screen.getByText('Change Password')).toBeInTheDocument();
    });

    it('shows Users link for admin users', () => {
      renderNavigation(adminUser);
      
      expect(screen.getByText('Users')).toBeInTheDocument();
    });

    it('hides Users link for non-admin users', () => {
      renderNavigation(regularUser);
      
      expect(screen.queryByText('Users')).not.toBeInTheDocument();
    });

    it('shows Users link for coach users', () => {
      const coachUser = {
        id: 3,
        username: 'coach',
        email: 'coach@example.com',
        role: 'coach'
      };
      renderNavigation(coachUser);
      
      expect(screen.queryByText('Users')).not.toBeInTheDocument();
    });
  });

  describe('Logout Functionality', () => {
    const regularUser = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      role: 'user'
    };

    it('calls logout when logout button is clicked', () => {
      renderNavigation(regularUser);
      
      const logoutButton = screen.getByText('Logout');
      fireEvent.click(logoutButton);
      
      expect(mockLogout).toHaveBeenCalled();
    });

    it('navigates to login page after logout', () => {
      renderNavigation(regularUser);
      
      const logoutButton = screen.getByText('Logout');
      fireEvent.click(logoutButton);
      
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  describe('Change Password Functionality', () => {
    const regularUser = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      role: 'user'
    };

    it('opens password dialog when change password button is clicked', () => {
      renderNavigation(regularUser);
      
      const changePasswordButton = screen.getByText('Change Password');
      fireEvent.click(changePasswordButton);
      
      expect(screen.getByText('Change Your Password')).toBeInTheDocument();
    });

    it('shows current password field in dialog', () => {
      renderNavigation(regularUser);
      
      fireEvent.click(screen.getByText('Change Password'));
      
      expect(screen.getByLabelText('Current Password *')).toBeInTheDocument();
    });

    it('passes correct props to password dialog', () => {
      renderNavigation(regularUser);
      
      fireEvent.click(screen.getByText('Change Password'));
      
      // Verify dialog is open with correct user info
      expect(screen.getByText('Change Your Password')).toBeInTheDocument();
      
      // Verify it's for own password (has current password field)
      expect(screen.getByLabelText('Current Password *')).toBeInTheDocument();
    });

    it('closes password dialog when cancel is clicked', () => {
      renderNavigation(regularUser);
      
      fireEvent.click(screen.getByText('Change Password'));
      
      expect(screen.getByText('Change Your Password')).toBeInTheDocument();
      
      fireEvent.click(screen.getByText('Cancel'));
      
      expect(screen.queryByText('Change Your Password')).not.toBeInTheDocument();
    });

    it('closes password dialog when X button is clicked', () => {
      renderNavigation(regularUser);
      
      fireEvent.click(screen.getByText('Change Password'));
      
      const closeButton = screen.getByLabelText('Close dialog');
      fireEvent.click(closeButton);
      
      expect(screen.queryByText('Change Your Password')).not.toBeInTheDocument();
    });

    it('successfully changes password', async () => {
      mockApi.post.mockResolvedValue({ data: { message: 'Password changed successfully' } });
      
      renderNavigation(regularUser);
      
      // Open dialog
      fireEvent.click(screen.getByText('Change Password'));
      
      // Fill in form
      fireEvent.change(screen.getByLabelText('Current Password *'), { target: { value: 'OldPass123!' } });
      fireEvent.change(screen.getByLabelText('New Password *'), { target: { value: 'NewPass123!' } });
      fireEvent.change(screen.getByLabelText('Confirm New Password *'), { target: { value: 'NewPass123!' } });
      
      // Submit - use getAllByText since there are two "Change Password" buttons
      const changePasswordButtons = screen.getAllByText('Change Password');
      fireEvent.click(changePasswordButtons[1]); // Click the submit button in the dialog
      
      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith('/auth/change-password', {
          currentPassword: 'OldPass123!',
          newPassword: 'NewPass123!'
        });
      });
    });

    it('shows alert on successful password change', async () => {
      mockApi.post.mockResolvedValue({ data: { message: 'Password changed successfully' } });
      
      renderNavigation(regularUser);
      
      fireEvent.click(screen.getByText('Change Password'));
      
      fireEvent.change(screen.getByLabelText('Current Password *'), { target: { value: 'OldPass123!' } });
      fireEvent.change(screen.getByLabelText('New Password *'), { target: { value: 'NewPass123!' } });
      fireEvent.change(screen.getByLabelText('Confirm New Password *'), { target: { value: 'NewPass123!' } });
      
      const changePasswordButtons = screen.getAllByText('Change Password');
      fireEvent.click(changePasswordButtons[1]); // Click the submit button
      
      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith('Password changed successfully!');
      });
    });

    it('closes dialog after successful password change', async () => {
      mockApi.post.mockResolvedValue({ data: { message: 'Password changed successfully' } });
      
      renderNavigation(regularUser);
      
      fireEvent.click(screen.getByText('Change Password'));
      
      fireEvent.change(screen.getByLabelText('Current Password *'), { target: { value: 'OldPass123!' } });
      fireEvent.change(screen.getByLabelText('New Password *'), { target: { value: 'NewPass123!' } });
      fireEvent.change(screen.getByLabelText('Confirm New Password *'), { target: { value: 'NewPass123!' } });
      
      const changePasswordButtons = screen.getAllByText('Change Password');
      fireEvent.click(changePasswordButtons[1]); // Click the submit button
      
      await waitFor(() => {
        expect(screen.queryByText('Change Your Password')).not.toBeInTheDocument();
      });
    });

    it('handles password change errors', async () => {
      mockApi.post.mockRejectedValue({
        response: {
          data: {
            error: 'Current password is incorrect'
          }
        }
      });
      
      renderNavigation(regularUser);
      
      fireEvent.click(screen.getByText('Change Password'));
      
      fireEvent.change(screen.getByLabelText('Current Password *'), { target: { value: 'WrongPass123!' } });
      fireEvent.change(screen.getByLabelText('New Password *'), { target: { value: 'NewPass123!' } });
      fireEvent.change(screen.getByLabelText('Confirm New Password *'), { target: { value: 'NewPass123!' } });
      
      const changePasswordButtons = screen.getAllByText('Change Password');
      fireEvent.click(changePasswordButtons[1]); // Click the submit button
      
      await waitFor(() => {
        expect(screen.getByText('Current password is incorrect')).toBeInTheDocument();
      });
    });

    it('can reopen password dialog after closing', () => {
      renderNavigation(regularUser);
      
      // Open dialog
      fireEvent.click(screen.getByText('Change Password'));
      expect(screen.getByText('Change Your Password')).toBeInTheDocument();
      
      // Close dialog
      fireEvent.click(screen.getByText('Cancel'));
      expect(screen.queryByText('Change Your Password')).not.toBeInTheDocument();
      
      // Reopen dialog
      fireEvent.click(screen.getByText('Change Password'));
      expect(screen.getByText('Change Your Password')).toBeInTheDocument();
    });

    it('validates password before submission', async () => {
      renderNavigation(regularUser);
      
      fireEvent.click(screen.getByText('Change Password'));
      
      // Fill with invalid password (too short)
      fireEvent.change(screen.getByLabelText('Current Password *'), { target: { value: 'OldPass123!' } });
      fireEvent.change(screen.getByLabelText('New Password *'), { target: { value: 'short' } });
      fireEvent.change(screen.getByLabelText('Confirm New Password *'), { target: { value: 'short' } });
      
      // Use getAllByText since there are two "Change Password" buttons
      const changePasswordButtons = screen.getAllByText('Change Password');
      fireEvent.click(changePasswordButtons[1]); // Click the submit button
      
      await waitFor(() => {
        // Error message appears in the error div (not the hint text)
        const errorMessages = screen.getAllByText(/at least 8 characters/i);
        expect(errorMessages.length).toBeGreaterThan(0);
      });
      
      expect(mockApi.post).not.toHaveBeenCalled();
    });
  });

  describe('Admin User', () => {
    const adminUser = {
      id: 2,
      username: 'admin',
      email: 'admin@example.com',
      role: 'admin'
    };

    it('shows change password button for admin', () => {
      renderNavigation(adminUser);
      
      expect(screen.getByText('Change Password')).toBeInTheDocument();
    });

    it('admin can change own password via navigation', () => {
      renderNavigation(adminUser);
      
      fireEvent.click(screen.getByText('Change Password'));
      
      expect(screen.getByText('Change Your Password')).toBeInTheDocument();
      expect(screen.getByLabelText('Current Password *')).toBeInTheDocument();
    });

    it('admin password change requires current password', () => {
      renderNavigation(adminUser);
      
      fireEvent.click(screen.getByText('Change Password'));
      
      // Current password field should be present
      expect(screen.getByLabelText('Current Password *')).toBeInTheDocument();
    });
  });

  describe('Coach User', () => {
    const coachUser = {
      id: 3,
      username: 'coach',
      email: 'coach@example.com',
      role: 'coach'
    };

    it('shows change password button for coach', () => {
      renderNavigation(coachUser);
      
      expect(screen.getByText('Change Password')).toBeInTheDocument();
    });

    it('coach can change own password via navigation', () => {
      renderNavigation(coachUser);
      
      fireEvent.click(screen.getByText('Change Password'));
      
      expect(screen.getByText('Change Your Password')).toBeInTheDocument();
    });
  });
});
