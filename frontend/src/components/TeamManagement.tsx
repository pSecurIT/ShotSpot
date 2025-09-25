import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Team {
  id: number;
  name: string;
}

const TeamManagement: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [newTeamName, setNewTeamName] = useState('');

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/teams');
      setTeams(response.data);
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  };

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:3001/api/teams', {
        name: newTeamName
      });
      setTeams([...teams, response.data]);
      setNewTeamName('');
    } catch (error) {
      console.error('Error adding team:', error);
    }
  };

  return (
    <div>
      <h2>Team Management</h2>
      
      <form onSubmit={handleAddTeam}>
        <input
          type="text"
          value={newTeamName}
          onChange={(e) => setNewTeamName(e.target.value)}
          placeholder="Enter team name"
          required
        />
        <button type="submit">Add Team</button>
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