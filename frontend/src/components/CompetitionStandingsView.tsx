import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { competitionsApi } from '../services/competitionsApi';
import type { LeagueStanding } from '../types/competitions';
import '../styles/CompetitionManagement.css';

const CompetitionStandingsView: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const competitionId = Number(id);

  const [standings, setStandings] = useState<LeagueStanding[]>([]);
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
        const data = await competitionsApi.getStandings(competitionId);
        setStandings(data);
      } catch (err) {
        const errorObj = err as { response?: { data?: { error?: string; details?: string } }; message?: string };
        setError(errorObj.response?.data?.error || errorObj.response?.data?.details || 'Failed to load standings');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [competitionId]);

  return (
    <div className="competition-management">
      <div className="competition-management__header">
        <h2>League Standings</h2>
        <button type="button" className="secondary-button" onClick={() => navigate('/competitions')}>
          Back
        </button>
      </div>

      {loading && <div>Loading standings…</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {!loading && !error && standings.length === 0 && <div className="empty-state">No standings available</div>}

      {!loading && !error && standings.length > 0 && (
        <div className="competition-card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.5rem' }}>#</th>
                <th style={{ textAlign: 'left', padding: '0.5rem' }}>Team</th>
                <th style={{ textAlign: 'right', padding: '0.5rem' }}>P</th>
                <th style={{ textAlign: 'right', padding: '0.5rem' }}>W</th>
                <th style={{ textAlign: 'right', padding: '0.5rem' }}>D</th>
                <th style={{ textAlign: 'right', padding: '0.5rem' }}>L</th>
                <th style={{ textAlign: 'right', padding: '0.5rem' }}>GF</th>
                <th style={{ textAlign: 'right', padding: '0.5rem' }}>GA</th>
                <th style={{ textAlign: 'right', padding: '0.5rem' }}>Pts</th>
              </tr>
            </thead>
            <tbody>
              {standings
                .slice()
                .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
                .map((row, index) => (
                  <tr key={row.team_id}>
                    <td style={{ padding: '0.5rem' }}>{index + 1}</td>
                    <td style={{ padding: '0.5rem' }}>{row.team_name}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{row.games_played ?? 0}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{row.wins ?? 0}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{row.draws ?? 0}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{row.losses ?? 0}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{row.goals_for ?? 0}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{row.goals_against ?? 0}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700 }}>{row.points ?? 0}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CompetitionStandingsView;
