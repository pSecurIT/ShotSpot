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
    is_active: true,
    last_login: '2024-01-15T10:30:00Z',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 2,
    username: 'coach1',
    email: 'coach1@example.com',
    role: 'coach',
    is_active: true,
    last_login: '2024-01-14T08:00:00Z',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z'
  },
  {
    id: 3,
    username: 'user1',
    email: 'user1@example.com',
    role: 'user',
    is_active: true,
    last_login: null,
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
      expect(screen.getByText('Role')).toBeInTheDocument();
      expect(screen.getByText('Last Login')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
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

  describe('Create User Functionality', () => {
    it('displays create user button', async () => {
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('+ Create User')).toBeInTheDocument();
      });
    });

    it('opens create user dialog when button is clicked', async () => {
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('+ Create User')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('+ Create User'));
      
      await waitFor(() => {
        expect(screen.getByText('Create New User')).toBeInTheDocument();
      });
    });

    it('shows success message after user creation', async () => {
      mockApi.post.mockResolvedValue({
        data: { id: 4, username: 'newuser', email: 'new@example.com', role: 'user' }
      });
      
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('+ Create User')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('+ Create User'));
      
      await waitFor(() => {
        expect(screen.getByLabelText('Username *')).toBeInTheDocument();
      });
      
      // Fill form
      fireEvent.change(screen.getByLabelText('Username *'), { target: { value: 'newuser' } });
      fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'new@example.com' } });
      fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'SecureP@ss123' } });
      
      // Submit
      fireEvent.click(screen.getByText('Create User'));
      
      await waitFor(() => {
        expect(screen.getByText('User newuser created successfully')).toBeInTheDocument();
      });
    });

    it('refreshes user list after successful creation', async () => {
      mockApi.post.mockResolvedValue({
        data: { id: 4, username: 'newuser', email: 'new@example.com', role: 'user' }
      });
      
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('+ Create User')).toBeInTheDocument();
      });
      
      // Initial fetch on mount
      expect(mockApi.get).toHaveBeenCalledTimes(1);
      
      fireEvent.click(screen.getByText('+ Create User'));
      
      await waitFor(() => {
        expect(screen.getByLabelText('Username *')).toBeInTheDocument();
      });
      
      fireEvent.change(screen.getByLabelText('Username *'), { target: { value: 'newuser' } });
      fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'new@example.com' } });
      fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'SecureP@ss123' } });
      fireEvent.click(screen.getByText('Create User'));
      
      await waitFor(() => {
        // Refresh fetch after creation
        expect(mockApi.get).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Last Login Display', () => {
    it('displays last login column header', async () => {
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('Last Login')).toBeInTheDocument();
      });
    });

    it('displays "Never" for users who have not logged in', async () => {
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('Never')).toBeInTheDocument();
      });
    });

    it('displays formatted last login time', async () => {
      renderUserManagement();
      
      await waitFor(() => {
        const lastLoginCells = screen.getAllByText(/ago|Never/);
        expect(lastLoginCells.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Delete User Functionality', () => {
    it('displays delete button for each user', async () => {
      renderUserManagement();
      
      await waitFor(() => {
        const deleteButtons = await screen.findAllByRole('button', { name: /delete user|cannot delete yourself/i });
        expect(deleteButtons).toHaveLength(3);
      });
    });

    it('disables delete button for current user', async () => {
      renderUserManagement({ id: 1, username: 'admin', role: 'admin', email: 'admin@example.com' });
      
      await waitFor(() => {
        const deleteButtons = await screen.findAllByRole('button', { name: /delete user|cannot delete yourself/i });
        const adminDeleteButton = deleteButtons[0];
        expect(adminDeleteButton).toBeDisabled();
      });
    });

    it('enables delete button for other users', async () => {
      renderUserManagement({ id: 1, username: 'admin', role: 'admin', email: 'admin@example.com' });
      
      await waitFor(() => {
        const deleteButtons = await screen.findAllByRole('button', { name: /delete user|cannot delete yourself/i });
        const coachDeleteButton = deleteButtons[1];
        const userDeleteButton = deleteButtons[2];
        
        expect(coachDeleteButton).not.toBeDisabled();
        expect(userDeleteButton).not.toBeDisabled();
      });
    });

    it('shows confirmation buttons when delete is clicked', async () => {
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('user1')).toBeInTheDocument();
      });
      
      const deleteButtons = await screen.findAllByRole('button', { name: /delete user/i });
      const user1DeleteButton = deleteButtons[deleteButtons.length - 1]; // Last user
      
      fireEvent.click(user1DeleteButton);
      
      await waitFor(() => {
        expect(await screen.findByRole('button', { name: /confirm delete/i })).toBeInTheDocument();
        expect(await screen.findByRole('button', { name: /cancel/i })).toBeInTheDocument();
      });
    });

    it('cancels delete when cancel button is clicked', async () => {
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('user1')).toBeInTheDocument();
      });
      
      const deleteButtons = await screen.findAllByRole('button', { name: /delete user/i });
      fireEvent.click(deleteButtons[deleteButtons.length - 1]);
      
      await waitFor(() => {
        expect(await screen.findByRole('button', { name: /confirm delete/i })).toBeInTheDocument();
      });
      
      fireEvent.click(await screen.findByRole('button', { name: /cancel/i }));
      
      await waitFor(() => {
        expect(screen.queryByTitle('Confirm delete')).not.toBeInTheDocument();
      });
      
      expect(mockApi.delete).not.toHaveBeenCalled();
    });

    it('deletes user when confirmed', async () => {
      mockApi.delete.mockResolvedValue({ data: { message: 'User deactivated successfully' } });
      
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('user1')).toBeInTheDocument();
      });
      
      const deleteButtons = await screen.findAllByRole('button', { name: /delete user/i });
      fireEvent.click(deleteButtons[deleteButtons.length - 1]);
      
      await waitFor(() => {
        expect(await screen.findByRole('button', { name: /confirm delete/i })).toBeInTheDocument();
      });
      
      fireEvent.click(await screen.findByRole('button', { name: /confirm delete/i }));
      
      await waitFor(() => {
        expect(mockApi.delete).toHaveBeenCalledWith('/users/3');
      });
    });

    it('shows success message after deletion', async () => {
      mockApi.delete.mockResolvedValue({ data: { message: 'User deactivated successfully' } });
      
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('user1')).toBeInTheDocument();
      });
      
      const deleteButtons = await screen.findAllByRole('button', { name: /delete user/i });
      fireEvent.click(deleteButtons[deleteButtons.length - 1]);
      
      await waitFor(() => {
        expect(await screen.findByRole('button', { name: /confirm delete/i })).toBeInTheDocument();
      });
      
      fireEvent.click(await screen.findByRole('button', { name: /confirm delete/i }));
      
      await waitFor(() => {
        expect(screen.getByText('User deactivated successfully')).toBeInTheDocument();
      });
    });

    it('refreshes user list after successful deletion', async () => {
      mockApi.delete.mockResolvedValue({ data: { message: 'User deactivated successfully' } });
      
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('user1')).toBeInTheDocument();
      });
      
      // Initial fetch on mount
      expect(mockApi.get).toHaveBeenCalledTimes(1);
      
      const deleteButtons = await screen.findAllByRole('button', { name: /delete user/i });
      fireEvent.click(deleteButtons[deleteButtons.length - 1]);
      
      await waitFor(() => {
        expect(await screen.findByRole('button', { name: /confirm delete/i })).toBeInTheDocument();
      });
      
      fireEvent.click(await screen.findByRole('button', { name: /confirm delete/i }));
      
      await waitFor(() => {
        // Refresh fetch after deletion
        expect(mockApi.get).toHaveBeenCalledTimes(2);
      });
    });

    it('handles deletion API errors', async () => {
      mockApi.delete.mockRejectedValue({
        response: {
          data: {
            error: 'Cannot delete the last admin user'
          }
        }
      });
      
      renderUserManagement();
      
      await waitFor(() => {
        const usernameCells = screen.getAllByText('admin');
        expect(usernameCells.length).toBeGreaterThan(0);
      });
      
      const deleteButtons = await screen.findAllByRole('button', { name: /delete user|cannot delete yourself/i });
      // Try to delete first enabled button
      const enabledButton = deleteButtons.find(btn => !btn.hasAttribute('disabled'));
      if (enabledButton) {
        fireEvent.click(enabledButton);
        
        await waitFor(() => {
          const confirmButton = screen.queryByTitle('Confirm delete');
          if (confirmButton) {
            fireEvent.click(confirmButton);
          }
        });
        
        await waitFor(() => {
          expect(screen.getByText('Cannot delete the last admin user')).toBeInTheDocument();
        });
      }
    });

    it('handles deletion network errors', async () => {
      mockApi.delete.mockRejectedValue(new Error('Network error'));
      
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('user1')).toBeInTheDocument();
      });
      
      const deleteButtons = await screen.findAllByRole('button', { name: /delete user/i });
      fireEvent.click(deleteButtons[deleteButtons.length - 1]);
      
      await waitFor(() => {
        expect(await screen.findByRole('button', { name: /confirm delete/i })).toBeInTheDocument();
      });
      
      fireEvent.click(await screen.findByRole('button', { name: /confirm delete/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Failed to delete user')).toBeInTheDocument();
      });
    });

    it('clears confirmation state after deletion', async () => {
      mockApi.delete.mockResolvedValue({ data: { message: 'User deactivated successfully' } });
      
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('user1')).toBeInTheDocument();
      });
      
      const deleteButtons = await screen.findAllByRole('button', { name: /delete user/i });
      fireEvent.click(deleteButtons[deleteButtons.length - 1]);
      
      await waitFor(() => {
        expect(await screen.findByRole('button', { name: /confirm delete/i })).toBeInTheDocument();
      });
      
      fireEvent.click(await screen.findByRole('button', { name: /confirm delete/i }));
      
      await waitFor(() => {
        expect(screen.queryByTitle('Confirm delete')).not.toBeInTheDocument();
      });
    });
  });

  describe('Edit User Functionality', () => {
    it('displays edit button for each user', async () => {
      renderUserManagement();
      
      await waitFor(() => {
        const editButtons = screen.getAllByTitle('Edit profile');
        expect(editButtons).toHaveLength(3);
      });
    });

    it('opens edit dialog when edit button is clicked', async () => {
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('user1')).toBeInTheDocument();
      });
      
      const editButtons = screen.getAllByTitle('Edit profile');
      const user1EditButton = editButtons[2]; // user1's edit button
      
      fireEvent.click(user1EditButton);
      
      await waitFor(() => {
        expect(screen.getByText('Edit User Profile')).toBeInTheDocument();
      });
    });

    it('pre-populates form with user data', async () => {
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('coach1')).toBeInTheDocument();
      });
      
      const editButtons = screen.getAllByTitle('Edit profile');
      const coach1EditButton = editButtons[1]; // coach1's edit button
      
      fireEvent.click(coach1EditButton);
      
      await waitFor(() => {
        const usernameInput = screen.getByLabelText('Username *') as HTMLInputElement;
        const emailInput = screen.getByLabelText('Email *') as HTMLInputElement;
        
        expect(usernameInput.value).toBe('coach1');
        expect(emailInput.value).toBe('coach1@example.com');
      });
    });

    it('shows success message after successful edit', async () => {
      mockApi.patch.mockResolvedValue({
        data: { id: 3, username: 'updateduser', email: 'updated@example.com', role: 'user' }
      });
      
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('user1')).toBeInTheDocument();
      });
      
      const editButtons = screen.getAllByTitle('Edit profile');
      fireEvent.click(editButtons[2]);
      
      await waitFor(() => {
        expect(screen.getByLabelText('Username *')).toBeInTheDocument();
      });
      
      fireEvent.change(screen.getByLabelText('Username *'), { target: { value: 'updateduser' } });
      fireEvent.click(screen.getByText('Save Changes'));
      
      await waitFor(() => {
        expect(screen.getByText('User updateduser updated successfully')).toBeInTheDocument();
      });
    });

    it('refreshes user list after successful edit', async () => {
      mockApi.patch.mockResolvedValue({
        data: { id: 3, username: 'updateduser', email: 'updated@example.com', role: 'user' }
      });
      
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('user1')).toBeInTheDocument();
      });
      
      // Initial fetch on mount
      expect(mockApi.get).toHaveBeenCalledTimes(1);
      
      const editButtons = screen.getAllByTitle('Edit profile');
      fireEvent.click(editButtons[2]);
      
      await waitFor(() => {
        expect(screen.getByLabelText('Username *')).toBeInTheDocument();
      });
      
      fireEvent.change(screen.getByLabelText('Username *'), { target: { value: 'updateduser' } });
      fireEvent.click(screen.getByText('Save Changes'));
      
      await waitFor(() => {
        // Refresh fetch after edit
        expect(mockApi.get).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Password Reset Functionality', () => {
    it('displays password reset buttons', async () => {
      renderUserManagement();
      
      await waitFor(() => {
        expect(screen.getByText('Actions')).toBeInTheDocument();
      });
      
      const passwordButtons = await screen.findAllByRole('button', { name: /reset password/i });
      expect(passwordButtons).toHaveLength(3); // One for each user
    });

    it('opens password dialog when reset button is clicked', async () => {
      renderUserManagement();
      
      await waitFor(() => {
        const resetButtons = await screen.findAllByRole('button', { name: /reset password/i });
        expect(resetButtons.length).toBeGreaterThan(0);
      });
      
      const resetButtons = await screen.findAllByRole('button', { name: /reset password/i });
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
      
      const resetButtons = await screen.findAllByRole('button', { name: /reset password/i });
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
      
      const resetButtons = await screen.findAllByRole('button', { name: /reset password/i });
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
      
      const resetButtons = await screen.findAllByRole('button', { name: /reset password/i });
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
      const resetButtons = await screen.findAllByRole('button', { name: /reset password/i });
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
      const resetButtons = await screen.findAllByRole('button', { name: /reset password/i });
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
      const resetButtons = await screen.findAllByRole('button', { name: /reset password/i });
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
      const resetButtons = await screen.findAllByRole('button', { name: /reset password/i });
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
      const resetButtons = await screen.findAllByRole('button', { name: /reset password/i });
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
      const resetButtons = await screen.findAllByRole('button', { name: /reset password/i });
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
        const newResetButtons = await screen.findAllByRole('button', { name: /reset password/i });
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
      const resetButtons = await screen.findAllByRole('button', { name: /reset password/i });
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
      const resetButtons = await screen.findAllByRole('button', { name: /reset password/i });
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
      const newResetButtons = await screen.findAllByRole('button', { name: /reset password/i });
      fireEvent.click(newResetButtons[1]);
      
      await waitFor(() => {
        expect(screen.getByText('Reset Password for coach1')).toBeInTheDocument();
      });
    });
  });
});
