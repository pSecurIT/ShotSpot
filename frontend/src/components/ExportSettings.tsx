import React, { useEffect, useState } from 'react';
import { settingsApi } from '../services/settingsApi';
import type { ExportSettings as ExportSettingsType, ExportSettingsUpdatePayload } from '../types/settings';

const ROLES = ['user', 'coach', 'admin'] as const;

const defaultForm: ExportSettingsUpdatePayload = {
  default_format: 'pdf',
  anonymize_opponents: false,
  include_sensitive_data: true,
  auto_delete_after_days: null,
  allow_public_sharing: false,
  allowed_share_roles: ['coach', 'admin'],
};

function settingsToForm(s: ExportSettingsType): ExportSettingsUpdatePayload {
  return {
    default_format: s.default_format,
    anonymize_opponents: s.anonymize_opponents,
    include_sensitive_data: s.include_sensitive_data,
    auto_delete_after_days: s.auto_delete_after_days,
    allow_public_sharing: s.allow_public_sharing,
    allowed_share_roles: s.allowed_share_roles,
  };
}

const ExportSettings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState<ExportSettingsUpdatePayload>(defaultForm);
  const [daysRaw, setDaysRaw] = useState('');

  useEffect(() => {
    settingsApi
      .getExportSettings()
      .then(data => {
        setForm(settingsToForm(data));
        setDaysRaw(data.auto_delete_after_days != null ? String(data.auto_delete_after_days) : '');
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load export settings.');
        setLoading(false);
      });
  }, []);

  const handleRoleToggle = (role: string) => {
    const current = form.allowed_share_roles ?? [];
    const next = current.includes(role)
      ? current.filter(r => r !== role)
      : [...current, role];
    setForm(f => ({ ...f, allowed_share_roles: next }));
  };

  const validate = (): string => {
    if (daysRaw !== '') {
      const n = parseInt(daysRaw, 10);
      if (isNaN(n) || n <= 0 || !Number.isInteger(n)) {
        return 'Auto-delete days must be a positive whole number, or leave blank for never.';
      }
    }
    return '';
  };

  const buildPayload = (): ExportSettingsUpdatePayload => ({
    ...form,
    auto_delete_after_days: daysRaw === '' ? null : parseInt(daysRaw, 10),
  });

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setSuccess('');
    setError('');
    try {
      const updated = await settingsApi.updateExportSettings(buildPayload());
      setForm(settingsToForm(updated));
      setDaysRaw(updated.auto_delete_after_days != null ? String(updated.auto_delete_after_days) : '');
      setSuccess('Export settings saved.');
    } catch {
      setError('Failed to save export settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    setSuccess('');
    setError('');
    try {
      const reset = await settingsApi.resetExportSettings();
      setForm(settingsToForm(reset));
      setDaysRaw(reset.auto_delete_after_days != null ? String(reset.auto_delete_after_days) : '');
      setSuccess('Export settings reset to defaults.');
    } catch {
      setError('Failed to reset export settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div aria-busy="true">Loading export settings…</div>;
  }

  return (
    <div className="settings-section">
      {success && (
        <div role="status" className="settings-banner settings-banner--success">
          {success}
        </div>
      )}
      {error && (
        <div role="alert" className="settings-banner settings-banner--error">
          {error}
        </div>
      )}

      <div className="settings-field">
        <label htmlFor="es-default-format">Default Export Format</label>
        <select
          id="es-default-format"
          value={form.default_format}
          onChange={e =>
            setForm(f => ({ ...f, default_format: e.target.value as 'pdf' | 'csv' | 'json' }))
          }
        >
          <option value="pdf">PDF</option>
          <option value="csv">CSV</option>
          <option value="json">JSON</option>
        </select>
      </div>

      <div className="settings-field settings-field--checkbox">
        <label>
          <input
            type="checkbox"
            checked={form.anonymize_opponents ?? false}
            onChange={e => setForm(f => ({ ...f, anonymize_opponents: e.target.checked }))}
          />
          Anonymize opponent names in exports
        </label>
      </div>

      <div className="settings-field settings-field--checkbox">
        <label>
          <input
            type="checkbox"
            checked={form.include_sensitive_data ?? true}
            onChange={e => setForm(f => ({ ...f, include_sensitive_data: e.target.checked }))}
          />
          Include sensitive data in exports
        </label>
      </div>

      <div className="settings-field settings-field--checkbox">
        <label>
          <input
            type="checkbox"
            checked={form.allow_public_sharing ?? false}
            onChange={e => setForm(f => ({ ...f, allow_public_sharing: e.target.checked }))}
          />
          Allow public sharing of exports
        </label>
      </div>

      <div className="settings-field">
        <label htmlFor="es-roles">Roles allowed to view shared exports</label>
        <div className="settings-field__roles">
          {ROLES.map(role => (
            <label key={role}>
              <input
                type="checkbox"
                checked={(form.allowed_share_roles ?? []).includes(role)}
                onChange={() => handleRoleToggle(role)}
              />
              {role}
            </label>
          ))}
        </div>
      </div>

      <div className="settings-field">
        <label htmlFor="es-auto-delete">Auto-delete exports after (days)</label>
        <input
          id="es-auto-delete"
          type="number"
          min={1}
          value={daysRaw}
          onChange={e => setDaysRaw(e.target.value)}
          placeholder="Never"
        />
        <p className="settings-field__help">Leave blank to keep exports indefinitely.</p>
      </div>

      <div className="settings-actions">
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Export Settings'}
        </button>
        <button className="btn btn-secondary" onClick={handleReset} disabled={saving}>
          Reset to Defaults
        </button>
      </div>
    </div>
  );
};

export default ExportSettings;
