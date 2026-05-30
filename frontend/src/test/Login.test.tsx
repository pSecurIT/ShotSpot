import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Login from '../components/Login';
import type { AuthContextType } from '../types/auth';

// Mock useNavigate
const mocks = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockLogin: vi.fn(),
  mockLogout: vi.fn(),
  mockRegister: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockCanUseBiometric: vi.fn(),
  mockEnrollBiometricAfterLogin: vi.fn(),
  mockBiometricLogin: vi.fn(),
  mockDisableBiometric: vi.fn(),
  mockHasAppBiometricEnrollment: vi.fn().mockResolvedValue(false),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.mockNavigate,
  };
});

vi.mock('../utils/biometricService', () => ({
  hasAppBiometricEnrollment: mocks.mockHasAppBiometricEnrollment,
}));

// Mock the useAuth hook
vi.mock('../contexts/AuthContext', async () => {
  const actual = await vi.importActual('../contexts/AuthContext');
  return {
    ...actual,
    useAuth: (): AuthContextType => ({
      user: null,
      login: mocks.mockLogin,
      logout: mocks.mockLogout,
      register: mocks.mockRegister,
      updateUser: mocks.mockUpdateUser,
      biometricEnrolled: false,
      canUseBiometric: mocks.mockCanUseBiometric,
      enrollBiometricAfterLogin: mocks.mockEnrollBiometricAfterLogin,
      biometricLogin: mocks.mockBiometricLogin,
      disableBiometric: mocks.mockDisableBiometric,
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
    mocks.mockHasAppBiometricEnrollment.mockResolvedValue(false);
    mocks.mockCanUseBiometric.mockResolvedValue({ available: false });
    mocks.mockEnrollBiometricAfterLogin.mockResolvedValue({ success: true });
    mocks.mockBiometricLogin.mockResolvedValue({ success: false });
    mocks.mockDisableBiometric.mockResolvedValue(undefined);
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

    it('shows quick biometric login when enrollment exists', async () => {
      mocks.mockHasAppBiometricEnrollment.mockResolvedValue(true);

      renderLogin();

      await waitFor(() => {
        expect(screen.getByLabelText('Sign in with biometrics')).toBeInTheDocument();
      });
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
      mocks.mockLogin.mockResolvedValue({ success: true });
      renderLogin();

      const usernameInput = screen.getByLabelText('Username or Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Login' });

      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      fireEvent.change(passwordInput, { target: { value: 'testpass' } });
      fireEvent.click(submitButton);

      expect(mocks.mockLogin).toHaveBeenCalledWith('testuser', 'testpass');
    });

    it('navigates to dashboard after successful login', async () => {
      mocks.mockLogin.mockResolvedValue({ success: true });
      renderLogin();

      const usernameInput = screen.getByLabelText('Username or Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Login' });

      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      fireEvent.change(passwordInput, { target: { value: 'testpass' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mocks.mockNavigate).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('clears error message on new submission attempt', async () => {
      mocks.mockLogin
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

    it('shows biometric enrollment prompt after successful password login when not enrolled', async () => {
      mocks.mockLogin.mockResolvedValueOnce({ success: true });
      mocks.mockHasAppBiometricEnrollment.mockResolvedValue(false);
      mocks.mockCanUseBiometric.mockResolvedValue({ available: true });

      renderLogin();

      fireEvent.change(screen.getByLabelText('Username or Email'), { target: { value: 'coach' } });
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
      fireEvent.click(screen.getByRole('button', { name: 'Login' }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /enable biometric login\?/i })).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message when login fails with server error', async () => {
      mocks.mockLogin.mockResolvedValue({
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
        expect(screen.getByRole('alert')).toHaveTextContent('Invalid username or password');
      });
    });

    it('displays generic error message when login fails without specific error', async () => {
      mocks.mockLogin.mockResolvedValue({ success: false });
      
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
      mocks.mockLogin.mockRejectedValue(new Error('Network error'));
      
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
      expect(call[0]).toContain('Login exception');
      expect(call[1]).toBeInstanceOf(Error);
      consoleSpy.mockRestore();
    });

    it('displays error with correct CSS classes', async () => {
      mocks.mockLogin.mockResolvedValue({
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
      mocks.mockLogin.mockResolvedValue({ success: true });
      renderLogin();

      const usernameInput = screen.getByLabelText('Username or Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Login' });

      fireEvent.change(usernameInput, { target: { value: 'a' } });
      fireEvent.change(passwordInput, { target: { value: 'b' } });
      fireEvent.click(submitButton);

      expect(mocks.mockLogin).toHaveBeenCalledWith('a', 'b');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty form submission', async () => {
      mocks.mockLogin.mockResolvedValue({ success: false, error: 'Fields required' });
      renderLogin();

      // HTML5 validation prevents empty form submission, so let's test with form submit event
      const form = document.querySelector('form');
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        expect(mocks.mockLogin).toHaveBeenCalledWith('', '');
      });
    });

    it('handles whitespace-only input', () => {
      mocks.mockLogin.mockResolvedValue({ success: true });
      renderLogin();

      const usernameInput = screen.getByLabelText('Username or Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Login' });

      fireEvent.change(usernameInput, { target: { value: '   ' } });
      fireEvent.change(passwordInput, { target: { value: '  \t  ' } });
      fireEvent.click(submitButton);

      expect(mocks.mockLogin).toHaveBeenCalledWith('   ', '  \t  ');
    });

    it('handles very long input values', () => {
      mocks.mockLogin.mockResolvedValue({ success: true });
      renderLogin();

      const longUsername = 'a'.repeat(1000);
      const longPassword = 'b'.repeat(1000);

      const usernameInput = screen.getByLabelText('Username or Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Login' });

      fireEvent.change(usernameInput, { target: { value: longUsername } });
      fireEvent.change(passwordInput, { target: { value: longPassword } });
      fireEvent.click(submitButton);

      expect(mocks.mockLogin).toHaveBeenCalledWith(longUsername, longPassword);
    });
  });
});