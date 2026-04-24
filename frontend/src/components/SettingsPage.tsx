import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ExportSettings from './ExportSettings';
import UserPreferences from './UserPreferences';
import PageLayout from './ui/PageLayout';
import useBreadcrumbs from '../hooks/useBreadcrumbs';
import type { SettingsTab } from '../types/settings';
import '../styles/Settings.css';

interface Tab {
  id: SettingsTab;
  label: string;
  minRole?: string;
}

const ALL_TABS: Tab[] = [
  { id: 'export', label: 'Export Settings', minRole: 'coach' },
  { id: 'preferences', label: 'User Preferences' },
  { id: 'account', label: 'Account Settings' },
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
        {activeTab === 'account' && <AccountSettingsTab />}
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
