import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { competitionsApi } from '../services/competitionsApi';
import type { TournamentBracket } from '../types/competitions';
import '../styles/CompetitionManagement.css';

const CompetitionBracketView: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const competitionId = Number(id);

  const [bracket, setBracket] = useState<TournamentBracket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        const data = await competitionsApi.getBracket(competitionId);
        setBracket(data);
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

      {loading && <div>Loading bracket…</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {!loading && !error && bracket && (
        <div className="competition-card">
          {bracket.rounds.length === 0 && <div className="empty-state">No rounds available</div>}

          {bracket.rounds.map((round) => (
            <div key={round.round_number} style={{ marginTop: '1rem' }}>
              <h3 style={{ marginBottom: '0.5rem' }}>Round {round.round_number}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {round.matches.map((match) => (
                  <div key={match.id} className="team-item">
                    <span>
                      {match.home_team_name ?? 'TBD'} vs {match.away_team_name ?? 'TBD'}
                    </span>
                    <span className="competition-card__muted">
                      {typeof match.home_score === 'number' || typeof match.away_score === 'number'
                        ? `${match.home_score ?? '-'} - ${match.away_score ?? '-'}`
                        : 'Not played'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CompetitionBracketView;
