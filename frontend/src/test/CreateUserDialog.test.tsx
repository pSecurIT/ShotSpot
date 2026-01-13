import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import CreateUserDialog from '../components/CreateUserDialog';
import api from '../utils/api';

// Mock the api module
vi.mock('../utils/api');
const mockApi = api as jest.Mocked<typeof api>;

describe('CreateUserDialog Component', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Dialog Visibility', () => {
    it('renders when isOpen is true', () => {
      render(
        <CreateUserDialog
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText('Create New User')).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      render(
        <CreateUserDialog
          isOpen={false}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.queryByText('Create New User')).not.toBeInTheDocument();
    });
  });

  describe('Form Fields', () => {
    beforeEach(() => {
      render(
        <CreateUserDialog
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );
    });

    it('renders all required form fields', () => {
      expect(screen.getByLabelText('Username *')).toBeInTheDocument();
      expect(screen.getByLabelText('Email *')).toBeInTheDocument();
      expect(screen.getByLabelText('Password *')).toBeInTheDocument();
      expect(screen.getByLabelText('Role *')).toBeInTheDocument();
    });

    it('has correct input types', () => {
      const usernameInput = screen.getByLabelText('Username *') as HTMLInputElement;
      const emailInput = screen.getByLabelText('Email *') as HTMLInputElement;
      const passwordInput = screen.getByLabelText('Password *') as HTMLInputElement;
      const roleSelect = screen.getByLabelText('Role *') as HTMLSelectElement;

      expect(usernameInput.type).toBe('text');
      expect(emailInput.type).toBe('email');
      expect(passwordInput.type).toBe('password');
      expect(roleSelect.tagName).toBe('SELECT');
    });

    it('has all role options', () => {
      const roleSelect = screen.getByLabelText('Role *') as HTMLSelectElement;
      const options = Array.from(roleSelect.options).map(opt => opt.value);

      expect(options).toEqual(['user', 'coach', 'admin']);
    });

    it('defaults to user role', () => {
      const roleSelect = screen.getByLabelText('Role *') as HTMLSelectElement;
      expect(roleSelect.value).toBe('user');
    });

    it('shows helper text for each field', () => {
      expect(screen.getByText('3-50 characters, letters, numbers, _ and - only')).toBeInTheDocument();
      expect(screen.getByText('Min 8 chars with uppercase, lowercase, number, and special character')).toBeInTheDocument();
      expect(screen.getByText('User: View only • Coach: Manage teams/games • Admin: Full access')).toBeInTheDocument();
    });
  });

  describe('Password Generator', () => {
    beforeEach(() => {
      render(
        <CreateUserDialog
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );
    });

    it('has generate password button', () => {
      expect(screen.getByText('Generate Secure Password')).toBeInTheDocument();
    });

    it('generates password when button is clicked', () => {
      const passwordInput = screen.getByLabelText('Password *') as HTMLInputElement;
      const generateButton = screen.getByText('Generate Secure Password');

      expect(passwordInput.value).toBe('');

      fireEvent.click(generateButton);

      expect(passwordInput.value).not.toBe('');
      expect(passwordInput.value.length).toBe(16);
    });

    it('generates different passwords on multiple clicks', () => {
      const passwordInput = screen.getByLabelText('Password *') as HTMLInputElement;
      const generateButton = screen.getByText('Generate Secure Password');

      fireEvent.click(generateButton);
      const firstPassword = passwordInput.value;

      fireEvent.click(generateButton);
      const secondPassword = passwordInput.value;

      expect(firstPassword).not.toBe(secondPassword);
    });

    it('shows password as text after generation', () => {
      const passwordInput = screen.getByLabelText('Password *') as HTMLInputElement;
      const generateButton = screen.getByText('Generate Secure Password');

      expect(passwordInput.type).toBe('password');

      fireEvent.click(generateButton);

      expect(passwordInput.type).toBe('text');
    });

    it('generates password with required character types', () => {
      const generateButton = screen.getByText('Generate Secure Password');
      const passwordInput = screen.getByLabelText('Password *') as HTMLInputElement;

      // Test multiple generations to ensure consistency
      for (let i = 0; i < 10; i++) {
        fireEvent.click(generateButton);
        const password = passwordInput.value;

        expect(password).toMatch(/[a-z]/); // lowercase
        expect(password).toMatch(/[A-Z]/); // uppercase
        expect(password).toMatch(/[0-9]/); // number
        expect(password).toMatch(/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/); // special char
      }
    });
  });

  describe('Password Toggle', () => {
    beforeEach(() => {
      render(
        <CreateUserDialog
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );
    });

    it('has toggle password visibility button', () => {
      const toggleButtons = screen.getAllByRole('button');
      const toggleButton = toggleButtons.find(btn => btn.textContent?.includes('👁️'));
      expect(toggleButton).toBeInTheDocument();
    });

    it('toggles password visibility', () => {
      const passwordInput = screen.getByLabelText('Password *') as HTMLInputElement;
      const toggleButtons = screen.getAllByRole('button');
      const toggleButton = toggleButtons.find(btn => btn.textContent?.includes('👁️'))!;

      expect(passwordInput.type).toBe('password');

      fireEvent.click(toggleButton);
      expect(passwordInput.type).toBe('text');

      fireEvent.click(toggleButton);
      expect(passwordInput.type).toBe('password');
    });
  });

  describe('Form Submission', () => {
    beforeEach(() => {
      render(
        <CreateUserDialog
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );
    });

    it('submits form with valid data', async () => {
      const mockResponse = {
        data: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
          role: 'user'
        }
      };
      mockApi.post.mockResolvedValue(mockResponse);

      fireEvent.change(screen.getByLabelText('Username *'), { target: { value: 'testuser' } });
      fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'SecureP@ss123' } });
      fireEvent.change(screen.getByLabelText('Role *'), { target: { value: 'user' } });

      const submitButton = screen.getByText('Create User');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith('/users', {
          username: 'testuser',
          email: 'test@example.com',
          password: 'SecureP@ss123',
          role: 'user'
        });
      });
    });

    it('calls onSuccess callback after successful submission', async () => {
      const mockResponse = {
        data: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
          role: 'coach'
        }
      };
      mockApi.post.mockResolvedValue(mockResponse);

      fireEvent.change(screen.getByLabelText('Username *'), { target: { value: 'testuser' } });
      fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'SecureP@ss123' } });
      fireEvent.change(screen.getByLabelText('Role *'), { target: { value: 'coach' } });

      fireEvent.click(screen.getByText('Create User'));

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledWith(mockResponse.data);
      });
    });

    it('closes dialog after successful submission', async () => {
      const mockResponse = {
        data: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
          role: 'user'
        }
      };
      mockApi.post.mockResolvedValue(mockResponse);

      fireEvent.change(screen.getByLabelText('Username *'), { target: { value: 'testuser' } });
      fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'SecureP@ss123' } });

      fireEvent.click(screen.getByText('Create User'));

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('resets form after successful submission', async () => {
      const mockResponse = {
        data: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
          role: 'user'
        }
      };
      mockApi.post.mockResolvedValue(mockResponse);

      const usernameInput = screen.getByLabelText('Username *') as HTMLInputElement;
      const emailInput = screen.getByLabelText('Email *') as HTMLInputElement;
      const passwordInput = screen.getByLabelText('Password *') as HTMLInputElement;
      const roleSelect = screen.getByLabelText('Role *') as HTMLSelectElement;

      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'SecureP@ss123' } });
      fireEvent.change(roleSelect, { target: { value: 'admin' } });

      fireEvent.click(screen.getByText('Create User'));

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });

      // Reopen dialog to check if form was reset
      render(
        <CreateUserDialog
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const newUsernameInput = screen.getByLabelText('Username *') as HTMLInputElement;
      const newEmailInput = screen.getByLabelText('Email *') as HTMLInputElement;
      const newPasswordInput = screen.getByLabelText('Password *') as HTMLInputElement;
      const newRoleSelect = screen.getByLabelText('Role *') as HTMLSelectElement;

      expect(newUsernameInput.value).toBe('');
      expect(newEmailInput.value).toBe('');
      expect(newPasswordInput.value).toBe('');
      expect(newRoleSelect.value).toBe('user');
    });

    it('shows loading state during submission', async () => {
      mockApi.post.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      fireEvent.change(screen.getByLabelText('Username *'), { target: { value: 'testuser' } });
      fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'SecureP@ss123' } });

      fireEvent.click(screen.getByText('Create User'));

      expect(screen.getByText('Creating...')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText('Creating...')).not.toBeInTheDocument();
      });
    });

    it('disables form during submission', async () => {
      mockApi.post.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      const usernameInput = screen.getByLabelText('Username *') as HTMLInputElement;
      const emailInput = screen.getByLabelText('Email *') as HTMLInputElement;
      const passwordInput = screen.getByLabelText('Password *') as HTMLInputElement;
      const roleSelect = screen.getByLabelText('Role *') as HTMLSelectElement;

      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'SecureP@ss123' } });

      fireEvent.click(screen.getByText('Create User'));

      expect(usernameInput).toBeDisabled();
      expect(emailInput).toBeDisabled();
      expect(passwordInput).toBeDisabled();
      expect(roleSelect).toBeDisabled();

      await waitFor(() => {
        expect(usernameInput).not.toBeDisabled();
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      render(
        <CreateUserDialog
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );
    });

    it('displays API error messages', async () => {
      mockApi.post.mockRejectedValue({
        response: {
          data: {
            error: 'Username already exists'
          }
        }
      });

      fireEvent.change(screen.getByLabelText('Username *'), { target: { value: 'existing' } });
      fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'SecureP@ss123' } });

      fireEvent.click(screen.getByText('Create User'));

      await waitFor(() => {
        expect(screen.getByText('Username already exists')).toBeInTheDocument();
      });
    });

    it('displays validation error messages', async () => {
      mockApi.post.mockRejectedValue({
        response: {
          data: {
            errors: [
              { msg: 'Username contains invalid characters' },
              { msg: 'Password is too weak' }
            ]
          }
        }
      });

      // Use valid HTML5 inputs that will pass client-side validation but fail server-side
      fireEvent.change(screen.getByLabelText('Username *'), { target: { value: 'test@user' } });
      fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'weakpass' } });

      fireEvent.click(screen.getByText('Create User'));

      await waitFor(() => {
        expect(screen.getByText(/Username contains invalid characters.*Password is too weak/)).toBeInTheDocument();
      });
    });

    it('displays fallback error message', async () => {
      mockApi.post.mockRejectedValue(new Error('Network error'));

      fireEvent.change(screen.getByLabelText('Username *'), { target: { value: 'testuser' } });
      fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'SecureP@ss123' } });

      fireEvent.click(screen.getByText('Create User'));

      await waitFor(() => {
        expect(screen.getByText('Failed to create user')).toBeInTheDocument();
      });
    });

    it('clears error message when form is resubmitted', async () => {
      mockApi.post.mockRejectedValueOnce({
        response: { data: { error: 'Username already exists' } }
      }).mockResolvedValueOnce({
        data: { id: 1, username: 'testuser', email: 'test@example.com', role: 'user' }
      });

      fireEvent.change(screen.getByLabelText('Username *'), { target: { value: 'existing' } });
      fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'SecureP@ss123' } });

      fireEvent.click(screen.getByText('Create User'));

      await waitFor(() => {
        expect(screen.getByText('Username already exists')).toBeInTheDocument();
      });

      // Change username and retry
      fireEvent.change(screen.getByLabelText('Username *'), { target: { value: 'newuser' } });
      fireEvent.click(screen.getByText('Create User'));

      await waitFor(() => {
        expect(screen.queryByText('Username already exists')).not.toBeInTheDocument();
      });
    });

    it('does not close dialog on error', async () => {
      mockApi.post.mockRejectedValue({
        response: { data: { error: 'Username already exists' } }
      });

      fireEvent.change(screen.getByLabelText('Username *'), { target: { value: 'existing' } });
      fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'SecureP@ss123' } });

      fireEvent.click(screen.getByText('Create User'));

      await waitFor(() => {
        expect(screen.getByText('Username already exists')).toBeInTheDocument();
      });

      expect(mockOnClose).not.toHaveBeenCalled();
      expect(screen.getByText('Create New User')).toBeInTheDocument();
    });
  });

  describe('Dialog Actions', () => {
    beforeEach(() => {
      render(
        <CreateUserDialog
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );
    });

    it('has cancel and submit buttons', () => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Create User')).toBeInTheDocument();
    });

    it('closes dialog when cancel is clicked', () => {
      fireEvent.click(screen.getByText('Cancel'));
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('closes dialog when close button (×) is clicked', () => {
      const closeButton = screen.getByLabelText('Close');
      fireEvent.click(closeButton);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('does not submit when cancel is clicked', () => {
      fireEvent.change(screen.getByLabelText('Username *'), { target: { value: 'testuser' } });
      fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'SecureP@ss123' } });

      fireEvent.click(screen.getByText('Cancel'));

      expect(mockApi.post).not.toHaveBeenCalled();
    });
  });

  describe('Form Validation', () => {
    beforeEach(() => {
      render(
        <CreateUserDialog
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );
    });

    it('requires username field', () => {
      const usernameInput = screen.getByLabelText('Username *') as HTMLInputElement;
      expect(usernameInput.required).toBe(true);
    });

    it('requires email field', () => {
      const emailInput = screen.getByLabelText('Email *') as HTMLInputElement;
      expect(emailInput.required).toBe(true);
    });

    it('requires password field', () => {
      const passwordInput = screen.getByLabelText('Password *') as HTMLInputElement;
      expect(passwordInput.required).toBe(true);
    });

    it('has minimum length validation for username', () => {
      const usernameInput = screen.getByLabelText('Username *') as HTMLInputElement;
      expect(usernameInput.minLength).toBe(3);
      expect(usernameInput.maxLength).toBe(50);
    });

    it('has minimum length validation for password', () => {
      const passwordInput = screen.getByLabelText('Password *') as HTMLInputElement;
      expect(passwordInput.minLength).toBe(8);
    });

    it('has pattern validation for username', () => {
      const usernameInput = screen.getByLabelText('Username *') as HTMLInputElement;
      expect(usernameInput.pattern).toBe('[a-zA-Z0-9_-]+');
    });
  });

  describe('Role Selection', () => {
    beforeEach(() => {
      render(
        <CreateUserDialog
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );
    });

    it('allows selecting coach role', async () => {
      const mockResponse = {
        data: { id: 1, username: 'coach', email: 'coach@example.com', role: 'coach' }
      };
      mockApi.post.mockResolvedValue(mockResponse);

      fireEvent.change(screen.getByLabelText('Username *'), { target: { value: 'coach' } });
      fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'coach@example.com' } });
      fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'SecureP@ss123' } });
      fireEvent.change(screen.getByLabelText('Role *'), { target: { value: 'coach' } });

      fireEvent.click(screen.getByText('Create User'));

      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith('/users', expect.objectContaining({
          role: 'coach'
        }));
      });
    });

    it('allows selecting admin role', async () => {
      const mockResponse = {
        data: { id: 1, username: 'admin2', email: 'admin2@example.com', role: 'admin' }
      };
      mockApi.post.mockResolvedValue(mockResponse);

      fireEvent.change(screen.getByLabelText('Username *'), { target: { value: 'admin2' } });
      fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'admin2@example.com' } });
      fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'SecureP@ss123' } });
      fireEvent.change(screen.getByLabelText('Role *'), { target: { value: 'admin' } });

      fireEvent.click(screen.getByText('Create User'));

      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith('/users', expect.objectContaining({
          role: 'admin'
        }));
      });
    });
  });
});
