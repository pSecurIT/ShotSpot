import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import ChangePasswordDialog from '../components/ChangePasswordDialog';
import api from '../utils/api';

// Mock the api module
vi.mock('../utils/api');
const mockApi = api as jest.Mocked<typeof api>;

describe('ChangePasswordDialog Component', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  const defaultProps = {
    userId: 1,
    username: 'testuser',
    isOwnPassword: true,
    isOpen: true,
    onClose: mockOnClose,
    onSuccess: mockOnSuccess
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders dialog when open', () => {
      render(<ChangePasswordDialog {...defaultProps} />);
      
      expect(screen.getByText('Change Your Password')).toBeInTheDocument();
      expect(screen.getByLabelText('Current Password *')).toBeInTheDocument();
      expect(screen.getByLabelText('New Password *')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm New Password *')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      render(<ChangePasswordDialog {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByText('Change Your Password')).not.toBeInTheDocument();
    });

    it('shows admin reset title for non-own password', () => {
      render(<ChangePasswordDialog {...defaultProps} isOwnPassword={false} username="otheruser" />);
      
      expect(screen.getByText('Reset Password for otheruser')).toBeInTheDocument();
      expect(screen.queryByLabelText('Current Password *')).not.toBeInTheDocument();
    });

    it('shows current password field for own password', () => {
      render(<ChangePasswordDialog {...defaultProps} />);
      
      expect(screen.getByLabelText('Current Password *')).toBeInTheDocument();
    });

    it('hides current password field for admin reset', () => {
      render(<ChangePasswordDialog {...defaultProps} isOwnPassword={false} />);
      
      expect(screen.queryByLabelText('Current Password *')).not.toBeInTheDocument();
    });
  });

  describe('Password Validation', () => {
    it('validates password minimum length', async () => {
      render(<ChangePasswordDialog {...defaultProps} />);
      
      fireEvent.change(screen.getByLabelText('Current Password *'), { target: { value: 'old123' } });
      fireEvent.change(screen.getByLabelText('New Password *'), { target: { value: 'short' } });
      fireEvent.change(screen.getByLabelText('Confirm New Password *'), { target: { value: 'short' } });
      
      fireEvent.click(screen.getByText('Change Password'));
      
      await waitFor(() => {
        // Error message and hint text both contain "at least 8 characters"
        const messages = screen.getAllByText(/at least 8 characters/i);
        expect(messages.length).toBeGreaterThan(0);
      });
      
      expect(mockApi.post).not.toHaveBeenCalled();
    });

    it('validates password requires lowercase letter', async () => {
      render(<ChangePasswordDialog {...defaultProps} />);
      
      fireEvent.change(screen.getByLabelText('Current Password *'), { target: { value: 'old123' } });
      fireEvent.change(screen.getByLabelText('New Password *'), { target: { value: 'TESTPASS123!' } });
      fireEvent.change(screen.getByLabelText('Confirm New Password *'), { target: { value: 'TESTPASS123!' } });
      
      fireEvent.click(screen.getByText('Change Password'));
      
      await waitFor(() => {
        expect(screen.getByText(/lowercase letter/i)).toBeInTheDocument();
      });
    });

    it('validates password requires uppercase letter', async () => {
      render(<ChangePasswordDialog {...defaultProps} />);
      
      fireEvent.change(screen.getByLabelText('Current Password *'), { target: { value: 'old123' } });
      fireEvent.change(screen.getByLabelText('New Password *'), { target: { value: 'testpass123!' } });
      fireEvent.change(screen.getByLabelText('Confirm New Password *'), { target: { value: 'testpass123!' } });
      
      fireEvent.click(screen.getByText('Change Password'));
      
      await waitFor(() => {
        expect(screen.getByText(/uppercase letter/i)).toBeInTheDocument();
      });
    });

    it('validates password requires number', async () => {
      render(<ChangePasswordDialog {...defaultProps} />);
      
      fireEvent.change(screen.getByLabelText('Current Password *'), { target: { value: 'old123' } });
      fireEvent.change(screen.getByLabelText('New Password *'), { target: { value: 'TestPassword!' } });
      fireEvent.change(screen.getByLabelText('Confirm New Password *'), { target: { value: 'TestPassword!' } });
      
      fireEvent.click(screen.getByText('Change Password'));
      
      await waitFor(() => {
        // Look for the specific error message about number
        const error = screen.queryByText(/must contain.*number/i);
        expect(error).toBeInTheDocument();
      });
    });

    it('validates password requires special character', async () => {
      render(<ChangePasswordDialog {...defaultProps} />);
      
      fireEvent.change(screen.getByLabelText('Current Password *'), { target: { value: 'old123' } });
      fireEvent.change(screen.getByLabelText('New Password *'), { target: { value: 'TestPassword123' } });
      fireEvent.change(screen.getByLabelText('Confirm New Password *'), { target: { value: 'TestPassword123' } });
      
      fireEvent.click(screen.getByText('Change Password'));
      
      await waitFor(() => {
        const error = screen.queryByText('Password must contain at least one special character');
        expect(error).toBeInTheDocument();
      });
    });

    it('validates passwords match', async () => {
      render(<ChangePasswordDialog {...defaultProps} />);
      
      fireEvent.change(screen.getByLabelText('Current Password *'), { target: { value: 'OldPass123!' } });
      fireEvent.change(screen.getByLabelText('New Password *'), { target: { value: 'NewPass123!' } });
      fireEvent.change(screen.getByLabelText('Confirm New Password *'), { target: { value: 'DifferentPass123!' } });
      
      fireEvent.click(screen.getByText('Change Password'));
      
      await waitFor(() => {
        expect(screen.getByText(/do not match/i)).toBeInTheDocument();
      });
    });

    // Note: Current password is marked as required at the HTML level, so browser validation
    // prevents form submission if it's empty. No need to test custom validation for this case.
  });

  describe('Form Submission - Own Password', () => {
    it('successfully changes own password', async () => {
      mockApi.post.mockResolvedValue({ data: { message: 'Password changed successfully' } });
      
      render(<ChangePasswordDialog {...defaultProps} />);
      
      fireEvent.change(screen.getByLabelText('Current Password *'), { target: { value: 'OldPass123!' } });
      fireEvent.change(screen.getByLabelText('New Password *'), { target: { value: 'NewPass123!' } });
      fireEvent.change(screen.getByLabelText('Confirm New Password *'), { target: { value: 'NewPass123!' } });
      
      fireEvent.click(screen.getByText('Change Password'));
      
      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith('/auth/change-password', {
          currentPassword: 'OldPass123!',
          newPassword: 'NewPass123!'
        });
        expect(mockOnSuccess).toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('handles API error for own password change', async () => {
      mockApi.post.mockRejectedValue({
        response: {
          data: {
            error: 'Current password is incorrect'
          }
        }
      });
      
      render(<ChangePasswordDialog {...defaultProps} />);
      
      fireEvent.change(screen.getByLabelText('Current Password *'), { target: { value: 'WrongPass123!' } });
      fireEvent.change(screen.getByLabelText('New Password *'), { target: { value: 'NewPass123!' } });
      fireEvent.change(screen.getByLabelText('Confirm New Password *'), { target: { value: 'NewPass123!' } });
      
      fireEvent.click(screen.getByText('Change Password'));
      
      await waitFor(() => {
        expect(screen.getByText('Current password is incorrect')).toBeInTheDocument();
      });
      
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });

    it('handles validation errors from API', async () => {
      mockApi.post.mockRejectedValue({
        response: {
          data: {
            errors: [
              { msg: 'Password must be at least 8 characters' },
              { msg: 'Password must contain uppercase letter' }
            ]
          }
        }
      });
      
      render(<ChangePasswordDialog {...defaultProps} />);
      
      fireEvent.change(screen.getByLabelText('Current Password *'), { target: { value: 'OldPass123!' } });
      fireEvent.change(screen.getByLabelText('New Password *'), { target: { value: 'weak' } });
      fireEvent.change(screen.getByLabelText('Confirm New Password *'), { target: { value: 'weak' } });
      
      fireEvent.click(screen.getByText('Change Password'));
      
      await waitFor(() => {
        expect(screen.getByText(/Password must be at least 8 characters/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission - Admin Reset', () => {
    it('successfully resets another users password', async () => {
      mockApi.put.mockResolvedValue({ data: { message: 'Password reset successfully' } });
      
      render(<ChangePasswordDialog {...defaultProps} isOwnPassword={false} userId={2} username="otheruser" />);
      
      fireEvent.change(screen.getByLabelText('New Password *'), { target: { value: 'NewPass123!' } });
      fireEvent.change(screen.getByLabelText('Confirm New Password *'), { target: { value: 'NewPass123!' } });
      
      fireEvent.click(screen.getByText('Change Password'));
      
      await waitFor(() => {
        expect(mockApi.put).toHaveBeenCalledWith('/users/2/password', {
          newPassword: 'NewPass123!'
        });
        expect(mockOnSuccess).toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('handles API error for admin reset', async () => {
      mockApi.put.mockRejectedValue({
        response: {
          data: {
            error: 'User not found'
          }
        }
      });
      
      render(<ChangePasswordDialog {...defaultProps} isOwnPassword={false} />);
      
      fireEvent.change(screen.getByLabelText('New Password *'), { target: { value: 'NewPass123!' } });
      fireEvent.change(screen.getByLabelText('Confirm New Password *'), { target: { value: 'NewPass123!' } });
      
      fireEvent.click(screen.getByText('Change Password'));
      
      await waitFor(() => {
        expect(screen.getByText('User not found')).toBeInTheDocument();
      });
    });
  });

  describe('Dialog Controls', () => {
    it('closes dialog when cancel button is clicked', () => {
      render(<ChangePasswordDialog {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Cancel'));
      
      expect(mockOnClose).toHaveBeenCalled();
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });

    it('closes dialog when X button is clicked', () => {
      render(<ChangePasswordDialog {...defaultProps} />);
      
      const closeButton = screen.getByLabelText('Close dialog');
      fireEvent.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('clears form when dialog is closed', async () => {
      const { rerender } = render(<ChangePasswordDialog {...defaultProps} />);
      
      fireEvent.change(screen.getByLabelText('Current Password *'), { target: { value: 'test' } });
      fireEvent.change(screen.getByLabelText('New Password *'), { target: { value: 'test' } });
      
      fireEvent.click(screen.getByText('Cancel'));
      
      rerender(<ChangePasswordDialog {...defaultProps} />);
      
      const currentPasswordInput = screen.getByLabelText('Current Password *') as HTMLInputElement;
      const newPasswordInput = screen.getByLabelText('New Password *') as HTMLInputElement;
      
      expect(currentPasswordInput.value).toBe('');
      expect(newPasswordInput.value).toBe('');
    });

    it('disables buttons while loading', async () => {
      mockApi.post.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      render(<ChangePasswordDialog {...defaultProps} />);
      
      fireEvent.change(screen.getByLabelText('Current Password *'), { target: { value: 'OldPass123!' } });
      fireEvent.change(screen.getByLabelText('New Password *'), { target: { value: 'NewPass123!' } });
      fireEvent.change(screen.getByLabelText('Confirm New Password *'), { target: { value: 'NewPass123!' } });
      
      fireEvent.click(screen.getByText('Change Password'));
      
      await waitFor(() => {
        expect(screen.getByText('Changing...')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeDisabled();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper form labels', () => {
      render(<ChangePasswordDialog {...defaultProps} />);
      
      expect(screen.getByLabelText('Current Password *')).toBeInTheDocument();
      expect(screen.getByLabelText('New Password *')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm New Password *')).toBeInTheDocument();
    });

    it('has password hint text', () => {
      render(<ChangePasswordDialog {...defaultProps} />);
      
      expect(screen.getByText(/Must be at least 8 characters/i)).toBeInTheDocument();
    });

    it('marks required fields', () => {
      render(<ChangePasswordDialog {...defaultProps} />);
      
      // Password inputs don't have textbox role, query by id instead
      expect(screen.getByLabelText('Current Password *')).toHaveAttribute('required');
      expect(screen.getByLabelText('New Password *')).toHaveAttribute('required');
      expect(screen.getByLabelText('Confirm New Password *')).toHaveAttribute('required');
    });
  });
});
