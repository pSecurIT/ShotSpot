import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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

type AnalyticsView = 'heatmap' | 'shot-chart' | 'players' | 'summary';

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

  // Filter states
  const [gridSize, setGridSize] = useState(10);
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);

  // Available teams and periods (extracted from data)
  const [teams, setTeams] = useState<{ id: number; name: string }[]>([]);
  const [periods, setPeriods] = useState<number[]>([]);

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
    }
  }, [activeView, fetchHeatmap, fetchShotChart, fetchPlayerStats, fetchGameSummary]);

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

        <div className="court-container" ref={courtRef}>
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
                title={`${shot.first_name} ${shot.last_name} (#${shot.jersey_number})\n${shot.team_name}\n${shot.result.toUpperCase()}${shot.distance ? `\n${shot.distance}m` : ''}`}
              >
                {getShotMarker(shot.result)}
              </div>
            ))}
          </div>
        </div>

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
      </div>
    );
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
          >
            🔥 Heatmap
          </button>
          <button
            className={`view-tab ${activeView === 'shot-chart' ? 'active' : ''}`}
            onClick={() => setActiveView('shot-chart')}
          >
            🎯 Shot Chart
          </button>
          <button
            className={`view-tab ${activeView === 'players' ? 'active' : ''}`}
            onClick={() => setActiveView('players')}
          >
            👤 Player Stats
          </button>
          <button
            className={`view-tab ${activeView === 'summary' ? 'active' : ''}`}
            onClick={() => setActiveView('summary')}
          >
            📋 Summary
          </button>
        </div>
      </div>

      {loading && <div className="loading-spinner">Loading analytics data...</div>}
      {error && <div className="error-message">❌ {error}</div>}

      {!loading && !error && (
        <>
          {activeView === 'heatmap' && renderHeatmap()}
          {activeView === 'shot-chart' && renderShotChart()}
          {activeView === 'players' && renderPlayerStats()}
          {activeView === 'summary' && renderGameSummary()}
        </>
      )}
    </div>
  );
};

export default ShotAnalytics;
