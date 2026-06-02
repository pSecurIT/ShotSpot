import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { cancelFlowTiming, startFlowTiming } from '../utils/uxObservability';
import { hasAppBiometricEnrollment } from '../utils/biometricService';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Biometric quick-login state
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [showEnrollPrompt, setShowEnrollPrompt] = useState(false);
  const [enrollLoading, setEnrollLoading] = useState(false);

  const { login, canUseBiometric, enrollBiometricAfterLogin, biometricLogin } = useAuth();
  const navigate = useNavigate();

  // Check on mount whether biometric quick-login is available
  useEffect(() => {
    hasAppBiometricEnrollment().then(enrolled => setBiometricAvailable(enrolled));
  }, []);

  const handleBiometricLogin = async () => {
    setBiometricLoading(true);
    setError('');
    const result = await biometricLogin();
    setBiometricLoading(false);
    if (result.success) {
      navigate('/dashboard');
    } else {
      // Surface the error; the password form stays visible as fallback
      setError(result.error ?? 'Biometric login failed. Please use your password.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    startFlowTiming('login_to_dashboard', '/dashboard');

    try {
      const result = await login(username, password);

      if (result.success) {
        // Check if we should offer biometric enrolment before navigating
        const avail = await canUseBiometric();
        if (avail.available && !biometricAvailable) {
          cancelFlowTiming('login_to_dashboard', '/dashboard');
          setShowEnrollPrompt(true);
        } else {
          navigate('/dashboard');
        }
      } else {
        cancelFlowTiming('login_to_dashboard', '/dashboard');
        setError(result.error || 'An error occurred during login');
      }
    } catch (err) {
      cancelFlowTiming('login_to_dashboard', '/dashboard');
      console.error('Login exception:', err);
      setError('An unexpected error occurred during login');
    }
  };

  const handleEnrollYes = async () => {
    setEnrollLoading(true);
    const result = await enrollBiometricAfterLogin();
    setEnrollLoading(false);
    if (!result.success) {
      // Non-fatal – inform the user and continue to dashboard
      setError(result.error ?? 'Could not enable biometric login. You can enable it later in Settings → Security.');
    }
    navigate('/dashboard');
  };

  const handleEnrollNo = () => {
    navigate('/dashboard');
  };

  const handleInputChange = (setter: (value: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
  };

  // ── Enrollment prompt (shown after successful password login) ──────────────
  if (showEnrollPrompt) {
    return (
      <div className="form-container">
        <h2>Enable biometric login?</h2>
        <p>
          Use Face ID or Touch ID to sign in quickly on your next visit.
          You can change this at any time in <strong>Settings → Security</strong>.
        </p>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <div className="button-group">
          <button
            className="primary-button"
            onClick={handleEnrollYes}
            disabled={enrollLoading}
          >
            {enrollLoading ? 'Enabling…' : 'Enable biometric login'}
          </button>
          <button
            className="secondary-button"
            onClick={handleEnrollNo}
            disabled={enrollLoading}
          >
            Not now
          </button>
        </div>
      </div>
    );
  }

  // ── Main login form ────────────────────────────────────────────────────────
  return (
    <div className="form-container">
      <h2>Login to ShotSpot</h2>
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      {/* Quick biometric login – only shown when the user has previously enrolled */}
      {biometricAvailable && (
        <div className="biometric-quick-login">
          <button
            type="button"
            className="primary-button biometric-button"
            onClick={handleBiometricLogin}
            disabled={biometricLoading}
            aria-label="Sign in with biometrics"
          >
            {biometricLoading ? 'Authenticating…' : '🔒 Sign in with Face ID / Touch ID'}
          </button>
          <p className="biometric-divider">— or sign in with your password —</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="username">Username or Email</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={handleInputChange(setUsername)}
            required
            placeholder="Enter your username or email"
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={handleInputChange(setPassword)}
            required
          />
        </div>
        <button type="submit" className="primary-button">Login</button>
      </form>
    </div>
  );
};

export default Login;