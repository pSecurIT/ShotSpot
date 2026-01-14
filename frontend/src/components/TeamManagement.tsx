import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import ExportDialog, { ExportFormat, ExportOptions } from './ExportDialog';

interface Team {
  id: number;
  name: string;
  club_id?: number;
  club_name?: string;
}

interface Club {
  id: number;
  name: string;
}

const TeamManagement: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<number | null>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

  const fetchClubs = async () => {
    try {
      setError(null);
      const response = await api.get('/clubs');
      const fetchedClubs = (response.data || []) as Club[];
      setClubs(fetchedClubs);
      setSelectedClubId((current) => {
        if (current && fetchedClubs.some(c => c.id === current)) return current;
        return fetchedClubs.length > 0 ? fetchedClubs[0].id : null;
      });
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || 'Error fetching clubs');
      console.error('Error fetching clubs:', error);
    }
  };

  const fetchTeams = async () => {
    try {
      setError(null);
      const response = await api.get('/teams');
      setTeams(response.data);
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || 'Error fetching teams');
      console.error('Error fetching teams:', error);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchClubs();
    fetchTeams();
  }, []);

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClubId) {
      setError('Please select a club first');
      return;
    }
    try {
      setError(null);
      const response = await api.post('/teams', {
        club_id: selectedClubId,
        name: newTeamName
      });
      setTeams([...teams, response.data]);
      setNewTeamName('');
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || 'Error adding team');
      console.error('Error adding team:', error);
    }
  };

  const handleExport = async (format: ExportFormat, options: ExportOptions) => {
    try {
      setError(null);
      // This would be an actual API call in production
      // await api.post(`/exports/team/${selectedTeamId}`, { format, options });

      const teamName = teams.find(t => t.id === selectedTeamId)?.name || 'team';

      // Log the export parameters for debugging
      console.log('Export requested:', { teamId: selectedTeamId, teamName, format, options });
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || 'Error generating export');
    }
  };

  return (
    <div className="game-management-container team-management-container">
      <h2>Team Management</h2>

      {error && (
        <div className="error-message" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}
      
      <form onSubmit={handleAddTeam} className="team-management-form">
        <input
          type="text"
          value={newTeamName}
          onChange={(e) => setNewTeamName(e.target.value)}
          placeholder="Enter team name"
          required
        />
        <button type="submit" className="primary-button">Add Team</button>
      </form>

      <div className="create-game-form create-team-form">
        <h3>Create Team</h3>
        <form onSubmit={handleAddTeam}>
          <div className="form-field">
            <label htmlFor="new-team-club">Club</label>
            <select
              id="new-team-club"
              value={selectedClubId ?? ''}
              onChange={(e) => setSelectedClubId(Number(e.target.value))}
              required
              disabled={clubs.length === 0}
            >
              {clubs.length === 0 ? (
                <option value="">No clubs available</option>
              ) : (
                clubs.map((club) => (
                  <option key={club.id} value={club.id}>
                    {club.name}
                  </option>
                ))
              )}
            </select>
            {clubs.length === 0 && (
              <div className="empty-state">Create a club first to add teams.</div>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="new-team-name">Team name</label>
            <input
              id="new-team-name"
              type="text"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Enter team name"
              required
            />
          </div>

          <div className="game-actions">
            <button type="submit" className="primary-button" disabled={clubs.length === 0}>Add Team</button>
          </div>
        </form>
      </div>

      <div className="teams-list">
        <h3>Teams</h3>
        {teams.length === 0 ? (
          <div className="empty-state">No teams yet.</div>
        ) : (
          teams.map(team => (
            <div key={team.id} className="team-item">
              <span className="team-name">
                {team.club_name ? `${team.club_name} — ` : ''}{team.name}
              </span>
              <button
                className="secondary-button"
                onClick={() => {
                  setSelectedTeamId(team.id);
                  setShowExportDialog(true);
                }}
              >
                📥 Export Season Summary
              </button>
            </div>
          ))
        )}
      </div>

      {showExportDialog && selectedTeamId && (
        <ExportDialog
          isOpen={showExportDialog}
          onClose={() => {
            setShowExportDialog(false);
            setSelectedTeamId(null);
          }}
          onExport={handleExport}
          title={`Export ${teams.find(t => t.id === selectedTeamId)?.name} Season Summary`}
          dataType="team"
        />
      )}
    </div>
  );
};

export default TeamManagement;