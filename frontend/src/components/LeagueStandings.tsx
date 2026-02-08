import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { competitionsApi } from '../services/competitionsApi';
import type { LeagueStanding } from '../types/competitions';
import StandingsRow from './StandingsRow';
import '../styles/LeagueStandings.css';

interface SortConfig {
  key: keyof LeagueStanding | 'position';
  direction: 'asc' | 'desc';
}

interface LeagueStandingsProps {
  competitionId: number;
  promotionZones?: Array<{ from: number; to: number; type: 'promotion' | 'playoff' }>;
  relegationZone?: { from: number; to: number };
  onUpdate?: (standings: LeagueStanding[]) => void;
}

const LeagueStandings: React.FC<LeagueStandingsProps> = ({
  competitionId,
  promotionZones = [{ from: 1, to: 1, type: 'promotion' }],
  relegationZone = { from: 14, to: 14 },
  onUpdate
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'coach';

  const [standings, setStandings] = useState<LeagueStanding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'points', direction: 'desc' });
  const [editingPointId, setEditingPointId] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [gameIdInput, setGameIdInput] = useState<string>('');
  const [updateLoading, setUpdateLoading] = useState(false);

  const loadStandings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await competitionsApi.getStandings(competitionId);
      setStandings(data);
      onUpdate?.(data);
    } catch (err) {
      const errorObj = err as { response?: { data?: { error?: string; details?: string } }; message?: string };
      setError(errorObj.response?.data?.error || errorObj.response?.data?.details || 'Failed to load standings');
    } finally {
      setLoading(false);
    }
  }, [competitionId, onUpdate]);

  useEffect(() => {
    loadStandings();
  }, [loadStandings]);

  const handleSort = (key: keyof LeagueStanding | 'position') => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const sortedStandings = [...standings].sort((a, b) => {
    let aVal: unknown;
    let bVal: unknown;

    if (sortConfig.key === 'position') {
      aVal = standings.indexOf(a) + 1;
      bVal = standings.indexOf(b) + 1;
    } else {
      aVal = a[sortConfig.key];
      bVal = b[sortConfig.key];
    }

    // Handle null/undefined values
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return sortConfig.direction === 'asc' ? 1 : -1;
    if (bVal == null) return sortConfig.direction === 'asc' ? -1 : 1;

    // Compare values
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    } else if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }

    return 0;
  });

  const handlePointsEdit = (teamId: number, currentPoints: number) => {
    setEditingPointId(teamId);
    setEditingValue(String(currentPoints));
  };

  const handlePointsSave = async (teamId: number) => {
    const newPoints = parseInt(editingValue, 10);
    if (!Number.isFinite(newPoints) || newPoints < 0) {
      setError('Invalid points value');
      return;
    }

    try {
      setError(null);
      const response = await competitionsApi.updateStandingPoints(competitionId, teamId, newPoints);

      if (Array.isArray(response)) {
        setStandings(response);
        onUpdate?.(response);
      }

      setEditingPointId(null);
    } catch (err) {
      const errorObj = err as { response?: { data?: { error?: string } }; message?: string };
      setError(errorObj.response?.data?.error || 'Failed to update points');
    }
  };

  const handlePointsCancel = () => {
    setEditingPointId(null);
    setEditingValue('');
  };

  const exportToCSV = () => {
    const headers = ['Position', 'Team', 'GP', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Points'];
    const csvData = sortedStandings.map((standing, index) => [
      String(index + 1),
      standing.team_name,
      String(standing.games_played ?? 0),
      String(standing.wins ?? 0),
      String(standing.draws ?? 0),
      String(standing.losses ?? 0),
      String(standing.goals_for ?? 0),
      String(standing.goals_against ?? 0),
      String(standing.goal_difference ?? 0),
      String(standing.points ?? 0)
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `league_standings_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUpdateFromGame = async () => {
    const parsed = parseInt(gameIdInput, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Please enter a valid game ID');
      return;
    }

    try {
      setError(null);
      setUpdateLoading(true);
      const response = await competitionsApi.updateStandings(competitionId, parsed);
      if (Array.isArray(response)) {
        setStandings(response);
        onUpdate?.(response);
      }
    } catch (err) {
      const errorObj = err as { response?: { data?: { error?: string } }; message?: string };
      setError(errorObj.response?.data?.error || 'Failed to update standings');
    } finally {
      setUpdateLoading(false);
    }
  };

  const getPositionClass = (index: number): string => {
    const position = index + 1;
    const promotionZone = promotionZones?.find(z => position >= z.from && position <= z.to);
    if (promotionZone) {
      return `position-${promotionZone.type}`;
    }
    if (relegationZone && position >= relegationZone.from && position <= relegationZone.to) {
      return 'position-relegated';
    }
    return '';
  };

  const getSortIndicator = (key: keyof LeagueStanding | 'position') => {
    if (sortConfig.key !== key) return '';
    return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
  };

  return (
    <div className="league-standings">
      <div className="league-standings__header">
        <h2>League Standings</h2>
        <div className="league-standings__actions">
          <div className="league-standings__update">
            <label htmlFor="standings-game-id" className="sr-only">Game ID</label>
            <input
              id="standings-game-id"
              type="number"
              min="1"
              inputMode="numeric"
              value={gameIdInput}
              onChange={(e) => setGameIdInput(e.target.value)}
              placeholder="Game ID"
              aria-label="Game ID"
              disabled={updateLoading}
            />
            <button
              type="button"
              className="secondary-button"
              onClick={handleUpdateFromGame}
              disabled={updateLoading}
              title="Update standings from a game result"
            >
              {updateLoading ? 'Updating…' : 'Update from game'}
            </button>
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={exportToCSV}
            title="Export standings to CSV"
          >
            📥 Export CSV
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={loadStandings}
            title="Refresh standings"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {loading && <div className="league-standings__loading">Loading standings…</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {!loading && !error && standings.length === 0 && (
        <div className="league-standings__empty">No standings available yet</div>
      )}

      {!loading && !error && standings.length > 0 && (
        <div className="league-standings__container">
          <table className="league-standings__table">
            <thead>
              <tr>
                <th
                  className={`sortable ${sortConfig.key === 'position' ? 'active' : ''}`}
                  onClick={() => handleSort('position')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleSort('position');
                    }
                  }}
                >
                  {`#${getSortIndicator('position')}`}
                </th>
                <th
                  className={`sortable team-col ${sortConfig.key === 'team_name' ? 'active' : ''}`}
                  onClick={() => handleSort('team_name')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleSort('team_name');
                    }
                  }}
                >
                  {`Team${getSortIndicator('team_name')}`}
                </th>
                <th
                  className={`sortable ${sortConfig.key === 'games_played' ? 'active' : ''}`}
                  onClick={() => handleSort('games_played')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleSort('games_played');
                    }
                  }}
                  title="Games Played"
                >
                  {`GP${getSortIndicator('games_played')}`}
                </th>
                <th
                  className={`sortable ${sortConfig.key === 'wins' ? 'active' : ''}`}
                  onClick={() => handleSort('wins')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleSort('wins');
                    }
                  }}
                  title="Wins"
                >
                  {`W${getSortIndicator('wins')}`}
                </th>
                <th
                  className={`sortable ${sortConfig.key === 'draws' ? 'active' : ''}`}
                  onClick={() => handleSort('draws')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleSort('draws');
                    }
                  }}
                  title="Draws"
                >
                  {`D${getSortIndicator('draws')}`}
                </th>
                <th
                  className={`sortable ${sortConfig.key === 'losses' ? 'active' : ''}`}
                  onClick={() => handleSort('losses')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleSort('losses');
                    }
                  }}
                  title="Losses"
                >
                  {`L${getSortIndicator('losses')}`}
                </th>
                <th
                  className={`sortable ${sortConfig.key === 'goals_for' ? 'active' : ''}`}
                  onClick={() => handleSort('goals_for')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleSort('goals_for');
                    }
                  }}
                  title="Goals For"
                >
                  {`GF${getSortIndicator('goals_for')}`}
                </th>
                <th
                  className={`sortable ${sortConfig.key === 'goals_against' ? 'active' : ''}`}
                  onClick={() => handleSort('goals_against')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleSort('goals_against');
                    }
                  }}
                  title="Goals Against"
                >
                  {`GA${getSortIndicator('goals_against')}`}
                </th>
                <th
                  className={`sortable ${sortConfig.key === 'goal_difference' ? 'active' : ''}`}
                  onClick={() => handleSort('goal_difference')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleSort('goal_difference');
                    }
                  }}
                  title="Goal Difference"
                >
                  {`GD${getSortIndicator('goal_difference')}`}
                </th>
                <th
                  className={`sortable points-col ${sortConfig.key === 'points' ? 'active' : ''}`}
                  onClick={() => handleSort('points')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleSort('points');
                    }
                  }}
                  title="Points"
                >
                  {`Pts${getSortIndicator('points')}`}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedStandings.map((standing, index) => (
                <StandingsRow
                  key={standing.id}
                  standing={standing}
                  position={index + 1}
                  positionClass={getPositionClass(index)}
                  isEditing={editingPointId === standing.team_id}
                  editingValue={editingValue}
                  isAdmin={isAdmin}
                  onEditPoints={() => handlePointsEdit(standing.team_id, standing.points ?? 0)}
                  onSavePoints={() => handlePointsSave(standing.team_id)}
                  onCancelPoints={handlePointsCancel}
                  onEditingValueChange={setEditingValue}
                />
              ))}
            </tbody>
          </table>

          <div className="league-standings__legend">
            {promotionZones && promotionZones.length > 0 && (
              <div className="legend-item promotion">
                <span className="legend-color"></span>
                <span>
                  Promotion (Positions {promotionZones[0].from}-{promotionZones[0].to})
                </span>
              </div>
            )}
            {relegationZone && (
              <div className="legend-item relegated">
                <span className="legend-color"></span>
                <span>
                  Relegation (Positions {relegationZone.from}-{relegationZone.to})
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LeagueStandings;
