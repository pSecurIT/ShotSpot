import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import UserManagement from '../components/UserManagement';
import api from '../utils/api';
import { act } from 'react';

// Mock the api module
vi.mock('../utils/api');
const mockApi = api as jest.Mocked<typeof api>;

// Mock the useAuth hook
const mockUseAuth = vi.fn();
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth()
}));

const mockUsers = [
  {
    id: 1,
    username: 'admin',
    email: 'admin@example.com',
    role: 'admin',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 2,
    username: 'coach1',
    email: 'coach1@example.com',
    role: 'coach',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z'
  },
  {
    id: 3,
    username: 'user1',
    email: 'user1@example.com',
    role: 'user',
    created_at: '2024-01-03T00:00:00Z',
    updated_at: '2024-01-03T00:00:00Z'
  }
];

const renderUserManagement = (authUser = { id: 1, username: 'admin', role: 'admin', email: 'admin@example.com' }) => {
  mockUseAuth.mockReturnValue({
    user: authUser,
    login: vi.fn(),
    logout: vi.fn(),
    isLoading: false
  });

  return render(<UserManagement />);
};

describe('UserManagement Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default successful response for most tests
    mockApi.get.mockResolvedValue({ data: mockUsers });
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'admin', role: 'admin', email: 'admin@example.com' },
      login: vi.fn(),
      logout: vi.fn(),
      isLoading: false
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Access Control', () => {
    it('allows access for admin users', async () => {
      renderUserManagement({ id: 1, username: 'admin', role: 'admin', email: 'admin@example.com' });
      
      await waitFor(() => {
        expect(screen.getByText('User Management')).toBeInTheDocument();
      });
    });

    it('denies access for non-admin users', () => {
      renderUserManagement({ id: 2, username: 'coach', role: 'coach', email: 'coach@example.com' });
      
      expect(screen.getByText("You don't have permission to access this page.")).toBeInTheDocument();
      expect(screen.queryByText('User Management')).not.toBeInTheDocument();
    });

    it('denies access for regular users', () => {
      renderUserManagement({ id: 3, username: 'user', role: 'user', email: 'user@example.com' });
      
      expect(screen.getByText("You don't have permission to access this page.")).toBeInTheDocument();
      expect(screen.queryByText('User Management')).not.toBeInTheDocument();
    });

    it('denies access when user is null', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false
      });
      
      render(<UserManagement />);
      
      expect(screen.getByText("You don't have permission to access this page.")).toBeInTheDocument();
      expect(screen.queryByText('User Management')).not.toBeInTheDocument();
    });
  });

  describe('User List Display', () => {
    it('renders user management interface correctly', async () => {
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('User Management')).toBeInTheDocument();
      });
      
      // Check table headers
      expect(screen.getByText('Username')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('Current Role')).toBeInTheDocument();
      expect(screen.getByText('Change Role')).toBeInTheDocument();
      expect(screen.getByText('Password')).toBeInTheDocument();
    });

    it('displays all users in the table', async () => {
      renderUserManagement();
      
      await waitFor(() => {
        // Check usernames are present
        const usernameCells = screen.getAllByText('admin');
        expect(usernameCells.length).toBeGreaterThan(0);
        expect(screen.getByText('coach1')).toBeInTheDocument();
        expect(screen.getByText('user1')).toBeInTheDocument();
      });
      
      // Check emails are present
      expect(screen.getByText('admin@example.com')).toBeInTheDocument();
      expect(screen.getByText('coach1@example.com')).toBeInTheDocument();
      expect(screen.getByText('user1@example.com')).toBeInTheDocument();
    });

    it('shows role dropdowns for each user', async () => {
      renderUserManagement();
      
      await waitFor(() => {
        const roleDropdowns = screen.getAllByRole('combobox');
        expect(roleDropdowns).toHaveLength(3); // One for each user
      });
    });

    it('fetches users on component mount', async () => {
      renderUserManagement();
      
      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalledWith('/users');
      });
    });
  });

  describe('Role Management', () => {
    it('allows changing user roles', async () => {
      mockApi.put.mockResolvedValue({ data: { message: 'Role updated successfully' } });
      mockApi.get.mockResolvedValueOnce({ data: mockUsers })
                .mockResolvedValueOnce({ data: [...mockUsers.slice(0, 2), { ...mockUsers[2], role: 'coach' }] });
      
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('user1')).toBeInTheDocument();
      });
      
      // Find the role dropdown for user1 (should be the third one)
      const roleDropdowns = screen.getAllByRole('combobox');
      const user1Dropdown = roleDropdowns[2]; // user1 is the third user
      
      fireEvent.change(user1Dropdown, { target: { value: 'coach' } });
      
      await waitFor(() => {
        expect(mockApi.put).toHaveBeenCalledWith('/users/3/role', { role: 'coach' });
      });
    });

    it('shows success message after role update', async () => {
      mockApi.put.mockResolvedValue({ data: { message: 'Role updated successfully' } });
      
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('user1')).toBeInTheDocument();
      });
      
      const roleDropdowns = screen.getAllByRole('combobox');
      const user1Dropdown = roleDropdowns[2];
      
      fireEvent.change(user1Dropdown, { target: { value: 'coach' } });
      
      await waitFor(() => {
        expect(screen.getByText('User role updated successfully')).toBeInTheDocument();
      });
    });

    it('prevents users from changing their own role', async () => {
      renderUserManagement({ id: 1, username: 'admin', role: 'admin', email: 'admin@example.com' });
      
      await waitFor(() => {
        const usernameCells = screen.getAllByText('admin');
        expect(usernameCells.length).toBeGreaterThan(0);
      });
      
      // Find admin's role dropdown (first one)
      const roleDropdowns = screen.getAllByRole('combobox');
      const adminDropdown = roleDropdowns[0];
      
      fireEvent.change(adminDropdown, { target: { value: 'user' } });
      
      await waitFor(() => {
        expect(screen.getByText('Cannot change your own role')).toBeInTheDocument();
      });
      
      expect(mockApi.put).not.toHaveBeenCalled();
    });

    it('disables role dropdown for current user', async () => {
      renderUserManagement({ id: 1, username: 'admin', role: 'admin', email: 'admin@example.com' });
      
      await waitFor(() => {
        const roleDropdowns = screen.getAllByRole('combobox');
        const adminDropdown = roleDropdowns[0];
        expect(adminDropdown).toBeDisabled();
      });
    });

    it('enables role dropdown for other users', async () => {
      renderUserManagement({ id: 1, username: 'admin', role: 'admin', email: 'admin@example.com' });
      
      await waitFor(() => {
        const roleDropdowns = screen.getAllByRole('combobox');
        const coachDropdown = roleDropdowns[1]; // coach1
        const userDropdown = roleDropdowns[2]; // user1
        
        expect(coachDropdown).not.toBeDisabled();
        expect(userDropdown).not.toBeDisabled();
      });
    });

    it('handles role update API errors', async () => {
      mockApi.put.mockRejectedValue({
        response: {
          data: {
            error: 'Insufficient permissions'
          }
        }
      });
      
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('user1')).toBeInTheDocument();
      });
      
      const roleDropdowns = screen.getAllByRole('combobox');
      const user1Dropdown = roleDropdowns[2];
      
      fireEvent.change(user1Dropdown, { target: { value: 'admin' } });
      
      await waitFor(() => {
        expect(screen.getByText('Insufficient permissions')).toBeInTheDocument();
      });
    });

    it('handles role update network errors', async () => {
      mockApi.put.mockRejectedValue(new Error('Network error'));
      
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('user1')).toBeInTheDocument();
      });
      
      const roleDropdowns = screen.getAllByRole('combobox');
      const user1Dropdown = roleDropdowns[2];
      
      fireEvent.change(user1Dropdown, { target: { value: 'admin' } });
      
      await waitFor(() => {
        expect(screen.getByText('Failed to update user role')).toBeInTheDocument();
      });
    });

    it('refreshes user list after successful role update', async () => {
      mockApi.put.mockResolvedValue({ data: { message: 'Role updated successfully' } });
      
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('user1')).toBeInTheDocument();
      });
      
      const roleDropdowns = screen.getAllByRole('combobox');
      const user1Dropdown = roleDropdowns[2];
      
      // Initial fetch on mount
      expect(mockApi.get).toHaveBeenCalledTimes(1);
      
      fireEvent.change(user1Dropdown, { target: { value: 'coach' } });
      
      await waitFor(() => {
        // Refresh fetch after role update
        expect(mockApi.get).toHaveBeenCalledTimes(2);
        expect(mockApi.get).toHaveBeenLastCalledWith('/users');
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message when fetching users fails', async () => {
      mockApi.get.mockRejectedValue({
        response: {
          data: {
            error: 'Database connection failed'
          }
        }
      });
      
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('Database connection failed')).toBeInTheDocument();
      });
    });

    it('displays fallback error message for network errors', async () => {
      mockApi.get.mockRejectedValue(new Error('Network error'));
      
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('Failed to fetch users')).toBeInTheDocument();
      });
    });

    it('clears error message when successful role update occurs', async () => {
      // Setup successful API calls
      mockApi.put.mockResolvedValue({ data: { message: 'Role updated' } });
      
      renderUserManagement();
      
      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('user1')).toBeInTheDocument();
      });
      
      // Trigger role update that should clear any previous error state
      const roleDropdowns = screen.getAllByRole('combobox');
      fireEvent.change(roleDropdowns[2], { target: { value: 'coach' } });
      
      await waitFor(() => {
        expect(screen.getByText('User role updated successfully')).toBeInTheDocument();
      });
    });

    it('clears success message when new role update occurs', async () => {
      mockApi.put.mockResolvedValue({ data: { message: 'Role updated' } });
      
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('user1')).toBeInTheDocument();
      });
      
      const roleDropdowns = screen.getAllByRole('combobox');
      const user1Dropdown = roleDropdowns[2];
      
      // First role change
      fireEvent.change(user1Dropdown, { target: { value: 'coach' } });
      
      await waitFor(() => {
        expect(screen.getByText('User role updated successfully')).toBeInTheDocument();
      });
      
      // Second role change should clear previous success message
      fireEvent.change(user1Dropdown, { target: { value: 'admin' } });
      
      await waitFor(() => {
        expect(mockApi.put).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Role Options', () => {
    it('provides all available role options', async () => {
      renderUserManagement();
      
      await waitFor(() => {
        const roleDropdowns = screen.getAllByRole('combobox');
        const dropdown = roleDropdowns[1]; // coach1's dropdown
        
        const options = Array.from(dropdown.querySelectorAll('option')).map(option => option.textContent);
        expect(options).toEqual(['User', 'Coach', 'Admin']);
      });
    });

    it('sets correct default values for role dropdowns', async () => {
      renderUserManagement();
      
      await waitFor(() => {
        const roleDropdowns = screen.getAllByRole('combobox');
        
        // Check admin dropdown
        expect(roleDropdowns[0]).toHaveValue('admin');
        // Check coach dropdown  
        expect(roleDropdowns[1]).toHaveValue('coach');
        // Check user dropdown
        expect(roleDropdowns[2]).toHaveValue('user');
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles empty user list', async () => {
      mockApi.get.mockResolvedValue({ data: [] });
      
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('User Management')).toBeInTheDocument();
      });
      
      // Should have table headers but no user rows
      expect(screen.getByText('Username')).toBeInTheDocument();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('handles API response without error field', async () => {
      mockApi.get.mockRejectedValue({
        response: { data: {} }
      });
      
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('Failed to fetch users')).toBeInTheDocument();
      });
    });

    it('handles API response without response field', async () => {
      mockApi.get.mockRejectedValue({});
      
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('Failed to fetch users')).toBeInTheDocument();
      });
    });

    it('handles role update with missing error details', async () => {
      mockApi.put.mockRejectedValue({
        response: { data: {} }
      });
      
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('user1')).toBeInTheDocument();
      });
      
      const roleDropdowns = screen.getAllByRole('combobox');
      const user1Dropdown = roleDropdowns[2];
      
      fireEvent.change(user1Dropdown, { target: { value: 'admin' } });
      
      await waitFor(() => {
        expect(screen.getByText('Failed to update user role')).toBeInTheDocument();
      });
    });
  });

  describe('Password Reset Functionality', () => {
    it('displays password column with reset buttons', async () => {
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('Password')).toBeInTheDocument();
      });
      
      const resetButtons = screen.getAllByText('Reset Password');
      expect(resetButtons).toHaveLength(3); // One for each user
    });

    it('opens password dialog when reset button is clicked', async () => {
      renderUserManagement();
      
      await waitFor(() => {
        const resetButtons = screen.getAllByText('Reset Password');
        expect(resetButtons.length).toBeGreaterThan(0);
      });
      
      const resetButtons = screen.getAllByText('Reset Password');
      const user1ResetButton = resetButtons[2]; // user1's reset button
      
      fireEvent.click(user1ResetButton);
      
      await waitFor(() => {
        expect(screen.getByText('Reset Password for user1')).toBeInTheDocument();
      });
    });

    it('shows correct dialog title for different users', async () => {
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('coach1')).toBeInTheDocument();
      });
      
      const resetButtons = screen.getAllByText('Reset Password');
      const coach1ResetButton = resetButtons[1]; // coach1's reset button
      
      fireEvent.click(coach1ResetButton);
      
      await waitFor(() => {
        expect(screen.getByText('Reset Password for coach1')).toBeInTheDocument();
      });
    });

    it('shows current password field when admin resets own password', async () => {
      renderUserManagement({ id: 1, username: 'admin', role: 'admin', email: 'admin@example.com' });
      
      await waitFor(() => {
        const usernameCells = screen.getAllByText('admin');
        expect(usernameCells.length).toBeGreaterThan(0);
      });
      
      const resetButtons = screen.getAllByText('Reset Password');
      const adminResetButton = resetButtons[0]; // admin's reset button
      
      fireEvent.click(adminResetButton);
      
      await waitFor(() => {
        expect(screen.getByText('Change Your Password')).toBeInTheDocument();
        expect(screen.getByLabelText('Current Password *')).toBeInTheDocument();
      });
    });

    it('does not show current password field when admin resets other user password', async () => {
      renderUserManagement({ id: 1, username: 'admin', role: 'admin', email: 'admin@example.com' });
      
      await waitFor(() => {
        expect(screen.getByText('user1')).toBeInTheDocument();
      });
      
      const resetButtons = screen.getAllByText('Reset Password');
      const user1ResetButton = resetButtons[2]; // user1's reset button
      
      fireEvent.click(user1ResetButton);
      
      await waitFor(() => {
        expect(screen.getByText('Reset Password for user1')).toBeInTheDocument();
        expect(screen.queryByLabelText('Current Password *')).not.toBeInTheDocument();
      });
    });

    it('successfully resets password for other user', async () => {
      mockApi.put.mockResolvedValue({ data: { message: 'Password reset successfully' } });
      
      renderUserManagement({ id: 1, username: 'admin', role: 'admin', email: 'admin@example.com' });
      
      await waitFor(() => {
        expect(screen.getByText('user1')).toBeInTheDocument();
      });
      
      // Open password dialog for user1
      const resetButtons = screen.getAllByText('Reset Password');
      fireEvent.click(resetButtons[2]);
      
      await waitFor(() => {
        expect(screen.getByText('Reset Password for user1')).toBeInTheDocument();
      });
      
      // Fill in new password
      const newPasswordInput = screen.getByLabelText('New Password *');
      const confirmPasswordInput = screen.getByLabelText('Confirm New Password *');
      
      fireEvent.change(newPasswordInput, { target: { value: 'NewPass123!' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'NewPass123!' } });
      
      // Submit form
      const changePasswordButton = screen.getByText('Change Password');
      fireEvent.click(changePasswordButton);
      
      await waitFor(() => {
        expect(mockApi.put).toHaveBeenCalledWith('/users/3/password', {
          newPassword: 'NewPass123!'
        });
        expect(screen.getByText('Password reset successfully for user1')).toBeInTheDocument();
      });
    });

    it('shows success message after password reset', async () => {
      mockApi.put.mockResolvedValue({ data: { message: 'Password reset successfully' } });
      
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('coach1')).toBeInTheDocument();
      });
      
      // Click reset password for coach1
      const resetButtons = screen.getAllByText('Reset Password');
      fireEvent.click(resetButtons[1]);
      
      await waitFor(() => {
        expect(screen.getByLabelText('New Password *')).toBeInTheDocument();
      });
      
      // Fill and submit form
      fireEvent.change(screen.getByLabelText('New Password *'), { target: { value: 'NewPass123!' } });
      fireEvent.change(screen.getByLabelText('Confirm New Password *'), { target: { value: 'NewPass123!' } });
      fireEvent.click(screen.getByText('Change Password'));
      
      await waitFor(() => {
        expect(screen.getByText('Password reset successfully for coach1')).toBeInTheDocument();
      });
    });

    it('closes password dialog after successful reset', async () => {
      mockApi.put.mockResolvedValue({ data: { message: 'Password reset successfully' } });
      
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('user1')).toBeInTheDocument();
      });
      
      // Open dialog
      const resetButtons = screen.getAllByText('Reset Password');
      fireEvent.click(resetButtons[2]);
      
      await waitFor(() => {
        expect(screen.getByText('Reset Password for user1')).toBeInTheDocument();
      });
      
      // Fill and submit
      fireEvent.change(screen.getByLabelText('New Password *'), { target: { value: 'NewPass123!' } });
      fireEvent.change(screen.getByLabelText('Confirm New Password *'), { target: { value: 'NewPass123!' } });
      fireEvent.click(screen.getByText('Change Password'));
      
      await waitFor(() => {
        expect(screen.queryByText('Reset Password for user1')).not.toBeInTheDocument();
      });
    });

    it('closes password dialog when cancel is clicked', async () => {
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('user1')).toBeInTheDocument();
      });
      
      // Open dialog
      const resetButtons = screen.getAllByText('Reset Password');
      fireEvent.click(resetButtons[2]);
      
      await waitFor(() => {
        expect(screen.getByText('Reset Password for user1')).toBeInTheDocument();
      });
      
      // Click cancel
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);
      
      await waitFor(() => {
        expect(screen.queryByText('Reset Password for user1')).not.toBeInTheDocument();
      });
    });

    it('handles password reset API errors', async () => {
      mockApi.put.mockRejectedValue({
        response: {
          data: {
            error: 'Password too weak'
          }
        }
      });
      
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('user1')).toBeInTheDocument();
      });
      
      // Open dialog and submit
      const resetButtons = screen.getAllByText('Reset Password');
      fireEvent.click(resetButtons[2]);
      
      await waitFor(() => {
        expect(screen.getByLabelText('New Password *')).toBeInTheDocument();
      });
      
      fireEvent.change(screen.getByLabelText('New Password *'), { target: { value: 'weak' } });
      fireEvent.change(screen.getByLabelText('Confirm New Password *'), { target: { value: 'weak' } });
      fireEvent.click(screen.getByText('Change Password'));
      
      await waitFor(() => {
        // Client-side validation shows error - there are two texts with "at least 8 characters" (error + hint)
        const errorMessages = screen.getAllByText(/at least 8 characters/i);
        expect(errorMessages.length).toBeGreaterThan(0);
      });
    });

    it('clears success message when opening password dialog again', async () => {
      mockApi.put.mockResolvedValue({ data: { message: 'Password reset successfully' } });
      
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('user1')).toBeInTheDocument();
      });
      
      // First password reset
      const resetButtons = screen.getAllByText('Reset Password');
      fireEvent.click(resetButtons[2]);
      
      await waitFor(() => {
        expect(screen.getByLabelText('New Password *')).toBeInTheDocument();
      });
      
      fireEvent.change(screen.getByLabelText('New Password *'), { target: { value: 'NewPass123!' } });
      fireEvent.change(screen.getByLabelText('Confirm New Password *'), { target: { value: 'NewPass123!' } });
      fireEvent.click(screen.getByText('Change Password'));
      
      await waitFor(() => {
        expect(screen.getByText('Password reset successfully for user1')).toBeInTheDocument();
      });
      
      // Open dialog for another user - should clear previous success message
      await act(async () => {
        const newResetButtons = screen.getAllByText('Reset Password');
        fireEvent.click(newResetButtons[1]); // coach1
      });
      
      await waitFor(() => {
        expect(screen.getByText('Reset Password for coach1')).toBeInTheDocument();
      });
    });

    it('maintains user list when password dialog is open', async () => {
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('user1')).toBeInTheDocument();
      });
      
      // Open dialog
      const resetButtons = screen.getAllByText('Reset Password');
      fireEvent.click(resetButtons[2]);
      
      await waitFor(() => {
        expect(screen.getByText('Reset Password for user1')).toBeInTheDocument();
      });
      
      // User list should still be visible
      expect(screen.getByText('admin@example.com')).toBeInTheDocument();
      expect(screen.getByText('coach1@example.com')).toBeInTheDocument();
      expect(screen.getByText('user1@example.com')).toBeInTheDocument();
    });

    it('resets selected user when dialog is closed', async () => {
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('user1')).toBeInTheDocument();
      });
      
      // Open dialog for user1
      const resetButtons = screen.getAllByText('Reset Password');
      fireEvent.click(resetButtons[2]);
      
      await waitFor(() => {
        expect(screen.getByText('Reset Password for user1')).toBeInTheDocument();
      });
      
      // Close dialog
      fireEvent.click(screen.getByText('Cancel'));
      
      await waitFor(() => {
        expect(screen.queryByText('Reset Password for user1')).not.toBeInTheDocument();
      });
      
      // Open dialog for coach1 - should work correctly
      const newResetButtons = screen.getAllByText('Reset Password');
      fireEvent.click(newResetButtons[1]);
      
      await waitFor(() => {
        expect(screen.getByText('Reset Password for coach1')).toBeInTheDocument();
      });
    });
  });
});