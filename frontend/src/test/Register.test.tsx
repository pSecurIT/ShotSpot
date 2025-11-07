import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Register from '../components/Register';
import api from '../utils/api';

// Mock the api module
vi.mock('../utils/api');
const mockApi = api as jest.Mocked<typeof api>;

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const renderRegister = () => {
  return render(
    <BrowserRouter>
      <Register />
    </BrowserRouter>
  );
};

describe('Register Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Form Rendering', () => {
    it('renders all form fields correctly', () => {
      renderRegister();
      
      expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    });

    it('displays password requirements help text', () => {
      renderRegister();
      
      expect(screen.getByText(/password must contain at least 8 characters/i)).toBeInTheDocument();
    });

    it('has correct input types for form fields', () => {
      renderRegister();
      
      expect(screen.getByLabelText(/username/i)).toHaveAttribute('type', 'text');
      expect(screen.getByLabelText(/^email/i)).toHaveAttribute('type', 'email');
      expect(screen.getByLabelText(/^password/i)).toHaveAttribute('type', 'password');
      expect(screen.getByLabelText(/confirm password/i)).toHaveAttribute('type', 'password');
    });

    it('has required attributes on all form fields', () => {
      renderRegister();
      
      expect(screen.getByLabelText(/username/i)).toHaveAttribute('required');
      expect(screen.getByLabelText(/^email/i)).toHaveAttribute('required');
      expect(screen.getByLabelText(/^password/i)).toHaveAttribute('required');
      expect(screen.getByLabelText(/confirm password/i)).toHaveAttribute('required');
    });
  });

  describe('Form Input Handling', () => {
    it('updates username field when typed', () => {
      renderRegister();
      
      const usernameInput = screen.getByLabelText(/username/i);
      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      
      expect(usernameInput).toHaveValue('testuser');
    });

    it('updates email field when typed', () => {
      renderRegister();
      
      const emailInput = screen.getByLabelText(/^email/i);
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      
      expect(emailInput).toHaveValue('test@example.com');
    });

    it('updates password field when typed', () => {
      renderRegister();
      
      const passwordInput = screen.getByLabelText(/^password/i);
      fireEvent.change(passwordInput, { target: { value: 'Password123!' } });
      
      expect(passwordInput).toHaveValue('Password123!');
    });

    it('updates confirm password field when typed', () => {
      renderRegister();
      
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      fireEvent.change(confirmPasswordInput, { target: { value: 'Password123!' } });
      
      expect(confirmPasswordInput).toHaveValue('Password123!');
    });

    it('handles multiple field updates correctly', () => {
      renderRegister();
      
      fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'testuser' } });
      fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'Password123!' } });
      fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'Password123!' } });
      
      expect(screen.getByLabelText(/username/i)).toHaveValue('testuser');
      expect(screen.getByLabelText(/^email/i)).toHaveValue('test@example.com');
      expect(screen.getByLabelText(/^password/i)).toHaveValue('Password123!');
      expect(screen.getByLabelText(/confirm password/i)).toHaveValue('Password123!');
    });
  });

  describe('Password Validation', () => {
    it('shows error when password is less than 8 characters', async () => {
      renderRegister();
      
      fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'testuser' } });
      fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'Pass1!' } });
      fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'Pass1!' } });
      
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/password must be at least 8 characters long/i)).toBeInTheDocument();
      });
    });

    it('shows error when password lacks lowercase letter', async () => {
      renderRegister();
      
      fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'testuser' } });
      fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'PASSWORD123!' } });
      fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'PASSWORD123!' } });
      
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/password must include at least one lowercase letter/i)).toBeInTheDocument();
      });
    });

    it('shows error when password lacks uppercase letter', async () => {
      renderRegister();
      
      fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'testuser' } });
      fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'password123!' } });
      fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123!' } });
      
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/password must include at least one uppercase letter/i)).toBeInTheDocument();
      });
    });

    it('shows error when password lacks number', async () => {
      renderRegister();
      
      fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'testuser' } });
      fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'Password!' } });
      fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'Password!' } });
      
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/password must include at least one number/i)).toBeInTheDocument();
      });
    });

    it('shows error when password lacks special character', async () => {
      renderRegister();
      
      fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'testuser' } });
      fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'Password123' } });
      fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'Password123' } });
      
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/password must include at least one special character/i)).toBeInTheDocument();
      });
    });

    it('shows error when passwords do not match', async () => {
      renderRegister();
      
      fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'testuser' } });
      fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'Password123!' } });
      fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'DifferentPassword!' } });
      
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
      });
    });

    it('accepts valid password with all requirements', async () => {
      renderRegister();
      mockApi.post.mockResolvedValue({ data: { message: 'User created successfully' } });
      
      fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'testuser' } });
      fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'Password123!' } });
      fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'Password123!' } });
      
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));
      
      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith('/auth/register', {
          username: 'testuser',
          email: 'test@example.com',
          password: 'Password123!'
        });
        expect(mockNavigate).toHaveBeenCalledWith('/login');
      });
    });
  });

  describe('API Integration', () => {
    it('submits registration data successfully', async () => {
      renderRegister();
      mockApi.post.mockResolvedValue({ data: { message: 'User created successfully' } });
      
      fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'newuser' } });
      fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'newuser@example.com' } });
      fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'StrongPass123!' } });
      fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'StrongPass123!' } });
      
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));
      
      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith('/auth/register', {
          username: 'newuser',
          email: 'newuser@example.com',
          password: 'StrongPass123!'
        });
      });
    });

    it('navigates to login page after successful registration', async () => {
      renderRegister();
      mockApi.post.mockResolvedValue({ data: { message: 'User created successfully' } });
      
      fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'testuser' } });
      fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'Password123!' } });
      fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'Password123!' } });
      
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login');
      });
    });

    it('handles API error with error message', async () => {
      renderRegister();
      mockApi.post.mockRejectedValue({
        response: {
          data: {
            error: 'Username already exists'
          }
        }
      });
      
      fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'existinguser' } });
      fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'Password123!' } });
      fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'Password123!' } });
      
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/username already exists/i)).toBeInTheDocument();
      });
    });

    it('handles API error with validation errors array', async () => {
      renderRegister();
      mockApi.post.mockRejectedValue({
        response: {
          data: {
            errors: [
              { msg: 'Email format is invalid' }
            ]
          }
        }
      });
      
      fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'testuser' } });
      fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'Password123!' } });
      fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'Password123!' } });
      
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/email format is invalid/i)).toBeInTheDocument();
      });
    });

    it('handles network error with fallback message', async () => {
      renderRegister();
      mockApi.post.mockRejectedValue(new Error('Network Error'));
      
      fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'testuser' } });
      fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'Password123!' } });
      fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'Password123!' } });
      
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/registration failed/i)).toBeInTheDocument();
      });
    });

    it('clears error message when form is resubmitted', async () => {
      renderRegister();
      
      // First submission with error
      mockApi.post.mockRejectedValue({
        response: {
          data: {
            error: 'Username already exists'
          }
        }
      });
      
      fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'existinguser' } });
      fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'Password123!' } });
      fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'Password123!' } });
      
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/username already exists/i)).toBeInTheDocument();
      });

      // Second submission should clear error
      mockApi.post.mockResolvedValue({ data: { message: 'User created successfully' } });
      
      fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'newuser' } });
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));
      
      await waitFor(() => {
        expect(screen.queryByText(/username already exists/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('prevents form submission when required fields are empty', () => {
      renderRegister();
      
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));
      
      // Browser validation should prevent submission, so API should not be called
      expect(mockApi.post).not.toHaveBeenCalled();
    });

    it('handles form submission when API returns no response data', async () => {
      renderRegister();
      mockApi.post.mockRejectedValue({});
      
      fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'testuser' } });
      fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'Password123!' } });
      fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'Password123!' } });
      
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/registration failed/i)).toBeInTheDocument();
      });
    });

    it('handles special characters in username and email', async () => {
      renderRegister();
      mockApi.post.mockResolvedValue({ data: { message: 'User created successfully' } });
      
      fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'user_test-123' } });
      fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'user.test+123@example-domain.com' } });
      fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'Password123!' } });
      fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'Password123!' } });
      
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));
      
      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith('/auth/register', {
          username: 'user_test-123',
          email: 'user.test+123@example-domain.com',
          password: 'Password123!'
        });
      });
    });

    it('handles complex password with multiple special characters', async () => {
      renderRegister();
      mockApi.post.mockResolvedValue({ data: { message: 'User created successfully' } });
      
      const complexPassword = 'C0mpl3x!@#$%^&*()Pass';
      
      fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'testuser' } });
      fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'test@example.com' } });
      fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: complexPassword } });
      fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: complexPassword } });
      
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));
      
      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith('/auth/register', {
          username: 'testuser',
          email: 'test@example.com',
          password: complexPassword
        });
      });
    });
  });
});