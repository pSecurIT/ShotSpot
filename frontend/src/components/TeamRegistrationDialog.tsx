import React, { useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
import type { Competition, CompetitionTeam } from '../types/competitions';
import { competitionsApi } from '../services/competitionsApi';

interface Team {
  id: number;
  name: string;
  club_id?: number;
  club_name?: string;
}

interface TeamRegistrationDialogProps {
  competition: Competition;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToBracket: (competitionId: number) => void;
}

const TeamRegistrationDialog: React.FC<TeamRegistrationDialogProps> = ({
  competition,
  isOpen,
  onClose,
  onNavigateToBracket,
}) => {
  const [availableTeams, setAvailableTeams] = useState<Team[]>([]);
  const [registeredTeams, setRegisteredTeams] = useState<CompetitionTeam[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const registeredTeamIds = useMemo(() => new Set(registeredTeams.map((t) => t.team_id)), [registeredTeams]);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      const [teamsResponse, registered] = await Promise.all([
        api.get<Team[]>('/teams'),
        competitionsApi.getTeams(competition.id),
      ]);

      setAvailableTeams(teamsResponse.data || []);
      setRegisteredTeams(registered);
    } catch (err) {
      const errorObj = err as { response?: { data?: { error?: string; details?: string } }; message?: string };
      setError(errorObj.response?.data?.error || errorObj.response?.data?.details || 'Failed to load teams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, competition.id]);

  if (!isOpen) return null;

  const handleAddTeam = async (teamId: number) => {
    try {
      setSubmitting(true);
      setError(null);
      await competitionsApi.addTeam(competition.id, teamId);
      const updated = await competitionsApi.getTeams(competition.id);
      setRegisteredTeams(updated);
    } catch (err) {
      const errorObj = err as { response?: { data?: { error?: string; details?: string } }; message?: string };
      setError(errorObj.response?.data?.error || errorObj.response?.data?.details || 'Failed to add team');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveTeam = async (teamId: number) => {
    try {
      setSubmitting(true);
      setError(null);
      await competitionsApi.removeTeam(competition.id, teamId);
      const updated = await competitionsApi.getTeams(competition.id);
      setRegisteredTeams(updated);
    } catch (err) {
      const errorObj = err as { response?: { data?: { error?: string; details?: string } }; message?: string };
      setError(errorObj.response?.data?.error || errorObj.response?.data?.details || 'Failed to remove team');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateBracket = async () => {
    try {
      setSubmitting(true);
      setError(null);
      await competitionsApi.generateBracket(competition.id);
      onNavigateToBracket(competition.id);
    } catch (err) {
      const errorObj = err as { response?: { data?: { error?: string; details?: string } }; message?: string };
      setError(errorObj.response?.data?.error || errorObj.response?.data?.details || 'Failed to generate bracket');
    } finally {
      setSubmitting(false);
    }
  };

  const canGenerateBracket = competition.type === 'tournament' && registeredTeams.length >= 4;

  return (
    <div
      className="competition-dialog__overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Manage Teams - ${competition.name}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="competition-dialog__content">
        <div className="competition-dialog__header">
          <h3>Manage Teams - {competition.name}</h3>
          <button type="button" className="secondary-button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {loading && <div>Loading…</div>}

        {!loading && (
          <div className="teams-layout">
            <div className="teams-panel">
              <h4>Available Teams</h4>
              <div className="teams-list" aria-label="Available Teams">
                {availableTeams.length === 0 && <div className="competition-card__muted">No teams found</div>}
                {availableTeams
                  .filter((t) => !registeredTeamIds.has(t.id))
                  .map((team) => (
                    <div key={team.id} className="team-item">
                      <span>{team.club_name ? `${team.club_name} — ${team.name}` : team.name}</span>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => handleAddTeam(team.id)}
                        disabled={submitting}
                      >
                        Add
                      </button>
                    </div>
                  ))}
              </div>
            </div>

            <div className="teams-panel">
              <h4>Registered Teams ({registeredTeams.length})</h4>
              <div className="teams-list" aria-label="Registered Teams">
                {registeredTeams.length === 0 && (
                  <div className="competition-card__muted">No teams registered</div>
                )}
                {registeredTeams.map((team) => (
                  <div key={team.team_id} className="team-item">
                    <span>{team.team_name}</span>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => handleRemoveTeam(team.team_id)}
                      disabled={submitting}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {canGenerateBracket && (
          <div className="competition-dialog__actions" style={{ justifyContent: 'space-between' }}>
            <div className="competition-card__muted">Minimum 4 teams met.</div>
            <button type="button" className="primary-button" onClick={handleGenerateBracket} disabled={submitting}>
              Generate Bracket
            </button>
          </div>
        )}

        <div className="competition-dialog__actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={submitting}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeamRegistrationDialog;
