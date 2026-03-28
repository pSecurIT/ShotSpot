import React, { useState } from 'react';
import { useTheme, type ThemePreference } from '../contexts/ThemeContext';
import type { Language } from '../types/settings';

const LANGUAGE_KEY = 'language';
const NOTIFICATIONS_KEY = 'emailNotifications';

function getStoredLanguage(): Language {
  const raw = localStorage.getItem(LANGUAGE_KEY);
  if (raw === 'nl' || raw === 'fr') return raw;
  return 'en';
}

function getStoredNotifications(): boolean {
  return localStorage.getItem(NOTIFICATIONS_KEY) === 'true';
}

const UserPreferences: React.FC = () => {
  const { themePreference, setThemePreference } = useTheme();
  const [language, setLanguage] = useState<Language>(getStoredLanguage);
  const [emailNotifications, setEmailNotifications] = useState(getStoredNotifications);
  const [success, setSuccess] = useState('');

  const handleSave = () => {
    localStorage.setItem(LANGUAGE_KEY, language);
    localStorage.setItem(NOTIFICATIONS_KEY, String(emailNotifications));
    setSuccess('Preferences saved.');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleReset = () => {
    setThemePreference('system');
    setLanguage('en');
    setEmailNotifications(false);
    localStorage.setItem(LANGUAGE_KEY, 'en');
    localStorage.setItem(NOTIFICATIONS_KEY, 'false');
    setSuccess('Preferences reset to defaults.');
    setTimeout(() => setSuccess(''), 3000);
  };

  return (
    <div className="settings-section">
      {success && (
        <div role="status" className="settings-banner settings-banner--success">
          {success}
        </div>
      )}

      <div className="settings-field">
        <label htmlFor="pref-theme">Theme</label>
        <select
          id="pref-theme"
          value={themePreference}
          onChange={e => setThemePreference(e.target.value as ThemePreference)}
        >
          <option value="system">System default</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
        <p className="settings-field__help">
          System default follows your OS setting; choosing Light or Dark overrides it.
        </p>
      </div>

      <div className="settings-field">
        <label htmlFor="pref-language">Language</label>
        <select
          id="pref-language"
          value={language}
          onChange={e => setLanguage(e.target.value as Language)}
        >
          <option value="en">English</option>
          <option value="nl">Dutch (Nederlands)</option>
          <option value="fr">French (Français)</option>
        </select>
        <p className="settings-field__help">
          Controls the display language of the application.
        </p>
      </div>

      <div className="settings-field settings-field--checkbox">
        <label>
          <input
            type="checkbox"
            checked={emailNotifications}
            onChange={e => setEmailNotifications(e.target.checked)}
          />
          Email notifications for scheduled reports
        </label>
        <p className="settings-field__help">
          Receive an email when a scheduled report is ready.
        </p>
      </div>

      <div className="settings-actions">
        <button className="btn btn-primary" onClick={handleSave}>
          Save Preferences
        </button>
        <button className="btn btn-secondary" onClick={handleReset}>
          Reset to Defaults
        </button>
      </div>
    </div>
  );
};

export default UserPreferences;
