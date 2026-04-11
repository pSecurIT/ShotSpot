import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../utils/api';

type EventStatus = 'confirmed' | 'unconfirmed';
type EventSourceTable = 'game_event' | 'free_shot' | 'timeout' | 'commentary';
type ShotResult = 'goal' | 'miss' | 'blocked' | 'hit';

interface Player {
  id: number;
  first_name: string;
  last_name: string;
  jersey_number: number;
}

interface TimelineEvent {
  id: number;
  game_id: number;
  event_type: string;
  player_id: number | null;
  team_id: number | null;
  club_id?: number | null;
  period: number;
  time_remaining: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  jersey_number: number | null;
  team_name: string | null;
  club_name?: string | null;
  event_status: EventStatus;
  client_uuid?: string | null;
  source_table: EventSourceTable;
}

interface Shot {
  id: number;
  game_id: number;
  player_id: number;
  team_id: number | null;
  club_id?: number | null;
  location_x?: number;
  location_y?: number;
  result: ShotResult;
  period: number;
  time_remaining: string | null;
  created_at: string;
  first_name: string;
  last_name: string;
  jersey_number: number;
  team_name: string;
  club_name?: string | null;
  event_status: EventStatus;
  client_uuid?: string | null;
}

interface Substitution {
  id: number;
  game_id: number;
  team_id: number | null;
  club_id?: number | null;
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
  club_name?: string | null;
  created_at: string;
  event_status: EventStatus;
  client_uuid?: string | null;
}

type TimelineItem =
  | { type: 'event'; data: TimelineEvent; timestamp: string }
  | { type: 'shot'; data: Shot; timestamp: string }
  | { type: 'substitution'; data: Substitution; timestamp: string };

interface MatchTimelineProps {
  gameId: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string;
  awayTeamName: string;
  homePlayers?: Player[];
  awayPlayers?: Player[];
  onRefresh?: () => void;
}

const normalizeEventStatus = (value: unknown): EventStatus => value === 'unconfirmed' ? 'unconfirmed' : 'confirmed';

const normalizeEvent = (raw: Record<string, unknown>): TimelineEvent => ({
  id: Number(raw.id),
  game_id: Number(raw.game_id),
  event_type: String(raw.event_type || raw.type || 'unknown'),
  player_id: raw.player_id == null ? null : Number(raw.player_id),
  team_id: raw.team_id == null ? (raw.club_id == null ? null : Number(raw.club_id)) : Number(raw.team_id),
  club_id: raw.club_id == null ? null : Number(raw.club_id),
  period: Number(raw.period),
  time_remaining: typeof raw.time_remaining === 'string' ? raw.time_remaining : null,
  details: raw.details && typeof raw.details === 'object' ? raw.details as Record<string, unknown> : null,
  created_at: String(raw.created_at),
  first_name: typeof raw.first_name === 'string' ? raw.first_name : null,
  last_name: typeof raw.last_name === 'string' ? raw.last_name : null,
  jersey_number: raw.jersey_number == null ? null : Number(raw.jersey_number),
  team_name: typeof raw.team_name === 'string' ? raw.team_name : typeof raw.club_name === 'string' ? raw.club_name : null,
  club_name: typeof raw.club_name === 'string' ? raw.club_name : null,
  event_status: normalizeEventStatus(raw.event_status),
  client_uuid: typeof raw.client_uuid === 'string' ? raw.client_uuid : null,
  source_table: (raw.source_table as EventSourceTable) || 'game_event'
});

const normalizeShot = (raw: Record<string, unknown>): Shot => ({
  id: Number(raw.id),
  game_id: Number(raw.game_id),
  player_id: Number(raw.player_id),
  team_id: raw.team_id == null ? (raw.club_id == null ? null : Number(raw.club_id)) : Number(raw.team_id),
  club_id: raw.club_id == null ? null : Number(raw.club_id),
  location_x: typeof raw.location_x === 'number' ? raw.location_x : undefined,
  location_y: typeof raw.location_y === 'number' ? raw.location_y : undefined,
  result: (raw.result as ShotResult) || 'miss',
  period: Number(raw.period),
  time_remaining: typeof raw.time_remaining === 'string' ? raw.time_remaining : null,
  created_at: String(raw.created_at),
  first_name: String(raw.first_name || ''),
  last_name: String(raw.last_name || ''),
  jersey_number: Number(raw.jersey_number),
  team_name: String(raw.team_name || raw.club_name || ''),
  club_name: typeof raw.club_name === 'string' ? raw.club_name : null,
  event_status: normalizeEventStatus(raw.event_status),
  client_uuid: typeof raw.client_uuid === 'string' ? raw.client_uuid : null
});

const normalizeSubstitution = (raw: Record<string, unknown>): Substitution => ({
  id: Number(raw.id),
  game_id: Number(raw.game_id),
  team_id: raw.team_id == null ? (raw.club_id == null ? null : Number(raw.club_id)) : Number(raw.team_id),
  club_id: raw.club_id == null ? null : Number(raw.club_id),
  player_in_id: Number(raw.player_in_id),
  player_out_id: Number(raw.player_out_id),
  period: Number(raw.period),
  time_remaining: typeof raw.time_remaining === 'string' ? raw.time_remaining : null,
  reason: String(raw.reason || 'tactical'),
  player_in_first_name: String(raw.player_in_first_name || ''),
  player_in_last_name: String(raw.player_in_last_name || ''),
  player_in_jersey_number: Number(raw.player_in_jersey_number),
  player_out_first_name: String(raw.player_out_first_name || ''),
  player_out_last_name: String(raw.player_out_last_name || ''),
  player_out_jersey_number: Number(raw.player_out_jersey_number),
  team_name: String(raw.team_name || raw.club_name || ''),
  club_name: typeof raw.club_name === 'string' ? raw.club_name : null,
  created_at: String(raw.created_at),
  event_status: normalizeEventStatus(raw.event_status),
  client_uuid: typeof raw.client_uuid === 'string' ? raw.client_uuid : null
});

const formatEventTypeLabel = (eventType: string) => eventType.replace(/_/g, ' ').toUpperCase();

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
  const [selectedPendingItem, setSelectedPendingItem] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [filterPeriod, setFilterPeriod] = useState<string>('all');

  const fetchEvents = useCallback(async () => {
    try {
      const response = await api.get(`/events/comprehensive/${gameId}`);
      setEvents((response.data || []).map((item: Record<string, unknown>) => normalizeEvent(item)));
    } catch (err) {
      try {
        const fallbackResponse = await api.get(`/events/${gameId}`);
        setEvents((fallbackResponse.data || []).map((item: Record<string, unknown>) => normalizeEvent(item)));
      } catch (fallbackErr) {
        console.error('Error fetching events:', err);
        setError(fallbackErr instanceof Error ? fallbackErr.message : 'Failed to fetch events');
      }
    }
  }, [gameId]);

  const fetchShots = useCallback(async () => {
    try {
      const response = await api.get(`/shots/${gameId}`);
      setShots((response.data || []).map((item: Record<string, unknown>) => normalizeShot(item)));
    } catch (err) {
      console.error('Error fetching shots:', err);
    }
  }, [gameId]);

  const fetchSubstitutions = useCallback(async () => {
    try {
      const response = await api.get(`/substitutions/${gameId}`);
      setSubstitutions((response.data || []).map((item: Record<string, unknown>) => normalizeSubstitution(item)));
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
    const initialFetch = setTimeout(() => {
      void fetchTimeline();
    }, 0);
    const interval = setInterval(() => {
      void fetchTimeline();
    }, 5000);
    return () => {
      clearTimeout(initialFetch);
      clearInterval(interval);
    };
  }, [fetchTimeline]);

  const combinedTimeline = useMemo<TimelineItem[]>(() => {
    const timeline: TimelineItem[] = [
      ...events.map((event) => ({ type: 'event' as const, data: event, timestamp: event.created_at })),
      ...shots.map((shot) => ({ type: 'shot' as const, data: shot, timestamp: shot.created_at })),
      ...substitutions.map((substitution) => ({ type: 'substitution' as const, data: substitution, timestamp: substitution.created_at }))
    ];

    const filtered = timeline.filter((item) => {
      if (filterType !== 'all') {
        if (filterType === 'shots' && item.type !== 'shot') return false;
        if (filterType === 'substitutions' && item.type !== 'substitution') return false;
        if (filterType !== 'shots' && filterType !== 'substitutions' && (item.type !== 'event' || item.data.event_type !== filterType)) return false;
      }

      if (filterTeam !== 'all') {
        const teamId = item.data.team_id;
        if (filterTeam === 'home' && teamId !== homeTeamId) return false;
        if (filterTeam === 'away' && teamId !== awayTeamId) return false;
      }

      if (filterPeriod !== 'all' && item.data.period !== parseInt(filterPeriod, 10)) {
        return false;
      }

      return true;
    });

    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return filtered;
  }, [events, shots, substitutions, filterType, filterTeam, filterPeriod, homeTeamId, awayTeamId]);

  const getItemKey = (item: TimelineItem) => `${item.type}-${item.data.id}`;

  const supportsReviewStatus = (item: TimelineItem) => {
    void item;
    return true;
  };

  const pendingItems = useMemo(
    () => combinedTimeline.filter((item) => supportsReviewStatus(item) && item.data.event_status === 'unconfirmed'),
    [combinedTimeline]
  );

  const activeSelectedPendingItem = useMemo(() => {
    if (pendingItems.length === 0) {
      return null;
    }

    if (selectedPendingItem && pendingItems.some((item) => getItemKey(item) === selectedPendingItem)) {
      return selectedPendingItem;
    }

    return getItemKey(pendingItems[0]);
  }, [pendingItems, selectedPendingItem]);

  const latestEditableItem = useMemo(
    () => combinedTimeline[0] || null,
    [combinedTimeline]
  );

  const latestReviewableItem = useMemo(
    () => combinedTimeline.find((item) => supportsReviewStatus(item)) || null,
    [combinedTimeline]
  );

  const refreshAfterMutation = useCallback(async () => {
    await fetchTimeline();
    if (onRefresh) onRefresh();
  }, [fetchTimeline, onRefresh]);

  const formatTime = (timeString: string | null) => timeString || 'N/A';

  const getEventIcon = (eventType: string) => {
    const icons: Record<string, string> = {
      foul: '⚠️',
      substitution: '🔄',
      timeout: '⏸️',
      period_start: '▶️',
      period_end: '⏹️',
      shot: '🏀',
      fault_offensive: '🔴',
      fault_defensive: '🟡',
      fault_out_of_bounds: '⚪',
      free_shot_free_shot: '🎯',
      free_shot_penalty: '🥅',
      timeout_team: '⏸️',
      timeout_injury: '🏥',
      timeout_official: '👔',
      timeout_tv: '📺',
      commentary_note: '📝',
      commentary_highlight: '⭐',
      commentary_injury: '🚑',
      commentary_weather: '🌤️',
      commentary_technical: '⚙️'
    };
    return icons[eventType] || '📝';
  };

  const getResultIcon = (result: ShotResult) => {
    const icons: Record<ShotResult, string> = {
      goal: '✅',
      miss: '❌',
      blocked: '🛡️',
      hit: '⚪'
    };
    return icons[result] || '⚪';
  };

  const getPendingSummary = (item: TimelineItem) => {
    if (item.type === 'shot') {
      return `Shot review: #${item.data.jersey_number} ${item.data.first_name} ${item.data.last_name} - ${item.data.result.toUpperCase()}`;
    }

    if (item.type === 'substitution') {
      return `Substitution review: #${item.data.player_out_jersey_number} out, #${item.data.player_in_jersey_number} in`;
    }

    return `${formatEventTypeLabel(item.data.event_type)} review`;
  };

  const renderEventDetails = (event: TimelineEvent) => {
    const details = event.details;
    if (!details) return null;

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
        return (
          <div className="event-details">
            {getStringProp(details, 'foul_type') && <span className="detail-badge">{getStringProp(details, 'foul_type')}</span>}
            {getStringProp(details, 'severity') && <span className="detail-badge severity">{getStringProp(details, 'severity')}</span>}
            {getStringProp(details, 'description') && <span className="detail-text">{getStringProp(details, 'description')}</span>}
          </div>
        );
      case 'substitution':
        return (
          <div className="event-details">
            {getNumberProp(details, 'player_in') && <span className="detail-text">In: #{getNumberProp(details, 'player_in')}</span>}
            {getNumberProp(details, 'player_out') && <span className="detail-text">Out: #{getNumberProp(details, 'player_out')}</span>}
          </div>
        );
      case 'fault_offensive':
      case 'fault_defensive':
      case 'fault_out_of_bounds':
        return (
          <div className="event-details">
            {getStringProp(details, 'reason') && <span className="detail-badge">{getStringProp(details, 'reason')}</span>}
            {getStringProp(details, 'description') && <span className="detail-text">{getStringProp(details, 'description')}</span>}
          </div>
        );
      case 'free_shot_free_shot':
      case 'free_shot_penalty':
        return (
          <div className="event-details">
            {getStringProp(details, 'result') && <span className="detail-badge">{getStringProp(details, 'result')}</span>}
            {getNumberProp(details, 'distance') && <span className="detail-text">Distance: {getNumberProp(details, 'distance')}m</span>}
            {getStringProp(details, 'reason') && <span className="detail-text">Reason: {getStringProp(details, 'reason')}</span>}
          </div>
        );
      case 'timeout_team':
      case 'timeout_injury':
      case 'timeout_official':
      case 'timeout_tv':
        return (
          <div className="event-details">
            {getStringProp(details, 'duration') && <span className="detail-badge">Duration: {getStringProp(details, 'duration')}</span>}
            {getStringProp(details, 'called_by') && <span className="detail-text">Called by: {getStringProp(details, 'called_by')}</span>}
            {getStringProp(details, 'reason') && <span className="detail-text">Reason: {getStringProp(details, 'reason')}</span>}
          </div>
        );
      case 'commentary_note':
      case 'commentary_highlight':
      case 'commentary_injury':
      case 'commentary_weather':
      case 'commentary_technical':
        return (
          <div className="event-details">
            {getStringProp(details, 'title') && <span className="detail-badge commentary-title">{getStringProp(details, 'title')}</span>}
            {getStringProp(details, 'content') && <div className="detail-text commentary-content">{getStringProp(details, 'content')}</div>}
          </div>
        );
      default:
        return null;
    }
  };

  const handleDeleteItem = async (item: TimelineItem) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;

    try {
      if (item.type === 'shot') {
        await api.delete(`/shots/${gameId}/${item.data.id}`);
      } else if (item.type === 'substitution') {
        await api.delete(`/substitutions/${gameId}/${item.data.id}`);
      } else if (item.data.source_table === 'game_event') {
        await api.delete(`/events/${gameId}/${item.data.id}`);
      } else if (item.data.source_table === 'free_shot') {
        await api.delete(`/free-shots/${item.data.id}`, { data: { game_id: gameId } });
      } else if (item.data.source_table === 'timeout') {
        await api.delete(`/timeouts/${item.data.id}`, { data: { game_id: gameId } });
      } else {
        await api.delete(`/match-commentary/${gameId}/${item.data.id}`);
      }

      await refreshAfterMutation();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item');
    }
  };

  const handleUpdateReviewStatus = async (item: TimelineItem, eventStatus: EventStatus) => {
    const reviewStatusPayload = {
      event_status: eventStatus,
      ...(item.data.client_uuid ? { client_uuid: item.data.client_uuid } : {})
    };

    try {
      if (item.type === 'shot') {
        await api.put(`/shots/${gameId}/${item.data.id}`, reviewStatusPayload);
      } else if (item.type === 'substitution') {
        await api.put(`/substitutions/${gameId}/${item.data.id}`, reviewStatusPayload);
      } else if (item.data.source_table === 'game_event') {
        await api.put(`/events/${gameId}/${item.data.id}`, reviewStatusPayload);
      } else if (item.data.source_table === 'free_shot') {
        await api.put(`/free-shots/${item.data.id}`, { game_id: gameId, ...reviewStatusPayload });
      } else if (item.data.source_table === 'timeout') {
        await api.put(`/timeouts/${item.data.id}`, { game_id: gameId, ...reviewStatusPayload });
      } else {
        await api.put(`/match-commentary/${gameId}/${item.data.id}`, reviewStatusPayload);
      }

      setSelectedPendingItem(getItemKey(item));
      await refreshAfterMutation();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update review status');
    }
  };

  const handleConfirmItem = async (item: TimelineItem, nextPendingKey?: string | null) => {
    const confirmPayload = item.data.client_uuid ? { client_uuid: item.data.client_uuid } : undefined;

    try {
      if (item.type === 'shot') {
        if (confirmPayload) {
          await api.post(`/shots/${gameId}/${item.data.id}/confirm`, confirmPayload);
        } else {
          await api.post(`/shots/${gameId}/${item.data.id}/confirm`);
        }
      } else if (item.type === 'substitution') {
        if (confirmPayload) {
          await api.post(`/substitutions/${gameId}/${item.data.id}/confirm`, confirmPayload);
        } else {
          await api.post(`/substitutions/${gameId}/${item.data.id}/confirm`);
        }
      } else if (item.data.source_table === 'game_event') {
        if (confirmPayload) {
          await api.post(`/events/${gameId}/${item.data.id}/confirm`, confirmPayload);
        } else {
          await api.post(`/events/${gameId}/${item.data.id}/confirm`);
        }
      } else if (item.data.source_table === 'free_shot') {
        await api.post(`/free-shots/${item.data.id}/confirm`, { game_id: gameId, ...(confirmPayload || {}) });
      } else if (item.data.source_table === 'timeout') {
        await api.post(`/timeouts/${item.data.id}/confirm`, { game_id: gameId, ...(confirmPayload || {}) });
      } else {
        if (confirmPayload) {
          await api.post(`/match-commentary/${item.data.id}/confirm`, confirmPayload);
        } else {
          await api.post(`/match-commentary/${item.data.id}/confirm`);
        }
      }

      setSelectedPendingItem(nextPendingKey || null);
      await refreshAfterMutation();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm item');
    }
  };

  const promptForTimeRemaining = (currentValue: string | null) => {
    const nextValue = window.prompt('Time remaining (HH:MM:SS). Leave blank to clear.', currentValue || '');
    if (nextValue === null) return undefined;
    return nextValue.trim() === '' ? null : nextValue.trim();
  };

  const handleEditItem = async (item: TimelineItem, options?: { confirmAfterSave?: boolean; nextPendingKey?: string | null }) => {
    try {
      if (item.type === 'shot') {
        const nextResult = window.prompt('Shot result (goal, miss, blocked):', item.data.result === 'hit' ? 'blocked' : item.data.result);
        if (nextResult === null) return;

        const normalizedResult = nextResult.trim().toLowerCase();
        if (!['goal', 'miss', 'blocked'].includes(normalizedResult)) {
          setError('Shot result must be goal, miss, or blocked');
          return;
        }

        await api.put(`/shots/${gameId}/${item.data.id}`, {
          result: normalizedResult,
          time_remaining: promptForTimeRemaining(item.data.time_remaining),
          ...(item.data.client_uuid ? { client_uuid: item.data.client_uuid } : {})
        });
      } else if (item.type === 'substitution') {
        const nextReason = window.prompt('Substitution reason (tactical, injury, fatigue, disciplinary):', item.data.reason);
        if (nextReason === null) return;

        const normalizedReason = nextReason.trim().toLowerCase();
        if (!['tactical', 'injury', 'fatigue', 'disciplinary'].includes(normalizedReason)) {
          setError('Substitution reason must be tactical, injury, fatigue, or disciplinary');
          return;
        }

        await api.put(`/substitutions/${gameId}/${item.data.id}`, {
          reason: normalizedReason,
          time_remaining: promptForTimeRemaining(item.data.time_remaining),
          ...(item.data.client_uuid ? { client_uuid: item.data.client_uuid } : {})
        });
      } else if (item.data.source_table === 'game_event') {
        const currentDescription = item.data.details && typeof item.data.details.description === 'string' ? item.data.details.description : '';
        const nextDescription = window.prompt('Event description:', currentDescription);
        if (nextDescription === null) return;

        await api.put(`/events/${gameId}/${item.data.id}`, {
          details: {
            ...(item.data.details || {}),
            description: nextDescription.trim() === '' ? null : nextDescription.trim()
          },
          time_remaining: promptForTimeRemaining(item.data.time_remaining),
          ...(item.data.client_uuid ? { client_uuid: item.data.client_uuid } : {})
        });
      } else if (item.data.source_table === 'free_shot') {
        const currentResult = item.data.details && typeof item.data.details.result === 'string' ? item.data.details.result : 'miss';
        const nextResult = window.prompt('Free shot result (goal, miss, blocked):', currentResult);
        if (nextResult === null) return;

        const normalizedResult = nextResult.trim().toLowerCase();
        if (!['goal', 'miss', 'blocked'].includes(normalizedResult)) {
          setError('Free shot result must be goal, miss, or blocked');
          return;
        }

        const nextReason = window.prompt('Free shot reason:', item.data.details && typeof item.data.details.reason === 'string' ? item.data.details.reason : '');
        if (nextReason === null) return;

        await api.put(`/free-shots/${item.data.id}`, {
          game_id: gameId,
          result: normalizedResult,
          reason: nextReason.trim() === '' ? null : nextReason.trim(),
          time_remaining: promptForTimeRemaining(item.data.time_remaining),
          ...(item.data.client_uuid ? { client_uuid: item.data.client_uuid } : {})
        });
      } else if (item.data.source_table === 'timeout') {
        const nextReason = window.prompt('Timeout reason:', item.data.details && typeof item.data.details.reason === 'string' ? item.data.details.reason : '');
        if (nextReason === null) return;

        const nextDuration = window.prompt('Timeout duration:', item.data.details && typeof item.data.details.duration === 'string' ? item.data.details.duration : '1 minute');
        if (nextDuration === null) return;

        await api.put(`/timeouts/${item.data.id}`, {
          game_id: gameId,
          reason: nextReason.trim() === '' ? null : nextReason.trim(),
          duration: nextDuration.trim() === '' ? null : nextDuration.trim(),
          time_remaining: promptForTimeRemaining(item.data.time_remaining),
          ...(item.data.client_uuid ? { client_uuid: item.data.client_uuid } : {})
        });
      } else {
        const nextTitle = window.prompt('Commentary title:', item.data.details && typeof item.data.details.title === 'string' ? item.data.details.title : '');
        if (nextTitle === null) return;

        const nextContent = window.prompt('Commentary content:', item.data.details && typeof item.data.details.content === 'string' ? item.data.details.content : '');
        if (nextContent === null) return;

        await api.put(`/match-commentary/${gameId}/${item.data.id}`, {
          title: nextTitle.trim() === '' ? null : nextTitle.trim(),
          content: nextContent.trim(),
          time_remaining: promptForTimeRemaining(item.data.time_remaining),
          ...(item.data.client_uuid ? { client_uuid: item.data.client_uuid } : {})
        });
      }

      await refreshAfterMutation();

      if (options?.confirmAfterSave) {
        await handleConfirmItem(item, options.nextPendingKey);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item');
    }
  };

  if (loading && events.length === 0 && shots.length === 0 && substitutions.length === 0) {
    return <div className="timeline-loading">Loading timeline...</div>;
  }

  return (
    <div className="match-timeline">
      <div className="timeline-header">
        <div>
          <h3>Match Timeline</h3>
          <div className="filter-stats">Showing {combinedTimeline.length} of {events.length + shots.length + substitutions.length} events</div>
        </div>
        <div className="timeline-actions">
          <button onClick={() => void fetchTimeline()} className="refresh-button" disabled={loading}>🔄 {loading ? 'Refreshing...' : 'Refresh'}</button>
          <button onClick={() => latestEditableItem && void handleEditItem(latestEditableItem)} className="edit-button" disabled={!latestEditableItem}>✏️ Edit Last Event</button>
          <button
            onClick={() => latestReviewableItem && void handleUpdateReviewStatus(latestReviewableItem, 'unconfirmed')}
            className="secondary-button"
            disabled={!latestReviewableItem || latestReviewableItem.data.event_status === 'unconfirmed'}
          >
            🏷️ Mark Last To Edit Later
          </button>
        </div>
      </div>

      {error && <div className="timeline-error">{error}</div>}

      {pendingItems.length > 0 && (
        <div className="timeline-pending-panel">
          <div className="timeline-header-row">
            <div className="timeline-info">
              <span className="event-type">Pending Review</span>
              <span className="detail-badge warning">{pendingItems.length} item{pendingItems.length === 1 ? '' : 's'}</span>
            </div>
          </div>
          <div className="timeline-list">
            {pendingItems.map((item, index) => {
              const itemKey = getItemKey(item);
              const nextPendingKey = pendingItems[index + 1] ? getItemKey(pendingItems[index + 1]) : pendingItems[index - 1] ? getItemKey(pendingItems[index - 1]) : null;
              const isSelected = activeSelectedPendingItem === itemKey;

              return (
                <div key={itemKey} className={`timeline-item event ${isSelected ? 'active' : ''}`}>
                  <div className="timeline-icon">🕒</div>
                  <div className="timeline-content">
                    <div className="timeline-header-row">
                      <div className="timeline-info">
                        <span className="event-type">{getPendingSummary(item)}</span>
                        {item.data.team_name && <span className="team-badge">{item.data.team_name}</span>}
                      </div>
                      <div className="timeline-meta">
                        <span className="period">P{item.data.period}</span>
                        {item.data.time_remaining && <span className="time">{formatTime(item.data.time_remaining)}</span>}
                      </div>
                    </div>
                    <div className="event-details">
                      <span className="detail-badge warning">Pending review</span>
                    </div>
                    <div className="timeline-actions">
                      <button onClick={() => void handleEditItem(item)} className="edit-button">✏️ Edit</button>
                      <button onClick={() => void handleConfirmItem(item)} className="save-button">✅ Confirm</button>
                      <button onClick={() => void handleEditItem(item, { confirmAfterSave: true, nextPendingKey })} className="primary-button">➡️ Confirm And Next</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="timeline-filters">
        <div className="filter-group">
          <label>Type:</label>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="all">All</option>
            <option value="shots">Shots</option>
            <option value="substitutions">Substitutions</option>
            <optgroup label="Original Events">
              <option value="foul">Fouls</option>
              <option value="timeout">Timeouts</option>
              <option value="period_start">Period Start</option>
              <option value="period_end">Period End</option>
            </optgroup>
            <optgroup label="Enhanced Events - Faults">
              <option value="fault_offensive">Offensive Faults</option>
              <option value="fault_defensive">Defensive Faults</option>
              <option value="fault_out_of_bounds">Out of Bounds</option>
            </optgroup>
            <optgroup label="Enhanced Events - Free Shots">
              <option value="free_shot_free_shot">Free Shots</option>
              <option value="free_shot_penalty">Penalties</option>
            </optgroup>
            <optgroup label="Enhanced Events - Timeouts">
              <option value="timeout_team">Team Timeouts</option>
              <option value="timeout_injury">Injury Timeouts</option>
              <option value="timeout_official">Official Timeouts</option>
              <option value="timeout_tv">TV Timeouts</option>
            </optgroup>
            <optgroup label="Enhanced Events - Commentary">
              <option value="commentary_note">Notes</option>
              <option value="commentary_highlight">Highlights</option>
              <option value="commentary_injury">Injury Reports</option>
              <option value="commentary_weather">Weather</option>
              <option value="commentary_technical">Technical</option>
            </optgroup>
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
      </div>

      <div className="timeline-list">
        {combinedTimeline.length === 0 ? (
          <div className="timeline-empty">No events to display</div>
        ) : (
          combinedTimeline.map((item) => {
            const itemKey = getItemKey(item);
            const isPending = item.data.event_status === 'unconfirmed';

            if (item.type === 'substitution') {
              const isHome = item.data.team_id === homeTeamId;

              return (
                <div key={itemKey} className={`timeline-item substitution ${isHome ? 'home' : 'away'}`}>
                  <div className="timeline-icon">🔄</div>
                  <div className="timeline-content">
                    <div className="timeline-header-row">
                      <div className="timeline-info">
                        <span className="event-type">SUBSTITUTION</span>
                        <span className="team-badge">{item.data.team_name}</span>
                        {isPending && <span className="detail-badge warning">Pending review</span>}
                      </div>
                      <div className="timeline-meta">
                        <span className="period">P{item.data.period}</span>
                        {item.data.time_remaining && <span className="time">{formatTime(item.data.time_remaining)}</span>}
                      </div>
                    </div>
                    <div className="substitution-details">
                      <div className="player-change">
                        <span className="player-out">⬇️ #{item.data.player_out_jersey_number} {item.data.player_out_first_name} {item.data.player_out_last_name}</span>
                        <span className="sub-arrow">→</span>
                        <span className="player-in">⬆️ #{item.data.player_in_jersey_number} {item.data.player_in_first_name} {item.data.player_in_last_name}</span>
                      </div>
                      <div className="sub-reason">
                        <span className="reason-badge">{item.data.reason}</span>
                      </div>
                    </div>
                    <div className="timeline-actions">
                      <button onClick={() => void handleEditItem(item)} className="edit-button">✏️ Edit</button>
                      {isPending ? (
                        <button onClick={() => void handleConfirmItem(item)} className="save-button">✅ Confirm</button>
                      ) : (
                        <button onClick={() => void handleUpdateReviewStatus(item, 'unconfirmed')} className="secondary-button">🏷️ Edit Later</button>
                      )}
                      <button onClick={() => void handleDeleteItem(item)} className="delete-button">🗑️ Delete</button>
                    </div>
                  </div>
                </div>
              );
            }

            if (item.type === 'shot') {
              const isHome = item.data.team_id === homeTeamId;

              return (
                <div key={itemKey} className={`timeline-item shot ${isHome ? 'home' : 'away'}`}>
                  <div className="timeline-icon">{getEventIcon('shot')}</div>
                  <div className="timeline-content">
                    <div className="timeline-header-row">
                      <div className="timeline-info">
                        <span className="event-type">SHOT - {getResultIcon(item.data.result)} {item.data.result.toUpperCase()}</span>
                        <span className="team-badge">{item.data.team_name}</span>
                        {isPending && <span className="detail-badge warning">Pending review</span>}
                      </div>
                      <div className="timeline-meta">
                        <span className="period">P{item.data.period}</span>
                        {item.data.time_remaining && <span className="time">{formatTime(item.data.time_remaining)}</span>}
                      </div>
                    </div>
                    <div className="timeline-player">#{item.data.jersey_number} {item.data.first_name} {item.data.last_name}</div>
                    <div className="timeline-actions">
                      <button onClick={() => void handleEditItem(item)} className="edit-button">✏️ Edit</button>
                      {isPending ? (
                        <button onClick={() => void handleConfirmItem(item)} className="save-button">✅ Confirm</button>
                      ) : (
                        <button onClick={() => void handleUpdateReviewStatus(item, 'unconfirmed')} className="secondary-button">🏷️ Edit Later</button>
                      )}
                      <button onClick={() => void handleDeleteItem(item)} className="delete-button">🗑️ Delete</button>
                    </div>
                  </div>
                </div>
              );
            }

            const isHome = item.data.team_id === homeTeamId;

            return (
              <div key={itemKey} className={`timeline-item event ${isHome ? 'home' : 'away'}`}>
                <div className="timeline-icon">{getEventIcon(item.data.event_type || 'unknown')}</div>
                <div className="timeline-content">
                  <div className="timeline-header-row">
                    <div className="timeline-info">
                      <span className="event-type">{formatEventTypeLabel(item.data.event_type || 'unknown')}</span>
                      {item.data.team_name && <span className="team-badge">{item.data.team_name}</span>}
                      {isPending && <span className="detail-badge warning">Pending review</span>}
                    </div>
                    <div className="timeline-meta">
                      <span className="period">P{item.data.period}</span>
                      {item.data.time_remaining && <span className="time">{formatTime(item.data.time_remaining)}</span>}
                    </div>
                  </div>

                  {item.data.player_id && <div className="timeline-player">#{item.data.jersey_number} {item.data.first_name} {item.data.last_name}</div>}

                  {renderEventDetails(item.data)}

                  <div className="timeline-actions">
                    <button onClick={() => void handleEditItem(item)} className="edit-button">✏️ Edit</button>
                    {supportsReviewStatus(item) && (isPending ? (
                      <button onClick={() => void handleConfirmItem(item)} className="save-button">✅ Confirm</button>
                    ) : (
                      <button onClick={() => void handleUpdateReviewStatus(item, 'unconfirmed')} className="secondary-button">🏷️ Edit Later</button>
                    ))}
                    <button onClick={() => void handleDeleteItem(item)} className="delete-button">🗑️ Delete</button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default MatchTimeline;
