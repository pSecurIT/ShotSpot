import React, { useState, useEffect } from 'react';
import api from '../utils/api';

interface Player {
  id: number;
  team_id: number;
  first_name: string;
  last_name: string;
  jersey_number: number;
  role: string;
  is_active: boolean;
}

type PlayerRole = 'captain' | 'player';

interface Team {
  id: number;
  name: string;
}

const PlayerManagement: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [newPlayer, setNewPlayer] = useState({
    first_name: '',
    last_name: '',
    jersey_number: '',
    role: 'player',
    team_id: ''
  });

  useEffect(() => {
    fetchTeams();
    fetchPlayers();
  }, []);

  const fetchTeams = async () => {
    try {
      const response = await api.get('/teams');
      setTeams(response.data);
    } catch (error: any) {
      console.error('Error fetching teams:', error.response?.data?.error || error.message);
    }
  };

  const fetchPlayers = async () => {
    try {
      const response = await api.get('/players');
      setPlayers(response.data);
    } catch (error: any) {
      console.error('Error fetching players:', error.response?.data?.error || error.message);
    }
  };

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await api.post('/players', {
        ...newPlayer,
        jersey_number: parseInt(newPlayer.jersey_number),
        team_id: parseInt(newPlayer.team_id)
      });
      setPlayers([...players, response.data]);
      setNewPlayer({
        first_name: '',
        last_name: '',
        jersey_number: '',
        role: '',
        team_id: ''
      });
    } catch (error: any) {
      console.error('Error adding player:', error.response?.data?.error || error.message);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewPlayer(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div>
      <h2>Player Management</h2>
      
      <form onSubmit={handleAddPlayer}>
        <div>
          <label>Team:</label>
          <select
            name="team_id"
            value={newPlayer.team_id}
            onChange={handleInputChange}
            required
          >
            <option value="">Select a team</option>
            {teams.map(team => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label>First Name:</label>
          <input
            type="text"
            name="first_name"
            value={newPlayer.first_name}
            onChange={handleInputChange}
            required
          />
        </div>

        <div>
          <label>Last Name:</label>
          <input
            type="text"
            name="last_name"
            value={newPlayer.last_name}
            onChange={handleInputChange}
            required
          />
        </div>

        <div>
          <label>Jersey Number:</label>
          <input
            type="number"
            name="jersey_number"
            value={newPlayer.jersey_number}
            onChange={handleInputChange}
            required
          />
        </div>

        <div>
          <label>Role:</label>
          <select
            name="role"
            value={newPlayer.role}
            onChange={handleInputChange}
            required
          >
            <option value="Player">Player</option>
            <option value="Captain">Captain</option>
          </select>
        </div>

        <button type="submit" className="primary-button">
          Add Player
        </button>
      </form>

      <div className="players-list">
        <h3>Players</h3>
        {players.map(player => (
          <div key={player.id} className="player-item">
            {player.first_name} {player.last_name} - #{player.jersey_number} - {player.role}
            {teams.find(team => team.id === player.team_id)?.name && 
              ` - Team: ${teams.find(team => team.id === player.team_id)?.name}`}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlayerManagement;