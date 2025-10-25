import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import './MatchTimeline.css';

interface Player {
  id: number;
  first_name: string;
  last_name: string;
  jersey_number: number;
}

interface TimelineEvent {
  id: number;
  game_id: number;
  event_type: 'foul' | 'substitution' | 'timeout' | 'period_start' | 'period_end';
  player_id: number | null;
  team_id: number;
  period: number;
  time_remaining: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  jersey_number: number | null;
  team_name: string;
}

interface Shot {
  id: number;
  game_id: number;
  player_id: number;
  team_id: number;
  location_x: number;
  location_y: number;
  result: 'goal' | 'miss' | 'hit';
  period: number;
  time_remaining: string | null;
  created_at: string;
  first_name: string;
  last_name: string;
  jersey_number: number;
  team_name: string;
}

interface Substitution {
  id: number;
  game_id: number;
  team_id: number;
  player_in_id: number;
  player_out_id: number;
  period: number;
  time_remaining: string | null;
  reason: string;
  player_in_first_name: string;
  player_in_last_name: string;
  player_in_jersey_number: number;
  player_out_first_name: string;
  player_out_last_name: string;
  player_out_jersey_number: number;
  team_name: string;
  created_at: string;
}

interface MatchTimelineProps {
  gameId: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string;
  awayTeamName: string;
  homePlayers?: Player[]; // Optional for future player filtering feature
  awayPlayers?: Player[]; // Optional for future player filtering feature
  onRefresh?: () => void;
}

const MatchTimeline: React.FC<MatchTimelineProps> = ({
  gameId,
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
  onRefresh
}) => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [shots, setShots] = useState<Shot[]>([]);
  const [substitutions, setSubstitutions] = useState<Substitution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [filterPeriod, setFilterPeriod] = useState<string>('all');

  const fetchEvents = useCallback(async () => {
    try {
      const response = await api.get(`/events/${gameId}`);
      setEvents(response.data);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
    }
  }, [gameId]);

  const fetchShots = useCallback(async () => {
    try {
      const response = await api.get(`/shots/${gameId}`);
      setShots(response.data);
    } catch (err) {
      console.error('Error fetching shots:', err);
    }
  }, [gameId]);

  const fetchSubstitutions = useCallback(async () => {
    try {
      const response = await api.get(`/substitutions/${gameId}`);
      setSubstitutions(response.data);
    } catch (err) {
      console.error('Error fetching substitutions:', err);
    }
  }, [gameId]);

  const fetchTimeline = useCallback(async () => {
    setLoading(true);
    setError(null);
    await Promise.all([fetchEvents(), fetchShots(), fetchSubstitutions()]);
    setLoading(false);
  }, [fetchEvents, fetchShots, fetchSubstitutions]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTimeline();
    
    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchTimeline, 5000);
    return () => clearInterval(interval);
  }, [fetchTimeline]);

  const handleDeleteEvent = async (eventId: number) => {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      await api.delete(`/events/${gameId}/${eventId}`);
      await fetchTimeline();
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete event');
    }
  };

  const handleDeleteShot = async (shotId: number) => {
    if (!confirm('Are you sure you want to delete this shot?')) return;

    try {
      await api.delete(`/shots/${gameId}/${shotId}`);
      await fetchTimeline();
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete shot');
    }
  };

  const handleEditEvent = async (eventId: number, updates: Partial<TimelineEvent>) => {
    try {
      await api.put(`/events/${gameId}/${eventId}`, updates);
      setEditingEvent(null);
      await fetchTimeline();
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update event');
    }
  };

  // Combine and sort events, shots, and substitutions by timestamp
  const combinedTimeline = React.useMemo(() => {
    const timeline: Array<{ 
      type: 'event' | 'shot' | 'substitution'; 
      data: TimelineEvent | Shot | Substitution; 
      timestamp: string 
    }> = [
      ...events.map(e => ({ type: 'event' as const, data: e, timestamp: e.created_at })),
      ...shots.map(s => ({ type: 'shot' as const, data: s, timestamp: s.created_at })),
      ...substitutions.map(sub => ({ type: 'substitution' as const, data: sub, timestamp: sub.created_at }))
    ];

    // Apply filters
    const filtered = timeline.filter(item => {
      if (filterType !== 'all') {
        if (filterType === 'shots' && item.type !== 'shot') return false;
        if (filterType === 'substitutions' && item.type !== 'substitution') return false;
        if (filterType !== 'shots' && filterType !== 'substitutions' && (item.type !== 'event' || (item.data as TimelineEvent).event_type !== filterType)) return false;
      }

      if (filterTeam !== 'all') {
        const teamId = item.data.team_id;
        if (filterTeam === 'home' && teamId !== homeTeamId) return false;
        if (filterTeam === 'away' && teamId !== awayTeamId) return false;
      }

      if (filterPeriod !== 'all') {
        if (item.data.period !== parseInt(filterPeriod)) return false;
      }

      return true;
    });

    // Sort by timestamp descending (most recent first)
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return filtered;
  }, [events, shots, substitutions, filterType, filterTeam, filterPeriod, homeTeamId, awayTeamId]);

  const formatTime = (timeString: string | null) => {
    if (!timeString) return 'N/A';
    // PostgreSQL interval format: HH:MM:SS or MM:SS
    return timeString;
  };

  const getEventIcon = (eventType: string) => {
    const icons = {
      foul: '⚠️',
      substitution: '🔄',
      timeout: '⏸️',
      period_start: '▶️',
      period_end: '⏹️',
      shot: '🏀'
    };
    return icons[eventType as keyof typeof icons] || '📝';
  };

  const getResultIcon = (result: 'goal' | 'miss' | 'hit') => {
    const icons = {
      goal: '✅',
      miss: '❌',
      hit: '⚪'
    };
    return icons[result];
  };

  const renderEventDetails = (event: TimelineEvent) => {
    const details = event.details;
    if (!details) return null;

    // Type guard to safely access properties
    const getStringProp = (obj: Record<string, unknown>, key: string): string | undefined => {
      const value = obj[key];
      return typeof value === 'string' ? value : undefined;
    };

    const getNumberProp = (obj: Record<string, unknown>, key: string): number | undefined => {
      const value = obj[key];
      return typeof value === 'number' ? value : undefined;
    };

    switch (event.event_type) {
      case 'foul':
        {
          const foulType = getStringProp(details, 'foul_type');
          const severity = getStringProp(details, 'severity');
          const description = getStringProp(details, 'description');
          
          return (
            <div className="event-details">
              {foulType && <span className="detail-badge">{foulType}</span>}
              {severity && <span className="detail-badge severity">{severity}</span>}
              {description && <span className="detail-text">{description}</span>}
            </div>
          );
        }
      case 'substitution':
        {
          const playerIn = getNumberProp(details, 'player_in');
          const playerOut = getNumberProp(details, 'player_out');
          
          return (
            <div className="event-details">
              {playerIn && <span className="detail-text">In: #{playerIn}</span>}
              {playerOut && <span className="detail-text">Out: #{playerOut}</span>}
            </div>
          );
        }
      default:
        return null;
    }
  };

  if (loading && events.length === 0 && shots.length === 0) {
    return <div className="timeline-loading">Loading timeline...</div>;
  }

  return (
    <div className="match-timeline">
      <div className="timeline-header">
        <h3>Match Timeline</h3>
        <button onClick={fetchTimeline} className="refresh-button" disabled={loading}>
          🔄 {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && <div className="timeline-error">{error}</div>}

      {/* Filters */}
      <div className="timeline-filters">
        <div className="filter-group">
          <label>Type:</label>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="all">All</option>
            <option value="shots">Shots</option>
            <option value="substitutions">Substitutions</option>
            <option value="foul">Fouls</option>
            <option value="timeout">Timeouts</option>
            <option value="period_start">Period Start</option>
            <option value="period_end">Period End</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Team:</label>
          <select value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)}>
            <option value="all">Both Teams</option>
            <option value="home">{homeTeamName}</option>
            <option value="away">{awayTeamName}</option>
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

        <div className="filter-stats">
          Showing {combinedTimeline.length} of {events.length + shots.length + substitutions.length} events
        </div>
      </div>

      {/* Timeline List */}
      <div className="timeline-list">
        {combinedTimeline.length === 0 ? (
          <div className="timeline-empty">No events to display</div>
        ) : (
          combinedTimeline.map((item) => {
            if (item.type === 'substitution') {
              const sub = item.data as Substitution;
              const isHome = sub.team_id === homeTeamId;
              
              return (
                <div key={`sub-${sub.id}`} className={`timeline-item substitution ${isHome ? 'home' : 'away'}`}>
                  <div className="timeline-icon">🔄</div>
                  <div className="timeline-content">
                    <div className="timeline-header-row">
                      <div className="timeline-info">
                        <span className="event-type">SUBSTITUTION</span>
                        <span className="team-badge">{sub.team_name}</span>
                      </div>
                      <div className="timeline-meta">
                        <span className="period">P{sub.period}</span>
                        {sub.time_remaining && <span className="time">{formatTime(sub.time_remaining)}</span>}
                      </div>
                    </div>
                    <div className="substitution-details">
                      <div className="player-change">
                        <span className="player-out">
                          ⬇️ #{sub.player_out_jersey_number} {sub.player_out_first_name} {sub.player_out_last_name}
                        </span>
                        <span className="sub-arrow">→</span>
                        <span className="player-in">
                          ⬆️ #{sub.player_in_jersey_number} {sub.player_in_first_name} {sub.player_in_last_name}
                        </span>
                      </div>
                      <div className="sub-reason">
                        <span className="reason-badge">{sub.reason}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            } else if (item.type === 'shot') {
              const shot = item.data as Shot;
              const isHome = shot.team_id === homeTeamId;
              
              return (
                <div key={`shot-${shot.id}`} className={`timeline-item shot ${isHome ? 'home' : 'away'}`}>
                  <div className="timeline-icon">{getEventIcon('shot')}</div>
                  <div className="timeline-content">
                    <div className="timeline-header-row">
                      <div className="timeline-info">
                        <span className="event-type">Shot - {getResultIcon(shot.result)} {shot.result.toUpperCase()}</span>
                        <span className="team-badge">{shot.team_name}</span>
                      </div>
                      <div className="timeline-meta">
                        <span className="period">P{shot.period}</span>
                        {shot.time_remaining && <span className="time">{formatTime(shot.time_remaining)}</span>}
                      </div>
                    </div>
                    <div className="timeline-player">
                      #{shot.jersey_number} {shot.first_name} {shot.last_name}
                    </div>
                    <div className="timeline-actions">
                      <button 
                        onClick={() => handleDeleteShot(shot.id)}
                        className="delete-button"
                        title="Delete shot"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            } else {
              const event = item.data as TimelineEvent;
              const isHome = event.team_id === homeTeamId;
              const isEditing = editingEvent === event.id;

              return (
                <div key={`event-${event.id}`} className={`timeline-item event ${isHome ? 'home' : 'away'}`}>
                  <div className="timeline-icon">{getEventIcon(event.event_type)}</div>
                  <div className="timeline-content">
                    <div className="timeline-header-row">
                      <div className="timeline-info">
                        <span className="event-type">{event.event_type.replace('_', ' ').toUpperCase()}</span>
                        <span className="team-badge">{event.team_name}</span>
                      </div>
                      <div className="timeline-meta">
                        <span className="period">P{event.period}</span>
                        {event.time_remaining && <span className="time">{formatTime(event.time_remaining)}</span>}
                      </div>
                    </div>
                    
                    {event.player_id && (
                      <div className="timeline-player">
                        #{event.jersey_number} {event.first_name} {event.last_name}
                      </div>
                    )}
                    
                    {renderEventDetails(event)}

                    <div className="timeline-actions">
                      {!isEditing && (
                        <>
                          <button 
                            onClick={() => setEditingEvent(event.id)}
                            className="edit-button"
                            title="Edit event"
                          >
                            ✏️ Edit
                          </button>
                          <button 
                            onClick={() => handleDeleteEvent(event.id)}
                            className="delete-button"
                            title="Delete event"
                          >
                            🗑️ Delete
                          </button>
                        </>
                      )}
                      
                      {isEditing && (
                        <div className="edit-form">
                          <button 
                            onClick={() => setEditingEvent(null)}
                            className="cancel-button"
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={() => {
                              // Simple edit - just update details for now
                              const currentDescription = event.details && typeof event.details.description === 'string' 
                                ? event.details.description 
                                : '';
                              const newDescription = prompt('Enter new description:', currentDescription);
                              if (newDescription !== null) {
                                handleEditEvent(event.id, {
                                  details: { ...event.details, description: newDescription }
                                });
                              }
                            }}
                            className="save-button"
                          >
                            Save
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }
          })
        )}
      </div>
    </div>
  );
};

export default MatchTimeline;
