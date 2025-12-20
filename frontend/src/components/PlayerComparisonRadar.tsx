import React, { useState, useRef, useCallback } from 'react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend, ResponsiveContainer, Tooltip } from 'recharts';
import html2canvas from 'html2canvas';
import '../styles/PlayerComparisonRadar.css';

interface PlayerStats {
  player_id: number;
  first_name: string;
  last_name: string;
  jersey_number: number;
  team_name: string;
  total_shots: number;
  goals: number;
  field_goal_percentage: number;
  average_distance: number;
  zone_performance: {
    left: { success_rate: number };
    center: { success_rate: number };
    right: { success_rate: number };
  };
}

interface RadarDataPoint {
  metric: string;
  fullMark: number;
  [key: string]: string | number;
}

interface PlayerComparisonRadarProps {
  players: PlayerStats[];
  availablePlayers: PlayerStats[];
  onPlayerSelect?: (playerId: number) => void;
  onPlayerRemove?: (playerId: number) => void;
  maxPlayers?: number;
}

const PlayerComparisonRadar: React.FC<PlayerComparisonRadarProps> = ({
  players,
  availablePlayers,
  onPlayerSelect,
  onPlayerRemove,
  maxPlayers = 4
}) => {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
    'accuracy',
    'volume',
    'left_zone',
    'center_zone',
    'right_zone',
    'distance'
  ]);
  const chartRef = useRef<HTMLDivElement>(null);

  // Define available metrics
  const allMetrics = [
    { id: 'accuracy', label: 'Accuracy', description: 'Field Goal %' },
    { id: 'volume', label: 'Volume', description: 'Shot Attempts (normalized)' },
    { id: 'left_zone', label: 'Left Zone', description: 'Left Zone Success %' },
    { id: 'center_zone', label: 'Center Zone', description: 'Center Zone Success %' },
    { id: 'right_zone', label: 'Right Zone', description: 'Right Zone Success %' },
    { id: 'distance', label: 'Distance', description: 'Avg Shot Distance (normalized)' }
  ];

  // Color palette for different players
  const playerColors = [
    '#2196F3', // Blue
    '#4CAF50', // Green
    '#FF9800', // Orange
    '#9C27B0'  // Purple
  ];

  // Normalize player stats to radar data
  const normalizeStats = useCallback((player: PlayerStats): Record<string, number> => {
    // Find max values for normalization
    const maxShots = Math.max(...availablePlayers.map(p => p.total_shots), 1);
    const maxDistance = Math.max(...availablePlayers.map(p => p.average_distance || 0), 1);

    return {
      accuracy: player.field_goal_percentage,
      volume: Math.min(100, (player.total_shots / maxShots) * 100),
      left_zone: player.zone_performance.left.success_rate,
      center_zone: player.zone_performance.center.success_rate,
      right_zone: player.zone_performance.right.success_rate,
      distance: player.average_distance ? Math.min(100, (player.average_distance / maxDistance) * 100) : 0
    };
  }, [availablePlayers]);

  // Prepare radar chart data
  const radarData: RadarDataPoint[] = selectedMetrics.map(metricId => {
    const metric = allMetrics.find(m => m.id === metricId);
    const dataPoint: RadarDataPoint = {
      metric: metric?.label || metricId,
      fullMark: 100
    };

    // Add each player's value for this metric
    players.forEach((player, index) => {
      const stats = normalizeStats(player);
      const playerKey = `player${index}`;
      dataPoint[playerKey] = stats[metricId] || 0;
    });

    return dataPoint;
  });

  const toggleMetric = (metricId: string) => {
    setSelectedMetrics(prev => {
      if (prev.includes(metricId)) {
        // Keep at least one metric selected
        if (prev.length === 1) return prev;
        return prev.filter(id => id !== metricId);
      } else {
        return [...prev, metricId];
      }
    });
  };

  // Export as PNG
  const exportAsPNG = useCallback(async () => {
    if (!chartRef.current) return;

    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false
      });

      const link = document.createElement('a');
      link.download = `player-comparison-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error exporting PNG:', error);
      alert('Failed to export image. Please try again.');
    }
  }, []);

  // Export as SVG (simplified version)
  const exportAsSVG = useCallback(() => {
    alert('SVG export for radar charts is coming soon!');
  }, []);

  // Generate shareable link
  const generateShareableLink = useCallback(() => {
    const state = {
      players: players.map(p => p.player_id),
      metrics: selectedMetrics
    };
    
    const encodedState = btoa(JSON.stringify(state));
    const shareUrl = `${window.location.origin}${window.location.pathname}?comparison=${encodedState}`;
    
    navigator.clipboard.writeText(shareUrl).then(() => {
      alert('Shareable link copied to clipboard!');
    }).catch(() => {
      prompt('Copy this link:', shareUrl);
    });
  }, [players, selectedMetrics]);

  return (
    <div className="player-comparison-radar">
      <div className="radar-controls">
        <div className="control-section">
          <h3>Player Selection</h3>
          <div className="player-selection">
            {players.length < maxPlayers && availablePlayers.length > players.length && (
              <select 
                onChange={(e) => {
                  const playerId = parseInt(e.target.value);
                  if (playerId && onPlayerSelect) {
                    onPlayerSelect(playerId);
                    e.target.value = '';
                  }
                }}
                className="player-select"
              >
                <option value="">Add player to compare...</option>
                {availablePlayers
                  .filter(p => !players.find(selected => selected.player_id === p.player_id))
                  .map(player => (
                    <option key={player.player_id} value={player.player_id}>
                      #{player.jersey_number} {player.first_name} {player.last_name} ({player.team_name})
                    </option>
                  ))}
              </select>
            )}
            {players.length >= maxPlayers && (
              <div className="max-players-notice">
                Maximum {maxPlayers} players can be compared at once
              </div>
            )}
          </div>

          <div className="selected-players">
            {players.map((player, index) => (
              <div 
                key={player.player_id} 
                className="player-chip"
                style={{ borderColor: playerColors[index] }}
              >
                <span className="player-info">
                  <span className="player-color" style={{ backgroundColor: playerColors[index] }}></span>
                  #{player.jersey_number} {player.first_name} {player.last_name}
                  <span className="player-team">({player.team_name})</span>
                </span>
                {onPlayerRemove && (
                  <button 
                    className="remove-player"
                    onClick={() => onPlayerRemove(player.player_id)}
                    title="Remove player"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="control-section">
          <h3>Metrics</h3>
          <div className="metrics-selection">
            {allMetrics.map(metric => (
              <label key={metric.id} className="metric-checkbox">
                <input
                  type="checkbox"
                  checked={selectedMetrics.includes(metric.id)}
                  onChange={() => toggleMetric(metric.id)}
                />
                <span className="metric-label">
                  {metric.label}
                  <span className="metric-description">{metric.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="control-section">
          <h3>Export</h3>
          <div className="export-buttons">
            <button onClick={exportAsPNG} className="export-btn" title="Export as PNG">
              📷 PNG
            </button>
            <button onClick={exportAsSVG} className="export-btn" title="Export as SVG">
              🎨 SVG
            </button>
            <button onClick={generateShareableLink} className="export-btn" title="Copy shareable link">
              🔗 Share
            </button>
          </div>
        </div>
      </div>

      {players.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <h3>No Players Selected</h3>
          <p>Select players from the dropdown above to start comparing their statistics</p>
        </div>
      ) : (
        <div ref={chartRef} className="radar-chart-container">
          <h3>Player Comparison Radar Chart</h3>
          <ResponsiveContainer width="100%" height={500}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e0e0e0" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: '#666', fontSize: 12 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#999', fontSize: 10 }} />
              
              {players.map((player, index) => (
                <Radar
                  key={player.player_id}
                  name={`#${player.jersey_number} ${player.last_name}`}
                  dataKey={`player${index}`}
                  stroke={playerColors[index]}
                  fill={playerColors[index]}
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              ))}
              
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="circle"
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255,255,255,0.95)', 
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  padding: '10px'
                }}
                formatter={(value?: number) =>
                  typeof value === 'number' ? `${value.toFixed(1)}%` : 'N/A'}
              />
            </RadarChart>
          </ResponsiveContainer>

          {/* Statistical Comparison Table */}
          <div className="comparison-table">
            <h4>Detailed Statistics</h4>
            <table>
              <thead>
                <tr>
                  <th>Metric</th>
                  {players.map((player, index) => (
                    <th key={player.player_id} style={{ color: playerColors[index] }}>
                      #{player.jersey_number} {player.last_name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allMetrics.filter(m => selectedMetrics.includes(m.id)).map(metric => (
                  <tr key={metric.id}>
                    <td className="metric-name">{metric.label}</td>
                    {players.map(player => {
                      const stats = normalizeStats(player);
                      const value = stats[metric.id];
                      
                      // Show actual values for some metrics
                      let displayValue: string;
                      if (metric.id === 'accuracy') {
                        displayValue = `${player.field_goal_percentage}%`;
                      } else if (metric.id === 'volume') {
                        displayValue = `${player.total_shots} shots`;
                      } else if (metric.id === 'distance') {
                        displayValue = player.average_distance ? `${player.average_distance}m` : 'N/A';
                      } else {
                        displayValue = `${value.toFixed(0)}%`;
                      }
                      
                      return (
                        <td key={player.player_id} className="metric-value">
                          {displayValue}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="summary-row">
                  <td className="metric-name"><strong>Total Shots</strong></td>
                  {players.map(player => (
                    <td key={player.player_id} className="metric-value">
                      <strong>{player.total_shots}</strong>
                    </td>
                  ))}
                </tr>
                <tr className="summary-row">
                  <td className="metric-name"><strong>Goals</strong></td>
                  {players.map(player => (
                    <td key={player.player_id} className="metric-value success">
                      <strong>{player.goals}</strong>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="help-section">
        <h4>💡 How to Use</h4>
        <ul>
          <li><strong>Add Players:</strong> Select up to {maxPlayers} players from the dropdown to compare</li>
          <li><strong>Customize Metrics:</strong> Toggle checkboxes to show/hide different performance metrics</li>
          <li><strong>Export:</strong> Save the chart as an image or copy a shareable link</li>
          <li><strong>Interpretation:</strong> Larger area = better performance. Compare overlapping regions to see strengths/weaknesses</li>
        </ul>
      </div>
    </div>
  );
};

export default PlayerComparisonRadar;
