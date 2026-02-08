import React from 'react';
import type { LeagueStanding } from '../types/competitions';

interface StandingsRowProps {
  standing: LeagueStanding;
  position: number;
  positionClass: string;
  isAdmin: boolean;
  isEditing: boolean;
  editingValue: string;
  onEditPoints: () => void;
  onSavePoints: () => void;
  onCancelPoints: () => void;
  onEditingValueChange: (value: string) => void;
}

const StandingsRow: React.FC<StandingsRowProps> = ({
  standing,
  position,
  positionClass,
  isAdmin,
  isEditing,
  editingValue,
  onEditPoints,
  onSavePoints,
  onCancelPoints,
  onEditingValueChange
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSavePoints();
    } else if (e.key === 'Escape') {
      onCancelPoints();
    }
  };

  return (
    <tr className={`standings-row ${positionClass}`}>
      <td className="position-col">{position}</td>
      <td className="team-col">{standing.team_name}</td>
      <td className="stat-col">{standing.games_played ?? 0}</td>
      <td className="stat-col">{standing.wins ?? 0}</td>
      <td className="stat-col">{standing.draws ?? 0}</td>
      <td className="stat-col">{standing.losses ?? 0}</td>
      <td className="stat-col">{standing.goals_for ?? 0}</td>
      <td className="stat-col">{standing.goals_against ?? 0}</td>
      <td className="stat-col">{standing.goal_difference ?? 0}</td>
      <td className={`points-col ${isEditing ? 'editing' : ''}`}>
        {isEditing ? (
          <div className="points-edit">
            <input
              type="number"
              value={editingValue}
              onChange={(e) => onEditingValueChange(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              min="0"
              className="points-input"
            />
            <div className="edit-actions">
              <button
                type="button"
                className="edit-btn save"
                onClick={onSavePoints}
                title="Save"
              >
                ✓
              </button>
              <button
                type="button"
                className="edit-btn cancel"
                onClick={onCancelPoints}
                title="Cancel"
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          <div className="points-display">
            <span className="points-value">{standing.points ?? 0}</span>
            {isAdmin && (
              <button
                type="button"
                className="edit-icon"
                onClick={onEditPoints}
                title="Edit points"
                aria-label="Edit points"
              >
                ✎
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
};

export default StandingsRow;
