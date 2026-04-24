import React, { useMemo, useState } from 'react';

const NOTIFICATION_PREFS_KEY = 'notificationPreferences:v1';
const LEGACY_EMAIL_NOTIFICATIONS_KEY = 'emailNotifications';

type DeliveryFrequency = 'realtime' | 'hourly' | 'daily';

interface NotificationPreferencesState {
  enabled: boolean;
  channels: {
    email: boolean;
    inApp: boolean;
    push: boolean;
  };
  categories: {
    scheduledReports: boolean;
    matchReminders: boolean;
    lineupUpdates: boolean;
    systemAnnouncements: boolean;
  };
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
  frequency: DeliveryFrequency;
}

const DEFAULT_NOTIFICATION_PREFS: NotificationPreferencesState = {
  enabled: true,
  channels: {
    email: false,
    inApp: true,
    push: false
  },
  categories: {
    scheduledReports: true,
    matchReminders: true,
    lineupUpdates: true,
    systemAnnouncements: true
  },
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '07:00'
  },
  frequency: 'realtime'
};

function getStoredNotificationPreferences(): NotificationPreferencesState {
  try {
    const raw = localStorage.getItem(NOTIFICATION_PREFS_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_PREFS;

    const parsed = JSON.parse(raw) as Partial<NotificationPreferencesState>;

    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_NOTIFICATION_PREFS.enabled,
      channels: {
        email: typeof parsed.channels?.email === 'boolean' ? parsed.channels.email : DEFAULT_NOTIFICATION_PREFS.channels.email,
        inApp: typeof parsed.channels?.inApp === 'boolean' ? parsed.channels.inApp : DEFAULT_NOTIFICATION_PREFS.channels.inApp,
        push: typeof parsed.channels?.push === 'boolean' ? parsed.channels.push : DEFAULT_NOTIFICATION_PREFS.channels.push
      },
      categories: {
        scheduledReports: typeof parsed.categories?.scheduledReports === 'boolean'
          ? parsed.categories.scheduledReports
          : DEFAULT_NOTIFICATION_PREFS.categories.scheduledReports,
        matchReminders: typeof parsed.categories?.matchReminders === 'boolean'
          ? parsed.categories.matchReminders
          : DEFAULT_NOTIFICATION_PREFS.categories.matchReminders,
        lineupUpdates: typeof parsed.categories?.lineupUpdates === 'boolean'
          ? parsed.categories.lineupUpdates
          : DEFAULT_NOTIFICATION_PREFS.categories.lineupUpdates,
        systemAnnouncements: typeof parsed.categories?.systemAnnouncements === 'boolean'
          ? parsed.categories.systemAnnouncements
          : DEFAULT_NOTIFICATION_PREFS.categories.systemAnnouncements
      },
      quietHours: {
        enabled: typeof parsed.quietHours?.enabled === 'boolean'
          ? parsed.quietHours.enabled
          : DEFAULT_NOTIFICATION_PREFS.quietHours.enabled,
        start: typeof parsed.quietHours?.start === 'string' ? parsed.quietHours.start : DEFAULT_NOTIFICATION_PREFS.quietHours.start,
        end: typeof parsed.quietHours?.end === 'string' ? parsed.quietHours.end : DEFAULT_NOTIFICATION_PREFS.quietHours.end
      },
      frequency: parsed.frequency === 'hourly' || parsed.frequency === 'daily' || parsed.frequency === 'realtime'
        ? parsed.frequency
        : DEFAULT_NOTIFICATION_PREFS.frequency
    };
  } catch {
    return DEFAULT_NOTIFICATION_PREFS;
  }
}

function toggleFeedback(enabled: boolean, label: string): string {
  return `${label} ${enabled ? 'enabled' : 'disabled'}.`;
}

const NotificationPreferences: React.FC = () => {
  const [preferences, setPreferences] = useState<NotificationPreferencesState>(getStoredNotificationPreferences);
  const [feedback, setFeedback] = useState('Notifications loaded.');

  const persistPreferences = (next: NotificationPreferencesState, message: string) => {
    localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(next));
    // Keep backward compatibility with legacy key used in older flows/tests.
    const legacyEmailEnabled = next.enabled && next.channels.email && next.categories.scheduledReports;
    localStorage.setItem(LEGACY_EMAIL_NOTIFICATIONS_KEY, String(legacyEmailEnabled));
    setPreferences(next);
    setFeedback(message);
  };

  const updateGlobalEnabled = (enabled: boolean) => {
    persistPreferences({ ...preferences, enabled }, toggleFeedback(enabled, 'All notifications'));
  };

  const updateChannel = (channel: keyof NotificationPreferencesState['channels'], enabled: boolean) => {
    const next = {
      ...preferences,
      channels: {
        ...preferences.channels,
        [channel]: enabled
      }
    };
    const channelLabel = channel === 'inApp' ? 'In-app notifications' : `${channel.charAt(0).toUpperCase()}${channel.slice(1)} notifications`;
    persistPreferences(next, toggleFeedback(enabled, channelLabel));
  };

  const updateCategory = (category: keyof NotificationPreferencesState['categories'], enabled: boolean) => {
    const next = {
      ...preferences,
      categories: {
        ...preferences.categories,
        [category]: enabled
      }
    };

    const labels: Record<keyof NotificationPreferencesState['categories'], string> = {
      scheduledReports: 'Scheduled report alerts',
      matchReminders: 'Match reminders',
      lineupUpdates: 'Lineup updates',
      systemAnnouncements: 'System announcements'
    };

    persistPreferences(next, toggleFeedback(enabled, labels[category]));
  };

  const updateQuietHoursEnabled = (enabled: boolean) => {
    const next = {
      ...preferences,
      quietHours: {
        ...preferences.quietHours,
        enabled
      }
    };
    persistPreferences(next, toggleFeedback(enabled, 'Quiet hours'));
  };

  const updateQuietTime = (field: 'start' | 'end', value: string) => {
    const next = {
      ...preferences,
      quietHours: {
        ...preferences.quietHours,
        [field]: value
      }
    };
    persistPreferences(next, `Quiet hours ${field} time updated to ${value}.`);
  };

  const updateFrequency = (frequency: DeliveryFrequency) => {
    persistPreferences({ ...preferences, frequency }, `Delivery frequency set to ${frequency}.`);
  };

  const resetDefaults = () => {
    persistPreferences(DEFAULT_NOTIFICATION_PREFS, 'Notification preferences reset to defaults.');
  };

  const stateSummary = useMemo(() => {
    if (!preferences.enabled) {
      return 'Disabled';
    }

    const activeChannels = Object.entries(preferences.channels)
      .filter(([, value]) => value)
      .map(([name]) => (name === 'inApp' ? 'In-app' : `${name.charAt(0).toUpperCase()}${name.slice(1)}`));

    const activeCategories = Object.values(preferences.categories).filter(Boolean).length;
    return `${activeChannels.length > 0 ? activeChannels.join(', ') : 'No channels'} • ${activeCategories} categories active`;
  }, [preferences]);

  return (
    <div className="settings-section">
      <div role="status" className="settings-banner settings-banner--success" aria-live="polite">
        {feedback}
      </div>

      <section className="settings-group" aria-labelledby="notifications-overview">
        <div className="settings-group__header">
          <h3 id="notifications-overview">Notification center</h3>
          <p>Control what you receive, where it appears, and when alerts should be quiet.</p>
        </div>

        <div className="settings-toggle-row">
          <div>
            <p className="settings-toggle-row__title">Enable notifications</p>
            <p className="settings-field__help">Turn all notifications on or off for this account.</p>
          </div>
          <label className="settings-switch" htmlFor="notif-enabled">
            <input
              id="notif-enabled"
              type="checkbox"
              aria-label="Enable notifications"
              checked={preferences.enabled}
              onChange={(event) => updateGlobalEnabled(event.target.checked)}
            />
            <span className="settings-switch__slider" aria-hidden="true" />
            <span className="settings-switch__label">{preferences.enabled ? 'Enabled' : 'Disabled'}</span>
          </label>
        </div>

        <p className="settings-state-chip" aria-label="Notification summary">{stateSummary}</p>
      </section>

      <section className="settings-group" aria-labelledby="notifications-channels">
        <div className="settings-group__header">
          <h3 id="notifications-channels">Delivery channels</h3>
          <p>Pick where notifications should be delivered.</p>
        </div>

        <div className="settings-grid">
          <label className="settings-check-card" htmlFor="notif-channel-email">
            <input
              id="notif-channel-email"
              type="checkbox"
              aria-label="Email channel"
              checked={preferences.channels.email}
              disabled={!preferences.enabled}
              onChange={(event) => updateChannel('email', event.target.checked)}
            />
            <span className="settings-check-card__content">
              <strong>Email</strong>
              <small>Best for report and schedule updates.</small>
            </span>
            <span className={`settings-check-card__state ${preferences.channels.email ? 'is-enabled' : 'is-disabled'}`}>
              {preferences.channels.email ? 'Enabled' : 'Disabled'}
            </span>
          </label>

          <label className="settings-check-card" htmlFor="notif-channel-inapp">
            <input
              id="notif-channel-inapp"
              type="checkbox"
              aria-label="In-app channel"
              checked={preferences.channels.inApp}
              disabled={!preferences.enabled}
              onChange={(event) => updateChannel('inApp', event.target.checked)}
            />
            <span className="settings-check-card__content">
              <strong>In-app</strong>
              <small>Shows alerts directly in ShotSpot while you work.</small>
            </span>
            <span className={`settings-check-card__state ${preferences.channels.inApp ? 'is-enabled' : 'is-disabled'}`}>
              {preferences.channels.inApp ? 'Enabled' : 'Disabled'}
            </span>
          </label>

          <label className="settings-check-card" htmlFor="notif-channel-push">
            <input
              id="notif-channel-push"
              type="checkbox"
              aria-label="Push channel"
              checked={preferences.channels.push}
              disabled={!preferences.enabled}
              onChange={(event) => updateChannel('push', event.target.checked)}
            />
            <span className="settings-check-card__content">
              <strong>Push</strong>
              <small>Use browser push when available on your device.</small>
            </span>
            <span className={`settings-check-card__state ${preferences.channels.push ? 'is-enabled' : 'is-disabled'}`}>
              {preferences.channels.push ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        </div>
      </section>

      <section className="settings-group" aria-labelledby="notifications-types">
        <div className="settings-group__header">
          <h3 id="notifications-types">Notification types</h3>
          <p>Choose exactly which alerts are useful for your role.</p>
        </div>

        <div className="settings-grid">
          <label className="settings-check-card" htmlFor="notif-category-reports">
            <input
              id="notif-category-reports"
              type="checkbox"
              aria-label="Scheduled reports category"
              checked={preferences.categories.scheduledReports}
              disabled={!preferences.enabled}
              onChange={(event) => updateCategory('scheduledReports', event.target.checked)}
            />
            <span className="settings-check-card__content">
              <strong>Scheduled reports</strong>
              <small>Report completed, failed, or delayed.</small>
            </span>
            <span className={`settings-check-card__state ${preferences.categories.scheduledReports ? 'is-enabled' : 'is-disabled'}`}>
              {preferences.categories.scheduledReports ? 'Enabled' : 'Disabled'}
            </span>
          </label>

          <label className="settings-check-card" htmlFor="notif-category-match">
            <input
              id="notif-category-match"
              type="checkbox"
              aria-label="Match reminders category"
              checked={preferences.categories.matchReminders}
              disabled={!preferences.enabled}
              onChange={(event) => updateCategory('matchReminders', event.target.checked)}
            />
            <span className="settings-check-card__content">
              <strong>Match reminders</strong>
              <small>Upcoming matches, kickoffs, and schedule changes.</small>
            </span>
            <span className={`settings-check-card__state ${preferences.categories.matchReminders ? 'is-enabled' : 'is-disabled'}`}>
              {preferences.categories.matchReminders ? 'Enabled' : 'Disabled'}
            </span>
          </label>

          <label className="settings-check-card" htmlFor="notif-category-lineup">
            <input
              id="notif-category-lineup"
              type="checkbox"
              aria-label="Lineup updates category"
              checked={preferences.categories.lineupUpdates}
              disabled={!preferences.enabled}
              onChange={(event) => updateCategory('lineupUpdates', event.target.checked)}
            />
            <span className="settings-check-card__content">
              <strong>Lineup updates</strong>
              <small>Roster and player availability changes.</small>
            </span>
            <span className={`settings-check-card__state ${preferences.categories.lineupUpdates ? 'is-enabled' : 'is-disabled'}`}>
              {preferences.categories.lineupUpdates ? 'Enabled' : 'Disabled'}
            </span>
          </label>

          <label className="settings-check-card" htmlFor="notif-category-system">
            <input
              id="notif-category-system"
              type="checkbox"
              aria-label="System announcements category"
              checked={preferences.categories.systemAnnouncements}
              disabled={!preferences.enabled}
              onChange={(event) => updateCategory('systemAnnouncements', event.target.checked)}
            />
            <span className="settings-check-card__content">
              <strong>System announcements</strong>
              <small>Platform updates and maintenance notices.</small>
            </span>
            <span className={`settings-check-card__state ${preferences.categories.systemAnnouncements ? 'is-enabled' : 'is-disabled'}`}>
              {preferences.categories.systemAnnouncements ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        </div>
      </section>

      <section className="settings-group" aria-labelledby="notifications-timing">
        <div className="settings-group__header">
          <h3 id="notifications-timing">Timing controls</h3>
          <p>Define delivery pace and optional quiet hours.</p>
        </div>

        <div className="settings-field">
          <label htmlFor="notif-frequency">Delivery frequency</label>
          <select
            id="notif-frequency"
            value={preferences.frequency}
            disabled={!preferences.enabled}
            onChange={(event) => updateFrequency(event.target.value as DeliveryFrequency)}
          >
            <option value="realtime">Real-time</option>
            <option value="hourly">Hourly digest</option>
            <option value="daily">Daily digest</option>
          </select>
          <p className="settings-field__help">Real-time is best for active match operations; digests reduce noise.</p>
        </div>

        <div className="settings-toggle-row">
          <div>
            <p className="settings-toggle-row__title">Quiet hours</p>
            <p className="settings-field__help">Pause non-critical alerts during specific hours.</p>
          </div>
          <label className="settings-switch" htmlFor="notif-quiet-hours">
            <input
              id="notif-quiet-hours"
              type="checkbox"
              aria-label="Quiet hours"
              checked={preferences.quietHours.enabled}
              disabled={!preferences.enabled}
              onChange={(event) => updateQuietHoursEnabled(event.target.checked)}
            />
            <span className="settings-switch__slider" aria-hidden="true" />
            <span className="settings-switch__label">{preferences.quietHours.enabled ? 'Enabled' : 'Disabled'}</span>
          </label>
        </div>

        <div className="settings-grid settings-grid--times">
          <div className="settings-field">
            <label htmlFor="notif-quiet-start">Quiet hours start</label>
            <input
              id="notif-quiet-start"
              type="time"
              value={preferences.quietHours.start}
              disabled={!preferences.enabled || !preferences.quietHours.enabled}
              onChange={(event) => updateQuietTime('start', event.target.value)}
            />
          </div>
          <div className="settings-field">
            <label htmlFor="notif-quiet-end">Quiet hours end</label>
            <input
              id="notif-quiet-end"
              type="time"
              value={preferences.quietHours.end}
              disabled={!preferences.enabled || !preferences.quietHours.enabled}
              onChange={(event) => updateQuietTime('end', event.target.value)}
            />
          </div>
        </div>
      </section>

      <div className="settings-actions">
        <button className="secondary-button" onClick={resetDefaults}>
          Reset notification defaults
        </button>
      </div>
    </div>
  );
};

export default NotificationPreferences;
