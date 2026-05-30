import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ExportSettings from './ExportSettings';
import UserPreferences from './UserPreferences';
import NotificationPreferences from './NotificationPreferences';
import PageLayout from './ui/PageLayout';
import useBreadcrumbs from '../hooks/useBreadcrumbs';
import type { SettingsTab } from '../types/settings';
import { isBiometricAvailable } from '../utils/biometricService';
import '../styles/Settings.css';

interface Tab {
  id: SettingsTab;
  label: string;
  minRole?: string;
}

const ALL_TABS: Tab[] = [
  { id: 'export', label: 'Export Settings', minRole: 'coach' },
  { id: 'preferences', label: 'User Preferences' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'account', label: 'Account Settings' },
  { id: 'security', label: 'Security' },
  { id: 'system', label: 'System Configuration', minRole: 'admin' },
];

const ROLE_ORDER = ['user', 'viewer', 'coach', 'admin'] as const;

function roleAtLeast(userRole: string, minRole: string): boolean {
  return ROLE_ORDER.indexOf(userRole as never) >= ROLE_ORDER.indexOf(minRole as never);
}

const SettingsPage: React.FC = () => {
  const breadcrumbs = useBreadcrumbs();
  const { user } = useAuth();

  const visibleTabs = ALL_TABS.filter(t => !t.minRole || (user && roleAtLeast(user.role, t.minRole)));

  const [activeTab, setActiveTab] = useState<SettingsTab>(visibleTabs[0]?.id ?? 'preferences');

  if (!user) {
    return null;
  }

  return (
    <PageLayout
      title="Settings"
      eyebrow="Settings"
      description="Manage your preferences and configuration."
      breadcrumbs={breadcrumbs}
    >
    <div className="settings-page">

      <nav className="settings-tabs" aria-label="Settings sections">
        {visibleTabs.map(tab => (
          <button
            key={tab.id}
            className={`settings-tab${activeTab === tab.id ? ' settings-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="settings-content">
        {activeTab === 'export' && <ExportSettings />}
        {activeTab === 'preferences' && <UserPreferences />}
        {activeTab === 'notifications' && <NotificationPreferences />}
        {activeTab === 'account' && <AccountSettingsTab />}
        {activeTab === 'security' && <BiometricSettingsTab />}
        {activeTab === 'system' && user.role === 'admin' && <SystemConfigTab />}
      </div>
    </div>
    </PageLayout>
  );
};

const AccountSettingsTab: React.FC = () => {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="settings-section">
      <dl className="settings-details">
        <div className="settings-details__row">
          <dt>Username</dt>
          <dd>{user.username}</dd>
        </div>
        <div className="settings-details__row">
          <dt>Email</dt>
          <dd>{user.email}</dd>
        </div>
        <div className="settings-details__row">
          <dt>Role</dt>
          <dd className="settings-details__value--role">{user.role}</dd>
        </div>
      </dl>
      <hr className="settings-divider" />
      <p className="settings-info">
        To update your email or password, visit your{' '}
        <Link to="/profile">User Profile</Link>.
      </p>
    </div>
  );
};

const BiometricSettingsTab: React.FC = () => {
  const { biometricEnrolled, enrollBiometricAfterLogin, disableBiometric, user } = useAuth();
  const [deviceSupported, setDeviceSupported] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    isBiometricAvailable().then(r => setDeviceSupported(r.available));
  }, []);

  if (!user) return null;

  const handleDisable = async () => {
    setLoading(true);
    setStatusMsg(null);
    await disableBiometric();
    setLoading(false);
    setStatusMsg('Biometric login has been disabled. You can re-enable it after your next password login.');
  };

  const handleEnable = async () => {
    setLoading(true);
    setStatusMsg(null);
    const result = await enrollBiometricAfterLogin();
    setLoading(false);
    setStatusMsg(result.success
      ? 'Biometric login enabled. Use Face ID or Touch ID on your next sign-in.'
      : (result.error ?? 'Could not enable biometric login. Please try again.'));
  };

  return (
    <div className="settings-section">
      <h3>Biometric login</h3>
      <p className="settings-info">
        Use Face ID or Touch ID to sign in quickly without entering your password.
        Your session token is stored securely in the device keychain and is only
        accessible via biometric confirmation.
      </p>

      {statusMsg && (
        <div className="alert alert-info" role="status">{statusMsg}</div>
      )}

      {!deviceSupported && (
        <p className="settings-info settings-info--muted">
          Biometric authentication is not available on this device or in the web browser.
          Run the app as a native iOS or Android build to use this feature.
        </p>
      )}

      {deviceSupported && (
        <>
          <div className="settings-field">
            <label>Status</label>
            <span className="settings-value">
              {biometricEnrolled ? '✅ Enabled' : '⬜ Disabled'}
            </span>
          </div>
          <hr className="settings-divider" />
          {biometricEnrolled ? (
            <button
              className="secondary-button"
              onClick={handleDisable}
              disabled={loading}
            >
              {loading ? 'Disabling…' : 'Disable biometric login'}
            </button>
          ) : (
            <button
              className="primary-button"
              onClick={handleEnable}
              disabled={loading}
            >
              {loading ? 'Enabling…' : 'Enable biometric login'}
            </button>
          )}
        </>
      )}
    </div>
  );
};

const SystemConfigTab: React.FC = () => (
  <div className="settings-section">
    <p className="settings-info">
      System-level configuration is visible to administrators only.
    </p>
    <div className="settings-field">
      <label>Application</label>
      <span className="settings-value">ShotSpot — Korfball Statistics</span>
    </div>
    <div className="settings-field">
      <label>Environment</label>
      <span className="settings-value">
        {import.meta.env.MODE === 'production' ? 'Production' : 'Development'}
      </span>
    </div>
    <div className="settings-field">
      <label>API Base URL</label>
      <span className="settings-value">{import.meta.env.VITE_API_URL ?? '/api'}</span>
    </div>
  </div>
);

export default SettingsPage;
