import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import ExportDialog, { ExportFormat, ExportOptions } from './ExportDialog';
import { useAuth } from '../contexts/AuthContext';

interface Team {
  id: number;
  name: string;
  club_id?: number;
  club_name?: string;
  age_group?: string | null;
  gender?: 'male' | 'female' | 'mixed' | null;
  is_active?: boolean;
}

interface Club {
  id: number;
  name: string;
}

const TeamManagement: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [teams, setTeams] = useState<Team[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<number | null>(null);
  const [selectedClubFilter, setSelectedClubFilter] = useState<string>('');
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('');
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamAgeGroup, setNewTeamAgeGroup] = useState('');
  const [newTeamGender, setNewTeamGender] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

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

  const filteredTeams = teams.filter((team) => {
    if (selectedClubFilter && team.club_id?.toString() !== selectedClubFilter) return false;
    if (selectedTeamFilter && team.id.toString() !== selectedTeamFilter) return false;
    return true;
  });

  const filterTeamOptions = selectedClubFilter
    ? teams.filter((team) => team.club_id?.toString() === selectedClubFilter)
    : teams;

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClubId) {
      setError('Please select a club first');
      return;
    }

    const trimmedTeamName = newTeamName.trim();
    if (!trimmedTeamName) {
      setError('Team name is required');
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      const selectedClub = clubs.find((club) => club.id === selectedClubId);
      const response = await api.post('/teams', {
        club_id: selectedClubId,
        name: trimmedTeamName,
        age_group: newTeamAgeGroup || null,
        gender: newTeamGender || null,
      });
      setTeams((current) => [...current, { ...response.data, club_name: response.data.club_name || selectedClub?.name }]);
      setNewTeamName('');
      setNewTeamAgeGroup('');
      setNewTeamGender('');
      setSuccess('Team created successfully!');
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || 'Error adding team');
      console.error('Error adding team:', error);
    }
  };

  const handleEditTeam = (team: Team) => {
    setEditingTeam({ ...team });
    setError(null);
    setSuccess(null);
  };

  const handleUpdateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam) return;

    const trimmedTeamName = editingTeam.name.trim();
    if (!trimmedTeamName) {
      setError('Team name is required');
      return;
    }

    if (isAdmin && !editingTeam.club_id) {
      setError('Please select a club first');
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      const normalizedGender = editingTeam.gender === 'male' || editingTeam.gender === 'female' || editingTeam.gender === 'mixed'
        ? editingTeam.gender
        : null;
      const normalizedAgeGroup = typeof editingTeam.age_group === 'string' && editingTeam.age_group.length <= 20
        ? editingTeam.age_group
        : null;

      const updatePayload: {
        name: string;
        age_group: string | null;
        gender: Team['gender'];
        is_active: boolean;
        club_id?: number;
      } = {
        name: trimmedTeamName,
        age_group: normalizedAgeGroup,
        gender: normalizedGender,
        is_active: editingTeam.is_active ?? true,
      };

      if (isAdmin && editingTeam.club_id) {
        updatePayload.club_id = editingTeam.club_id;
      }

      const response = await api.put(`/teams/${editingTeam.id}`, {
        ...updatePayload,
      });
      const updatedTeam = response.data;
      const updatedClubName = clubs.find((club) => club.id === (updatedTeam.club_id ?? editingTeam.club_id))?.name || editingTeam.club_name;
      setTeams((current) => current.map((team) => (team.id === editingTeam.id ? { ...team, ...updatedTeam, club_name: updatedClubName } : team)));
      setEditingTeam(null);
      setSuccess('Team updated successfully!');
    } catch (error) {
      const err = error as { response?: { data?: { error?: string; details?: string } }; message?: string };
      setError(err.response?.data?.details || err.response?.data?.error || 'Error updating team');
    }
  };

  const handleDeleteTeam = async (team: Team) => {
    const confirmDelete = window.confirm(`Delete ${team.name}? This cannot be undone.`);
    if (!confirmDelete) return;

    try {
      setError(null);
      setSuccess(null);
      await api.delete(`/teams/${team.id}`);
      setTeams((current) => current.filter((item) => item.id !== team.id));
      setSelectedTeamId((current) => (current === team.id ? null : current));
      setEditingTeam(null);
      setSuccess('Team removed successfully!');
    } catch (error) {
      const err = error as { response?: { data?: { error?: string; details?: string } }; message?: string };
      setError(err.response?.data?.details || err.response?.data?.error || 'Error removing team');
    }
  };

  const handleCancelEdit = () => {
    setEditingTeam(null);
    setError(null);
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
      <div className="player-management-header">
        <h2>Team Management</h2>
        <div className="header-actions">
          <button 
            className="secondary-button"
            onClick={() => setShowExportDialog(true)}
            disabled={!selectedTeamId}
          >
            📥 Export Season Summary
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {success && (
        <div className="success-message" style={{ marginBottom: '1rem' }}>
          {success}
        </div>
      )}

      <div className="create-game-form create-team-form">
        <h3>Create Team</h3>
        <form onSubmit={handleAddTeam}>
          <div className="form-field">
            <label htmlFor="new-team-club">Club <span aria-hidden="true">*</span></label>
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
            <label htmlFor="new-team-name">Team name <span aria-hidden="true">*</span></label>
            <input
              id="new-team-name"
              type="text"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Enter team name"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="new-team-age-group">Age group</label>
              <input
                id="new-team-age-group"
                type="text"
                value={newTeamAgeGroup}
                onChange={(e) => setNewTeamAgeGroup(e.target.value)}
                placeholder="e.g. U17"
              />
            </div>

            <div className="form-group">
              <label htmlFor="new-team-gender">Gender</label>
              <select
                id="new-team-gender"
                value={newTeamGender}
                onChange={(e) => setNewTeamGender(e.target.value)}
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>
          </div>

          <div className="game-actions">
            <button type="submit" className="primary-button" disabled={clubs.length === 0}>Add Team</button>
          </div>
        </form>
      </div>

      {editingTeam && (
        <div className="form-section editing-section">
          <h3>Edit Team</h3>
          <form onSubmit={handleUpdateTeam} className="player-form">
            <div className="form-row">
              {isAdmin && (
                <div className="form-group">
                  <label htmlFor="edit-team-club">Club <span aria-hidden="true">*</span></label>
                  <select
                    id="edit-team-club"
                    value={editingTeam.club_id || ''}
                    onChange={(e) => setEditingTeam((current) => current ? { ...current, club_id: Number(e.target.value) } : current)}
                    required
                  >
                    {clubs.map((club) => (
                      <option key={club.id} value={club.id}>{club.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="edit-team-name">Team name <span aria-hidden="true">*</span></label>
                <input
                  id="edit-team-name"
                  type="text"
                  value={editingTeam.name}
                  onChange={(e) => setEditingTeam((current) => current ? { ...current, name: e.target.value } : current)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-team-age-group">Age group</label>
                <input
                  id="edit-team-age-group"
                  type="text"
                  value={editingTeam.age_group || ''}
                  onChange={(e) => setEditingTeam((current) => current ? { ...current, age_group: e.target.value } : current)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-team-gender">Gender</label>
                <select
                  id="edit-team-gender"
                  value={editingTeam.gender || ''}
                  onChange={(e) => setEditingTeam((current) => current ? { ...current, gender: (e.target.value || null) as Team['gender'] } : current)}
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="primary-button">Update Team</button>
              <button type="button" className="secondary-button" onClick={handleCancelEdit}>Cancel</button>
              <button type="button" className="archive-button" onClick={() => handleDeleteTeam(editingTeam)}>
                🗑️ Remove Team
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="players-list-section">
        <div className="list-header">
          <h3>Teams</h3>
          <div className="search-filters-container">
            <div className="filters-row">
              <div className="filter-group">
                <label htmlFor="club_filter">Club</label>
                <select
                  id="club_filter"
                  value={selectedClubFilter}
                  onChange={(e) => {
                    setSelectedClubFilter(e.target.value);
                    setSelectedTeamFilter('');
                  }}
                  className="filter-select"
                >
                  <option value="">All Clubs</option>
                  {clubs.map((club) => (
                    <option key={club.id} value={club.id}>{club.name}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label htmlFor="team_filter">Team</label>
                <select
                  id="team_filter"
                  value={selectedTeamFilter}
                  onChange={(e) => setSelectedTeamFilter(e.target.value)}
                  className="filter-select"
                >
                  <option value="">All Teams</option>
                  {filterTeamOptions.map((team) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="results-count">
              Showing {filteredTeams.length} of {teams.length} teams
            </div>
          </div>
        </div>

        <div className="team-grid">
          {filteredTeams.length === 0 ? (
            <div className="empty-state">No teams found.</div>
          ) : (
            filteredTeams.map((team) => (
              <div
                key={team.id}
                className={`team-card ${editingTeam?.id === team.id ? 'editing' : ''} ${(team.is_active ?? true) ? '' : 'inactive'}`}
                onClick={() => handleEditTeam(team)}
              >
                <div className="player-header">
                  <span className="player-name">{team.name}</span>
                  <span className="player-number">#{team.id}</span>
                </div>
                <div className="player-details">
                  <span className="player-team">{team.club_name || 'Unknown Club'}</span>
                  {team.age_group && <span className="player-role">Age Group: {team.age_group}</span>}
                  {team.gender && <span className="player-gender">{team.gender}</span>}
                  {team.is_active === false && <span className="player-status-badge archived">Inactive</span>}
                </div>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
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