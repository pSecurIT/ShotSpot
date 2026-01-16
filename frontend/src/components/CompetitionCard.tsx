import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Competition } from '../types/competitions';

interface CompetitionCardProps {
  competition: Competition;
  onEdit: (competition: Competition) => void;
  onDelete: (competitionId: number) => void;
  onManageTeams: (competition: Competition) => void;
}

const statusLabels: Record<Competition['status'], string> = {
  upcoming: 'Upcoming',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const CompetitionCard: React.FC<CompetitionCardProps> = ({ competition, onEdit, onDelete, onManageTeams }) => {
  const navigate = useNavigate();

  return (
    <div className="competition-card">
      <div className={`competition-card__badge competition-card__badge--${competition.status}`}>
        {competition.type === 'tournament' ? '🏆' : '📊'} {competition.type.toUpperCase()}
      </div>

      <h3 className="competition-card__title">{competition.name}</h3>

      <div className="competition-card__meta">
        <span className={`status status--${competition.status}`}>{statusLabels[competition.status]}</span>
        <span className="competition-card__date">
          {new Date(competition.start_date).toLocaleDateString()}
        </span>
        {typeof competition.team_count === 'number' && (
          <span className="competition-card__muted">Teams: {competition.team_count}</span>
        )}
      </div>

      <div className="competition-card__actions">
        {competition.type === 'tournament' && (
          <button type="button" className="secondary-button" onClick={() => navigate(`/competitions/${competition.id}/bracket`)}>
            View Bracket
          </button>
        )}
        {competition.type === 'league' && (
          <button type="button" className="secondary-button" onClick={() => navigate(`/competitions/${competition.id}/standings`)}>
            View Standings
          </button>
        )}
        <button type="button" className="secondary-button" onClick={() => onManageTeams(competition)}>
          Teams
        </button>
        <button type="button" className="secondary-button" onClick={() => onEdit(competition)}>
          Edit
        </button>
        <button type="button" className="danger-button" onClick={() => onDelete(competition.id)}>
          Delete
        </button>
      </div>
    </div>
  );
};

export default CompetitionCard;
