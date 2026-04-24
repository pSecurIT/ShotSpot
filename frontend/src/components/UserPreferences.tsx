import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import api from '../utils/api';
import type { Language } from '../types/settings';

const LANGUAGE_KEY = 'language';

interface ThemeTeamOption {
  id: number;
  name: string;
  club_id: number;
  club_name?: string | null;
}

interface ThemeClubOption {
  id: number;
  name: string;
}

function getPaletteName(paletteId: string | null, paletteOptions: Array<{ id: string; name: string }>): string {
  if (!paletteId) return 'Inherited';
  return paletteOptions.find((palette) => palette.id === paletteId)?.name ?? paletteId;
}

function getStoredLanguage(): Language {
  const raw = localStorage.getItem(LANGUAGE_KEY);
  if (raw === 'nl' || raw === 'fr') return raw;
  return 'en';
}

const UserPreferences: React.FC = () => {
  const { user } = useAuth();
  const {
    themePreference,
    setThemePreference,
    paletteSelection,
    setPaletteSelection,
    clubScopeId,
    setClubScopeId,
    clubPaletteId,
    setClubPaletteId,
    teamScopeId,
    setTeamScopeId,
    teamPaletteId,
    setTeamPaletteId,
    inheritedPaletteId,
    availablePalettes
  } = useTheme();
  const [clubs, setClubs] = useState<ThemeClubOption[]>([]);
  const [teams, setTeams] = useState<ThemeTeamOption[]>([]);
  const [language, setLanguage] = useState<Language>(getStoredLanguage);
  const [success, setSuccess] = useState('');

  const canManageClubTheme = user?.role === 'admin';
  const canManageTeamTheme = user?.role === 'admin' || user?.role === 'coach';
  const visibleTeams = clubScopeId ? teams.filter((team) => team.club_id === clubScopeId) : teams;
  const activePreviewPaletteId = teamPaletteId ?? inheritedPaletteId;
  const selectedClub = clubs.find((club) => club.id === clubScopeId) ?? null;
  const selectedTeam = teams.find((team) => team.id === teamScopeId) ?? null;
  const personalModeLabel = paletteSelection === 'team-default'
    ? `Following shared theme (${getPaletteName(inheritedPaletteId, availablePalettes)})`
    : `Using personal palette (${getPaletteName(paletteSelection, availablePalettes)})`;
  const clubModeLabel = clubScopeId === null
    ? `Browser only (${getPaletteName(clubPaletteId, availablePalettes)})`
    : `${selectedClub?.name ?? 'Selected club'} default (${getPaletteName(clubPaletteId, availablePalettes)})`;
  const teamModeLabel = teamScopeId === null
    ? 'No team override selected'
    : teamPaletteId === null
      ? `${selectedTeam?.name ?? 'Selected team'} inherits the club default`
      : `${selectedTeam?.name ?? 'Selected team'} override (${getPaletteName(teamPaletteId, availablePalettes)})`;

  useEffect(() => {
    let ignore = false;

    Promise.all([
      api.get<ThemeClubOption[]>('/clubs'),
      api.get<ThemeTeamOption[]>('/teams')
    ])
      .then(([clubsResponse, teamsResponse]) => {
        if (ignore) return;

        setClubs(clubsResponse.data);
        setTeams(teamsResponse.data);
      })
      .catch(() => {
        if (!ignore) {
          setClubs([]);
          setTeams([]);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (clubScopeId === null || teamScopeId === null) return;

    const selectedTeam = teams.find((team) => team.id === teamScopeId);
    if (selectedTeam && selectedTeam.club_id !== clubScopeId) {
      setTeamScopeId(null);
    }
  }, [clubScopeId, teamScopeId, teams, setTeamScopeId]);

  const handleSave = () => {
    localStorage.setItem(LANGUAGE_KEY, language);
    setSuccess('Preferences saved.');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleReset = () => {
    setThemePreference('system');
    setPaletteSelection('team-default');
    setClubScopeId(null);
    setClubPaletteId('shotspot-blue');
    setTeamScopeId(null);
    setTeamPaletteId(null);
    setLanguage('en');
    localStorage.setItem(LANGUAGE_KEY, 'en');
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

      <section className="settings-theme-flow" aria-label="Theme inheritance overview">
        <div className="settings-theme-flow__header">
          <h3>Theme hierarchy</h3>
          <p>Club sets the default, team can override it, and your personal preference can still take precedence.</p>
        </div>
        <div className="settings-theme-flow__grid">
          <article className="settings-theme-flow__card">
            <span className="settings-theme-flow__eyebrow">1. Club default</span>
            <strong>{clubModeLabel}</strong>
            <p>This is the shared base look for teams and players in the selected club.</p>
          </article>
          <article className="settings-theme-flow__card">
            <span className="settings-theme-flow__eyebrow">2. Team override</span>
            <strong>{teamModeLabel}</strong>
            <p>Trainers can optionally override the club default for one team.</p>
          </article>
          <article className="settings-theme-flow__card settings-theme-flow__card--accent">
            <span className="settings-theme-flow__eyebrow">3. Your view</span>
            <strong>{personalModeLabel}</strong>
            <p>Your personal palette only affects your own account.</p>
          </article>
        </div>
      </section>

      <section className="settings-group" aria-labelledby="settings-personal-theme">
        <div className="settings-group__header">
          <h3 id="settings-personal-theme">Your appearance</h3>
          <p>Choose whether you follow the shared club or team colors, or keep a personal palette.</p>
        </div>

        <div className="settings-field">
          <label htmlFor="pref-theme">Theme</label>
          <select
            id="pref-theme"
            value={themePreference}
            onChange={e => setThemePreference(e.target.value as 'system' | 'light' | 'dark')}
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
          <label htmlFor="pref-palette">Personal palette</label>
          <select
            id="pref-palette"
            value={paletteSelection}
            onChange={e => setPaletteSelection(e.target.value as 'team-default' | typeof availablePalettes[number]['id'])}
          >
            <option value="team-default">Follow club or team theme</option>
            {availablePalettes.map((palette) => (
              <option key={palette.id} value={palette.id}>{palette.name}</option>
            ))}
          </select>
          <p className="settings-field__help">
            Use this only if you want your own colors. Leaving it on shared mode keeps you aligned with your club or team.
          </p>
        </div>
      </section>

      <section className="settings-group" aria-labelledby="settings-shared-theme">
        <div className="settings-group__header">
          <h3 id="settings-shared-theme">Shared club and team colors</h3>
          <p>Pick the club first. Team overrides always sit on top of the selected club default.</p>
        </div>

        <div className="settings-field">
          <label htmlFor="pref-theme-club">Club theme source</label>
          <select
            id="pref-theme-club"
            value={clubScopeId ?? ''}
            onChange={e => setClubScopeId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">This device only</option>
            {clubs.map((club) => (
              <option key={club.id} value={club.id}>{club.name}</option>
            ))}
          </select>
          <p className="settings-field__help">
            The club theme is the shared default for all teams and players in that club.
          </p>
        </div>

        <div className="settings-field">
          <label htmlFor="pref-club-palette">Club default palette</label>
          <select
            id="pref-club-palette"
            value={clubPaletteId}
            onChange={e => setClubPaletteId(e.target.value as typeof availablePalettes[number]['id'])}
            disabled={!canManageClubTheme && clubScopeId !== null}
          >
            {availablePalettes.map((palette) => (
              <option key={palette.id} value={palette.id}>{palette.name}</option>
            ))}
          </select>
          <p className="settings-field__help">
            {clubScopeId === null
              ? 'Without a selected club this sets the browser-local fallback theme.'
              : canManageClubTheme
                ? 'Administrators can update the shared default palette for the selected club.'
                : 'This shows the shared default palette for the selected club.'}
          </p>
        </div>

        <div className="settings-field">
          <label htmlFor="pref-theme-team">Team theme source</label>
          <select
            id="pref-theme-team"
            value={teamScopeId ?? ''}
            onChange={e => setTeamScopeId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Inherit club theme only</option>
            {visibleTeams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.club_name ? `${team.club_name} - ${team.name}` : team.name}
              </option>
            ))}
          </select>
          <p className="settings-field__help">
            Select a team only when you want to inspect or manage a team-specific override.
          </p>
        </div>

        <div className="settings-field">
          <label htmlFor="pref-team-palette">Team override palette</label>
          <select
            id="pref-team-palette"
            value={teamPaletteId ?? ''}
            onChange={e => setTeamPaletteId(e.target.value ? (e.target.value as typeof availablePalettes[number]['id']) : null)}
            disabled={!teamScopeId || !canManageTeamTheme}
          >
            <option value="">Inherit club default</option>
            {availablePalettes.map((palette) => (
              <option key={palette.id} value={palette.id}>{palette.name}</option>
            ))}
          </select>
          <p className="settings-field__help">
            {!teamScopeId
              ? 'Pick a team first if you want to configure a team-level override.'
              : canManageTeamTheme
                ? 'Coaches and administrators can override the club default for the selected team.'
                : 'This shows whether the selected team inherits the club theme or uses its own override.'}
          </p>
        </div>
      </section>

      <div className="settings-field">
        <span className="settings-field__label">Palette preview</span>
        <div className="settings-palette-preview" aria-label="Theme palette preview">
          {availablePalettes.map((palette) => (
            <div key={palette.id} className={`settings-palette-chip${activePreviewPaletteId === palette.id ? ' settings-palette-chip--active' : ''}`}>
              <span className="settings-palette-chip__swatch" style={{ backgroundColor: palette.primary }} />
              <span className="settings-palette-chip__swatch" style={{ backgroundColor: palette.secondary }} />
              <span className="settings-palette-chip__swatch" style={{ backgroundColor: palette.accent }} />
              <span className="settings-palette-chip__label">{palette.name}</span>
            </div>
          ))}
        </div>
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

      <div className="settings-actions">
        <button className="primary-button" onClick={handleSave}>
          Save Preferences
        </button>
        <button className="secondary-button" onClick={handleReset}>
          Reset to Defaults
        </button>
      </div>
    </div>
  );
};

export default UserPreferences;
