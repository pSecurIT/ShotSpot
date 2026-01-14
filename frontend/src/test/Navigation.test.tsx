import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
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

const renderNavigation = (user: { username: string; role: string } | null = null) => {
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

const openUserMenu = async () => {
  const trigger = screen.getByRole('button', { name: 'User' });
  if (trigger.getAttribute('aria-expanded') === 'true') {
    return;
  }

  const user = userEvent.setup();
  await user.click(trigger);

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'User' })).toHaveAttribute('aria-expanded', 'true');
  });
  await screen.findByText('Change Password');
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
      
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Matches' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Analytics' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Data' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'User' })).not.toBeInTheDocument();
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

    const coachUser = {
      id: 3,
      username: 'coach',
      email: 'coach@example.com',
      role: 'coach'
    };

    it('shows navigation menu when authenticated', () => {
      renderNavigation(regularUser);
      
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Matches' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Analytics' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Data' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'User' })).toBeInTheDocument();
    });

    it('displays user information', () => {
      renderNavigation(regularUser);
      
      expect(screen.getByText(/testuser\s*\(\s*user\s*\)/i)).toBeInTheDocument();
    });

    it('shows change password button when authenticated', async () => {
      renderNavigation(regularUser);
      
      await openUserMenu();
      expect(screen.getByText('Change Password')).toBeInTheDocument();
    });

    it('shows Users link for admin users', () => {
      renderNavigation(adminUser);
      
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
      expect(screen.getByText('User Management')).toBeInTheDocument();
    });

    it('shows an Admin badge for admin-only items', () => {
      renderNavigation(adminUser);

      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
      const userManagement = screen.getByRole('menuitem', { name: /User Management/i });
      expect(within(userManagement).getByText('Admin')).toBeInTheDocument();
    });

    it('hides Users link for non-admin users', () => {
      renderNavigation(regularUser);
      
      expect(screen.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument();
      expect(screen.queryByText('User Management')).not.toBeInTheDocument();
    });

    it('shows Users link for coach users', () => {
      renderNavigation(coachUser);
      
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
      expect(screen.queryByText('User Management')).not.toBeInTheDocument();
    });

    it('shows coach-only items for coaches but not regular users', () => {
      const { unmount } = renderNavigation(coachUser);
      fireEvent.click(screen.getByRole('button', { name: 'Matches' }));
      expect(screen.getByText('Match Templates')).toBeInTheDocument();

      unmount();

      renderNavigation(regularUser);
      fireEvent.click(screen.getByRole('button', { name: 'Matches' }));
      expect(screen.queryByText('Match Templates')).not.toBeInTheDocument();
    });

    it('shows Twizzit Integration for coach/admin users', () => {
      const { unmount } = renderNavigation(coachUser);
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
      expect(screen.getByText('Twizzit Integration')).toBeInTheDocument();

      unmount();

      renderNavigation(adminUser);
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
      expect(screen.getByText('Twizzit Integration')).toBeInTheDocument();
    });
  });

  describe('Logout Functionality', () => {
    const regularUser = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      role: 'user'
    };

    it('calls logout when logout button is clicked', async () => {
      renderNavigation(regularUser);
      
      await openUserMenu();
      fireEvent.click(screen.getByText('Logout'));
      
      expect(mockLogout).toHaveBeenCalled();
    });

    it('navigates to login page after logout', async () => {
      renderNavigation(regularUser);
      
      await openUserMenu();
      fireEvent.click(screen.getByText('Logout'));
      
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

    it('opens password dialog when change password button is clicked', async () => {
      renderNavigation(regularUser);
      
      await openUserMenu();
      fireEvent.click(screen.getByText('Change Password'));
      
      expect(screen.getByText('Change Your Password')).toBeInTheDocument();
    });

    it('shows current password field in dialog', async () => {
      renderNavigation(regularUser);
      
      await openUserMenu();
      fireEvent.click(screen.getByText('Change Password'));
      
      expect(screen.getByLabelText('Current Password *')).toBeInTheDocument();
    });

    it('passes correct props to password dialog', async () => {
      renderNavigation(regularUser);
      
      await openUserMenu();
      fireEvent.click(screen.getByText('Change Password'));
      
      // Verify dialog is open with correct user info
      expect(screen.getByText('Change Your Password')).toBeInTheDocument();
      
      // Verify it's for own password (has current password field)
      expect(screen.getByLabelText('Current Password *')).toBeInTheDocument();
    });

    it('closes password dialog when cancel is clicked', async () => {
      renderNavigation(regularUser);
      
      await openUserMenu();
      fireEvent.click(screen.getByText('Change Password'));
      
      expect(screen.getByText('Change Your Password')).toBeInTheDocument();
      
      fireEvent.click(screen.getByText('Cancel'));
      
      expect(screen.queryByText('Change Your Password')).not.toBeInTheDocument();
    });

    it('closes password dialog when X button is clicked', async () => {
      renderNavigation(regularUser);
      
      await openUserMenu();
      fireEvent.click(screen.getByText('Change Password'));
      
      const closeButton = screen.getByLabelText('Close dialog');
      fireEvent.click(closeButton);
      
      expect(screen.queryByText('Change Your Password')).not.toBeInTheDocument();
    });

    it('successfully changes password', async () => {
      mockApi.post.mockResolvedValue({ data: { message: 'Password changed successfully' } });
      
      renderNavigation(regularUser);
      
      // Open dialog
      await openUserMenu();
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
      
      await openUserMenu();
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
      
      await openUserMenu();
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
      
      await openUserMenu();
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

    it('can reopen password dialog after closing', async () => {
      renderNavigation(regularUser);
      
      // Open dialog
      await openUserMenu();
      fireEvent.click(screen.getByText('Change Password'));
      expect(screen.getByText('Change Your Password')).toBeInTheDocument();
      
      // Close dialog
      fireEvent.click(screen.getByText('Cancel'));
      expect(screen.queryByText('Change Your Password')).not.toBeInTheDocument();
      
      // Reopen dialog
      await openUserMenu();
      fireEvent.click(screen.getByText('Change Password'));
      expect(screen.getByText('Change Your Password')).toBeInTheDocument();
    });

    it('validates password before submission', async () => {
      renderNavigation(regularUser);
      
      await openUserMenu();
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

    it('shows change password button for admin', async () => {
      renderNavigation(adminUser);
      
      await openUserMenu();
      expect(screen.getByText('Change Password')).toBeInTheDocument();
    });

    it('admin can change own password via navigation', async () => {
      renderNavigation(adminUser);
      
      await openUserMenu();
      fireEvent.click(screen.getByText('Change Password'));
      
      expect(screen.getByText('Change Your Password')).toBeInTheDocument();
      expect(screen.getByLabelText('Current Password *')).toBeInTheDocument();
    });

    it('admin password change requires current password', async () => {
      renderNavigation(adminUser);
      
      await openUserMenu();
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

    it('shows change password button for coach', async () => {
      renderNavigation(coachUser);
      
      await openUserMenu();
      expect(screen.getByText('Change Password')).toBeInTheDocument();
    });

    it('coach can change own password via navigation', async () => {
      renderNavigation(coachUser);
      
      await openUserMenu();
      fireEvent.click(screen.getByText('Change Password'));
      
      expect(screen.getByText('Change Your Password')).toBeInTheDocument();
    });
  });
});
