import React, { useState, useEffect } from 'react';
import api from '../utils/api';

interface Team {
  id: number;
  name: string;
}

const TeamManagement: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      setError(null);
      const response = await api.get('/teams');
      setTeams(response.data);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Error fetching teams');
      console.error('Error fetching teams:', error);
    }
  };

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      const response = await api.post('/teams', {
        name: newTeamName
      });
      setTeams([...teams, response.data]);
      setNewTeamName('');
    } catch (error: any) {
      setError(error.response?.data?.error || 'Error adding team');
      console.error('Error adding team:', error);
    }
  };

  return (
    <div>
      <h2>Team Management</h2>
      
      {error && (
        <div className="error-message" style={{ color: 'red', marginBottom: '1rem' }}>
          {error}
        </div>
      )}
      
      <form onSubmit={handleAddTeam}>
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
            {team.name}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TeamManagement;