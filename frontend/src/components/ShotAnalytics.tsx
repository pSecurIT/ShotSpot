import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import { useWebSocket } from '../hooks/useWebSocket';
import AchievementBadge from './AchievementBadge';
import Leaderboard from './Leaderboard';
import AchievementNotification from './AchievementNotification';
import InteractiveShotChart from './InteractiveShotChart';
const PlayerComparisonRadar = React.lazy(() => import('./PlayerComparisonRadar'));
import PossessionFlowDiagram from './PossessionFlowDiagram';
import { Achievement, LeaderboardPlayer } from '../types/achievements';
import api from '../utils/api';
import courtImageUrl from '../img/Korfbalveld-breed.PNG';
import '../styles/ShotAnalytics.css';

interface HeatmapBucket {
  x: number;
  y: number;
  count: number;
  goals: number;
  misses: number;
  blocked: number;
  success_rate: number;
}

interface HeatmapData {
  grid_size: number;
  data: HeatmapBucket[];
}

interface ShotChartShot {
  id: number;
  x_coord: number;
  y_coord: number;
  result: 'goal' | 'miss' | 'blocked';
  first_name: string;
  last_name: string;
  jersey_number: number;
  team_name: string;
  team_id: number;
  player_id: number;
  period: number;
  distance: number | null;
}

interface ZonePerformance {
  shots: number;
  goals: number;
  misses: number;
  blocked: number;
  success_rate: number;
}

interface PlayerStats {
  player_id: number;
  first_name: string;
  last_name: string;
  jersey_number: number;
  team_name: string;
  team_id: number;
  total_shots: number;
  goals: number;
  misses: number;
  blocked: number;
  field_goal_percentage: number;
  average_distance: number;
  play_time_seconds?: number;
  zone_performance: {
    left: ZonePerformance;
    center: ZonePerformance;
    right: ZonePerformance;
  };
}

interface TeamSummary {
  team_id: number;
  team_name: string;
  total_shots: number;
  goals: number;
  misses: number;
  blocked: number;
  fg_percentage: number;
}

interface Possession {
  id: number;
  game_id: number;
  team_id: number;
  period: number;
  started_at: string;
  ended_at: string | null;
  shots_taken: number;
  team_name?: string;
  duration?: number;
  result?: 'goal' | 'turnover' | 'end_period' | 'active';
}

interface GameSummary {
  overall: {
    total_shots: number;
    total_goals: number;
    total_misses: number;
    total_blocked: number;
    overall_fg_percentage: number;
  };
  by_team: TeamSummary[];
}

// Phase 3 interfaces
interface PlayerStreak {
  player_id: number;
  first_name: string;
  last_name: string;
  jersey_number: number;
  team_name: string;
  current_streak: number;
  current_streak_type: 'makes' | 'misses';
  longest_make_streak: number;
  longest_miss_streak: number;
}

interface Zone {
  zone_x: number;
  zone_y: number;
  min_x: number;
  max_x: number;
  min_y: number;
  max_y: number;
  shots: number;
  goals: number;
  fg_percentage: number;
  overall_fg: number;
  difference: number;
  is_significant: boolean;
  zone_type: 'hot' | 'cold' | 'neutral';
}

interface ZoneAnalysis {
  overall_fg_percentage: number;
  zones: Zone[];
}

interface PeriodTrend {
  period: number;
  total_shots: number;
  goals: number;
  misses: number;
  blocked: number;
  fg_percentage: number;
  avg_distance: number;
  players_with_shots: number;
  trend: 'improving' | 'declining' | 'stable' | null;
  fg_change: number | null;
}

// Phase 4: Historical & Comparative Analytics interfaces
interface PlayerDevelopment {
  game_id: number;
  game_date: string;
  team_name: string;
  shots: number;
  goals: number;
  fg_percentage: number;
  avg_distance: number;
  improvement: number | null;
}

interface TeamTendencies {
  overall: {
    games_played: number;
    total_shots: number;
    total_goals: number;
    avg_fg_percentage: number;
    avg_distance: number;
    avg_shot_location: {
      x: number;
      y: number;
    };
  };
  zone_preferences: Array<{
    zone: string;
    shots: number;
    goals: number;
    fg_percentage: number;
  }>;
  top_shooters: Array<{
    player_id: number;
    first_name: string;
    last_name: string;
    jersey_number: number;
    shots: number;
    goals: number;
    fg_percentage: number;
  }>;
}

interface MatchupAnalysis {
  games_played: number;
  game_dates: string[];
  team_stats: {
    total_shots: number;
    total_goals: number;
    avg_fg_percentage: number;
    avg_distance: number;
  };
  opponent_stats: {
    total_shots: number;
    total_goals: number;
    avg_fg_percentage: number;
    avg_distance: number;
  };
}

type AnalyticsView = 'heatmap' | 'shot-chart' | 'players' | 'summary' | 'charts' | 'performance' | 'historical' | 'achievements' | 'interactive' | 'comparison' | 'possession';

const ShotAnalytics: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { socket, joinGame, leaveGame } = useWebSocket();
  const [activeView, setActiveView] = useState<AnalyticsView>('heatmap');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Data states
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);
  const [shotChartData, setShotChartData] = useState<ShotChartShot[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [gameSummary, setGameSummary] = useState<GameSummary | null>(null);
  
  // Phase 3 data states
  const [streaks, setStreaks] = useState<PlayerStreak[]>([]);
  const [zoneAnalysis, setZoneAnalysis] = useState<ZoneAnalysis | null>(null);
  const [trends, setTrends] = useState<PeriodTrend[]>([]);

  // Phase 4 data states
  const [playerDevelopment, setPlayerDevelopment] = useState<PlayerDevelopment[]>([]);
  const [teamTendencies, setTeamTendencies] = useState<TeamTendencies | null>(null);
  const [matchupAnalysis, setMatchupAnalysis] = useState<MatchupAnalysis | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [selectedOpponentId, setSelectedOpponentId] = useState<number | null>(null);

  // Phase 6 achievements data states
  const [allAchievements, setAllAchievements] = useState<Achievement[]>([]);
  const [playerAchievements, setPlayerAchievements] = useState<Achievement[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardPlayer[]>([]);
  const [selectedAchievementPlayer, setSelectedAchievementPlayer] = useState<number | null>(null);
  const [leaderboardType, setLeaderboardType] = useState<'global' | 'team'>('global');
  const [unlockedAchievement, setUnlockedAchievement] = useState<Achievement | null>(null);

  // New visualization states
  const [possessions, setPossessions] = useState<Possession[]>([]);
  const [comparisonPlayers, setComparisonPlayers] = useState<PlayerStats[]>([]);

  // Filter states
  const [gridSize, setGridSize] = useState(10);
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);

  // Sorting states for player stats
  const [sortColumn, setSortColumn] = useState<keyof PlayerStats | 'play_time'>('goals');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Available teams and periods (extracted from data)
  const [teams, setTeams] = useState<{ id: number; name: string }[]>([]);
  const [periods, setPeriods] = useState<number[]>([]);

  // Phase 1: Enhanced visualization states
  const [selectedShot, setSelectedShot] = useState<ShotChartShot | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [animatedPeriod, setAnimatedPeriod] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // Court ref for positioning
  const courtRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Fetch heatmap data
  const fetchHeatmap = useCallback(async () => {
    if (!gameId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      params.append('grid_size', gridSize.toString());
      if (selectedTeam) params.append('team_id', selectedTeam.toString());
      if (selectedPeriod) params.append('period', selectedPeriod.toString());

      const response = await api.get<HeatmapData>(`/analytics/shots/${gameId}/heatmap?${params}`);
      setHeatmapData(response.data);
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      setError(error.response?.data?.error || 'Failed to load heatmap data');
    } finally {
      setLoading(false);
    }
  }, [gameId, gridSize, selectedTeam, selectedPeriod]);

  // Fetch shot chart data
  const fetchShotChart = useCallback(async () => {
    if (!gameId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (selectedTeam) params.append('team_id', selectedTeam.toString());
      if (selectedPeriod) params.append('period', selectedPeriod.toString());
      if (selectedPlayer) params.append('player_id', selectedPlayer.toString());

      const response = await api.get<ShotChartShot[]>(`/analytics/shots/${gameId}/shot-chart?${params}`);
      setShotChartData(response.data);
      
      // Extract unique teams and periods
      const uniqueTeams = Array.from(new Set(response.data.map(s => ({ id: s.team_id, name: s.team_name }))))
        .filter((team, index, self) => self.findIndex(t => t.id === team.id) === index);
      const uniquePeriods = Array.from(new Set(response.data.map(s => s.period))).sort();
      
      setTeams(uniqueTeams);
      setPeriods(uniquePeriods);
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      setError(error.response?.data?.error || 'Failed to load shot chart data');
    } finally {
      setLoading(false);
    }
  }, [gameId, selectedTeam, selectedPeriod, selectedPlayer]);

  // Fetch player statistics
  const fetchPlayerStats = useCallback(async () => {
    if (!gameId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (selectedTeam) params.append('team_id', selectedTeam.toString());

      const response = await api.get<PlayerStats[]>(`/analytics/shots/${gameId}/players?${params}`);
      setPlayerStats(response.data);
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      setError(error.response?.data?.error || 'Failed to load player statistics');
    } finally {
      setLoading(false);
    }
  }, [gameId, selectedTeam]);

  // Fetch game summary
  const fetchGameSummary = useCallback(async () => {
    if (!gameId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get<GameSummary>(`/analytics/shots/${gameId}/summary`);
      setGameSummary(response.data);
      
      // Extract teams from summary
      const teamList = response.data.by_team.map(t => ({ id: t.team_id, name: t.team_name }));
      setTeams(teamList);
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      setError(error.response?.data?.error || 'Failed to load game summary');
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  // Phase 3: Fetch streak data
  const fetchStreaks = useCallback(async () => {
    if (!gameId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (selectedTeam) params.append('team_id', selectedTeam.toString());

      const response = await api.get<PlayerStreak[]>(`/analytics/shots/${gameId}/streaks?${params}`);
      setStreaks(response.data);
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      setError(error.response?.data?.error || 'Failed to load streak data');
    } finally {
      setLoading(false);
    }
  }, [gameId, selectedTeam]);

  // Phase 3: Fetch zone analysis
  const fetchZoneAnalysis = useCallback(async () => {
    if (!gameId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (selectedTeam) params.append('team_id', selectedTeam.toString());

      const response = await api.get<ZoneAnalysis>(`/analytics/shots/${gameId}/zones?${params}`);
      setZoneAnalysis(response.data);
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      setError(error.response?.data?.error || 'Failed to load zone analysis');
    } finally {
      setLoading(false);
    }
  }, [gameId, selectedTeam]);

  // Phase 3: Fetch period trends
  const fetchTrends = useCallback(async () => {
    if (!gameId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (selectedTeam) params.append('team_id', selectedTeam.toString());

      const response = await api.get<PeriodTrend[]>(`/analytics/shots/${gameId}/trends?${params}`);
      setTrends(response.data);
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      setError(error.response?.data?.error || 'Failed to load trend data');
    } finally {
      setLoading(false);
    }
  }, [gameId, selectedTeam]);

  // Phase 4: Fetch player development
  const fetchPlayerDevelopment = useCallback(async () => {
    if (!selectedPlayerId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (selectedTeam) params.append('team_id', selectedTeam.toString());
      params.append('limit', '10');

      const response = await api.get<PlayerDevelopment[]>(`/analytics/players/${selectedPlayerId}/development?${params}`);
      setPlayerDevelopment(response.data);
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      setError(error.response?.data?.error || 'Failed to load player development data');
    } finally {
      setLoading(false);
    }
  }, [selectedPlayerId, selectedTeam]);

  // Phase 4: Fetch team tendencies
  const fetchTeamTendencies = useCallback(async () => {
    if (!selectedTeam) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      params.append('limit', '10');

      const response = await api.get<TeamTendencies>(`/analytics/teams/${selectedTeam}/tendencies?${params}`);
      setTeamTendencies(response.data);
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      setError(error.response?.data?.error || 'Failed to load team tendencies');
    } finally {
      setLoading(false);
    }
  }, [selectedTeam]);

  // Phase 4: Fetch matchup analysis
  const fetchMatchupAnalysis = useCallback(async () => {
    if (!selectedTeam || !selectedOpponentId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      params.append('limit', '5');

      const response = await api.get<MatchupAnalysis>(`/analytics/teams/${selectedTeam}/matchup/${selectedOpponentId}?${params}`);
      setMatchupAnalysis(response.data);
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      setError(error.response?.data?.error || 'Failed to load matchup analysis');
    } finally {
      setLoading(false);
    }
  }, [selectedTeam, selectedOpponentId]);

  // Phase 6: Fetch all achievements
  const fetchAchievements = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get<Achievement[]>('/achievements/list');
      setAllAchievements(response.data);
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      setError(error.response?.data?.error || 'Failed to load achievements');
    } finally {
      setLoading(false);
    }
  }, []);

  // Phase 6: Fetch player achievements
  const fetchPlayerAchievements = useCallback(async () => {
    if (!selectedAchievementPlayer) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get<{ achievements: Achievement[]; total_points: number }>(`/achievements/player/${selectedAchievementPlayer}`);
      setPlayerAchievements(response.data.achievements || []);
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      setError(error.response?.data?.error || 'Failed to load player achievements');
      setPlayerAchievements([]); // Reset to empty array on error
    } finally {
      setLoading(false);
    }
  }, [selectedAchievementPlayer]);

  // Phase 6: Fetch leaderboard
  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      if (leaderboardType === 'global') {
        const response = await api.get<{ season: string; leaderboard: LeaderboardPlayer[] }>('/achievements/leaderboard');
        setLeaderboard(response.data.leaderboard || []);
      } else if (selectedTeam) {
        const response = await api.get<{ team_id: number; leaderboard: LeaderboardPlayer[] }>(`/achievements/team/${selectedTeam}/leaderboard`);
        setLeaderboard(response.data.leaderboard || []);
      } else {
        setError('Please select a team for team leaderboard');
        setLoading(false);
        return;
      }
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      setError(error.response?.data?.error || 'Failed to load leaderboard');
      setLeaderboard([]); // Reset to empty array on error
    } finally {
      setLoading(false);
    }
  }, [leaderboardType, selectedTeam]);

  // New: Fetch possessions data
  const fetchPossessions = useCallback(async () => {
    if (!gameId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get<Possession[]>(`/possessions/${gameId}`);
      // Calculate duration for each possession
      const possessionsWithDuration = response.data.map(p => ({
        ...p,
        duration: p.ended_at 
          ? Math.floor((new Date(p.ended_at).getTime() - new Date(p.started_at).getTime()) / 1000)
          : 0
      }));
      setPossessions(possessionsWithDuration);
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      setError(error.response?.data?.error || 'Failed to load possession data');
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  // Phase 5: WebSocket connection - join/leave game room
  useEffect(() => {
    if (!gameId || !socket) return;

    const gameIdNum = parseInt(gameId);
    joinGame(gameIdNum);

    return () => {
      leaveGame(gameIdNum);
    };
  }, [gameId, socket, joinGame, leaveGame]);

  // Phase 5: WebSocket event listeners for real-time updates
  useEffect(() => {
    if (!socket || !autoRefresh) return;

    const handleAnalyticsUpdate = () => {
      console.log('🔄 Analytics update received, refreshing current view...');
      
      // Refresh current view data
      switch (activeView) {
        case 'heatmap':
          fetchHeatmap();
          break;
        case 'shot-chart':
          fetchShotChart();
          break;
        case 'players':
          fetchPlayerStats();
          break;
        case 'summary':
          fetchGameSummary();
          break;
        case 'charts':
          fetchShotChart();
          fetchPlayerStats();
          break;
        case 'performance':
          fetchStreaks();
          fetchZoneAnalysis();
          fetchTrends();
          break;
        case 'historical':
          if (selectedPlayerId) fetchPlayerDevelopment();
          if (selectedTeam) fetchTeamTendencies();
          if (selectedTeam && selectedOpponentId) fetchMatchupAnalysis();
          break;
        case 'achievements':
          fetchAchievements();
          if (selectedAchievementPlayer) fetchPlayerAchievements();
          fetchLeaderboard();
          break;
      }
    };

    socket.on('analytics-update', handleAnalyticsUpdate);

    // Phase 6: Listen for achievement unlocked events
    const handleAchievementUnlocked = (data: { achievement: Achievement; player_id: number }) => {
      console.log('🏆 Achievement unlocked:', data);
      setUnlockedAchievement(data.achievement);
      
      // Refresh achievements if viewing achievements tab
      if (activeView === 'achievements') {
        fetchAchievements();
        if (selectedAchievementPlayer === data.player_id) {
          fetchPlayerAchievements();
        }
        fetchLeaderboard();
      }
    };

    socket.on('achievement-unlocked', handleAchievementUnlocked);

    return () => {
      socket.off('analytics-update', handleAnalyticsUpdate);
      socket.off('achievement-unlocked', handleAchievementUnlocked);
    };
  }, [socket, autoRefresh, activeView, fetchHeatmap, fetchShotChart, fetchPlayerStats, fetchGameSummary, fetchStreaks, fetchZoneAnalysis, fetchTrends, fetchPlayerDevelopment, fetchTeamTendencies, fetchMatchupAnalysis, fetchAchievements, fetchPlayerAchievements, fetchLeaderboard, selectedPlayerId, selectedTeam, selectedOpponentId, selectedAchievementPlayer]);

  // Load data when view changes
  useEffect(() => {
    switch (activeView) {
      case 'heatmap':
        fetchHeatmap();
        break;
      case 'shot-chart':
        fetchShotChart();
        break;
      case 'interactive':
        // Interactive shot chart needs shot data
        fetchShotChart();
        break;
      case 'comparison':
        // Comparison view needs player stats
        fetchPlayerStats();
        if (teams.length === 0) fetchGameSummary();
        break;
      case 'possession':
        // Possession flow needs possessions data
        fetchPossessions();
        if (teams.length === 0) fetchGameSummary();
        break;
      case 'players':
        fetchPlayerStats();
        // Fetch game summary to populate teams dropdown
        if (teams.length === 0) fetchGameSummary();
        break;
      case 'summary':
        fetchGameSummary();
        break;
      case 'charts':
        // Charts view needs both shot chart and player stats data
        fetchShotChart();
        fetchPlayerStats();
        break;
      case 'performance':
        // Performance view needs streaks, zones, and trends
        fetchStreaks();
        fetchZoneAnalysis();
        fetchTrends();
        break;
      case 'historical':
        // Historical view needs player development, team tendencies, and matchup analysis
        if (selectedPlayerId) fetchPlayerDevelopment();
        if (selectedTeam) fetchTeamTendencies();
        if (selectedTeam && selectedOpponentId) fetchMatchupAnalysis();
        break;
      case 'achievements':
        // Achievements view needs all achievements and leaderboard
        fetchAchievements();
        fetchLeaderboard();
        break;
    }
  }, [activeView, fetchHeatmap, fetchShotChart, fetchPlayerStats, fetchGameSummary, fetchStreaks, fetchZoneAnalysis, fetchTrends, fetchPlayerDevelopment, fetchTeamTendencies, fetchMatchupAnalysis, fetchAchievements, fetchLeaderboard, fetchPossessions, selectedPlayerId, selectedTeam, selectedOpponentId, teams.length]);

  // Fetch player achievements when player selection changes
  useEffect(() => {
    if (activeView === 'achievements' && selectedAchievementPlayer) {
      fetchPlayerAchievements();
    }
  }, [activeView, selectedAchievementPlayer, fetchPlayerAchievements]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle if not in input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      // Close modal with Escape
      if (e.key === 'Escape' && selectedShot) {
        setSelectedShot(null);
        return;
      }

      // Tab switching with numbers 1-8
      const views: AnalyticsView[] = ['heatmap', 'shot-chart', 'players', 'summary', 'charts', 'performance', 'historical', 'achievements'];
      const keyNum = parseInt(e.key);
      if (keyNum >= 1 && keyNum <= 8) {
        setActiveView(views[keyNum - 1]);
        return;
      }

      // Arrow left/right for zoom in shot-chart view
      if (activeView === 'shot-chart') {
        if (e.key === 'ArrowRight' && zoomLevel < 3) {
          setZoomLevel(prev => Math.min(prev + 0.25, 3));
        } else if (e.key === 'ArrowLeft' && zoomLevel > 1) {
          setZoomLevel(prev => Math.max(prev - 0.25, 1));
        } else if (e.key === '0') {
          setZoomLevel(1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [activeView, selectedShot, zoomLevel]);

  // Get color for heatmap bucket based on intensity
  const getHeatmapColor = (count: number, maxCount: number): string => {
    if (count === 0) return 'rgba(76, 175, 80, 0)';
    
    const intensity = count / maxCount;
    
    // Create a green -> yellow -> red gradient
    let red: number;
    let green: number;
    
    if (intensity < 0.5) {
      // Green to yellow (0-50% intensity)
      red = Math.round(255 * (intensity * 2));
      green = 220;
    } else {
      // Yellow to red (50-100% intensity)
      red = 255;
      green = Math.round(220 * (1 - ((intensity - 0.5) * 2)));
    }
    
    const alpha = 0.4 + (intensity * 0.5); // 0.4 to 0.9 opacity
    
    return `rgba(${red}, ${green}, 0, ${alpha})`;
  };

  // Get color for shot marker
  const getShotColor = (result: 'goal' | 'miss' | 'blocked'): string => {
    switch (result) {
      case 'goal': return '#4CAF50';
      case 'miss': return '#f44336';
      case 'blocked': return '#FF9800';
    }
  };

  // Get marker symbol for shot
  const getShotMarker = (result: 'goal' | 'miss' | 'blocked'): string => {
    switch (result) {
      case 'goal': return '●';
      case 'miss': return '✕';
      case 'blocked': return '◼';
    }
  };

  // Render heatmap view
  const renderHeatmap = () => {
    if (!heatmapData) {
      return (
        <div className="analytics-view">
          <div className="empty-state">
            <p>No heatmap data available. Shots will appear here once they are recorded.</p>
          </div>
        </div>
      );
    }

    if (heatmapData.data.length === 0) {
      return (
        <div className="analytics-view">
          <div className="empty-state">
            <p>No shot data for the selected filters. Try changing team or period filters.</p>
          </div>
        </div>
      );
    }

    const maxCount = Math.max(...heatmapData.data.map(b => b.count), 1);

    return (
      <div className="analytics-view">
        <div className="analytics-controls">
          <div className="control-group">
            <label>Grid Size:</label>
            <select value={gridSize} onChange={(e) => setGridSize(Number(e.target.value))}>
              <option value={5}>5x5</option>
              <option value={10}>10x10</option>
              <option value={15}>15x15</option>
              <option value={20}>20x20</option>
            </select>
          </div>
          <div className="control-group">
            <label>Team:</label>
            <select value={selectedTeam || ''} onChange={(e) => setSelectedTeam(e.target.value ? Number(e.target.value) : null)}>
              <option value="">All Teams</option>
              {teams.map(team => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </div>
          <div className="control-group">
            <label>Period:</label>
            <select value={selectedPeriod || ''} onChange={(e) => setSelectedPeriod(e.target.value ? Number(e.target.value) : null)}>
              <option value="">All Periods</option>
              {periods.map(period => (
                <option key={period} value={period}>Period {period}</option>
              ))}
            </select>
          </div>
        </div>

        {periods.length > 1 && (
          <div className="animation-controls">
            <button 
              onClick={async () => {
                if (!isAnimating) {
                  setIsAnimating(true);
                  const originalPeriod = selectedPeriod;
                  
                  for (let i = 0; i < periods.length; i++) {
                    setAnimatedPeriod(periods[i]);
                    setSelectedPeriod(periods[i]);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                  }
                  
                  setIsAnimating(false);
                  setAnimatedPeriod(null);
                  setSelectedPeriod(originalPeriod);
                }
              }}
              disabled={isAnimating}
            >
              {isAnimating ? 'Animating...' : 'Animate by Period'}
            </button>
            {isAnimating && animatedPeriod && (
              <span className="animation-status">Showing Period {animatedPeriod}</span>
            )}
          </div>
        )}

        <div className="court-container" ref={courtRef}>
          <img 
            ref={imageRef}
            src={courtImageUrl} 
            alt="Korfball Court" 
            className="court-image"
          />
          <div className="heatmap-overlay">
            {heatmapData.data.map((bucket, index) => {
              const bucketWidth = 100 / heatmapData.grid_size;
              const bucketHeight = 100 / heatmapData.grid_size;
              // bucket.x and bucket.y are coordinate values (0-100), not indices
              // So we just use them directly as percentages
              const leftPos = bucket.x;
              const topPos = bucket.y;
              const bgColor = getHeatmapColor(bucket.count, maxCount);
              
              return (
                <div
                  key={index}
                  className="heatmap-bucket"
                  style={{
                    left: `${leftPos}%`,
                    top: `${topPos}%`,
                    width: `${bucketWidth}%`,
                    height: `${bucketHeight}%`,
                    backgroundColor: bgColor,
                    border: bucket.count > 0 ? '1px solid rgba(0,0,0,0.1)' : 'none'
                  }}
                  title={`Shots: ${bucket.count}\nGoals: ${bucket.goals}\nSuccess: ${bucket.success_rate}%`}
                >
                  {bucket.count > 0 && (
                    <div className="bucket-label">
                      <div className="bucket-count">{bucket.count}</div>
                      <div className="bucket-rate">{bucket.success_rate}%</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="heatmap-legend">
          <h4>Shot Density Heatmap</h4>
          <p>Darker colors indicate more shots taken from that location</p>
          <div className="legend-scale">
            <span>Low</span>
            <div className="gradient-bar"></div>
            <span>High</span>
          </div>
        </div>
      </div>
    );
  };

  // Render shot chart view
  const renderShotChart = () => {
    if (shotChartData.length === 0) {
      return (
        <div className="analytics-view">
          <div className="empty-state">
            <p>No shots recorded yet. Shot markers will appear on the court once shots are recorded.</p>
          </div>
        </div>
      );
    }

    const availablePlayers = Array.from(new Set(shotChartData.map(s => ({
      id: s.player_id,
      name: `#${s.jersey_number} ${s.first_name} ${s.last_name}`
    })))).filter((player, index, self) => 
      self.findIndex(p => p.id === player.id) === index
    );

    return (
      <div className="analytics-view">
        <div className="analytics-controls">
          <div className="control-group">
            <label>Team:</label>
            <select value={selectedTeam || ''} onChange={(e) => setSelectedTeam(e.target.value ? Number(e.target.value) : null)}>
              <option value="">All Teams</option>
              {teams.map(team => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </div>
          <div className="control-group">
            <label>Player:</label>
            <select value={selectedPlayer || ''} onChange={(e) => setSelectedPlayer(e.target.value ? Number(e.target.value) : null)}>
              <option value="">All Players</option>
              {availablePlayers.map(player => (
                <option key={player.id} value={player.id}>{player.name}</option>
              ))}
            </select>
          </div>
          <div className="control-group">
            <label>Period:</label>
            <select value={selectedPeriod || ''} onChange={(e) => setSelectedPeriod(e.target.value ? Number(e.target.value) : null)}>
              <option value="">All Periods</option>
              {periods.map(period => (
                <option key={period} value={period}>Period {period}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="zoom-controls">
          <button onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 3))} disabled={zoomLevel >= 3}>
            Zoom In (+)
          </button>
          <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
          <button onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 1))} disabled={zoomLevel <= 1}>
            Zoom Out (-)
          </button>
          <button onClick={() => setZoomLevel(1)} disabled={zoomLevel === 1}>
            Reset
          </button>
        </div>

        {shotChartData.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎯</div>
            <h3>No Shots Recorded</h3>
            <p>No shots have been recorded for this game yet. Start tracking shots to see them visualized here.</p>
          </div>
        ) : (
          <>
            <div className="court-container" ref={courtRef} style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center', transition: 'transform 0.3s ease' }}>
              <img 
                ref={imageRef}
                src={courtImageUrl} 
                alt="Korfball Court" 
                className="court-image"
              />
              <div className="shot-markers-overlay">
                {shotChartData.map((shot) => (
              <div
                key={shot.id}
                className={`shot-marker ${shot.result}`}
                style={{
                  left: `${shot.x_coord}%`,
                  top: `${shot.y_coord}%`,
                  backgroundColor: getShotColor(shot.result),
                }}
                onClick={() => setSelectedShot(shot)}
              >
                {getShotMarker(shot.result)}
              </div>
            ))}
          </div>
        </div>

        {selectedShot && (
          <div className="shot-modal-overlay" onClick={() => setSelectedShot(null)}>
            <div className="shot-modal" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setSelectedShot(null)}>×</button>
              <h3>Shot Details</h3>
              <div className="modal-content">
                <div className="modal-section">
                  <h4>Player</h4>
                  <p>#{selectedShot.jersey_number} {selectedShot.first_name} {selectedShot.last_name}</p>
                  <p className="team-name">{selectedShot.team_name}</p>
                </div>
                <div className="modal-section">
                  <h4>Shot Information</h4>
                  <p><strong>Result:</strong> <span className={`result-badge ${selectedShot.result}`}>{selectedShot.result.toUpperCase()}</span></p>
                  <p><strong>Period:</strong> {selectedShot.period}</p>
                  <p><strong>Distance:</strong> {selectedShot.distance ? `${selectedShot.distance}m` : 'N/A'}</p>
                </div>
                <div className="modal-section">
                  <h4>Location</h4>
                  <p><strong>X:</strong> {selectedShot.x_coord.toFixed(1)}%</p>
                  <p><strong>Y:</strong> {selectedShot.y_coord.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          </div>
        )}

            <div className="shot-chart-legend">
              <h4>Shot Chart</h4>
              <div className="legend-items">
                <div className="legend-item">
                  <span className="marker goal">●</span>
                  <span>Goal ({shotChartData.filter(s => s.result === 'goal').length})</span>
                </div>
                <div className="legend-item">
                  <span className="marker miss">✕</span>
                  <span>Miss ({shotChartData.filter(s => s.result === 'miss').length})</span>
                </div>
                <div className="legend-item">
                  <span className="marker blocked">◼</span>
                  <span>Blocked ({shotChartData.filter(s => s.result === 'blocked').length})</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  // Export data to CSV
  const exportToCSV = (data: unknown[], filename: string) => {
    if (!data || data.length === 0) return;
    
    // Convert data to CSV
    const headers = Object.keys(data[0] as Record<string, unknown>);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = (row as Record<string, unknown>)[header];
          // Handle nested objects and escape commas
          const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
          return `"${strValue.replace(/"/g, '""')}"`;
        }).join(',')
      )
    ].join('\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Render player statistics view
  const handleSort = (column: keyof PlayerStats | 'play_time') => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const getSortedPlayerStats = () => {
    return [...playerStats].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      if (sortColumn === 'play_time') {
        aValue = a.play_time_seconds || 0;
        bValue = b.play_time_seconds || 0;
      } else if (sortColumn === 'first_name' || sortColumn === 'last_name') {
        aValue = a[sortColumn].toLowerCase();
        bValue = b[sortColumn].toLowerCase();
      } else if (sortColumn === 'team_name') {
        aValue = a.team_name.toLowerCase();
        bValue = b.team_name.toLowerCase();
      } else if (sortColumn === 'average_distance') {
        aValue = a.average_distance || 0;
        bValue = b.average_distance || 0;
      } else {
        // For numeric columns (total_shots, goals, misses, blocked, field_goal_percentage)
        aValue = a[sortColumn] as number;
        bValue = b[sortColumn] as number;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const renderSortIcon = (column: keyof PlayerStats | 'play_time') => {
    if (sortColumn !== column) return ' ⇅';
    return sortDirection === 'asc' ? ' ▲' : ' ▼';
  };

  const renderPlayerStats = () => {
    const sortedStats = getSortedPlayerStats();

    return (
      <div className="analytics-view">
        <div className="analytics-controls">
          <div className="control-group">
            <label>Team:</label>
            <select value={selectedTeam || ''} onChange={(e) => setSelectedTeam(e.target.value ? Number(e.target.value) : null)}>
              <option value="">All Teams</option>
              {teams.map(team => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </div>
          <button 
            className="export-button"
            onClick={() => exportToCSV(playerStats, `player_stats_game_${gameId}`)}
            disabled={playerStats.length === 0}
          >
            📥 Export CSV
          </button>
        </div>

        <div className="player-stats-table">
          <table>
            <thead>
              <tr>
                <th onClick={() => handleSort('last_name')} style={{ cursor: 'pointer' }}>
                  Player{renderSortIcon('last_name')}
                </th>
                <th onClick={() => handleSort('team_name')} style={{ cursor: 'pointer' }}>
                  Team{renderSortIcon('team_name')}
                </th>
                <th onClick={() => handleSort('total_shots')} style={{ cursor: 'pointer' }}>
                  Shots{renderSortIcon('total_shots')}
                </th>
                <th onClick={() => handleSort('goals')} style={{ cursor: 'pointer' }}>
                  Goals{renderSortIcon('goals')}
                </th>
                <th onClick={() => handleSort('misses')} style={{ cursor: 'pointer' }}>
                  Misses{renderSortIcon('misses')}
                </th>
                <th onClick={() => handleSort('blocked')} style={{ cursor: 'pointer' }}>
                  Blocked{renderSortIcon('blocked')}
                </th>
                <th onClick={() => handleSort('field_goal_percentage')} style={{ cursor: 'pointer' }}>
                  FG%{renderSortIcon('field_goal_percentage')}
                </th>
                <th onClick={() => handleSort('average_distance')} style={{ cursor: 'pointer' }}>
                  Avg Dist{renderSortIcon('average_distance')}
                </th>
                <th onClick={() => handleSort('play_time')} style={{ cursor: 'pointer' }}>
                  Play Time{renderSortIcon('play_time')}
                </th>
                <th>Left Zone</th>
                <th>Center Zone</th>
                <th>Right Zone</th>
              </tr>
            </thead>
            <tbody>
              {sortedStats.map((player) => {
                const playTimeMinutes = player.play_time_seconds 
                  ? Math.floor(player.play_time_seconds / 60)
                  : 0;
                const playTimeSeconds = player.play_time_seconds 
                  ? player.play_time_seconds % 60
                  : 0;
                const playTimeDisplay = player.play_time_seconds 
                  ? `${playTimeMinutes}:${playTimeSeconds.toString().padStart(2, '0')}`
                  : '-';

                return (
                  <tr key={player.player_id}>
                    <td className="player-name">
                      #{player.jersey_number} {player.first_name} {player.last_name}
                    </td>
                    <td>{player.team_name}</td>
                    <td className="stat-number">{player.total_shots}</td>
                    <td className="stat-number success">{player.goals}</td>
                    <td className="stat-number miss">{player.misses}</td>
                    <td className="stat-number blocked">{player.blocked}</td>
                    <td className="stat-number fg-percentage">{player.field_goal_percentage}%</td>
                    <td className="stat-number">{player.average_distance ? `${player.average_distance}m` : '-'}</td>
                    <td className="stat-number">{playTimeDisplay}</td>
                    <td className="zone-stat">
                      <div className="zone-detail">
                        <span className="zone-shots">{player.zone_performance.left.shots} shots</span>
                        <span className="zone-rate">{player.zone_performance.left.success_rate}%</span>
                      </div>
                    </td>
                    <td className="zone-stat">
                      <div className="zone-detail">
                        <span className="zone-shots">{player.zone_performance.center.shots} shots</span>
                        <span className="zone-rate">{player.zone_performance.center.success_rate}%</span>
                      </div>
                    </td>
                    <td className="zone-stat">
                      <div className="zone-detail">
                        <span className="zone-shots">{player.zone_performance.right.shots} shots</span>
                        <span className="zone-rate">{player.zone_performance.right.success_rate}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Render game summary view
  const renderGameSummary = () => {
    if (!gameSummary) return null;

    return (
      <div className="analytics-view summary-view">
        <div className="summary-section overall-stats">
          <h3>Overall Game Statistics</h3>
          <div className="stat-cards">
            <div className="stat-card">
              <div className="stat-value">{gameSummary.overall.total_shots}</div>
              <div className="stat-label">Total Shots</div>
            </div>
            <div className="stat-card success">
              <div className="stat-value">{gameSummary.overall.total_goals}</div>
              <div className="stat-label">Goals</div>
            </div>
            <div className="stat-card miss">
              <div className="stat-value">{gameSummary.overall.total_misses}</div>
              <div className="stat-label">Misses</div>
            </div>
            <div className="stat-card blocked">
              <div className="stat-value">{gameSummary.overall.total_blocked}</div>
              <div className="stat-label">Blocked</div>
            </div>
            <div className="stat-card fg">
              <div className="stat-value">{gameSummary.overall.overall_fg_percentage}%</div>
              <div className="stat-label">Field Goal %</div>
            </div>
          </div>
        </div>

        <div className="summary-section team-comparison">
          <h3>Team Comparison</h3>
          <div className="team-stats-grid">
            {gameSummary.by_team.map((team) => (
              <div key={team.team_id} className="team-stat-card">
                <h4>{team.team_name}</h4>
                <div className="team-stats">
                  <div className="team-stat-row">
                    <span className="label">Shots:</span>
                    <span className="value">{team.total_shots}</span>
                  </div>
                  <div className="team-stat-row">
                    <span className="label">Goals:</span>
                    <span className="value success">{team.goals}</span>
                  </div>
                  <div className="team-stat-row">
                    <span className="label">Misses:</span>
                    <span className="value miss">{team.misses}</span>
                  </div>
                  <div className="team-stat-row">
                    <span className="label">Blocked:</span>
                    <span className="value blocked">{team.blocked}</span>
                  </div>
                  <div className="team-stat-row highlight">
                    <span className="label">FG%:</span>
                    <span className="value">{team.fg_percentage}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Render advanced charts view (Phase 2)
  const renderAdvancedCharts = () => {
    // Prepare data for line chart (Shot % by period)
    const periodData = periods.map(period => {
      const periodShots = shotChartData.filter(s => s.period === period);
      const goals = periodShots.filter(s => s.result === 'goal').length;
      const total = periodShots.length;
      return {
        period: `P${period}`,
        percentage: total > 0 ? Math.round((goals / total) * 100) : 0,
        shots: total,
        goals
      };
    });

    // Prepare data for bar chart (Player rankings by FG%)
    const playerRankings = [...playerStats]
      .sort((a, b) => b.field_goal_percentage - a.field_goal_percentage)
      .slice(0, 10)
      .map(p => ({
        name: `#${p.jersey_number} ${p.last_name}`,
        fg_percentage: p.field_goal_percentage,
        shots: p.total_shots
      }));

    // Prepare data for scatter plot (Distance vs Success Rate)
    const distanceData = playerStats
      .filter(p => p.average_distance && p.total_shots >= 3)
      .map(p => ({
        name: `${p.first_name} ${p.last_name}`,
        distance: p.average_distance,
        success_rate: p.field_goal_percentage,
        shots: p.total_shots
      }));

    // Prepare data for radar chart (Top player multi-dimensional profile)
    const topPlayer = playerStats.length > 0 ? playerStats.reduce((prev, current) =>
      (prev.field_goal_percentage > current.field_goal_percentage) ? prev : current
    ) : null;

    const radarData = topPlayer ? [
      { stat: 'Volume', value: Math.min(100, (topPlayer.total_shots / 20) * 100), fullMark: 100 },
      { stat: 'Accuracy', value: topPlayer.field_goal_percentage, fullMark: 100 },
      { stat: 'Left Zone', value: topPlayer.zone_performance.left.success_rate, fullMark: 100 },
      { stat: 'Center Zone', value: topPlayer.zone_performance.center.success_rate, fullMark: 100 },
      { stat: 'Right Zone', value: topPlayer.zone_performance.right.success_rate, fullMark: 100 },
      { stat: 'Distance', value: topPlayer.average_distance ? Math.min(100, topPlayer.average_distance * 10) : 0, fullMark: 100 }
    ] : [];

    const COLORS = ['#4CAF50', '#2196F3', '#FF9800', '#f44336', '#9C27B0', '#00BCD4'];

    return (
      <div className="analytics-view charts-view">
        <h3>📈 Advanced Analytics Charts</h3>
        
        {/* Line Chart: Shot % by Period */}
        {periodData.length > 0 && (
          <div className="chart-section">
            <h4>Shot Success Rate by Period</h4>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={periodData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis label={{ value: 'Success %', angle: -90, position: 'insideLeft' }} />
                <Tooltip content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="custom-tooltip">
                        <p><strong>{data.period}</strong></p>
                        <p>Success Rate: {data.percentage}%</p>
                        <p>Shots: {data.shots}</p>
                        <p>Goals: {data.goals}</p>
                      </div>
                    );
                  }
                  return null;
                }} />
                <Legend />
                <Line type="monotone" dataKey="percentage" stroke="#4CAF50" strokeWidth={3} name="Success %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Bar Chart: Player Rankings */}
        {playerRankings.length > 0 && (
          <div className="chart-section">
            <h4>Top 10 Players by Field Goal Percentage</h4>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={playerRankings} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} label={{ value: 'FG %', position: 'insideBottom', offset: -5 }} />
                <YAxis type="category" dataKey="name" width={100} />
                <Tooltip content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="custom-tooltip">
                        <p><strong>{data.name}</strong></p>
                        <p>FG%: {data.fg_percentage}%</p>
                        <p>Total Shots: {data.shots}</p>
                      </div>
                    );
                  }
                  return null;
                }} />
                <Bar dataKey="fg_percentage" name="FG %">
                  {playerRankings.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Scatter Plot: Distance vs Success */}
        {distanceData.length > 0 && (
          <div className="chart-section">
            <h4>Shot Distance vs Success Rate</h4>
            <ResponsiveContainer width="100%" height={400}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="distance" name="Distance" unit="m" label={{ value: 'Distance (m)', position: 'insideBottom', offset: -5 }} />
                <YAxis type="number" dataKey="success_rate" name="Success Rate" unit="%" label={{ value: 'Success Rate %', angle: -90, position: 'insideLeft' }} />
                <Tooltip content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="custom-tooltip">
                        <p><strong>{data.name}</strong></p>
                        <p>Distance: {data.distance}m</p>
                        <p>Success: {data.success_rate}%</p>
                        <p>Shots: {data.shots}</p>
                      </div>
                    );
                  }
                  return null;
                }} />
                <Scatter name="Players" data={distanceData} fill="#2196F3" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Radar Chart: Player Profile */}
        {topPlayer && radarData.length > 0 && (
          <div className="chart-section">
            <h4>Player Profile: {topPlayer.first_name} {topPlayer.last_name} (#{topPlayer.jersey_number})</h4>
            <ResponsiveContainer width="100%" height={400}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="stat" />
                <PolarRadiusAxis angle={90} domain={[0, 100]} />
                <Radar name={`${topPlayer.first_name} ${topPlayer.last_name}`} dataKey="value" stroke="#4CAF50" fill="#4CAF50" fillOpacity={0.6} />
                <Tooltip />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  };

  // Phase 3: Render performance tracking view
  const renderPerformanceTracking = () => {
    const getTrendIcon = (trend: string | null) => {
      if (!trend) return '—';
      if (trend === 'improving') return '📈';
      if (trend === 'declining') return '📉';
      return '→';
    };

    const getTrendColor = (trend: string | null) => {
      if (!trend) return '';
      if (trend === 'improving') return '#4CAF50';
      if (trend === 'declining') return '#f44336';
      return '#666';
    };

    return (
      <div className="analytics-view performance-view">
        <h3>⚡ Performance Tracking</h3>

        {/* Streak Tracking */}
        <div className="performance-section">
          <h4>🔥 Current Streaks</h4>
          {streaks.length > 0 ? (
            <div className="streaks-grid">
              {streaks.map(player => (
                <div key={player.player_id} className="streak-card">
                  <div className="streak-header">
                    <h5>#{player.jersey_number} {player.first_name} {player.last_name}</h5>
                    <span className="team-badge">{player.team_name}</span>
                  </div>
                  <div className="streak-stats">
                    <div className={`current-streak ${player.current_streak_type}`}>
                      <span className="streak-label">Current:</span>
                      <span className="streak-value">{player.current_streak} {player.current_streak_type}</span>
                    </div>
                    <div className="streak-records">
                      <div className="record">
                        <span className="record-label">Best Make Streak:</span>
                        <span className="record-value success">{player.longest_make_streak}</span>
                      </div>
                      <div className="record">
                        <span className="record-label">Longest Miss Streak:</span>
                        <span className="record-value miss">{player.longest_miss_streak}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-data">No streak data available</p>
          )}
        </div>

        {/* Hot/Cold Zones */}
        <div className="performance-section">
          <h4>🎯 Hot & Cold Zones</h4>
          {zoneAnalysis && zoneAnalysis.zones.length > 0 ? (
            <>
              <p className="zone-info">
                Overall FG%: <strong>{zoneAnalysis.overall_fg_percentage}%</strong>
                <span className="zone-legend">
                  🔥 Hot Zone (+15%) | ❄️ Cold Zone (-15%)
                </span>
              </p>
              <div className="zones-court">
                <img src={courtImageUrl} alt="Court" className="zones-court-image" />
                <div className="zones-overlay">
                  {zoneAnalysis.zones.map((zone, index) => (
                    <div
                      key={index}
                      className={`zone-box ${zone.zone_type}`}
                      style={{
                        left: `${zone.min_x}%`,
                        top: `${zone.min_y}%`,
                        width: '25%',
                        height: '25%'
                      }}
                      title={`Zone (${zone.zone_x}, ${zone.zone_y})\nShots: ${zone.shots}\nFG%: ${zone.fg_percentage}%\nDiff: ${zone.difference > 0 ? '+' : ''}${zone.difference}%`}
                    >
                      {zone.is_significant && (
                        <>
                          <span className="zone-icon">{zone.zone_type === 'hot' ? '🔥' : '❄️'}</span>
                          <span className="zone-fg">{zone.fg_percentage}%</span>
                          <span className="zone-diff">{zone.difference > 0 ? '+' : ''}{zone.difference}%</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="no-data">No zone analysis available (need 10+ shots per zone)</p>
          )}
        </div>

        {/* Period Trends */}
        <div className="performance-section">
          <h4>📊 Period-by-Period Trends</h4>
          {trends.length > 0 ? (
            <div className="trends-table-container">
              <table className="trends-table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Shots</th>
                    <th>Goals</th>
                    <th>FG%</th>
                    <th>Trend</th>
                    <th>Change</th>
                    <th>Avg Distance</th>
                    <th>Players</th>
                  </tr>
                </thead>
                <tbody>
                  {trends.map(trend => (
                    <tr key={trend.period}>
                      <td className="period-cell">Period {trend.period}</td>
                      <td>{trend.total_shots}</td>
                      <td className="success">{trend.goals}</td>
                      <td className="fg-cell">{trend.fg_percentage}%</td>
                      <td className="trend-cell">
                        <span style={{ color: getTrendColor(trend.trend) }}>
                          {getTrendIcon(trend.trend)} {trend.trend || 'N/A'}
                        </span>
                      </td>
                      <td className={trend.fg_change && trend.fg_change > 0 ? 'success' : trend.fg_change && trend.fg_change < 0 ? 'miss' : ''}>
                        {trend.fg_change !== null ? `${trend.fg_change > 0 ? '+' : ''}${trend.fg_change}%` : '—'}
                      </td>
                      <td>{trend.avg_distance ? `${trend.avg_distance}m` : 'N/A'}</td>
                      <td>{trend.players_with_shots}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="no-data">No trend data available</p>
          )}
        </div>
      </div>
    );
  };

  // Phase 4: Render historical analytics
  const renderHistoricalAnalytics = () => {
    return (
      <div className="historical-view">
        <div className="filters">
          <div className="filter-group">
            <label htmlFor="player-select">Player Development</label>
            <select 
              id="player-select"
              value={selectedPlayerId || ''} 
              onChange={(e) => setSelectedPlayerId(e.target.value ? parseInt(e.target.value) : null)}
            >
              <option value="">Select a player...</option>
              {playerStats.map(p => (
                <option key={p.player_id} value={p.player_id}>
                  {p.first_name} {p.last_name} (#{p.jersey_number})
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="opponent-select">Matchup Analysis</label>
            <select 
              id="opponent-select"
              value={selectedOpponentId || ''} 
              onChange={(e) => setSelectedOpponentId(e.target.value ? parseInt(e.target.value) : null)}
            >
              <option value="">Select opponent...</option>
              {teams.filter(t => t.id !== selectedTeam).map(team => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Player Development Section */}
        {selectedPlayerId && (
          <div className="historical-section">
            <h3>📈 Player Development Over Last 10 Games</h3>
            {playerDevelopment.length > 0 ? (
              <>
                <div className="development-chart">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={[...playerDevelopment].reverse()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="game_date" 
                        tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      />
                      <YAxis domain={[0, 100]} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="custom-tooltip">
                                <p><strong>{new Date(data.game_date).toLocaleDateString()}</strong></p>
                                <p>Shots: {data.shots} | Goals: {data.goals}</p>
                                <p>FG%: {data.fg_percentage}%</p>
                                {data.improvement !== null && (
                                  <p style={{ color: data.improvement > 0 ? '#4CAF50' : '#F44336' }}>
                                    {data.improvement > 0 ? '↑' : '↓'} {Math.abs(data.improvement)}% from previous
                                  </p>
                                )}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="fg_percentage" stroke="#2196F3" name="FG%" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="development-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Team</th>
                        <th>Shots</th>
                        <th>Goals</th>
                        <th>FG%</th>
                        <th>Avg Distance</th>
                        <th>Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {playerDevelopment.map(game => (
                        <tr key={game.game_id}>
                          <td>{new Date(game.game_date).toLocaleDateString()}</td>
                          <td>{game.team_name}</td>
                          <td>{game.shots}</td>
                          <td className="success">{game.goals}</td>
                          <td className="fg-cell">{game.fg_percentage}%</td>
                          <td>{game.avg_distance}m</td>
                          <td className={game.improvement && game.improvement > 0 ? 'success' : game.improvement && game.improvement < 0 ? 'miss' : ''}>
                            {game.improvement !== null ? `${game.improvement > 0 ? '+' : ''}${game.improvement}%` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="no-data">No development data available for this player</p>
            )}
          </div>
        )}

        {/* Team Tendencies Section */}
        {selectedTeam && teamTendencies && (
          <div className="historical-section">
            <h3>🎯 Team Shooting Tendencies (Last 10 Games)</h3>
            <div className="tendencies-grid">
              <div className="tendency-card">
                <h4>Overall Stats</h4>
                <div className="stat-row">
                  <span className="stat-label">Games:</span>
                  <span className="stat-value">{teamTendencies.overall.games_played}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Total Shots:</span>
                  <span className="stat-value">{teamTendencies.overall.total_shots}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Goals:</span>
                  <span className="stat-value success">{teamTendencies.overall.total_goals}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">FG%:</span>
                  <span className="stat-value">{teamTendencies.overall.avg_fg_percentage}%</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Avg Distance:</span>
                  <span className="stat-value">{teamTendencies.overall.avg_distance}m</span>
                </div>
              </div>

              <div className="tendency-card">
                <h4>Zone Preferences</h4>
                {teamTendencies.zone_preferences.map(zone => (
                  <div key={zone.zone} className="zone-preference">
                    <span className="zone-name">{zone.zone.toUpperCase()}</span>
                    <div className="zone-bar">
                      <div 
                        className="zone-bar-fill" 
                        style={{ width: `${zone.fg_percentage}%`, backgroundColor: zone.fg_percentage > 50 ? '#4CAF50' : '#FF9800' }}
                      ></div>
                    </div>
                    <span className="zone-stats">{zone.shots} shots • {zone.fg_percentage}%</span>
                  </div>
                ))}
              </div>

              <div className="tendency-card">
                <h4>Top Shooters</h4>
                <div className="top-shooters-list">
                  {teamTendencies.top_shooters.map((shooter, index) => (
                    <div key={shooter.player_id} className="shooter-item">
                      <span className="shooter-rank">#{index + 1}</span>
                      <div className="shooter-info">
                        <span className="shooter-name">{shooter.first_name} {shooter.last_name}</span>
                        <span className="shooter-jersey">#{shooter.jersey_number}</span>
                      </div>
                      <div className="shooter-stats">
                        <span>{shooter.shots} shots</span>
                        <span className="success">{shooter.fg_percentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Matchup Analysis Section */}
        {selectedTeam && selectedOpponentId && matchupAnalysis && matchupAnalysis.games_played > 0 && (
          <div className="historical-section">
            <h3>⚔️ Head-to-Head Matchup Analysis</h3>
            <p className="matchup-info">
              {matchupAnalysis.games_played} game{matchupAnalysis.games_played > 1 ? 's' : ''} analyzed
              {matchupAnalysis.game_dates.length > 0 && ` (Latest: ${new Date(matchupAnalysis.game_dates[0]).toLocaleDateString()})`}
            </p>
            <div className="matchup-comparison">
              <div className="matchup-team">
                <h4>Your Team</h4>
                <div className="matchup-stats">
                  <div className="matchup-stat">
                    <span className="stat-label">Shots</span>
                    <span className="stat-value">{matchupAnalysis.team_stats.total_shots}</span>
                  </div>
                  <div className="matchup-stat">
                    <span className="stat-label">Goals</span>
                    <span className="stat-value success">{matchupAnalysis.team_stats.total_goals}</span>
                  </div>
                  <div className="matchup-stat">
                    <span className="stat-label">FG%</span>
                    <span className="stat-value">{matchupAnalysis.team_stats.avg_fg_percentage}%</span>
                  </div>
                  <div className="matchup-stat">
                    <span className="stat-label">Avg Distance</span>
                    <span className="stat-value">{matchupAnalysis.team_stats.avg_distance}m</span>
                  </div>
                </div>
              </div>

              <div className="matchup-divider">VS</div>

              <div className="matchup-team">
                <h4>Opponent</h4>
                <div className="matchup-stats">
                  <div className="matchup-stat">
                    <span className="stat-label">Shots</span>
                    <span className="stat-value">{matchupAnalysis.opponent_stats.total_shots}</span>
                  </div>
                  <div className="matchup-stat">
                    <span className="stat-label">Goals</span>
                    <span className="stat-value success">{matchupAnalysis.opponent_stats.total_goals}</span>
                  </div>
                  <div className="matchup-stat">
                    <span className="stat-label">FG%</span>
                    <span className="stat-value">{matchupAnalysis.opponent_stats.avg_fg_percentage}%</span>
                  </div>
                  <div className="matchup-stat">
                    <span className="stat-label">Avg Distance</span>
                    <span className="stat-value">{matchupAnalysis.opponent_stats.avg_distance}m</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="matchup-advantage">
              {matchupAnalysis.team_stats.avg_fg_percentage > matchupAnalysis.opponent_stats.avg_fg_percentage ? (
                <p className="advantage-text success">
                  ✓ Your team has a <strong>{(matchupAnalysis.team_stats.avg_fg_percentage - matchupAnalysis.opponent_stats.avg_fg_percentage).toFixed(1)}%</strong> shooting advantage in this matchup
                </p>
              ) : matchupAnalysis.team_stats.avg_fg_percentage < matchupAnalysis.opponent_stats.avg_fg_percentage ? (
                <p className="advantage-text miss">
                  ⚠ Opponent has a <strong>{(matchupAnalysis.opponent_stats.avg_fg_percentage - matchupAnalysis.team_stats.avg_fg_percentage).toFixed(1)}%</strong> shooting advantage
                </p>
              ) : (
                <p className="advantage-text">Teams are evenly matched in shooting efficiency</p>
              )}
            </div>
          </div>
        )}

        {!selectedPlayerId && !teamTendencies && !matchupAnalysis && (
          <div className="empty-state">
            <p>📊 Select a player, team, or opponent to view historical analytics</p>
          </div>
        )}
      </div>
    );
  };

  // New: Render interactive shot chart view
  const renderInteractiveShotChart = () => {
    return (
      <div className="analytics-view">
        <InteractiveShotChart
          shots={shotChartData}
          title="Interactive Shot Chart with Clickable Zones"
          showZones={true}
          showExportButtons={true}
        />
      </div>
    );
  };

  // New: Render player comparison view
  const renderPlayerComparison = () => {
    const handlePlayerSelect = (playerId: number) => {
      const player = playerStats.find(p => p.player_id === playerId);
      if (player && comparisonPlayers.length < 4) {
        setComparisonPlayers(prev => [...prev, player]);
      }
    };

    const handlePlayerRemove = (playerId: number) => {
      setComparisonPlayers(prev => prev.filter(p => p.player_id !== playerId));
    };

    return (
      <div className="analytics-view">
        <React.Suspense fallback={<div>Loading player comparison…</div>}>
          <PlayerComparisonRadar
            players={comparisonPlayers}
            availablePlayers={playerStats}
            onPlayerSelect={handlePlayerSelect}
            onPlayerRemove={handlePlayerRemove}
            maxPlayers={4}
          />
        </React.Suspense>
      </div>
    );
  };

  // New: Render possession flow view
  const renderPossessionFlow = () => {
    // Get team names from teams state
    const homeTeam = teams.find(t => t.id === teams[0]?.id);
    const awayTeam = teams.find(t => t.id === teams[1]?.id);

    if (!homeTeam || !awayTeam) {
      return (
        <div className="analytics-view">
          <div className="empty-state">
            <p>Loading team information...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="analytics-view">
        <PossessionFlowDiagram
          possessions={possessions}
          homeTeamId={homeTeam.id}
          awayTeamId={awayTeam.id}
          homeTeamName={homeTeam.name}
          awayTeamName={awayTeam.name}
          currentPeriod={selectedPeriod || undefined}
          showExportButtons={true}
        />
      </div>
    );
  };

  // Phase 6: Render achievements view
  const renderAchievements = () => {
    return (
      <div className="achievements-view">
        <div className="filters">
          <div className="filter-group">
            <label htmlFor="achievement-player-select">Select Player</label>
            <select 
              id="achievement-player-select"
              value={selectedAchievementPlayer || ''} 
              onChange={(e) => setSelectedAchievementPlayer(e.target.value ? parseInt(e.target.value) : null)}
            >
              <option value="">Select a player...</option>
              {playerStats.map(p => (
                <option key={p.player_id} value={p.player_id}>
                  {p.first_name} {p.last_name} (#{p.jersey_number})
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="leaderboard-type-select">Leaderboard Type</label>
            <select 
              id="leaderboard-type-select"
              value={leaderboardType} 
              onChange={(e) => setLeaderboardType(e.target.value as 'global' | 'team')}
            >
              <option value="global">🌍 Global Leaderboard</option>
              <option value="team">👥 Team Leaderboard</option>
            </select>
          </div>
        </div>

        {/* Player Achievements Section */}
        {selectedAchievementPlayer && (
          <div className="achievements-section">
            <h3>🏆 Player Achievements</h3>
            {playerAchievements.length > 0 ? (
              <div className="achievements-grid">
                {allAchievements.map(achievement => {
                  const earned = playerAchievements.find(a => a.id === achievement.id);
                  return (
                    <AchievementBadge
                      key={achievement.id}
                      achievement={earned || achievement}
                      isLocked={!earned}
                      size="medium"
                      showDetails={true}
                    />
                  );
                })}
              </div>
            ) : (
              <p className="no-data">No achievements earned yet. Keep playing to unlock them!</p>
            )}
          </div>
        )}

        {/* All Achievements Section (when no player selected) */}
        {!selectedAchievementPlayer && allAchievements.length > 0 && (
          <div className="achievements-section">
            <h3>🎯 All Available Achievements</h3>
            <div className="achievements-grid">
              {allAchievements.map(achievement => (
                <AchievementBadge
                  key={achievement.id}
                  achievement={achievement}
                  isLocked={true}
                  size="medium"
                  showDetails={true}
                />
              ))}
            </div>
          </div>
        )}

        {/* Leaderboard Section */}
        <div className="achievements-section">
          <h3>📊 {leaderboardType === 'global' ? 'Global Leaderboard' : 'Team Leaderboard'}</h3>
          <Leaderboard
            players={leaderboard}
            type={leaderboardType}
            loading={loading}
            season="Current Season"
            teamName={leaderboardType === 'team' && selectedTeam ? teams.find(t => t.id === selectedTeam)?.name : undefined}
          />
        </div>

        {allAchievements.length === 0 && (
          <div className="empty-state">
            <p>🏆 No achievements available yet</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="shot-analytics-container">
      <div className="analytics-header">
        <div className="header-top">
          <button className="back-button" onClick={() => navigate(`/match/${gameId}`)}>
            ← Back to Match
          </button>
          <h2>📊 Shot Analytics</h2>
        </div>
        <div className="view-tabs">
          <button
            className={`view-tab ${activeView === 'heatmap' ? 'active' : ''}`}
            onClick={() => setActiveView('heatmap')}
            title="Keyboard: 1"
          >
            🔥 Heatmap
          </button>
          <button
            className={`view-tab ${activeView === 'shot-chart' ? 'active' : ''}`}
            onClick={() => setActiveView('shot-chart')}
            title="Keyboard: 2 | Zoom: ← → | Reset: 0"
          >
            🎯 Shot Chart
          </button>
          <button
            className={`view-tab ${activeView === 'interactive' ? 'active' : ''}`}
            onClick={() => setActiveView('interactive')}
            title="Interactive shot chart with clickable zones"
          >
            🎨 Interactive
          </button>
          <button
            className={`view-tab ${activeView === 'comparison' ? 'active' : ''}`}
            onClick={() => setActiveView('comparison')}
            title="Compare players with radar charts"
          >
            👥 Compare
          </button>
          <button
            className={`view-tab ${activeView === 'possession' ? 'active' : ''}`}
            onClick={() => setActiveView('possession')}
            title="Possession flow diagram"
          >
            🔄 Possession
          </button>
          <button
            className={`view-tab ${activeView === 'players' ? 'active' : ''}`}
            onClick={() => setActiveView('players')}
            title="Keyboard: 3"
          >
            👤 Player Stats
          </button>
          <button
            className={`view-tab ${activeView === 'summary' ? 'active' : ''}`}
            onClick={() => setActiveView('summary')}
            title="Keyboard: 4"
          >
            📋 Summary
          </button>
          <button
            className={`view-tab ${activeView === 'charts' ? 'active' : ''}`}
            onClick={() => setActiveView('charts')}
            title="Keyboard: 5"
          >
            📈 Advanced Charts
          </button>
          <button
            className={`view-tab ${activeView === 'performance' ? 'active' : ''}`}
            onClick={() => setActiveView('performance')}
            title="Keyboard: 6"
          >
            ⚡ Performance
          </button>
          <button
            className={`view-tab ${activeView === 'historical' ? 'active' : ''}`}
            onClick={() => setActiveView('historical')}
            title="Keyboard: 7"
          >
            📚 Historical
          </button>
          <button
            className={`view-tab ${activeView === 'achievements' ? 'active' : ''}`}
            onClick={() => setActiveView('achievements')}
            title="Keyboard: 8"
          >
            🏆 Achievements
          </button>
        </div>
        <div className="analytics-controls-bar">
          <div className="keyboard-hints">
            <span className="hint">💡 Tip: Use number keys 1-8 to switch views | ESC to close modals</span>
          </div>
          <div className="auto-refresh-toggle">
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
            <span className="toggle-label">
              {autoRefresh ? '🔄 Live Updates' : '⏸ Manual Refresh'}
            </span>
          </div>
        </div>
      </div>

      {loading && (
        <div className="loading-container">
          <div className="loading-skeleton">
            <div className="skeleton-header"></div>
            <div className="skeleton-content">
              <div className="skeleton-box"></div>
              <div className="skeleton-box"></div>
              <div className="skeleton-box"></div>
            </div>
          </div>
        </div>
      )}
      
      {error && (
        <div className="error-message">
          <span className="error-icon">❌</span>
          <span className="error-text">{error}</span>
          <button className="retry-button" onClick={() => {
            setError(null);
            switch (activeView) {
              case 'heatmap': fetchHeatmap(); break;
              case 'shot-chart': fetchShotChart(); break;
              case 'players': fetchPlayerStats(); break;
              case 'summary': fetchGameSummary(); break;
              case 'charts': fetchShotChart(); fetchPlayerStats(); break;
              case 'performance': fetchStreaks(); fetchZoneAnalysis(); fetchTrends(); break;
              case 'historical':
                if (selectedPlayerId) fetchPlayerDevelopment();
                if (selectedTeam) fetchTeamTendencies();
                if (selectedTeam && selectedOpponentId) fetchMatchupAnalysis();
                break;
              case 'achievements':
                fetchAchievements();
                if (selectedAchievementPlayer) fetchPlayerAchievements();
                fetchLeaderboard();
                break;
            }
          }}>
            🔄 Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          {activeView === 'heatmap' && renderHeatmap()}
          {activeView === 'shot-chart' && renderShotChart()}
          {activeView === 'interactive' && renderInteractiveShotChart()}
          {activeView === 'comparison' && renderPlayerComparison()}
          {activeView === 'possession' && renderPossessionFlow()}
          {activeView === 'players' && renderPlayerStats()}
          {activeView === 'summary' && renderGameSummary()}
          {activeView === 'charts' && renderAdvancedCharts()}
          {activeView === 'performance' && renderPerformanceTracking()}
          {activeView === 'historical' && renderHistoricalAnalytics()}
          {activeView === 'achievements' && renderAchievements()}
        </>
      )}

      {/* Achievement notification toast */}
      {unlockedAchievement && (
        <AchievementNotification
          achievement={unlockedAchievement}
          onClose={() => setUnlockedAchievement(null)}
        />
      )}
    </div>
  );
};

export default ShotAnalytics;
