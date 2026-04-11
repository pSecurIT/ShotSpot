import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import StatePanel from './ui/StatePanel';
import Toast from './ui/Toast';

interface Team {
  id: number;
  name: string;
  club_id: number;
  club_name?: string;
}

interface ClubOption {
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
  allow_same_team: boolean;
}

interface ApiValidationError {
  msg?: string;
}

const GameManagement: React.FC = () => {
  const navigate = useNavigate();
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [templates, setTemplates] = useState<MatchTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  
  // Form state for creating new game
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [newGame, setNewGame] = useState({
    home_club_id: '',
    home_team_id: '',
    away_club_id: '',
    away_team_id: '',
    date: ''
  });

  // Reschedule modal state
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleGameId, setRescheduleGameId] = useState<number | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');

  // Computed values
  const clubs = useMemo<ClubOption[]>(() => {
    const uniqueClubs = new Map<number, string>();
    teams.forEach((team) => {
      const clubName = typeof team.club_name === 'string' ? team.club_name.trim() : '';
      if (typeof team.club_id === 'number' && clubName && !uniqueClubs.has(team.club_id)) {
        uniqueClubs.set(team.club_id, clubName);
      }
    });

    return Array.from(uniqueClubs.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [teams]);

  const homeTeams = useMemo(() => {
    if (!newGame.home_club_id) return [];
    const selectedHomeClubId = Number(newGame.home_club_id);
    return teams.filter((team) => team.club_id === selectedHomeClubId);
  }, [teams, newGame.home_club_id]);

  const awayTeams = useMemo(() => {
    if (!newGame.away_club_id) return [];
    const selectedAwayClubId = Number(newGame.away_club_id);
    return teams.filter((team) => team.club_id === selectedAwayClubId);
  }, [teams, newGame.away_club_id]);

  // Fetch functions
  const fetchTeams = useCallback(async () => {
    try {
      const response = await api.get('/teams');
      setTeams(response.data);
    } catch (error) {
      console.error('Error fetching teams:', error);
      throw new Error('Failed to fetch teams');
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const response = await api.get('/match-templates');
      setTemplates(response.data);
    } catch (error) {
      console.error('Error fetching templates:', error);
      throw new Error('Failed to fetch match templates');
    }
  }, []);

  const fetchGames = useCallback(async () => {
    try {
      const params = filterStatus ? { status: filterStatus } : {};
      const response = await api.get('/games', { params });
      setGames(response.data);
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      throw new Error(err.response?.data?.error || 'Error fetching games');
      console.error('Error fetching games:', error);
    }
  }, [filterStatus]);

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await Promise.all([fetchTeams(), fetchTemplates(), fetchGames()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load games');
    } finally {
      setLoading(false);
    }
  }, [fetchGames, fetchTeams, fetchTemplates]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadInitialData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadInitialData]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (!loading) {
        void (async () => {
          try {
            setError(null);
            await fetchGames();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load games');
          }
        })();
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchGames, loading]);

  // Handle game creation
  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!newGame.home_club_id || !newGame.home_team_id || !newGame.away_club_id || !newGame.away_team_id || !newGame.date) {
      setError('All fields are required');
      return;
    }

    const selectedTemplateData = selectedTemplate 
      ? templates.find(t => t.id === parseInt(selectedTemplate))
      : null;
    
    const allowSameTeam = selectedTemplateData?.allow_same_team || false;

    if (newGame.home_team_id === newGame.away_team_id && !allowSameTeam) {
      setError('Home and away teams must be different');
      return;
    }

    try {
      const requestBody = {
        home_club_id: parseInt(newGame.home_club_id),
        away_club_id: parseInt(newGame.away_club_id),
        home_team_id: parseInt(newGame.home_team_id),
        away_team_id: parseInt(newGame.away_team_id),
        date: new Date(newGame.date).toISOString()
      };
      console.log('Sending game creation request:', requestBody);
      const response = await api.post('/games', requestBody);
      
      const createdGame = response.data;
      
      if (selectedTemplate) {
        try {
          await api.post(`/match-templates/${selectedTemplate}/apply-to-game/${createdGame.id}`);
          const updatedResponse = await api.get(`/games/${createdGame.id}`);
          setGames([updatedResponse.data, ...games]);
          setSuccess('Game created with template applied successfully');
        } catch (templateErr) {
          console.error('Error applying template:', templateErr);
          setGames([createdGame, ...games]);
          setSuccess('Game created, but template could not be applied');
        }
      } else {
        setGames([createdGame, ...games]);
        setSuccess('Game created successfully');
      }
      
      setNewGame({ home_club_id: '', home_team_id: '', away_club_id: '', away_team_id: '', date: '' });
      setSelectedTemplate('');
      setShowCreateForm(false);
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      const err = error as { response?: { status?: number; data?: { error?: string; errors?: ApiValidationError[] } }; message?: string };
      const errorMessage = err.response?.data?.error 
        || err.response?.data?.errors?.[0]?.msg
        || `Error creating game (HTTP ${err.response?.status || 'unknown'})`;
      setError(errorMessage);
      console.error('Error creating game:', {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
        fullError: error
      });
    }
  };

  // Other handlers
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
      
      {loading && (
        <StatePanel
          variant="loading"
          title="Loading games"
          message="Preparing teams, match templates, schedules, and live-match actions."
          className="game-management__feedback"
        />
      )}

      {!loading && error && games.length === 0 && (
        <StatePanel
          variant="error"
          title="Couldn’t load games"
          message={error ?? undefined}
          actionLabel="Retry"
          onAction={() => {
            void loadInitialData();
          }}
          className="game-management__feedback"
        />
      )}

      {!loading && error && games.length > 0 && (
        <StatePanel
          variant="error"
          title="Game action failed"
          message={error ?? undefined}
          actionLabel="Reload games"
          onAction={() => {
            void loadInitialData();
          }}
          compact
          className="game-management__feedback"
        />
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

      {!loading && !(error && games.length === 0) && (
      <>
      {showCreateForm && (
        <div className="create-game-form">
          <h3>Create New Game</h3>
          <form onSubmit={handleCreateGame}>
            <div className="form-field">
              <label htmlFor="home-club-select">
                Home Club:
                <select
                  id="home-club-select"
                  value={newGame.home_club_id}
                  onChange={(e) => setNewGame({ ...newGame, home_club_id: e.target.value, home_team_id: '' })}
                  required
                >
                  <option value="">Select home club</option>
                  {clubs.map(club => (
                    <option key={club.id} value={club.id}>{club.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="form-field">
              <label htmlFor="home-team-select">
                Home Team:
                <select
                  id="home-team-select"
                  value={newGame.home_team_id}
                  onChange={(e) => setNewGame({ ...newGame, home_team_id: e.target.value })}
                  disabled={!newGame.home_club_id}
                  required
                >
                  <option value="">Select home team</option>
                  {homeTeams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="form-field">
              <label htmlFor="away-club-select">
                Away Club:
                <select
                  id="away-club-select"
                  value={newGame.away_club_id}
                  onChange={(e) => setNewGame({ ...newGame, away_club_id: e.target.value, away_team_id: '' })}
                  required
                >
                  <option value="">Select away club</option>
                  {clubs.map(club => (
                    <option key={club.id} value={club.id}>{club.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="form-field">
              <label htmlFor="away-team-select">
                Away Team:
                <select
                  id="away-team-select"
                  value={newGame.away_team_id}
                  onChange={(e) => setNewGame({ ...newGame, away_team_id: e.target.value })}
                  disabled={!newGame.away_club_id}
                  required
                >
                  <option value="">Select away team</option>
                  {awayTeams.map(team => (
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
          <StatePanel
            variant="empty"
            title="No games found"
            message={filterStatus ? 'Try another status filter or create a new game.' : 'Create a game to start preparing matches and analytics.'}
            actionLabel={filterStatus ? 'Clear filter' : 'Create New Game'}
            onAction={filterStatus ? () => setFilterStatus('') : () => setShowCreateForm(true)}
            className="game-management__feedback"
          />
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
                    <>
                      <button 
                        onClick={() => navigate(`/match/${game.id}`)}
                        className="primary-button"
                      >
                        Prepare Match
                      </button>
                    </>
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
      </>
      )}

      {success && (
        <Toast
          title="Game updated"
          message={success}
          onDismiss={() => setSuccess(null)}
        />
      )}
    </div>
  );
};

export default GameManagement;
