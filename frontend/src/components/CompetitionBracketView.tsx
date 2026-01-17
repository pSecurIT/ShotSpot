import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { competitionsApi } from '../services/competitionsApi';
import type { CompetitionTeam, TournamentBracket } from '../types/competitions';
import { TournamentBracket as TournamentBracketSvg } from './TournamentBracket';
import '../styles/CompetitionManagement.css';

const CompetitionBracketView: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const competitionId = Number(id);

  const [bracket, setBracket] = useState<TournamentBracket | null>(null);
  const [teams, setTeams] = useState<CompetitionTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        if (!Number.isFinite(competitionId) || competitionId <= 0) {
          setError('Invalid competition id');
          setLoading(false);
          return;
        }

        setLoading(true);
        setError(null);
        const [teamsData, bracketData] = await Promise.all([
          competitionsApi.getTeams(competitionId),
          competitionsApi.getBracket(competitionId),
        ]);
        setTeams(teamsData);
        setBracket(bracketData);
      } catch (err) {
        const errorObj = err as { response?: { data?: { error?: string; details?: string } }; message?: string };
        setError(errorObj.response?.data?.error || errorObj.response?.data?.details || 'Failed to load bracket');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [competitionId]);

  return (
    <div className="competition-management">
      <div className="competition-management__header">
        <h2>Tournament Bracket</h2>
        <button type="button" className="secondary-button" onClick={() => navigate('/competitions')}>
          Back
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        <button
          type="button"
          className="primary-button"
          disabled={busy || loading || !Number.isFinite(competitionId) || competitionId <= 0}
          onClick={async () => {
            try {
              setBusy(true);
              setError(null);
              const result = await competitionsApi.generateBracket(competitionId);
              // When online, backend may return a message payload; always refresh via GET.
              if ((result as { queued?: boolean })?.queued) {
                setError('Bracket generation queued (offline). Sync when online to see updates.');
                return;
              }
              const refreshed = await competitionsApi.getBracket(competitionId);
              setBracket(refreshed);
            } catch (err) {
              const errorObj = err as { response?: { data?: { error?: string; details?: string } }; message?: string };
              setError(errorObj.response?.data?.error || errorObj.response?.data?.details || 'Failed to generate bracket');
            } finally {
              setBusy(false);
            }
          }}
        >
          Generate / Regenerate Bracket
        </button>
      </div>

      {loading && <div>Loading bracket…</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {!loading && !error && bracket && (
        <div className="competition-card">
          {bracket.rounds.length === 0 && <div className="empty-state">No rounds available</div>}

          {bracket.rounds.length > 0 && (
            <TournamentBracketSvg
              bracket={bracket}
              teams={teams}
              onAssignTeam={async (matchId, side, teamId) => {
                try {
                  setBusy(true);
                  setError(null);
                  await competitionsApi.updateBracketMatch(competitionId, matchId, {
                    [side === 'home' ? 'home_team_id' : 'away_team_id']: teamId,
                  });
                  const refreshed = await competitionsApi.getBracket(competitionId);
                  setBracket(refreshed);
                } catch (err) {
                  const errorObj = err as { response?: { data?: { error?: string; details?: string } }; message?: string };
                  setError(errorObj.response?.data?.error || errorObj.response?.data?.details || 'Failed to assign team');
                } finally {
                  setBusy(false);
                }
              }}
              onSetWinner={async (matchId, winnerTeamId) => {
                try {
                  setBusy(true);
                  setError(null);
                  await competitionsApi.updateBracketMatch(competitionId, matchId, { winner_team_id: winnerTeamId });
                  const refreshed = await competitionsApi.getBracket(competitionId);
                  setBracket(refreshed);
                } catch (err) {
                  const errorObj = err as { response?: { data?: { error?: string; details?: string } }; message?: string };
                  setError(errorObj.response?.data?.error || errorObj.response?.data?.details || 'Failed to update match result');
                } finally {
                  setBusy(false);
                }
              }}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default CompetitionBracketView;
