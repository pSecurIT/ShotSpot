import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../utils/api';
import {
  buildThemeCssVariables,
  DEFAULT_THEME_PALETTE_ID,
  getThemePalette,
  isThemePaletteId,
  isThemePaletteSelection,
  isThemePreference,
  THEME_PALETTES,
  type ThemePalette,
  type ThemePaletteId,
  type ThemePaletteSelection,
  type ThemePreference,
  type StoredThemeSettings
} from '../utils/theme';

interface ThemeContextValue {
  themePreference: ThemePreference;
  setThemePreference: (next: ThemePreference) => void;
  paletteSelection: ThemePaletteSelection;
  setPaletteSelection: (next: ThemePaletteSelection) => void;
  clubScopeId: number | null;
  setClubScopeId: (next: number | null) => void;
  clubPaletteId: ThemePaletteId;
  setClubPaletteId: (next: ThemePaletteId) => void;
  teamScopeId: number | null;
  setTeamScopeId: (next: number | null) => void;
  teamPaletteId: ThemePaletteId | null;
  setTeamPaletteId: (next: ThemePaletteId | null) => void;
  inheritedPaletteId: ThemePaletteId;
  resolvedPaletteId: ThemePaletteId;
  resolvedPalette: ThemePalette;
  availablePalettes: ThemePalette[];
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const LEGACY_STORAGE_KEY = 'themePreference';
const USER_STORAGE_PREFIX = 'themeSettings:user:';
const LOCAL_INHERITED_PALETTE_STORAGE_KEY = 'themePalette:teamDefault';
const CLUB_SCOPE_STORAGE_KEY = 'themePalette:clubScopeId';
const TEAM_SCOPE_STORAGE_KEY = 'themePalette:teamScopeId';

const DEFAULT_THEME_SETTINGS: StoredThemeSettings = {
  themePreference: 'system',
  paletteSelection: 'team-default'
};

function getCurrentUserScope(): string {
  if (typeof window === 'undefined') return 'anonymous';

  const raw = window.localStorage.getItem('user');
  if (!raw || raw === 'undefined' || raw === 'null') return 'anonymous';

  try {
    const parsed = JSON.parse(raw) as { id?: number | string };
    return parsed.id !== undefined ? String(parsed.id) : 'anonymous';
  } catch {
    return 'anonymous';
  }
}

function userStorageKey(scope: string): string {
  return `${USER_STORAGE_PREFIX}${scope}`;
}

function getStoredThemeSettings(): StoredThemeSettings {
  if (typeof window === 'undefined') return DEFAULT_THEME_SETTINGS;

  const scopedKey = userStorageKey(getCurrentUserScope());
  const raw = window.localStorage.getItem(scopedKey);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<StoredThemeSettings>;
      return {
        themePreference: isThemePreference(parsed.themePreference) ? parsed.themePreference : DEFAULT_THEME_SETTINGS.themePreference,
        paletteSelection: isThemePaletteSelection(parsed.paletteSelection) ? parsed.paletteSelection : DEFAULT_THEME_SETTINGS.paletteSelection
      };
    } catch {
      window.localStorage.removeItem(scopedKey);
    }
  }

  const legacyPreference = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  return {
    ...DEFAULT_THEME_SETTINGS,
    themePreference: isThemePreference(legacyPreference) ? legacyPreference : DEFAULT_THEME_SETTINGS.themePreference
  };
}

function getStoredLocalInheritedPaletteId(): ThemePaletteId {
  if (typeof window === 'undefined') return DEFAULT_THEME_PALETTE_ID;

  const raw = window.localStorage.getItem(LOCAL_INHERITED_PALETTE_STORAGE_KEY);
  return isThemePaletteId(raw) ? raw : DEFAULT_THEME_PALETTE_ID;
}

function getStoredClubScopeId(): number | null {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(CLUB_SCOPE_STORAGE_KEY);
  if (!raw) return null;

  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function getStoredTeamScopeId(): number | null {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(TEAM_SCOPE_STORAGE_KEY);
  if (!raw) return null;

  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function applyThemePreferenceToDocument(themePreference: ThemePreference) {
  const root = document.documentElement;

  if (themePreference === 'system') {
    root.removeAttribute('data-theme');
    return;
  }

  root.setAttribute('data-theme', themePreference);
}

function applyPaletteToDocument(paletteId: ThemePaletteId) {
  const root = document.documentElement;
  const palette = getThemePalette(paletteId);
  const variables = buildThemeCssVariables(palette);

  root.setAttribute('data-palette', paletteId);
  Object.entries(variables).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(() => getStoredThemeSettings().themePreference);
  const [paletteSelection, setPaletteSelectionState] = useState<ThemePaletteSelection>(() => getStoredThemeSettings().paletteSelection);
  const [clubScopeId, setClubScopeIdState] = useState<number | null>(() => getStoredClubScopeId());
  const [localInheritedPaletteId, setLocalInheritedPaletteId] = useState<ThemePaletteId>(() => getStoredLocalInheritedPaletteId());
  const [remoteClubPaletteId, setRemoteClubPaletteId] = useState<ThemePaletteId>(() => getStoredLocalInheritedPaletteId());
  const [teamScopeId, setTeamScopeIdState] = useState<number | null>(() => getStoredTeamScopeId());
  const [teamPaletteId, setTeamPaletteIdState] = useState<ThemePaletteId | null>(null);
  const clubScopeLoadingRef = useRef(false);
  const teamScopeLoadingRef = useRef(false);
  const lastLoadedClubPaletteRef = useRef<ThemePaletteId | null>(null);
  const lastLoadedTeamPaletteRef = useRef<ThemePaletteId | null>(null);

  const clubPaletteId = clubScopeId === null ? localInheritedPaletteId : remoteClubPaletteId;
  const inheritedPaletteId = teamScopeId !== null && teamPaletteId ? teamPaletteId : clubPaletteId;
  const resolvedPaletteId = paletteSelection === 'team-default' ? inheritedPaletteId : paletteSelection;

  useEffect(() => {
    applyThemePreferenceToDocument(themePreference);
    const scopedKey = userStorageKey(getCurrentUserScope());
    window.localStorage.setItem(scopedKey, JSON.stringify({ themePreference, paletteSelection }));
    window.localStorage.setItem(LEGACY_STORAGE_KEY, themePreference);
  }, [paletteSelection, themePreference]);

  useEffect(() => {
    applyPaletteToDocument(resolvedPaletteId);
  }, [resolvedPaletteId]);

  useEffect(() => {
    window.localStorage.setItem(LOCAL_INHERITED_PALETTE_STORAGE_KEY, localInheritedPaletteId);
  }, [localInheritedPaletteId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (clubScopeId === null) {
      window.localStorage.removeItem(CLUB_SCOPE_STORAGE_KEY);
      lastLoadedClubPaletteRef.current = null;
      clubScopeLoadingRef.current = false;
      return;
    }

    window.localStorage.setItem(CLUB_SCOPE_STORAGE_KEY, String(clubScopeId));
  }, [clubScopeId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (teamScopeId === null) {
      window.localStorage.removeItem(TEAM_SCOPE_STORAGE_KEY);
      lastLoadedTeamPaletteRef.current = null;
      teamScopeLoadingRef.current = false;
      return;
    }

    window.localStorage.setItem(TEAM_SCOPE_STORAGE_KEY, String(teamScopeId));
  }, [teamScopeId]);

  useEffect(() => {
    if (clubScopeId === null) return undefined;

    let ignore = false;
    clubScopeLoadingRef.current = true;

    api.get<{ club_id: number; palette_id: string }>(`/clubs/${clubScopeId}/theme`)
      .then((response) => {
        if (ignore) return;

        const nextPaletteId = isThemePaletteId(response.data.palette_id)
          ? response.data.palette_id
          : DEFAULT_THEME_PALETTE_ID;

        clubScopeLoadingRef.current = false;
        lastLoadedClubPaletteRef.current = nextPaletteId;
        setRemoteClubPaletteId(nextPaletteId);
      })
      .catch(() => {
        if (!ignore) {
          clubScopeLoadingRef.current = false;
          lastLoadedClubPaletteRef.current = null;
        }
      });

    return () => {
      ignore = true;
    };
  }, [clubScopeId]);

  useEffect(() => {
    if (teamScopeId === null) return undefined;

    let ignore = false;
    teamScopeLoadingRef.current = true;

    api.get<{
      team_id: number;
      club_id: number;
      palette_id: string | null;
      club_palette_id: string;
      effective_palette_id: string;
      is_inherited: boolean;
    }>(`/teams/${teamScopeId}/theme`)
      .then((response) => {
        if (ignore) return;

        const nextTeamPaletteId = isThemePaletteId(response.data.palette_id)
          ? response.data.palette_id
          : null;
        const nextClubPaletteId = isThemePaletteId(response.data.club_palette_id)
          ? response.data.club_palette_id
          : DEFAULT_THEME_PALETTE_ID;

        teamScopeLoadingRef.current = false;
        if (clubScopeId !== response.data.club_id) {
          setClubScopeIdState(response.data.club_id);
        }

        lastLoadedClubPaletteRef.current = nextClubPaletteId;
        setRemoteClubPaletteId(nextClubPaletteId);
        lastLoadedTeamPaletteRef.current = nextTeamPaletteId;
        setTeamPaletteIdState(nextTeamPaletteId);
      })
      .catch(() => {
        if (!ignore) {
          teamScopeLoadingRef.current = false;
          lastLoadedTeamPaletteRef.current = null;
          setTeamPaletteIdState(null);
        }
      });

    return () => {
      ignore = true;
    };
  }, [clubScopeId, teamScopeId]);

  useEffect(() => {
    if (clubScopeId === null) return;
    if (clubScopeLoadingRef.current) return;
    if (lastLoadedClubPaletteRef.current === remoteClubPaletteId) return;

    api.put(`/clubs/${clubScopeId}/theme`, { palette_id: remoteClubPaletteId })
      .then(() => {
        lastLoadedClubPaletteRef.current = remoteClubPaletteId;
      })
      .catch(() => {
        // Keep the selected palette applied locally even if persistence fails.
      });
  }, [clubScopeId, remoteClubPaletteId]);

  useEffect(() => {
    if (teamScopeId === null) return;
    if (teamScopeLoadingRef.current) return;
    if (lastLoadedTeamPaletteRef.current === teamPaletteId) return;

    api.put(`/teams/${teamScopeId}/theme`, { palette_id: teamPaletteId })
      .then(() => {
        lastLoadedTeamPaletteRef.current = teamPaletteId;
      })
      .catch(() => {
        // Keep the local selection applied even if backend persistence fails.
      });
  }, [teamPaletteId, teamScopeId]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      themePreference,
      setThemePreference: setThemePreferenceState,
      paletteSelection,
      setPaletteSelection: setPaletteSelectionState,
      clubScopeId,
      setClubScopeId: (next) => {
        setClubScopeIdState(next);
        if (next === null) {
          setTeamScopeIdState(null);
          setTeamPaletteIdState(null);
        }
      },
      clubPaletteId,
      setClubPaletteId: (next) => {
        if (clubScopeId === null) {
          setLocalInheritedPaletteId(next);
          return;
        }

        setRemoteClubPaletteId(next);
      },
      teamScopeId,
      setTeamScopeId: (next) => {
        setTeamScopeIdState(next);
        if (next === null) {
          setTeamPaletteIdState(null);
        }
      },
      teamPaletteId,
      setTeamPaletteId: setTeamPaletteIdState,
      inheritedPaletteId,
      resolvedPaletteId,
      resolvedPalette: getThemePalette(resolvedPaletteId),
      availablePalettes: Object.values(THEME_PALETTES)
    }),
    [clubPaletteId, clubScopeId, inheritedPaletteId, paletteSelection, resolvedPaletteId, teamPaletteId, teamScopeId, themePreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
