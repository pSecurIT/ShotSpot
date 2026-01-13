import React from 'react';
import type { Club } from '../types/clubs';

interface ClubCardProps {
  club: Club;
  onEdit: (club: Club) => void;
  onDelete: (clubId: number) => void;
  onViewTeams: (clubId: number) => void;
  onViewPlayers: (clubId: number) => void;
}

const ClubCard: React.FC<ClubCardProps> = ({
  club,
  onEdit,
  onDelete,
  onViewTeams,
  onViewPlayers
}) => {
  return (
    <div className="club-card card" data-testid={`club-card-${club.id}`}
    >
      <div className="club-card__header">
        <h3 className="club-card__title">{club.name}</h3>
      </div>

      <div className="club-card__actions">
        <button type="button" className="secondary-button" onClick={() => onViewTeams(club.id)}>
          View Teams
        </button>
        <button type="button" className="secondary-button" onClick={() => onViewPlayers(club.id)}>
          View Players
        </button>
      </div>

      <div className="club-card__actions club-card__actions--secondary">
        <button type="button" className="secondary-button" onClick={() => onEdit(club)}>
          Edit
        </button>
        <button type="button" className="danger-button" onClick={() => onDelete(club.id)}>
          Delete
        </button>
      </div>
    </div>
  );
};

export default ClubCard;
