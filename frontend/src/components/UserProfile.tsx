import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import PageLayout from './ui/PageLayout';
import useBreadcrumbs from '../hooks/useBreadcrumbs';
import '../styles/UserProfile.css';

const UserProfile: React.FC = () => {
  const breadcrumbs = useBreadcrumbs();
  const { user } = useAuth();
  const { themePreference, setThemePreference } = useTheme();

  if (!user) {
    return <div className="profile-page profile-page--unauth">You must be logged in.</div>;
  }

  return (
    <PageLayout
      title="My Profile"
      eyebrow="Profile"
      description="Account details and appearance preferences."
      breadcrumbs={breadcrumbs}
    >
    <div className="profile-page">
      <div className="profile-page__container">
        <section className="card profile-card" aria-label="Account details">
          <dl className="profile-details">
            <div className="profile-details__row">
              <dt className="profile-details__label">Username</dt>
              <dd className="profile-details__value">{user.username}</dd>
            </div>
            <div className="profile-details__row">
              <dt className="profile-details__label">Email</dt>
              <dd className="profile-details__value">{user.email}</dd>
            </div>
            <div className="profile-details__row">
              <dt className="profile-details__label">Role</dt>
              <dd className="profile-details__value">{user.role}</dd>
            </div>
          </dl>
        </section>

        <section className="card profile-card" aria-label="Appearance">
          <h3 className="profile-section__title">Appearance</h3>

          <div className="profile-field">
            <label htmlFor="themePreference" className="profile-field__label">
              Theme
            </label>
            <select
              id="themePreference"
              value={themePreference}
              onChange={(e) => setThemePreference(e.target.value as 'system' | 'light' | 'dark')}
              className="profile-field__control"
            >
              <option value="system">System default</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
            <p className="profile-field__help">
              System default follows your OS setting; choosing Light/Dark overrides it.
            </p>
          </div>
        </section>

        <p className="profile-page__note">More profile settings can be added later.</p>
      </div>
    </div>
    </PageLayout>
  );
};

export default UserProfile;
