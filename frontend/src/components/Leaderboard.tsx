import React from 'react';
import { List, type RowComponentProps } from 'react-window';
import type { LeaderboardPlayer } from '../types/achievements';
import '../styles/Leaderboard.css';

const VIRTUALIZATION_THRESHOLD = 100;
const LEADERBOARD_ROW_HEIGHT = 62;

type LeaderboardRowProps = {
  players: LeaderboardPlayer[];
  type: 'global' | 'team';
};

const getRankColor = (rank: number): string => {
  switch (rank) {
    case 1:
      return '#FFD700';
    case 2:
      return '#C0C0C0';
    case 3:
      return '#CD7F32';
    default:
      return '#6C757D';
  }
};

const getRankEmoji = (rank: number): string => {
  switch (rank) {
    case 1:
      return '🥇';
    case 2:
      return '🥈';
    case 3:
      return '🥉';
    default:
      return '';
  }
};

const LeaderboardVirtualRow = ({ index, style, players, type }: RowComponentProps<LeaderboardRowProps>): React.ReactElement => {
  const player = players[index];

  return (
    <div
      style={style}
      className={`leaderboard__virtual-row ${player.rank <= 3 ? 'leaderboard__virtual-row--podium' : ''}`}
      role="row"
    >
      <div className="leaderboard__virtual-cell leaderboard__virtual-cell--rank" role="cell">
        <span style={{ color: getRankColor(player.rank), fontWeight: player.rank <= 3 ? 700 : 500 }}>
          {getRankEmoji(player.rank) || `#${player.rank}`}
        </span>
      </div>
      <div className="leaderboard__virtual-cell leaderboard__virtual-cell--player" role="cell">
        {player.first_name} {player.last_name}
        {player.jersey_number ? <span className="leaderboard__player-number">#{player.jersey_number}</span> : null}
      </div>
      {type === 'global' && (
        <div className="leaderboard__virtual-cell leaderboard__virtual-cell--team" role="cell">{player.team_name || '-'}</div>
      )}
      <div className="leaderboard__virtual-cell leaderboard__virtual-cell--stat" role="cell">{player.total_shots}</div>
      <div className="leaderboard__virtual-cell leaderboard__virtual-cell--stat" role="cell">{player.total_goals}</div>
      <div className="leaderboard__virtual-cell leaderboard__virtual-cell--stat" role="cell">{player.fg_percentage.toFixed(1)}%</div>
      <div className="leaderboard__virtual-cell leaderboard__virtual-cell--points" role="cell">{player.achievement_points}</div>
      {type === 'team' && (
        <div className="leaderboard__virtual-cell leaderboard__virtual-cell--stat" role="cell">
          {player.achievements_earned ?? '-'}
        </div>
      )}
    </div>
  );
};

interface LeaderboardProps {
  players: LeaderboardPlayer[];
  type: 'global' | 'team';
  loading?: boolean;
  season?: string;
  teamName?: string;
}

const Leaderboard: React.FC<LeaderboardProps> = ({
  players,
  type,
  loading = false,
  season,
  teamName
}) => {
  const useVirtualization = players.length >= VIRTUALIZATION_THRESHOLD;

  if (loading) {
    return (
      <div className="leaderboard">
        <div className="leaderboard__header">
          <h3 className="leaderboard__title">
            {type === 'global' ? '🌍 Global Leaderboard' : `🏆 ${teamName || 'Team'} Leaderboard`}
          </h3>
          {season && <span className="leaderboard__season">{season}</span>}
        </div>
        <div className="leaderboard__loading" role="status" aria-live="polite">
          <div className="leaderboard__spinner"></div>
          <p>Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  if (players.length === 0) {
    return (
      <div className="leaderboard">
        <div className="leaderboard__header">
          <h3 className="leaderboard__title">
            {type === 'global' ? '🌍 Global Leaderboard' : `🏆 ${teamName || 'Team'} Leaderboard`}
          </h3>
          {season && <span className="leaderboard__season">{season}</span>}
        </div>
        <div className="leaderboard__empty" role="status" aria-live="polite">
          <p>No players found</p>
          <span className="leaderboard__empty-icon">📊</span>
        </div>
      </div>
    );
  }

  return (
    <div className="leaderboard">
      <div className="leaderboard__header">
        <h3 className="leaderboard__title">
          {type === 'global' ? '🌍 Global Leaderboard' : `🏆 ${teamName || 'Team'} Leaderboard`}
        </h3>
        {season && <span className="leaderboard__season">{season}</span>}
      </div>

      <div className="leaderboard__table-container">
        {!useVirtualization ? (
          <table className="leaderboard__table" aria-label={type === 'global' ? 'Global leaderboard' : `${teamName || 'Team'} leaderboard`}>
          <thead>
            <tr>
              <th className="leaderboard__th leaderboard__th--rank">Rank</th>
              <th className="leaderboard__th leaderboard__th--player">Player</th>
              {type === 'global' && (
                <th className="leaderboard__th leaderboard__th--team">Team</th>
              )}
              <th className="leaderboard__th leaderboard__th--stat">Shots</th>
              <th className="leaderboard__th leaderboard__th--stat">Goals</th>
              <th className="leaderboard__th leaderboard__th--stat">FG%</th>
              <th className="leaderboard__th leaderboard__th--stat">Points</th>
              {type === 'team' && (
                <th className="leaderboard__th leaderboard__th--stat">🏆</th>
              )}
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr 
                key={player.id}
                className={`leaderboard__row ${player.rank <= 3 ? 'leaderboard__row--podium' : ''}`}
              >
                <td className="leaderboard__td leaderboard__td--rank">
                  <div 
                    className="leaderboard__rank"
                    style={{ 
                      color: getRankColor(player.rank),
                      fontWeight: player.rank <= 3 ? 'bold' : 'normal'
                    }}
                  >
                    {getRankEmoji(player.rank) || `#${player.rank}`}
                  </div>
                </td>
                <td className="leaderboard__td leaderboard__td--player">
                  <div className="leaderboard__player">
                    <span className="leaderboard__player-name">
                      {player.first_name} {player.last_name}
                    </span>
                    {player.jersey_number && (
                      <span className="leaderboard__player-number">
                        #{player.jersey_number}
                      </span>
                    )}
                  </div>
                </td>
                {type === 'global' && (
                  <td className="leaderboard__td leaderboard__td--team">
                    {player.team_name || '-'}
                  </td>
                )}
                <td className="leaderboard__td leaderboard__td--stat">
                  {player.total_shots}
                </td>
                <td className="leaderboard__td leaderboard__td--stat">
                  {player.total_goals}
                </td>
                <td className="leaderboard__td leaderboard__td--stat leaderboard__td--highlight">
                  {player.fg_percentage.toFixed(1)}%
                </td>
                <td className="leaderboard__td leaderboard__td--stat leaderboard__td--points">
                  <span className="leaderboard__points">
                    {player.achievement_points}
                  </span>
                </td>
                {type === 'team' && player.achievements_earned !== undefined && (
                  <td className="leaderboard__td leaderboard__td--stat">
                    {player.achievements_earned}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          </table>
        ) : (
          <div className={`leaderboard__virtual ${type === 'team' ? 'leaderboard__virtual--team' : ''}`} role="table" aria-label={type === 'global' ? 'Global leaderboard' : `${teamName || 'Team'} leaderboard`}>
            <div className="leaderboard__virtual-header" role="rowgroup">
              <div className="leaderboard__virtual-row leaderboard__virtual-row--header" role="row">
                <div className="leaderboard__virtual-cell leaderboard__virtual-cell--rank" role="columnheader">Rank</div>
                <div className="leaderboard__virtual-cell leaderboard__virtual-cell--player" role="columnheader">Player</div>
                {type === 'global' && <div className="leaderboard__virtual-cell leaderboard__virtual-cell--team" role="columnheader">Team</div>}
                <div className="leaderboard__virtual-cell leaderboard__virtual-cell--stat" role="columnheader">Shots</div>
                <div className="leaderboard__virtual-cell leaderboard__virtual-cell--stat" role="columnheader">Goals</div>
                <div className="leaderboard__virtual-cell leaderboard__virtual-cell--stat" role="columnheader">FG%</div>
                <div className="leaderboard__virtual-cell leaderboard__virtual-cell--points" role="columnheader">Points</div>
                {type === 'team' && <div className="leaderboard__virtual-cell leaderboard__virtual-cell--stat" role="columnheader">🏆</div>}
              </div>
            </div>
            <List
              rowCount={players.length}
              rowHeight={LEADERBOARD_ROW_HEIGHT}
              rowComponent={LeaderboardVirtualRow}
              rowProps={{ players, type }}
              style={{ height: Math.min(620, players.length * LEADERBOARD_ROW_HEIGHT) }}
            />
          </div>
        )}
      </div>

      <div className="leaderboard__footer">
        <span className="leaderboard__footer-text">
          Showing {players.length} player{players.length !== 1 ? 's' : ''}
        </span>
        {type === 'global' && (
          <span className="leaderboard__footer-note">
            Minimum 10 shots required
          </span>
        )}
        {type === 'team' && (
          <span className="leaderboard__footer-note">
            Minimum 5 shots required
          </span>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
