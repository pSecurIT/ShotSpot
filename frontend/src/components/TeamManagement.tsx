import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import ExportDialog, { ExportFormat, ExportOptions } from './ExportDialog';

interface Team {
  id: number;
  name: string;
}

const TeamManagement: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

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
    fetchTeams();
  }, []);

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      const response = await api.post('/teams', {
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
    <div className="team-management-container">
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

      <div className="teams-list">
        <h3>Teams</h3>
        {teams.map(team => (
          <div key={team.id} className="team-item">
            <span>{team.name}</span>
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
        ))}
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