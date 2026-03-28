import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { vi, beforeEach, describe, expect, it } from 'vitest';
import SettingsPage from '../components/SettingsPage';

// ──────────────────────────────────────────────────────────
// Mocks
// ──────────────────────────────────────────────────────────

const mockUseAuth = vi.fn();
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUseTheme = vi.fn();
vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));

vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
  },
}));

import api from '../utils/api';

const defaultExportSettings = {
  id: 1,
  user_id: 5,
  default_format: 'pdf',
  default_template_id: null,
  anonymize_opponents: false,
  include_sensitive_data: true,
  auto_delete_after_days: null,
  allow_public_sharing: false,
  allowed_share_roles: ['coach', 'admin'],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockCoach = { id: 5, username: 'coach1', email: 'coach@test.com', role: 'coach' };
const mockAdmin = { id: 1, username: 'admin', email: 'admin@test.com', role: 'admin' };

function setup(user = mockCoach) {
  mockUseAuth.mockReturnValue({ user });
  mockUseTheme.mockReturnValue({ themePreference: 'system', setThemePreference: vi.fn() });
  (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: defaultExportSettings });
  (api.put as ReturnType<typeof vi.fn>).mockResolvedValue({ data: defaultExportSettings });
  (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: defaultExportSettings });

  const user_event = userEvent.setup();
  render(
    <BrowserRouter>
      <SettingsPage />
    </BrowserRouter>
  );
  return { ue: user_event };
}

// ──────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('🏷️ renders the page heading', () => {
    setup();
    expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
  });

  it('📑 shows tab navigation with correct tabs for coach', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Export Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'User Preferences' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Account Settings' })).toBeInTheDocument();
    // System Configuration must NOT appear for coach
    expect(screen.queryByRole('button', { name: 'System Configuration' })).not.toBeInTheDocument();
  });

  it('🔐 shows System Configuration tab for admin', () => {
    setup(mockAdmin);
    expect(screen.getByRole('button', { name: 'System Configuration' })).toBeInTheDocument();
  });

  it('📤 Export Settings tab is active by default for coach', async () => {
    setup();
    await waitFor(() => {
      expect(screen.getByLabelText('Default Export Format')).toBeInTheDocument();
    });
  });

  it('🎨 switches to User Preferences tab and shows theme selector', async () => {
    const { ue } = setup();
    await ue.click(screen.getByRole('button', { name: 'User Preferences' }));
    expect(screen.getByLabelText('Theme')).toBeInTheDocument();
    expect(screen.getByLabelText('Language')).toBeInTheDocument();
  });

  it('👤 shows account info in Account Settings tab', async () => {
    const { ue } = setup();
    await ue.click(screen.getByRole('button', { name: 'Account Settings' }));
    expect(screen.getByText('coach1')).toBeInTheDocument();
    expect(screen.getByText('coach@test.com')).toBeInTheDocument();
    expect(screen.getByText('coach')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /user profile/i })).toBeInTheDocument();
  });

  it('🖥️ shows system info in System Configuration tab for admin', async () => {
    const { ue } = setup(mockAdmin);
    await ue.click(screen.getByRole('button', { name: 'System Configuration' }));
    expect(screen.getByText(/korfball/i)).toBeInTheDocument();
  });

  it('💾 save button in Export Settings calls PUT', async () => {
    const { ue } = setup();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save export settings/i })).toBeInTheDocument();
    });
    await ue.click(screen.getByRole('button', { name: /save export settings/i }));
    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/export-settings', expect.objectContaining({ default_format: 'pdf' }));
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Export settings saved.');
  });

  it('🔄 reset button in Export Settings calls POST reset', async () => {
    const { ue } = setup();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reset to defaults/i })).toBeInTheDocument();
    });
    await ue.click(screen.getByRole('button', { name: /reset to defaults/i }));
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/export-settings/reset', {});
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Export settings reset to defaults.');
  });

  it('✅ save User Preferences persists language to localStorage', async () => {
    const { ue } = setup();
    await ue.click(screen.getByRole('button', { name: 'User Preferences' }));

    const languageSelect = screen.getByLabelText('Language');
    await ue.selectOptions(languageSelect, 'nl');

    await ue.click(screen.getByRole('button', { name: /save preferences/i }));

    expect(localStorage.getItem('language')).toBe('nl');
    expect(await screen.findByRole('status')).toHaveTextContent('Preferences saved.');
  });

  it('🔄 reset User Preferences restores defaults in localStorage', async () => {
    localStorage.setItem('language', 'fr');
    localStorage.setItem('emailNotifications', 'true');

    const { ue } = setup();
    await ue.click(screen.getByRole('button', { name: 'User Preferences' }));

    await ue.click(screen.getByRole('button', { name: /reset to defaults/i }));

    expect(localStorage.getItem('language')).toBe('en');
    expect(localStorage.getItem('emailNotifications')).toBe('false');
    expect(await screen.findByRole('status')).toHaveTextContent('Preferences reset to defaults.');
  });

  it('⛔ Export Settings shows error for invalid auto-delete days', async () => {
    const { ue } = setup();
    await waitFor(() => {
      expect(screen.getByLabelText('Auto-delete exports after (days)')).toBeInTheDocument();
    });

    const daysInput = screen.getByLabelText('Auto-delete exports after (days)');
    await ue.clear(daysInput);
    await ue.type(daysInput, '-5');

    await ue.click(screen.getByRole('button', { name: /save export settings/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/positive/i);
    expect(api.put).not.toHaveBeenCalled();
  });
});
