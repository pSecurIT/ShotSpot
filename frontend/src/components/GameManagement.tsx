import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

interface Team {
  id: number;
  name: string;
}

interface Game {
  id: number;
  home_team_id: number;
  away_team_id: number;
  home_team_name: string;
  away_team_name: string;
  date: string;
  status: 'scheduled' | 'to_reschedule' | 'in_progress' | 'completed' | 'cancelled';
  home_score: number;
  away_score: number;
  created_at: string;
  updated_at: string;
}

interface MatchTemplate {
  id: number;
  name: string;
  description: string | null;
  number_of_periods: number;
  period_duration_minutes: number;
  competition_type: string | null;
  is_system_template: boolean;
}

const GameManagement: React.FC = () => {
  const navigate = useNavigate();
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [templates, setTemplates] = useState<MatchTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  
  // Form state for creating new game
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [newGame, setNewGame] = useState({
    home_team_id: '',
    away_team_id: '',
    date: ''
  });

  // Reschedule modal state
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleGameId, setRescheduleGameId] = useState<number | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');

  const fetchTemplates = useCallback(async () => {
    try {
      const response = await api.get('/match-templates');
      setTemplates(response.data);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  }, []);

  const fetchTeams = useCallback(async () => {
    try {
      const response = await api.get('/teams');
      setTeams(response.data);
    } catch (error) {
      console.error('Error fetching teams:', error);
      setError('Failed to fetch teams');
    }
  }, []);

  const fetchGames = useCallback(async () => {
    try {
      setError(null);
      const params = filterStatus ? { status: filterStatus } : {};
      const response = await api.get('/games', { params });
      setGames(response.data);
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || 'Error fetching games');
      console.error('Error fetching games:', error);
    }
  }, [filterStatus]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTeams();
    fetchGames();
    fetchTemplates();
  }, [fetchTeams, fetchGames, fetchTemplates]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchGames();
  }, [filterStatus, fetchGames]);

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!newGame.home_team_id || !newGame.away_team_id || !newGame.date) {
      setError('All fields are required');
      return;
    }

    if (newGame.home_team_id === newGame.away_team_id) {
      setError('Home and away teams must be different');
      return;
    }

    try {
      // Create the game first
      const response = await api.post('/games', {
        home_team_id: parseInt(newGame.home_team_id),
        away_team_id: parseInt(newGame.away_team_id),
        date: new Date(newGame.date).toISOString()
      });
      
      const createdGame = response.data;
      
      // Apply template if selected
      if (selectedTemplate) {
        try {
          await api.post(`/match-templates/${selectedTemplate}/apply-to-game/${createdGame.id}`);
          // Re-fetch the game to get updated data with template applied
          const updatedResponse = await api.get(`/games/${createdGame.id}`);
          setGames([updatedResponse.data, ...games]);
          setSuccess('Game created with template applied successfully');
        } catch (templateErr) {
          console.error('Error applying template:', templateErr);
          // Game was created but template failed, still show the game
          setGames([createdGame, ...games]);
          setSuccess('Game created, but template could not be applied');
        }
      } else {
        setGames([createdGame, ...games]);
        setSuccess('Game created successfully');
      }
      
      setNewGame({ home_team_id: '', away_team_id: '', date: '' });
      setSelectedTemplate('');
      setShowCreateForm(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || 'Error creating game');
      console.error('Error creating game:', error);
    }
  };

  const handleEndGame = async (gameId: number) => {
    try {
      setError(null);
      setSuccess(null);
      const response = await api.post(`/games/${gameId}/end`, {});
      setGames(games.map(game => game.id === gameId ? response.data : game));
      setSuccess('Game ended successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || 'Error ending game');
    }
  };

  const handleCancelGame = async (gameId: number) => {
    if (typeof window !== 'undefined' && !window.confirm('Are you sure you want to cancel this game?')) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      const response = await api.post(`/games/${gameId}/cancel`, {});
      setGames(games.map(game => game.id === gameId ? response.data : game));
      setSuccess('Game cancelled successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || 'Error cancelling game');
    }
  };

  const openRescheduleModal = (gameId: number) => {
    setRescheduleGameId(gameId);
    setRescheduleDate('');
    setShowRescheduleModal(true);
  };

  const closeRescheduleModal = () => {
    setShowRescheduleModal(false);
    setRescheduleGameId(null);
    setRescheduleDate('');
  };

  const handleRescheduleGame = async (withDate: boolean) => {
    if (!rescheduleGameId) return;

    try {
      setError(null);
      setSuccess(null);
      
      const body = withDate && rescheduleDate 
        ? { game_date: rescheduleDate }
        : {};
      
      const response = await api.post(`/games/${rescheduleGameId}/reschedule`, body);
      setGames(games.map(game => game.id === rescheduleGameId ? response.data : game));
      
      if (withDate && rescheduleDate) {
        setSuccess('Game rescheduled successfully');
      } else {
        setSuccess('Game marked as needs reschedule');
      }
      
      setTimeout(() => setSuccess(null), 3000);
      closeRescheduleModal();
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || 'Error rescheduling game');
    }
  };

  const handleDeleteGame = async (gameId: number) => {
    if (typeof window !== 'undefined' && !window.confirm('Are you sure you want to delete this game? This action cannot be undone.')) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      await api.delete(`/games/${gameId}`);
      setGames(games.filter(game => game.id !== gameId));
      setSuccess('Game deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || 'Error deleting game');
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="game-management-container">
      <h2>Game Management</h2>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {success && (
        <div className="success-message">
          {success}
        </div>
      )}

      <div className="game-controls">
        <button 
          className="primary-button"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          {showCreateForm ? 'Cancel' : 'Create New Game'}
        </button>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All Games</option>
          <option value="scheduled">Scheduled</option>
          <option value="to_reschedule">To Reschedule</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <button onClick={fetchGames} className="secondary-button">
          Refresh
        </button>
      </div>

      {showCreateForm && (
        <div className="create-game-form">
          <h3>Create New Game</h3>
          <form onSubmit={handleCreateGame}>
            <div className="form-field">
              <label>
                Home Team:
                <select
                  value={newGame.home_team_id}
                  onChange={(e) => setNewGame({ ...newGame, home_team_id: e.target.value })}
                  required
                >
                  <option value="">Select home team</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="form-field">
              <label>
                Away Team:
                <select
                  value={newGame.away_team_id}
                  onChange={(e) => setNewGame({ ...newGame, away_team_id: e.target.value })}
                  required
                >
                  <option value="">Select away team</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="form-field">
              <label>
                Date & Time:
                <input
                  type="datetime-local"
                  value={newGame.date}
                  onChange={(e) => setNewGame({ ...newGame, date: e.target.value })}
                  required
                />
              </label>
            </div>

            <div className="form-field">
              <label>
                Match Template (Optional):
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                >
                  <option value="">No template (use default settings)</option>
                  <optgroup label="📌 System Templates">
                    {templates.filter(t => t.is_system_template).map(template => (
                      <option key={template.id} value={template.id}>
                        {template.name} ({template.number_of_periods}×{template.period_duration_minutes}min)
                      </option>
                    ))}
                  </optgroup>
                  {templates.filter(t => !t.is_system_template).length > 0 && (
                    <optgroup label="👤 My Templates">
                      {templates.filter(t => !t.is_system_template).map(template => (
                        <option key={template.id} value={template.id}>
                          {template.name} ({template.number_of_periods}×{template.period_duration_minutes}min)
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </label>
              {selectedTemplate && templates.find(t => t.id === parseInt(selectedTemplate)) && (
                <p className="template-preview">
                  {(() => {
                    const t = templates.find(tpl => tpl.id === parseInt(selectedTemplate));
                    if (!t) return null;
                    return (
                      <>
                        <strong>{t.name}</strong>: {t.number_of_periods} periods × {t.period_duration_minutes} min
                      </>
                    );
                  })()}
                </p>
              )}
            </div>

            <button type="submit" className="primary-button">
              Create Game
            </button>
          </form>
        </div>
      )}

      {showRescheduleModal && (
        <div className="modal-overlay" onClick={closeRescheduleModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Reschedule Game</h3>
            <p>Choose how you want to reschedule this game:</p>
            
            <div className="reschedule-options">
              <div className="reschedule-option">
                <h4>Option 1: Mark as Needs Reschedule</h4>
                <p>Set the game status to &quot;To Reschedule&quot; without specifying a date yet.</p>
                <button 
                  onClick={() => handleRescheduleGame(false)}
                  className="secondary-button"
                >
                  Mark as Needs Reschedule
                </button>
              </div>

              <div className="reschedule-option">
                <h4>Option 2: Reschedule to Specific Date</h4>
                <p>Choose a new date and time for the game.</p>
                <div className="form-field">
                  <label>
                    New Date & Time:
                    <input
                      type="datetime-local"
                      value={rescheduleDate}
                      onChange={(e) => setRescheduleDate(e.target.value)}
                    />
                  </label>
                </div>
                <button 
                  onClick={() => handleRescheduleGame(true)}
                  className="primary-button"
                  disabled={!rescheduleDate}
                >
                  Reschedule to This Date
                </button>
              </div>
            </div>

            <button 
              onClick={closeRescheduleModal}
              className="secondary-button"
              style={{ marginTop: '1rem' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="games-list">
        <h3>Games ({games.length})</h3>
        {games.length === 0 ? (
          <p className="empty-state">No games found</p>
        ) : (
          <div>
            {games.map(game => (
              <div key={game.id} className="game-card">
                <div className="game-card-header">
                  <div>
                    <div className="game-card-title">
                      {game.home_team_name} vs {game.away_team_name}
                    </div>
                    <div className="game-card-date">
                      {formatDate(game.date)}
                    </div>
                  </div>
                  <span className={`game-status-badge status-${game.status.replace('_', '-')}`}>
                    {game.status.replace('_', ' ')}
                  </span>
                </div>

                {(game.status === 'in_progress' || game.status === 'completed') && (
                  <div className="game-score">
                    {game.home_score} - {game.away_score}
                  </div>
                )}

                <div className="game-actions">
                  {game.status === 'in_progress' && (
                    <>
                      <button 
                        onClick={() => navigate(`/match/${game.id}`)}
                        className="primary-button"
                      >
                        View Live Match
                      </button>
                      <button 
                        onClick={() => navigate(`/analytics/${game.id}`)}
                        className="secondary-button"
                      >
                        📈 Analytics
                      </button>
                      <button 
                        onClick={() => handleEndGame(game.id)}
                        className="secondary-button"
                      >
                        End Game
                      </button>
                    </>
                  )}

                  {game.status === 'completed' && (
                    <>
                      <button 
                        onClick={() => navigate(`/match/${game.id}`)}
                        className="secondary-button"
                      >
                        View Match Details
                      </button>
                      <button 
                        onClick={() => navigate(`/analytics/${game.id}`)}
                        className="primary-button"
                      >
                        📈 View Analytics
                      </button>
                    </>
                  )}

                  {game.status === 'scheduled' && (
                    <button 
                      onClick={() => navigate(`/match/${game.id}`)}
                      className="primary-button"
                    >
                      Prepare Match
                    </button>
                  )}

                  {game.status === 'to_reschedule' && (
                    <button 
                      onClick={() => navigate(`/match/${game.id}`)}
                      className="primary-button"
                    >
                      Prepare Match
                    </button>
                  )}

                  {(game.status === 'scheduled' || game.status === 'to_reschedule' || game.status === 'in_progress') && (
                    <button 
                      onClick={() => openRescheduleModal(game.id)}
                      className="secondary-button"
                    >
                      Reschedule
                    </button>
                  )}

                  {(game.status === 'scheduled' || game.status === 'to_reschedule' || game.status === 'in_progress') && (
                    <button 
                      onClick={() => handleCancelGame(game.id)}
                      className="secondary-button"
                    >
                      Cancel
                    </button>
                  )}

                  <button 
                    onClick={() => handleDeleteGame(game.id)}
                    className="danger-button"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GameManagement;
