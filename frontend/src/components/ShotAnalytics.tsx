import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
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

type AnalyticsView = 'heatmap' | 'shot-chart' | 'players' | 'summary' | 'charts' | 'performance';

const ShotAnalytics: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<AnalyticsView>('heatmap');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);
  const [shotChartData, setShotChartData] = useState<ShotChartShot[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [gameSummary, setGameSummary] = useState<GameSummary | null>(null);
  
  // Phase 3 data states
  const [streaks, setStreaks] = useState<PlayerStreak[]>([]);
  const [zoneAnalysis, setZoneAnalysis] = useState<ZoneAnalysis | null>(null);
  const [trends, setTrends] = useState<PeriodTrend[]>([]);

  // Filter states
  const [gridSize, setGridSize] = useState(10);
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);

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

  // Load data when view changes
  useEffect(() => {
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
    }
  }, [activeView, fetchHeatmap, fetchShotChart, fetchPlayerStats, fetchGameSummary, fetchStreaks, fetchZoneAnalysis, fetchTrends]);

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

      // Tab switching with numbers 1-6
      const views: AnalyticsView[] = ['heatmap', 'shot-chart', 'players', 'summary', 'charts', 'performance'];
      const keyNum = parseInt(e.key);
      if (keyNum >= 1 && keyNum <= 6) {
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
    const red = Math.round(255 * intensity);
    const green = Math.round(100 * (1 - intensity));
    const alpha = 0.3 + (intensity * 0.5); // 0.3 to 0.8 opacity
    
    return `rgba(${red}, ${green}, 50, ${alpha})`;
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
    if (!heatmapData || !courtRef.current || !imageRef.current) return null;

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
              
              return (
                <div
                  key={index}
                  className="heatmap-bucket"
                  style={{
                    left: `${bucket.x * bucketWidth}%`,
                    top: `${bucket.y * bucketHeight}%`,
                    width: `${bucketWidth}%`,
                    height: `${bucketHeight}%`,
                    backgroundColor: getHeatmapColor(bucket.count, maxCount),
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
    if (!courtRef.current || !imageRef.current) return null;

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
  const renderPlayerStats = () => {
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
                <th>Player</th>
                <th>Team</th>
                <th>Shots</th>
                <th>Goals</th>
                <th>Misses</th>
                <th>Blocked</th>
                <th>FG%</th>
                <th>Avg Dist</th>
                <th>Left Zone</th>
                <th>Center Zone</th>
                <th>Right Zone</th>
              </tr>
            </thead>
            <tbody>
              {playerStats.map((player) => (
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
              ))}
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
        </div>
        <div className="keyboard-hints">
          <span className="hint">💡 Tip: Use number keys 1-6 to switch views | ESC to close modals</span>
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
          {activeView === 'players' && renderPlayerStats()}
          {activeView === 'summary' && renderGameSummary()}
          {activeView === 'charts' && renderAdvancedCharts()}
          {activeView === 'performance' && renderPerformanceTracking()}
        </>
      )}
    </div>
  );
};

export default ShotAnalytics;
