import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import ExportDialog, { ExportFormat, ExportOptions } from './ExportDialog';

interface Player {
  id: number;
  team_id: number;
  first_name: string;
  last_name: string;
  jersey_number: number;
  is_active: boolean;
  gender?: 'male' | 'female';
  games_played?: number;
  goals?: number;
  total_shots?: number;
  team_name?: string;
}

interface Team {
  id: number;
  name: string;
}

const PlayerManagement: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('');
  const [showInactive, setShowInactive] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedGenderFilter, setSelectedGenderFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name' | 'jersey' | 'team' | 'goals'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [newPlayer, setNewPlayer] = useState({
    first_name: '',
    last_name: '',
    jersey_number: '',
    team_id: '',
    gender: ''
  });
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState<Set<number>>(new Set());

  const fetchTeams = async () => {
    try {
      const response = await api.get('/teams');
      setTeams(response.data);
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      console.error('Error fetching teams:', err.response?.data?.error || err.message);
    }
  };

  const fetchPlayers = async () => {
    try {
      const response = await api.get('/players');
      setPlayers(response.data);
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      console.error('Error fetching players:', err.response?.data?.error || err.message);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTeams();
    fetchPlayers();
  }, []);

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setValidationErrors({});

    // Client-side validation
    const errors: {[key: string]: string} = {};
    
    if (!newPlayer.first_name.trim()) {
      errors.first_name = 'First name is required';
    } else if (newPlayer.first_name.length < 2) {
      errors.first_name = 'First name must be at least 2 characters';
    } else if (!/^[a-zA-Z\s'-]+$/.test(newPlayer.first_name)) {
      errors.first_name = 'First name can only contain letters, spaces, hyphens, and apostrophes';
    }

    if (!newPlayer.last_name.trim()) {
      errors.last_name = 'Last name is required';
    } else if (newPlayer.last_name.length < 2) {
      errors.last_name = 'Last name must be at least 2 characters';
    } else if (!/^[a-zA-Z\s'-]+$/.test(newPlayer.last_name)) {
      errors.last_name = 'Last name can only contain letters, spaces, hyphens, and apostrophes';
    }

    if (!newPlayer.jersey_number) {
      errors.jersey_number = 'Jersey number is required';
    } else {
      const jerseyNum = parseInt(newPlayer.jersey_number);
      if (jerseyNum < 1 || jerseyNum > 99) {
        errors.jersey_number = 'Jersey number must be between 1 and 99';
      }
    }

    if (!newPlayer.team_id) {
      errors.team_id = 'Please select a team';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setError('Please fix the validation errors below');
      return;
    }

    try {
      const response = await api.post('/players', {
        ...newPlayer,
        jersey_number: parseInt(newPlayer.jersey_number),
        team_id: parseInt(newPlayer.team_id),
        gender: newPlayer.gender || null
      });
      setPlayers([...players, response.data]);
      setNewPlayer({
        first_name: '',
        last_name: '',
        jersey_number: '',
        team_id: '',
        gender: ''
      });
      setSuccess('Player added successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      const err = error as { response?: { data?: { error?: string; details?: string; validationErrors?: Array<{ path: string; msg: string }> } }; message?: string };
      
      // Handle server validation errors
      if (err.response?.data?.validationErrors) {
        const serverErrors: {[key: string]: string} = {};
        err.response.data.validationErrors.forEach((valError) => {
          serverErrors[valError.path] = valError.msg;
        });
        setValidationErrors(serverErrors);
      }
      
      const errorMessage = err.response?.data?.details || err.response?.data?.error || err.message || 'Failed to add player';
      setError(errorMessage);
      console.error('Error adding player:', err.response?.data || err.message);
    }
  };

  const handleEditPlayer = (player: Player) => {
    setEditingPlayer(player);
    setError('');
    setSuccess('');
    setValidationErrors({});
  };

  const handleUpdatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayer) return;

    setError('');
    setSuccess('');
    setValidationErrors({});

    // Client-side validation
    const errors: {[key: string]: string} = {};
    
    if (!editingPlayer.first_name.trim()) {
      errors.first_name = 'First name is required';
    } else if (editingPlayer.first_name.length < 2) {
      errors.first_name = 'First name must be at least 2 characters';
    } else if (!/^[a-zA-Z\s'-]+$/.test(editingPlayer.first_name)) {
      errors.first_name = 'First name can only contain letters, spaces, hyphens, and apostrophes';
    }

    if (!editingPlayer.last_name.trim()) {
      errors.last_name = 'Last name is required';
    } else if (editingPlayer.last_name.length < 2) {
      errors.last_name = 'Last name must be at least 2 characters';
    } else if (!/^[a-zA-Z\s'-]+$/.test(editingPlayer.last_name)) {
      errors.last_name = 'Last name can only contain letters, spaces, hyphens, and apostrophes';
    }

    if (editingPlayer.jersey_number < 1 || editingPlayer.jersey_number > 99) {
      errors.jersey_number = 'Jersey number must be between 1 and 99';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setError('Please fix the validation errors below');
      return;
    }

    try {
      const response = await api.put(`/players/${editingPlayer.id}`, {
        team_id: editingPlayer.team_id,
        first_name: editingPlayer.first_name,
        last_name: editingPlayer.last_name,
        jersey_number: editingPlayer.jersey_number,
        is_active: editingPlayer.is_active,
        gender: editingPlayer.gender || null
      });
      
      setPlayers(players.map(p => p.id === editingPlayer.id ? response.data : p));
      setEditingPlayer(null);
      setSuccess('Player updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      const err = error as { response?: { data?: { error?: string; details?: string; validationErrors?: Array<{ path: string; msg: string }> } }; message?: string };
      
      // Handle server validation errors
      if (err.response?.data?.validationErrors) {
        const serverErrors: {[key: string]: string} = {};
        err.response.data.validationErrors.forEach((valError) => {
          serverErrors[valError.path] = valError.msg;
        });
        setValidationErrors(serverErrors);
      }
      
      const errorMessage = err.response?.data?.details || err.response?.data?.error || err.message || 'Failed to update player';
      setError(errorMessage);
    }
  };

  const handleCancelEdit = () => {
    setEditingPlayer(null);
    setError('');
    setValidationErrors({});
  };

  const handleTogglePlayerStatus = async (player: Player, e: React.MouseEvent) => {
    e.preventDefault(); // Prevent form submission
    
    const action = player.is_active ? 'deactivate' : 'reactivate';
    const confirmMessage = player.is_active 
      ? `Are you sure you want to archive ${player.first_name} ${player.last_name}? They will be hidden from active rosters but their statistics will be preserved.`
      : `Reactivate ${player.first_name} ${player.last_name}?`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      await api.put(`/players/${player.id}`, {
        ...player,
        is_active: !player.is_active
      });
      
      await fetchPlayers();
      setEditingPlayer(null); // Close edit form after archiving/reactivating
      setSuccess(`Player ${action}d successfully!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      const err = error as { response?: { data?: { error?: string; details?: string } }; message?: string };
      const errorMessage = err.response?.data?.details || err.response?.data?.error || err.message || `Failed to ${action} player`;
      setError(errorMessage);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewPlayer(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (!editingPlayer) return;
    const { name, value } = e.target;
    
    setEditingPlayer(prev => {
      if (!prev) return prev;
      if (name === 'is_active') {
        return { ...prev, is_active: value === 'true' };
      }
      if (name === 'jersey_number') {
        return { ...prev, [name]: parseInt(value) };
      }
      return { ...prev, [name]: value };
    });
  };

  const handleExport = async (format: ExportFormat, options: ExportOptions) => {
    try {
      setError('');
      setSuccess('Generating player export...');
      
      // This would be an actual API call in production
      // const playerIds = selectedPlayers.size > 0 ? Array.from(selectedPlayers) : filteredPlayers.map(p => p.id);
      // await api.post('/exports/players', { format, options, playerIds });
      
      setTimeout(() => {
        setSuccess(`Player report generated successfully! Format: ${format.toUpperCase()}`);
        setSelectedPlayers(new Set());
      }, 1000);
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      setError(error.response?.data?.error || 'Error generating export');
    }
  };

  const handlePlayerSelection = (playerId: number) => {
    const newSelection = new Set(selectedPlayers);
    if (newSelection.has(playerId)) {
      newSelection.delete(playerId);
    } else {
      newSelection.add(playerId);
    }
    setSelectedPlayers(newSelection);
  };

  // Filter and sort players
  const filteredPlayers = players
    .filter(p => {
      // Team filter
      if (selectedTeamFilter && p.team_id.toString() !== selectedTeamFilter) return false;
      
      // Active status filter
      if (!showInactive && !p.is_active) return false;
      
      // Gender filter
      if (selectedGenderFilter && p.gender !== selectedGenderFilter) return false;
      
      // Search query (name or jersey number)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
        const jerseyMatch = p.jersey_number.toString().includes(query);
        if (!fullName.includes(query) && !jerseyMatch) return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`);
          break;
        case 'jersey':
          comparison = a.jersey_number - b.jersey_number;
          break;
        case 'team':
          comparison = (a.team_name || '').localeCompare(b.team_name || '');
          break;
        case 'goals':
          comparison = (a.goals || 0) - (b.goals || 0);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  return (
    <div className="player-management">
      <div className="player-management-header">
        <h2>Player Management</h2>
        <div className="header-actions">
          <button 
            className="secondary-button"
            onClick={() => setShowExportDialog(true)}
            disabled={filteredPlayers.length === 0}
          >
            📥 Export Report
            {selectedPlayers.size > 0 && ` (${selectedPlayers.size} selected)`}
          </button>
        </div>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      
      {/* Add New Player Form */}
      <div className="form-section">
        <h3>Add New Player</h3>
        <form onSubmit={handleAddPlayer} className="player-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="team_id">Team:</label>
              <select
                id="team_id"
                name="team_id"
                value={newPlayer.team_id}
                onChange={handleInputChange}
                required
                className={validationErrors.team_id ? 'error' : ''}
              >
                <option value="">Select a team</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
              {validationErrors.team_id && (
                <span className="field-error">{validationErrors.team_id}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="first_name">First Name:</label>
              <input
                id="first_name"
                type="text"
                name="first_name"
                value={newPlayer.first_name}
                onChange={handleInputChange}
                required
                className={validationErrors.first_name ? 'error' : ''}
              />
              {validationErrors.first_name && (
                <span className="field-error">{validationErrors.first_name}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="last_name">Last Name:</label>
              <input
                id="last_name"
                type="text"
                name="last_name"
                value={newPlayer.last_name}
                onChange={handleInputChange}
                required
                className={validationErrors.last_name ? 'error' : ''}
              />
              {validationErrors.last_name && (
                <span className="field-error">{validationErrors.last_name}</span>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="jersey_number">Jersey Number:</label>
              <input
                id="jersey_number"
                type="number"
                name="jersey_number"
                value={newPlayer.jersey_number}
                onChange={handleInputChange}
                min="1"
                max="99"
                required
                className={validationErrors.jersey_number ? 'error' : ''}
              />
              {validationErrors.jersey_number && (
                <span className="field-error">{validationErrors.jersey_number}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="gender">Gender:</label>
              <select
                id="gender"
                name="gender"
                value={newPlayer.gender}
                onChange={handleInputChange}
                className={validationErrors.gender ? 'error' : ''}
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              {validationErrors.gender && (
                <span className="field-error">{validationErrors.gender}</span>
              )}
            </div>
          </div>

          <button type="submit" className="primary-button">
            Add Player
          </button>
        </form>
      </div>

      {/* Edit Player Form */}
      {editingPlayer && (
        <div className="form-section editing-section">
          <h3>Edit Player</h3>
          <form onSubmit={handleUpdatePlayer} className="player-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="edit_team_id">Team:</label>
                <select
                  id="edit_team_id"
                  name="team_id"
                  value={editingPlayer.team_id}
                  onChange={handleEditInputChange}
                  required
                >
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="edit_first_name">First Name:</label>
                <input
                  id="edit_first_name"
                  type="text"
                  name="first_name"
                  value={editingPlayer.first_name}
                  onChange={handleEditInputChange}
                  required
                  className={validationErrors.first_name ? 'error' : ''}
                />
                {validationErrors.first_name && (
                  <span className="field-error">{validationErrors.first_name}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="edit_last_name">Last Name:</label>
                <input
                  id="edit_last_name"
                  type="text"
                  name="last_name"
                  value={editingPlayer.last_name}
                  onChange={handleEditInputChange}
                  required
                  className={validationErrors.last_name ? 'error' : ''}
                />
                {validationErrors.last_name && (
                  <span className="field-error">{validationErrors.last_name}</span>
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="edit_jersey_number">Jersey Number:</label>
                <input
                  id="edit_jersey_number"
                  type="number"
                  name="jersey_number"
                  value={editingPlayer.jersey_number}
                  onChange={handleEditInputChange}
                  min="1"
                  max="99"
                  required
                  className={validationErrors.jersey_number ? 'error' : ''}
                />
                {validationErrors.jersey_number && (
                  <span className="field-error">{validationErrors.jersey_number}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="edit_gender">Gender:</label>
                <select
                  id="edit_gender"
                  name="gender"
                  value={editingPlayer.gender || ''}
                  onChange={handleEditInputChange}
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="edit_is_active">Status:</label>
                <select
                  id="edit_is_active"
                  name="is_active"
                  value={editingPlayer.is_active.toString()}
                  onChange={handleEditInputChange}
                  required
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="primary-button">
                Update Player
              </button>
              <button type="button" onClick={handleCancelEdit} className="secondary-button">
                Cancel
              </button>
              <button
                type="button"
                className={`${editingPlayer.is_active ? 'archive-button' : 'reactivate-button'}`}
                onClick={(e) => handleTogglePlayerStatus(editingPlayer, e)}
              >
                {editingPlayer.is_active ? '🗄️ Archive Player' : '↩️ Reactivate Player'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Team Filter and Player List */}
      <div className="players-list-section">
        <div className="list-header">
          <h3>Players List</h3>
          
          {/* Search and Filters */}
          <div className="search-filters-container">
            <div className="search-box">
              <input
                type="text"
                placeholder="🔍 Search by name or jersey number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              {searchQuery && (
                <button
                  className="clear-search"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
            
            <div className="filters-row">
              <div className="filter-group">
                <label htmlFor="team_filter">Team:</label>
                <select
                  id="team_filter"
                  value={selectedTeamFilter}
                  onChange={(e) => setSelectedTeamFilter(e.target.value)}
                  className="filter-select"
                >
                  <option value="">All Teams</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="filter-group">
                <label htmlFor="gender_filter">Gender:</label>
                <select
                  id="gender_filter"
                  value={selectedGenderFilter}
                  onChange={(e) => setSelectedGenderFilter(e.target.value)}
                  className="filter-select"
                >
                  <option value="">All</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              
              <div className="filter-group">
                <label htmlFor="sort_by">Sort by:</label>
                <select
                  id="sort_by"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'name' | 'jersey' | 'team' | 'goals')}
                  className="filter-select"
                >
                  <option value="name">Name</option>
                  <option value="jersey">Jersey #</option>
                  <option value="team">Team</option>
                  <option value="goals">Goals</option>
                </select>
                <button
                  className="sort-order-btn"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
              
              <div className="status-filter">
                <label>
                  <input
                    type="checkbox"
                    checked={showInactive}
                    onChange={(e) => setShowInactive(e.target.checked)}
                  />
                  Show inactive
                </label>
              </div>
            </div>
            
            {/* Results count */}
            <div className="results-count">
              Showing {filteredPlayers.length} of {players.length} players
            </div>
          </div>
        </div>

        <div className="players-grid">
          {filteredPlayers.length === 0 ? (
            <p className="no-players">No players found.</p>
          ) : (
            filteredPlayers.map(player => {
              const shootingPercentage = player.total_shots && player.total_shots > 0
                ? Math.round((player.goals || 0) / player.total_shots * 100)
                : 0;
              
              return (
                <div 
                  key={player.id} 
                  className={`player-card ${!player.is_active ? 'inactive' : ''} ${editingPlayer?.id === player.id ? 'editing' : ''}`}
                  onClick={() => handleEditPlayer(player)}
                >
                  <div className="player-header">
                    <span className="player-name">
                      {player.first_name} {player.last_name}
                    </span>
                    <span className="player-number">#{player.jersey_number}</span>
                  </div>
                  <div className="player-details">
                    <span className="player-team">
                      {teams.find(team => team.id === player.team_id)?.name || 'Unknown Team'}
                    </span>
                    {player.gender && (
                      <span className="player-gender">
                        {player.gender === 'male' ? '♂️ Male' : '♀️ Female'}
                      </span>
                    )}
                    {!player.is_active && (
                      <span className="player-status-badge archived">Archived</span>
                    )}
                  </div>
                  
                  {/* Player Statistics */}
                  {(player.games_played || 0) > 0 && (
                    <div className="player-stats">
                      <div className="stat-item">
                        <span className="stat-label">Games</span>
                        <span className="stat-value">{player.games_played || 0}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Goals</span>
                        <span className="stat-value">{player.goals || 0}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Shots</span>
                        <span className="stat-value">{player.total_shots || 0}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Accuracy</span>
                        <span className="stat-value">{shootingPercentage}%</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {showExportDialog && (
        <ExportDialog
          isOpen={showExportDialog}
          onClose={() => setShowExportDialog(false)}
          onExport={handleExport}
          title={selectedPlayers.size > 0 ? `Export ${selectedPlayers.size} Selected Players` : 'Export Player Report'}
          dataType={selectedPlayers.size > 1 ? 'comparison' : 'player'}
        />
      )}
    </div>
  );
};

export default PlayerManagement;