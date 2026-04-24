import { renderHook, act, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';

vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

import api from '../utils/api';

const STORAGE_KEY = 'themePreference';
const LOCAL_INHERITED_STORAGE_KEY = 'themePalette:teamDefault';
const CLUB_SCOPE_STORAGE_KEY = 'themePalette:clubScopeId';
const TEAM_SCOPE_STORAGE_KEY = 'themePalette:teamScopeId';
const USER_STORAGE_KEY = 'themeSettings:user:12';

const apiGetMock = vi.mocked(api.get);
const apiPutMock = vi.mocked(api.put);

describe('ThemeContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-palette');
    document.documentElement.style.cssText = '';
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ id: 12, username: 'theme-user' }));
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LOCAL_INHERITED_STORAGE_KEY);
    localStorage.removeItem(CLUB_SCOPE_STORAGE_KEY);
    localStorage.removeItem(TEAM_SCOPE_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    apiGetMock.mockImplementation((url: string) => {
      if (url === '/clubs/4/theme') {
        return Promise.resolve({ data: { club_id: 4, palette_id: 'emerald-club' } });
      }

      if (url === '/teams/9/theme') {
        return Promise.resolve({
          data: {
            team_id: 9,
            club_id: 4,
            palette_id: null,
            club_palette_id: 'emerald-club',
            effective_palette_id: 'emerald-club',
            is_inherited: true,
          }
        });
      }

      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });
    apiPutMock.mockResolvedValue({ data: { ok: true } });
  });

  it('defaults to system and does not set data-theme', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>
    });

    expect(result.current.themePreference).toBe('system');
    expect(result.current.paletteSelection).toBe('team-default');
    expect(result.current.clubPaletteId).toBe('shotspot-blue');
    expect(result.current.teamPaletteId).toBeNull();
    expect(result.current.inheritedPaletteId).toBe('shotspot-blue');
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
    expect(document.documentElement.getAttribute('data-palette')).toBe('shotspot-blue');
  });

  it('persists and applies dark theme', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>
    });

    act(() => {
      result.current.setThemePreference('dark');
    });

    expect(result.current.themePreference).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
    expect(JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || '{}')).toMatchObject({ themePreference: 'dark' });
  });

  it('allows overriding OS dark mode by forcing light', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>
    });

    act(() => {
      result.current.setThemePreference('light');
    });

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('persists palette selections per user and exposes palette variables', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>
    });

    act(() => {
      result.current.setPaletteSelection('emerald-club');
      result.current.setClubPaletteId('crimson-strike');
    });

    expect(result.current.resolvedPaletteId).toBe('emerald-club');
    expect(document.documentElement.getAttribute('data-palette')).toBe('emerald-club');
    expect(document.documentElement.style.getPropertyValue('--primary-color')).toBe('#0f8f6b');
    expect(JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || '{}')).toMatchObject({ paletteSelection: 'emerald-club' });
    expect(localStorage.getItem(LOCAL_INHERITED_STORAGE_KEY)).toBe('crimson-strike');
  });

  it('uses the stored team default palette when the user inherits team colors', () => {
    localStorage.setItem(LOCAL_INHERITED_STORAGE_KEY, 'violet-pulse');

    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>
    });

    expect(result.current.resolvedPaletteId).toBe('violet-pulse');
    expect(result.current.resolvedPalette.name).toBe('Violet Pulse');
  });

  it('loads the club and team hierarchy from the backend when scopes are selected', async () => {
    localStorage.setItem(CLUB_SCOPE_STORAGE_KEY, '4');
    localStorage.setItem(TEAM_SCOPE_STORAGE_KEY, '9');

    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>
    });

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith('/clubs/4/theme');
      expect(apiGetMock).toHaveBeenCalledWith('/teams/9/theme');
      expect(result.current.clubPaletteId).toBe('emerald-club');
      expect(result.current.inheritedPaletteId).toBe('emerald-club');
      expect(document.documentElement.getAttribute('data-palette')).toBe('emerald-club');
    });

    expect(result.current.clubScopeId).toBe(4);
    expect(result.current.teamScopeId).toBe(9);
    expect(result.current.clubPaletteId).toBe('emerald-club');
    expect(result.current.teamPaletteId).toBeNull();
    expect(result.current.inheritedPaletteId).toBe('emerald-club');
  });

  it('persists team palette updates back to the backend when a team scope is selected', async () => {
    localStorage.setItem(CLUB_SCOPE_STORAGE_KEY, '4');
    localStorage.setItem(TEAM_SCOPE_STORAGE_KEY, '9');

    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>
    });

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith('/teams/9/theme');
    });

    act(() => {
      result.current.setTeamPaletteId('sunset-flare');
    });

    await waitFor(() => {
      expect(apiPutMock).toHaveBeenCalledWith('/teams/9/theme', { palette_id: 'sunset-flare' });
    });
  });
});
