import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Login from '../components/Login';
import type { AuthContextType } from '../types/auth';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Create mock functions that can be updated per test
const mockLogin = vi.fn();
const mockLogout = vi.fn();
const mockRegister = vi.fn();
const mockUpdateUser = vi.fn();

// Mock the useAuth hook
vi.mock('../contexts/AuthContext', async () => {
  const actual = await vi.importActual('../contexts/AuthContext');
  return {
    ...actual,
    useAuth: (): AuthContextType => ({
      user: null,
      login: mockLogin,
      logout: mockLogout,
      register: mockRegister,
      updateUser: mockUpdateUser,
    }),
  };
});

describe('Login Component', () => {
  const renderLogin = () => {
    return render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Form Rendering', () => {
    it('renders login form with all required fields', () => {
      renderLogin();

      expect(screen.getByRole('heading', { name: 'Login to ShotSpot' })).toBeInTheDocument();
      expect(screen.getByLabelText('Username or Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
    });

    it('renders form inputs with correct attributes', () => {
      renderLogin();

      const usernameInput = screen.getByLabelText('Username or Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Login' });

      expect(usernameInput).toHaveAttribute('type', 'text');
      expect(usernameInput).toHaveAttribute('placeholder', 'Enter your username or email');
      expect(usernameInput).toBeRequired();

      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(passwordInput).toBeRequired();

      expect(submitButton).toHaveAttribute('type', 'submit');
    });

    it('does not display error message initially', () => {
      renderLogin();

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
    });
  });

  describe('Form Input Handling', () => {
    it('updates username field when user types', () => {
      renderLogin();

      const usernameInput = screen.getByLabelText('Username or Email') as HTMLInputElement;
      
      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      
      expect(usernameInput.value).toBe('testuser');
    });

    it('updates password field when user types', () => {
      renderLogin();

      const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;
      
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      
      expect(passwordInput.value).toBe('password123');
    });

    it('handles multiple field updates correctly', () => {
      renderLogin();

      const usernameInput = screen.getByLabelText('Username or Email') as HTMLInputElement;
      const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;
      
      fireEvent.change(usernameInput, { target: { value: 'user@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'mypassword' } });
      
      expect(usernameInput.value).toBe('user@example.com');
      expect(passwordInput.value).toBe('mypassword');
    });
  });

  describe('Form Submission', () => {
    it('calls login function with correct credentials on form submit', () => {
      mockLogin.mockResolvedValue({ success: true });
      renderLogin();

      const usernameInput = screen.getByLabelText('Username or Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Login' });

      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      fireEvent.change(passwordInput, { target: { value: 'testpass' } });
      fireEvent.click(submitButton);

      expect(mockLogin).toHaveBeenCalledWith('testuser', 'testpass');
    });

    it('navigates to dashboard after successful login', async () => {
      mockLogin.mockResolvedValue({ success: true });
      renderLogin();

      const usernameInput = screen.getByLabelText('Username or Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Login' });

      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      fireEvent.change(passwordInput, { target: { value: 'testpass' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('clears error message on new submission attempt', async () => {
      mockLogin
        .mockResolvedValueOnce({ success: false, error: 'Invalid credentials' })
        .mockResolvedValueOnce({ success: true });
      
      renderLogin();

      const usernameInput = screen.getByLabelText('Username or Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Login' });

      // First submission with error
      fireEvent.change(usernameInput, { target: { value: 'wronguser' } });
      fireEvent.change(passwordInput, { target: { value: 'wrongpass' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
      });

      // Second submission should clear error
      fireEvent.change(usernameInput, { target: { value: 'correctuser' } });
      fireEvent.change(passwordInput, { target: { value: 'correctpass' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByText('Invalid credentials')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message when login fails with server error', async () => {
      mockLogin.mockResolvedValue({ 
        success: false, 
        error: 'Invalid username or password' 
      });
      
      renderLogin();

      const usernameInput = screen.getByLabelText('Username or Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Login' });

      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      fireEvent.change(passwordInput, { target: { value: 'wrongpass' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid username or password')).toBeInTheDocument();
      });
    });

    it('displays generic error message when login fails without specific error', async () => {
      mockLogin.mockResolvedValue({ success: false });
      
      renderLogin();

      const usernameInput = screen.getByLabelText('Username or Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Login' });

      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      fireEvent.change(passwordInput, { target: { value: 'testpass' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('An error occurred during login')).toBeInTheDocument();
      });
    });

    it('handles unexpected exceptions during login', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockLogin.mockRejectedValue(new Error('Network error'));
      
      renderLogin();

      const usernameInput = screen.getByLabelText('Username or Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Login' });

      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      fireEvent.change(passwordInput, { target: { value: 'testpass' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('An unexpected error occurred during login')).toBeInTheDocument();
      });

      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls[0];
      expect(call[0]).toContain('Login');
      expect(call[1]).toBeInstanceOf(Error);
      consoleSpy.mockRestore();
    });

    it('displays error with correct CSS classes', async () => {
      mockLogin.mockResolvedValue({ 
        success: false, 
        error: 'Test error message' 
      });
      
      renderLogin();

      const usernameInput = screen.getByLabelText('Username or Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Login' });

      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      fireEvent.change(passwordInput, { target: { value: 'testpass' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const errorDiv = screen.getByText('Test error message');
        expect(errorDiv).toHaveClass('alert', 'alert-error');
      });
    });
  });

  describe('Form Validation', () => {
    it('requires username field to be filled', () => {
      renderLogin();

      const usernameInput = screen.getByLabelText('Username or Email');
      expect(usernameInput).toBeRequired();
    });

    it('requires password field to be filled', () => {
      renderLogin();

      const passwordInput = screen.getByLabelText('Password');
      expect(passwordInput).toBeRequired();
    });

    it('submits form with minimal valid input', () => {
      mockLogin.mockResolvedValue({ success: true });
      renderLogin();

      const usernameInput = screen.getByLabelText('Username or Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Login' });

      fireEvent.change(usernameInput, { target: { value: 'a' } });
      fireEvent.change(passwordInput, { target: { value: 'b' } });
      fireEvent.click(submitButton);

      expect(mockLogin).toHaveBeenCalledWith('a', 'b');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty form submission', () => {
      mockLogin.mockResolvedValue({ success: false, error: 'Fields required' });
      renderLogin();

      // HTML5 validation prevents empty form submission, so let's test with form submit event
      const form = document.querySelector('form');
      if (form) {
        fireEvent.submit(form);
      }

      expect(mockLogin).toHaveBeenCalledWith('', '');
    });

    it('handles whitespace-only input', () => {
      mockLogin.mockResolvedValue({ success: true });
      renderLogin();

      const usernameInput = screen.getByLabelText('Username or Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Login' });

      fireEvent.change(usernameInput, { target: { value: '   ' } });
      fireEvent.change(passwordInput, { target: { value: '  \t  ' } });
      fireEvent.click(submitButton);

      expect(mockLogin).toHaveBeenCalledWith('   ', '  \t  ');
    });

    it('handles very long input values', () => {
      mockLogin.mockResolvedValue({ success: true });
      renderLogin();

      const longUsername = 'a'.repeat(1000);
      const longPassword = 'b'.repeat(1000);

      const usernameInput = screen.getByLabelText('Username or Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Login' });

      fireEvent.change(usernameInput, { target: { value: longUsername } });
      fireEvent.change(passwordInput, { target: { value: longPassword } });
      fireEvent.click(submitButton);

      expect(mockLogin).toHaveBeenCalledWith(longUsername, longPassword);
    });
  });
});