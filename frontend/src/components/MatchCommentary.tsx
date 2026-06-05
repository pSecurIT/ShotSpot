import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';

interface MatchCommentaryProps {
  gameId: number;
  currentPeriod: number;
  timeRemaining?: string;
  onCommentaryAdded?: () => void;
}

interface Commentary {
  id: number;
  game_id: number;
  period: number;
  time_remaining?: string;
  commentary_type: string;
  title?: string;
  content: string;
  created_by?: number;
  created_by_username?: string;
  event_status?: 'confirmed' | 'unconfirmed';
  client_uuid?: string | null;
  created_at: string;
  updated_at: string;
}

const MatchCommentary: React.FC<MatchCommentaryProps> = ({
  gameId,
  currentPeriod,
  timeRemaining,
  onCommentaryAdded
}) => {
  const [commentaries, setCommentaries] = useState<Commentary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Ref for timeout cleanup
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Form state
  const [commentaryType, setCommentaryType] = useState<'note' | 'highlight' | 'injury' | 'weather' | 'technical'>('note');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Filter state
  const [filterType, setFilterType] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('all');

  useEffect(() => {
    fetchCommentaries();
  }, [gameId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  const fetchCommentaries = async () => {
    try {
      const params = new URLSearchParams();
      if (filterType !== 'all') {
        params.append('commentary_type', filterType);
      }
      if (filterPeriod !== 'all') {
        params.append('period', filterPeriod);
      }

      const response = await api.get(`/match-commentary/${gameId}?${params}`);
      setCommentaries(response.data);
    } catch (err) {
      console.error('Error fetching match commentary:', err);
    }
  };

  useEffect(() => {
    fetchCommentaries();
  }, [filterType, filterPeriod]); // eslint-disable-line react-hooks/exhaustive-deps

  const scheduleSuccessClear = () => {
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
    }

    successTimeoutRef.current = setTimeout(() => setSuccess(null), 3000);
  };

  const handleAddCommentary = async (eventStatus: 'confirmed' | 'unconfirmed' = 'confirmed') => {
    if (!content.trim()) {
      setError('Please enter commentary content');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const commentaryData = {
        period: currentPeriod,
        time_remaining: timeRemaining || null,
        commentary_type: commentaryType,
        title: title.trim() || null,
        content: content.trim(),
        event_status: eventStatus
      };

      const response = await api.post(`/match-commentary/${gameId}`, commentaryData);
      const wasQueued = Boolean((response.data as { queued?: boolean } | undefined)?.queued);

      setSuccess(wasQueued ? 'Commentary queued for sync when online' : eventStatus === 'unconfirmed' ? 'Commentary added for later review' : 'Commentary added successfully');
      
      // Reset form
      setTitle('');
      setContent('');
      setShowForm(false);
      
      if (!wasQueued) {
        fetchCommentaries();
      }
      
      // Notify parent component
      if (onCommentaryAdded) {
        onCommentaryAdded();
      }

      scheduleSuccessClear();
    } catch (err) {
      const error = err as Error & { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to add commentary');
    } finally {
      setLoading(false);
    }
  };

  const updateCommentaryStatus = async (commentaryId: number, eventStatus: 'confirmed' | 'unconfirmed', clientUuid?: string | null) => {
    try {
      await api.put(`/match-commentary/${gameId}/${commentaryId}`, {
        event_status: eventStatus,
        ...(clientUuid ? { client_uuid: clientUuid } : {})
      });
      setSuccess(eventStatus === 'unconfirmed' ? 'Commentary marked for later review' : 'Commentary confirmed');
      fetchCommentaries();
      if (onCommentaryAdded) {
        onCommentaryAdded();
      }
      scheduleSuccessClear();
    } catch (err) {
      const error = err as Error & { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to update commentary review status');
    }
  };

  const confirmCommentary = async (commentaryId: number, clientUuid?: string | null) => {
    try {
      if (clientUuid) {
        await api.post(`/match-commentary/${commentaryId}/confirm`, { client_uuid: clientUuid });
      } else {
        await api.post(`/match-commentary/${commentaryId}/confirm`);
      }
      setSuccess('Commentary confirmed');
      fetchCommentaries();
      if (onCommentaryAdded) {
        onCommentaryAdded();
      }
      scheduleSuccessClear();
    } catch (err) {
      const error = err as Error & { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to confirm commentary');
    }
  };

  const deleteCommentary = async (commentaryId: number) => {
    try {
      await api.delete(`/match-commentary/${gameId}/${commentaryId}`);
      setSuccess('Commentary removed successfully');
      fetchCommentaries();
      if (onCommentaryAdded) {
        onCommentaryAdded();
      }
      scheduleSuccessClear();
    } catch (err) {
      const error = err as Error & { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to delete commentary');
    }
  };

  const getCommentaryIcon = (type: string): string => {
    switch (type) {
      case 'note':
        return '📝';
      case 'highlight':
        return '⭐';
      case 'injury':
        return '🏥';
      case 'weather':
        return '🌤️';
      case 'technical':
        return '⚙️';
      default:
        return '📝';
    }
  };

  const getCommentaryColor = (type: string): string => {
    switch (type) {
      case 'note':
        return 'note';
      case 'highlight':
        return 'highlight';
      case 'injury':
        return 'injury';
      case 'weather':
        return 'weather';
      case 'technical':
        return 'technical';
      default:
        return 'note';
    }
  };

  const getCommentaryDisplayName = (type: string): string => {
    switch (type) {
      case 'note':
        return 'General Note';
      case 'highlight':
        return 'Key Moment';
      case 'injury':
        return 'Injury Note';
      case 'weather':
        return 'Weather/Conditions';
      case 'technical':
        return 'Technical Note';
      default:
        return 'Note';
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="match-commentary">
      <div className="commentary-header">
        <h4>Match Commentary</h4>
        <button
          onClick={() => setShowForm(!showForm)}
          className="toggle-form-button"
        >
          {showForm ? '✖️ Cancel' : '📝 Add Note'}
        </button>
      </div>

      {error && <div className="error-message" role="alert">{error}</div>}
      {success && <div className="success-message" role="status" aria-live="polite">{success}</div>}

      {/* Add Commentary Form */}
      {showForm && (
        <div className="commentary-form">
          <div className="form-group">
            <label>Type:</label>
            <div className="commentary-type-buttons">
              <button
                className={`type-btn ${commentaryType === 'note' ? 'active' : ''} note`}
                onClick={() => setCommentaryType('note')}
                type="button"
              >
                📝 Note
              </button>
              <button
                className={`type-btn ${commentaryType === 'highlight' ? 'active' : ''} highlight`}
                onClick={() => setCommentaryType('highlight')}
                type="button"
              >
                ⭐ Highlight
              </button>
              <button
                className={`type-btn ${commentaryType === 'injury' ? 'active' : ''} injury`}
                onClick={() => setCommentaryType('injury')}
                type="button"
              >
                🏥 Injury
              </button>
              <button
                className={`type-btn ${commentaryType === 'weather' ? 'active' : ''} weather`}
                onClick={() => setCommentaryType('weather')}
                type="button"
              >
                🌤️ Weather
              </button>
              <button
                className={`type-btn ${commentaryType === 'technical' ? 'active' : ''} technical`}
                onClick={() => setCommentaryType('technical')}
                type="button"
              >
                ⚙️ Technical
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Title (Optional):</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief title or summary"
              maxLength={100}
            />
          </div>

          <div className="form-group">
            <label>Content:</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter your commentary or notes here..."
              rows={4}
              maxLength={2000}
            />
            <small className="character-count">
              {content.length}/2000 characters
            </small>
          </div>

          <div className="commentary-form-actions">
            <button
              onClick={() => void handleAddCommentary('confirmed')}
              disabled={loading || !content.trim()}
              className="primary-button"
            >
              {loading ? 'Adding...' : 'Add Commentary'}
            </button>
            <button
              onClick={() => void handleAddCommentary('unconfirmed')}
              disabled={loading || !content.trim()}
              className="secondary-button"
            >
              {loading ? 'Adding...' : 'Add And Review Later'}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="commentary-filters">
        <div className="filter-group">
          <label>Type:</label>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="all">All Types</option>
            <option value="note">General Notes</option>
            <option value="highlight">Key Moments</option>
            <option value="injury">Injury Notes</option>
            <option value="weather">Weather/Conditions</option>
            <option value="technical">Technical Notes</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Period:</label>
          <select value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)}>
            <option value="all">All Periods</option>
            <option value="1">Period 1</option>
            <option value="2">Period 2</option>
            <option value="3">Period 3</option>
            <option value="4">Period 4</option>
          </select>
        </div>
      </div>

      {/* Commentary List */}
      <div className="commentary-list">
        {commentaries.length === 0 ? (
          <div className="no-commentary">
            <p>No commentary added yet.</p>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="secondary-button"
              >
                Add First Note
              </button>
            )}
          </div>
        ) : (
          commentaries.map((commentary) => (
            <div key={commentary.id} className={`commentary-item ${getCommentaryColor(commentary.commentary_type)}`}>
              <div className="commentary-header-item">
                <div className="commentary-meta">
                  <span className="commentary-icon">
                    {getCommentaryIcon(commentary.commentary_type)}
                  </span>
                  <span className="commentary-type">
                    {getCommentaryDisplayName(commentary.commentary_type)}
                  </span>
                  <span className="commentary-time">
                    Period {commentary.period} • {commentary.time_remaining || 'End'} • {formatTimestamp(commentary.created_at)}
                  </span>
                  {commentary.event_status === 'unconfirmed' && (
                    <span className="detail-badge warning">Pending review</span>
                  )}
                  {commentary.created_by_username && (
                    <span className="commentary-author">
                      by {commentary.created_by_username}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => deleteCommentary(commentary.id)}
                  className="delete-button"
                  title="Remove this commentary"
                >
                  🗑️
                </button>
              </div>

              {commentary.title && (
                <h6 className="commentary-title">{commentary.title}</h6>
              )}

              <div className="commentary-content">
                {commentary.content}
              </div>

              <div className="commentary-actions">
                {commentary.event_status === 'unconfirmed' ? (
                  <button
                    onClick={() => confirmCommentary(commentary.id, commentary.client_uuid)}
                    className="save-button"
                    title="Confirm this commentary"
                  >
                    ✅ Confirm
                  </button>
                ) : (
                  <button
                    onClick={() => updateCommentaryStatus(commentary.id, 'unconfirmed', commentary.client_uuid)}
                    className="secondary-button"
                    title="Review this commentary later"
                  >
                    🏷️ Edit Later
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MatchCommentary;