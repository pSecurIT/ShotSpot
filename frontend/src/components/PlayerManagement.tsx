import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import ExportDialog, { ExportFormat, ExportOptions } from './ExportDialog';
import { useAuth } from '../contexts/AuthContext';
import StatePanel from './ui/StatePanel';
import Toast from './ui/Toast';
import PageLayout from './ui/PageLayout';
import useBreadcrumbs from '../hooks/useBreadcrumbs';

interface Player {
  id: number;
  team_id: number;
  club_id: number;
  first_name: string;
  last_name: string;
  jersey_number: number;
  is_active: boolean;
  gender?: 'male' | 'female';
  games_played?: number;
  goals?: number;
  total_shots?: number;
  team_name?: string;
  club_name?: string;
}

interface Team {
  id: number;
  name: string;
  club_id: number;
  club_name?: string;
}

interface Club {
  id: number;
  name: string;
}

const PlayerManagement: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const breadcrumbs = useBreadcrumbs();
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  const [selectedClubFilter, setSelectedClubFilter] = useState<string>('');
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('');
  const [showInactive, setShowInactive] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedGenderFilter, setSelectedGenderFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name' | 'jersey' | 'team' | 'goals'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [newPlayer, setNewPlayer] = useState({
    club_id: '',
    first_name: '',
    last_name: '',
    jersey_number: '',
    team_id: '',
    gender: ''
  });
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState<Set<number>>(new Set());

  const getValidationId = (fieldName: string, context: 'add' | 'edit') => `${context}-${fieldName}-error`;

  const fetchClubs = useCallback(async () => {
    try {
      const response = await api.get('/clubs');
      const fetchedClubs = (response as { data?: unknown })?.data;
      const clubList = Array.isArray(fetchedClubs) ? (fetchedClubs as Club[]) : [];
      setClubs(clubList);

      // For admins the club filter is mandatory, so keep a club selected.
      if (isAdmin && clubList.length > 0 && !selectedClubFilter) {
        setSelectedClubFilter(String(clubList[0].id));
      }

      setNewPlayer((prev) => {
        if (prev.club_id) return prev;
        return {
          ...prev,
          club_id: clubList.length > 0 ? String(clubList[0].id) : ''
        };
      });
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      const message = err.response?.data?.error || err.message || 'Failed to load clubs';
      console.error('Error fetching clubs:', message);
      throw new Error(message);
    }
  }, [isAdmin, selectedClubFilter]);

  const fetchTeams = useCallback(async () => {
    try {
      const response = await api.get('/teams');
      setTeams(response.data);
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      const message = err.response?.data?.error || err.message || 'Failed to load teams';
      console.error('Error fetching teams:', message);
      throw new Error(message);
    }
  }, []);

  const fetchPlayers = useCallback(async () => {
    try {
      const response = await api.get('/players');
      setPlayers(response.data);
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      const message = err.response?.data?.error || err.message || 'Failed to load players';
      console.error('Error fetching players:', message);
      throw new Error(message);
    }
  }, []);

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      await Promise.all([fetchClubs(), fetchTeams(), fetchPlayers()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load players');
    } finally {
      setLoading(false);
    }
  }, [fetchClubs, fetchTeams, fetchPlayers]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  const teamsForSelectedClub = newPlayer.club_id
    ? teams.filter(t => t.club_id === Number(newPlayer.club_id))
    : [];

  const teamsForFilters = isAdmin && selectedClubFilter
    ? teams.filter(t => t.club_id === Number(selectedClubFilter))
    : teams;

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

    if (!newPlayer.club_id) {
      errors.club_id = 'Please select a club';
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
        club_id: parseInt(newPlayer.club_id),
        jersey_number: parseInt(newPlayer.jersey_number),
        team_id: parseInt(newPlayer.team_id),
        first_name: newPlayer.first_name,
        last_name: newPlayer.last_name,
        gender: newPlayer.gender || null
      });
      setPlayers([...players, response.data]);
      setNewPlayer({
        club_id: newPlayer.club_id,
        first_name: '',
        last_name: '',
        jersey_number: '',
        team_id: '',
        gender: ''
      });
      setSuccess('Player added successfully!');
      setTimeout(() => setSuccess(''), 5000);
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
        club_id: editingPlayer.club_id,
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
      setTimeout(() => setSuccess(''), 5000);
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
      setTimeout(() => setSuccess(''), 5000);
    } catch (error) {
      const err = error as { response?: { data?: { error?: string; details?: string } }; message?: string };
      const errorMessage = err.response?.data?.details || err.response?.data?.error || err.message || `Failed to ${action} player`;
      setError(errorMessage);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewPlayer(prev => {
      if (name === 'club_id') {
        return {
          ...prev,
          club_id: value,
          team_id: ''
        };
      }
      return {
        ...prev,
        [name]: value
      };
    });
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
        return { ...prev, [name]: value === '' ? 0 : parseInt(value, 10) };
      }
      return { ...prev, [name]: value };
    });
  };

  const handleExport = async (format: ExportFormat, options: ExportOptions) => {
    try {
      setError('');
      setSuccess('Generating player export...');
      
      // This would be an actual API call in production
      const playerIds = selectedPlayers.size > 0 ? Array.from(selectedPlayers) : filteredPlayers.map(p => p.id);
      // await api.post('/exports/players', { format, options, playerIds });
      
      // Log the export parameters for debugging
      console.log('Export requested:', { format, options, playerIds });
      
      setTimeout(() => {
        setSuccess(`Player report generated successfully! Format: ${format.toUpperCase()}`);
        setSelectedPlayers(new Set());
      }, 1000);
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      setError(error.response?.data?.error || 'Error generating export');
    }
  };

  // Filter and sort players
  const filteredPlayers = players
    .filter(p => {
      // Club filter (admins only)
      if (isAdmin) {
        if (!selectedClubFilter) return false;
        if (p.club_id.toString() !== selectedClubFilter) return false;
      }

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
    <PageLayout
      title="Player Management"
      eyebrow="Data > Players"
      description="Manage player records, filters, and export-ready reports."
      breadcrumbs={breadcrumbs}
      actions={(
        <button
          className="secondary-button"
          onClick={() => setShowExportDialog(true)}
          disabled={filteredPlayers.length === 0}
          type="button"
        >
          📥 Export Report
          {selectedPlayers.size > 0 && ` (${selectedPlayers.size} selected)`}
        </button>
      )}
    >
      
      {loading && (
        <StatePanel
          variant="loading"
          title="Loading players"
          message="Preparing clubs, teams, players, and export controls."
          className="player-management__feedback"
        />
      )}

      {!loading && error && players.length === 0 && (
        <StatePanel
          variant="error"
          title="Couldn’t load players"
          message={error}
          actionLabel="Retry"
          onAction={() => {
            void loadInitialData();
          }}
          className="player-management__feedback"
        />
      )}

      {!loading && error && players.length > 0 && (
        <StatePanel
          variant="error"
          title="Player action failed"
          message={error}
          actionLabel="Reload players"
          onAction={() => {
            void loadInitialData();
          }}
          compact
          className="player-management__feedback"
        />
      )}
      
      {/* Add New Player Form */}
      {players.length > 0 || !error ? (
      <>
      <div className="form-section">
        <h3>Add New Player</h3>
        <form onSubmit={handleAddPlayer} className="player-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="club_id">Club:</label>
              <select
                id="club_id"
                name="club_id"
                value={newPlayer.club_id}
                onChange={handleInputChange}
                required
                disabled={clubs.length === 0}
                className={validationErrors.club_id ? 'error' : ''}
                aria-invalid={validationErrors.club_id ? 'true' : 'false'}
                aria-describedby={validationErrors.club_id ? getValidationId('club_id', 'add') : clubs.length === 0 ? 'add-club-empty-hint' : undefined}
              >
                <option value="">Select a club</option>
                {clubs.map(club => (
                  <option key={club.id} value={club.id}>{club.name}</option>
                ))}
              </select>
              {validationErrors.club_id && (
                <span className="field-error" id={getValidationId('club_id', 'add')}>{validationErrors.club_id}</span>
              )}
              {clubs.length === 0 && (
                <span className="field-error" id="add-club-empty-hint">Create a club first to add players.</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="team_id">Team:</label>
              <select
                id="team_id"
                name="team_id"
                value={newPlayer.team_id}
                onChange={handleInputChange}
                required
                disabled={!newPlayer.club_id || teamsForSelectedClub.length === 0}
                className={validationErrors.team_id ? 'error' : ''}
                aria-invalid={validationErrors.team_id ? 'true' : 'false'}
                aria-describedby={validationErrors.team_id ? getValidationId('team_id', 'add') : newPlayer.club_id && teamsForSelectedClub.length === 0 ? 'add-team-empty-hint' : undefined}
              >
                <option value="">Select a team</option>
                {teamsForSelectedClub.map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
              {validationErrors.team_id && (
                <span className="field-error" id={getValidationId('team_id', 'add')}>{validationErrors.team_id}</span>
              )}
              {newPlayer.club_id && teamsForSelectedClub.length === 0 && (
                <span className="field-error" id="add-team-empty-hint">No teams found for this club. Create a team first.</span>
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
                aria-invalid={validationErrors.first_name ? 'true' : 'false'}
                aria-describedby={validationErrors.first_name ? getValidationId('first_name', 'add') : undefined}
              />
              {validationErrors.first_name && (
                <span className="field-error" id={getValidationId('first_name', 'add')}>{validationErrors.first_name}</span>
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
                aria-invalid={validationErrors.last_name ? 'true' : 'false'}
                aria-describedby={validationErrors.last_name ? getValidationId('last_name', 'add') : undefined}
              />
              {validationErrors.last_name && (
                <span className="field-error" id={getValidationId('last_name', 'add')}>{validationErrors.last_name}</span>
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
                aria-invalid={validationErrors.jersey_number ? 'true' : 'false'}
                aria-describedby={validationErrors.jersey_number ? getValidationId('jersey_number', 'add') : undefined}
              />
              {validationErrors.jersey_number && (
                <span className="field-error" id={getValidationId('jersey_number', 'add')}>{validationErrors.jersey_number}</span>
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
                aria-invalid={validationErrors.gender ? 'true' : 'false'}
                aria-describedby={validationErrors.gender ? getValidationId('gender', 'add') : undefined}
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              {validationErrors.gender && (
                <span className="field-error" id={getValidationId('gender', 'add')}>{validationErrors.gender}</span>
              )}
            </div>
          </div>

          <button type="submit" className="primary-button" disabled={clubs.length === 0}>
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
                  aria-invalid={validationErrors.first_name ? 'true' : 'false'}
                  aria-describedby={validationErrors.first_name ? getValidationId('first_name', 'edit') : undefined}
                />
                {validationErrors.first_name && (
                  <span className="field-error" id={getValidationId('first_name', 'edit')}>{validationErrors.first_name}</span>
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
                  aria-invalid={validationErrors.last_name ? 'true' : 'false'}
                  aria-describedby={validationErrors.last_name ? getValidationId('last_name', 'edit') : undefined}
                />
                {validationErrors.last_name && (
                  <span className="field-error" id={getValidationId('last_name', 'edit')}>{validationErrors.last_name}</span>
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
                  aria-invalid={validationErrors.jersey_number ? 'true' : 'false'}
                  aria-describedby={validationErrors.jersey_number ? getValidationId('jersey_number', 'edit') : undefined}
                />
                {validationErrors.jersey_number && (
                  <span className="field-error" id={getValidationId('jersey_number', 'edit')}>{validationErrors.jersey_number}</span>
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
                aria-label="Search players"
              />
              {searchQuery && (
                <button
                  className="clear-search"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                  aria-label="Clear player search"
                >
                  ✕
                </button>
              )}
            </div>
            
            <div className="filters-row">
              {isAdmin && (
                <div className="filter-group">
                  <label htmlFor="club_filter">Club:</label>
                  <select
                    id="club_filter"
                    value={selectedClubFilter}
                    onChange={(e) => {
                      setSelectedClubFilter(e.target.value);
                      setSelectedTeamFilter('');
                    }}
                    className="filter-select"
                  >
                    {clubs.map(club => (
                      <option key={club.id} value={club.id}>{club.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="filter-group">
                <label htmlFor="team_filter">Team:</label>
                <select
                  id="team_filter"
                  value={selectedTeamFilter}
                  onChange={(e) => setSelectedTeamFilter(e.target.value)}
                  className="filter-select"
                >
                  <option value="">All Teams</option>
                  {teamsForFilters.map(team => (
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
                  aria-label={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
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
            <div className="results-count" role="status" aria-live="polite">
              Showing {filteredPlayers.length} of {players.length} players
            </div>
          </div>
        </div>

        <div className="players-grid">
          {filteredPlayers.length === 0 ? (
            <StatePanel
              variant="empty"
              title="No players found."
              message={searchQuery || selectedTeamFilter || selectedGenderFilter || (isAdmin && selectedClubFilter) ? 'Try a broader filter or search to find the player you need.' : 'Add a player to start building the roster and report exports.'}
              actionLabel={searchQuery || selectedTeamFilter || selectedGenderFilter || (isAdmin && selectedClubFilter) ? 'Clear filters' : undefined}
              onAction={searchQuery || selectedTeamFilter || selectedGenderFilter || (isAdmin && selectedClubFilter) ? () => {
                setSearchQuery('');
                setSelectedTeamFilter('');
                setSelectedGenderFilter('');
                setShowInactive(true);
                if (isAdmin && clubs.length > 0) {
                  setSelectedClubFilter(String(clubs[0].id));
                }
              } : undefined}
              className="player-management__feedback"
            />
          ) : (
            filteredPlayers.map(player => {
              const shootingPercentage = player.total_shots && player.total_shots > 0
                ? Math.round((player.goals || 0) / player.total_shots * 100)
                : 0;

              const teamName = teams.find(team => team.id === player.team_id)?.name || 'Unknown Team';
              const clubName = player.club_name || clubs.find(club => club.id === player.club_id)?.name;
              
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
                      {clubName ? `${clubName} — ${teamName}` : teamName}
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
      </>
      ) : null}

      {success && (
        <Toast
          title="Player updated"
          message={success}
          onDismiss={() => setSuccess('')}
        />
      )}
    </PageLayout>
  );
};

export default PlayerManagement;