import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); // Only clear on new submit

    try {
      console.log('[Login] Attempting login...');
      const result = await login(username, password);
      console.log('[Login] Login result:', result);
      
      if (result.success) {
        console.log('[Login] Success, navigating to /dashboard');
        navigate('/dashboard');
      } else {
        console.log('[Login] Failed, setting error:', result.error);
        setError(result.error || 'An error occurred during login');
        console.log('[Login] Error state set, waiting for render...');
      }
    } catch (err) {
      console.error('[Login] Exception during login:', err);
      setError('An unexpected error occurred during login');
    }
  };

  const handleInputChange = (setter: (value: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    // Don't clear error on input change - let user see the error while correcting
    setter(e.target.value);
  };

  return (
    <div className="form-container">
      <h2>Login to ShotSpot</h2>
      {error && <div className="alert alert-error">{error}</div>}
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