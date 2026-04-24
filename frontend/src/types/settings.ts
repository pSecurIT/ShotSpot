export interface ExportSettings {
  id: number;
  user_id: number;
  default_format: 'pdf' | 'csv' | 'json';
  default_template_id: number | null;
  anonymize_opponents: boolean;
  include_sensitive_data: boolean;
  auto_delete_after_days: number | null;
  allow_public_sharing: boolean;
  allowed_share_roles: string[];
  created_at: string;
  updated_at: string;
}

export interface ExportSettingsUpdatePayload {
  default_format?: 'pdf' | 'csv' | 'json';
  default_template_id?: number | null;
  anonymize_opponents?: boolean;
  include_sensitive_data?: boolean;
  auto_delete_after_days?: number | null;
  allow_public_sharing?: boolean;
  allowed_share_roles?: string[];
}

export type Language = 'en' | 'nl' | 'fr';

export interface UserPreferences {
  theme: 'system' | 'light' | 'dark';
  language: Language;
  emailNotifications: boolean;
}

export interface NotificationPreferences {
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
  frequency: 'realtime' | 'hourly' | 'daily';
}

export type SettingsTab = 'export' | 'preferences' | 'notifications' | 'account' | 'system';
