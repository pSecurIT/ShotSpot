import React, { useState, useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
import '../styles/PossessionFlowDiagram.css';

interface Possession {
  id: number;
  game_id: number;
  team_id: number;
  period: number;
  started_at: string;
  ended_at: string | null;
  shots_taken: number;
  team_name?: string;
  duration?: number; // in seconds
  result?: 'goal' | 'turnover' | 'end_period' | 'active';
}

interface PossessionFlowDiagramProps {
  possessions: Possession[];
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string;
  awayTeamName: string;
  currentPeriod?: number;
  showExportButtons?: boolean;
}

const PossessionFlowDiagram: React.FC<PossessionFlowDiagramProps> = ({
  possessions,
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
  currentPeriod,
  showExportButtons = true
}) => {
  const [filterPeriod, setFilterPeriod] = useState<number | null>(currentPeriod || null);
  const [selectedPossession, setSelectedPossession] = useState<Possession | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'flow'>('timeline');
  const diagramRef = useRef<HTMLDivElement>(null);

  // Get unique periods
  const periods = Array.from(new Set(possessions.map(p => p.period))).sort();

  // Filter possessions by period
  const filteredPossessions = filterPeriod
    ? possessions.filter(p => p.period === filterPeriod)
    : possessions;

  // Calculate possession statistics
  const calculateStats = useCallback(() => {
    const homePossessions = filteredPossessions.filter(p => p.team_id === homeTeamId);
    const awayPossessions = filteredPossessions.filter(p => p.team_id === awayTeamId);

    const totalDuration = filteredPossessions.reduce((sum, p) => sum + (p.duration || 0), 0);
    const homeDuration = homePossessions.reduce((sum, p) => sum + (p.duration || 0), 0);
    const awayDuration = awayPossessions.reduce((sum, p) => sum + (p.duration || 0), 0);

    return {
      home: {
        count: homePossessions.length,
        percentage: totalDuration > 0 ? Math.round((homeDuration / totalDuration) * 100) : 0,
        avgDuration: homePossessions.length > 0 ? Math.round(homeDuration / homePossessions.length) : 0,
        totalShots: homePossessions.reduce((sum, p) => sum + p.shots_taken, 0)
      },
      away: {
        count: awayPossessions.length,
        percentage: totalDuration > 0 ? Math.round((awayDuration / totalDuration) * 100) : 0,
        avgDuration: awayPossessions.length > 0 ? Math.round(awayDuration / awayPossessions.length) : 0,
        totalShots: awayPossessions.reduce((sum, p) => sum + p.shots_taken, 0)
      }
    };
  }, [filteredPossessions, homeTeamId, awayTeamId]);

  const stats = calculateStats();

  // Export as PNG
  const exportAsPNG = useCallback(async () => {
    if (!diagramRef.current) return;

    try {
      const canvas = await html2canvas(diagramRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false
      });

      const link = document.createElement('a');
      link.download = `possession-flow-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error exporting PNG:', error);
      alert('Failed to export image. Please try again.');
    }
  }, []);

  // Export as SVG
  const exportAsSVG = useCallback(() => {
    alert('SVG export for possession flow is coming soon!');
  }, []);

  // Generate shareable link
  const generateShareableLink = useCallback(() => {
    const state = {
      period: filterPeriod,
      viewMode
    };
    
    const encodedState = btoa(JSON.stringify(state));
    const shareUrl = `${window.location.origin}${window.location.pathname}?possession=${encodedState}`;
    
    navigator.clipboard.writeText(shareUrl).then(() => {
      alert('Shareable link copied to clipboard!');
    }).catch(() => {
      prompt('Copy this link:', shareUrl);
    });
  }, [filterPeriod, viewMode]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getResultIcon = (result?: string): string => {
    switch (result) {
      case 'goal': return '⚽';
      case 'turnover': return '🔄';
      case 'end_period': return '⏹️';
      case 'active': return '▶️';
      default: return '●';
    }
  };

  const getResultColor = (result?: string): string => {
    switch (result) {
      case 'goal': return '#4CAF50';
      case 'turnover': return '#ff9800';
      case 'end_period': return '#9e9e9e';
      case 'active': return '#2196f3';
      default: return '#666';
    }
  };

  return (
    <div className="possession-flow-diagram">
      {/* Controls */}
      <div className="flow-controls">
        <div className="control-group">
          <h3>Possession Flow Diagram</h3>
          <div className="view-mode-toggle">
            <button
              className={`mode-btn ${viewMode === 'timeline' ? 'active' : ''}`}
              onClick={() => setViewMode('timeline')}
            >
              Timeline View
            </button>
            <button
              className={`mode-btn ${viewMode === 'flow' ? 'active' : ''}`}
              onClick={() => setViewMode('flow')}
            >
              Flow View
            </button>
          </div>
        </div>

        <div className="filter-controls">
          <label>
            Period:
            <select value={filterPeriod || ''} onChange={(e) => setFilterPeriod(e.target.value ? parseInt(e.target.value) : null)}>
              <option value="">All Periods</option>
              {periods.map(period => (
                <option key={period} value={period}>Period {period}</option>
              ))}
            </select>
          </label>

          {showExportButtons && (
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
          )}
        </div>
      </div>

      {/* Statistics Summary */}
      <div className="possession-stats">
        <div className="team-stat home">
          <h4>{homeTeamName}</h4>
          <div className="stat-row">
            <span className="label">Possessions:</span>
            <span className="value">{stats.home.count}</span>
          </div>
          <div className="stat-row">
            <span className="label">Time of Possession:</span>
            <span className="value">{stats.home.percentage}%</span>
          </div>
          <div className="stat-row">
            <span className="label">Avg Duration:</span>
            <span className="value">{formatDuration(stats.home.avgDuration)}</span>
          </div>
          <div className="stat-row">
            <span className="label">Total Shots:</span>
            <span className="value">{stats.home.totalShots}</span>
          </div>
        </div>

        <div className="possession-bar">
          <div 
            className="home-bar"
            style={{ width: `${stats.home.percentage}%` }}
            title={`${homeTeamName}: ${stats.home.percentage}%`}
          />
          <div 
            className="away-bar"
            style={{ width: `${stats.away.percentage}%` }}
            title={`${awayTeamName}: ${stats.away.percentage}%`}
          />
        </div>

        <div className="team-stat away">
          <h4>{awayTeamName}</h4>
          <div className="stat-row">
            <span className="label">Possessions:</span>
            <span className="value">{stats.away.count}</span>
          </div>
          <div className="stat-row">
            <span className="label">Time of Possession:</span>
            <span className="value">{stats.away.percentage}%</span>
          </div>
          <div className="stat-row">
            <span className="label">Avg Duration:</span>
            <span className="value">{formatDuration(stats.away.avgDuration)}</span>
          </div>
          <div className="stat-row">
            <span className="label">Total Shots:</span>
            <span className="value">{stats.away.totalShots}</span>
          </div>
        </div>
      </div>

      {/* Diagram */}
      <div ref={diagramRef} className="diagram-container">
        {filteredPossessions.length === 0 ? (
          <div className="empty-state">
            <p>No possession data available for the selected period</p>
          </div>
        ) : viewMode === 'timeline' ? (
          // Timeline View
          <div className="timeline-view">
            {filteredPossessions.map((possession, index) => {
              const isHome = possession.team_id === homeTeamId;
              const teamName = isHome ? homeTeamName : awayTeamName;
              const isSelected = selectedPossession?.id === possession.id;

              return (
                <div
                  key={possession.id}
                  className={`possession-block ${isHome ? 'home' : 'away'} ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedPossession(possession)}
                  title={`${teamName} - ${formatDuration(possession.duration || 0)} - ${possession.shots_taken} shots`}
                >
                  <div className="possession-header">
                    <span className="possession-number">#{index + 1}</span>
                    <span className="possession-team">{teamName}</span>
                    <span className="possession-result" style={{ color: getResultColor(possession.result) }}>
                      {getResultIcon(possession.result)}
                    </span>
                  </div>
                  <div className="possession-details">
                    <span className="possession-duration">{formatDuration(possession.duration || 0)}</span>
                    <span className="possession-shots">{possession.shots_taken} shot{possession.shots_taken !== 1 ? 's' : ''}</span>
                  </div>
                  <div 
                    className="possession-bar-indicator"
                    style={{ 
                      backgroundColor: isHome ? '#2196f3' : '#ff9800',
                      height: `${Math.min(100, (possession.duration || 0) / 2)}%`
                    }}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          // Flow View (Sankey-like diagram)
          <div className="flow-view">
            <div className="flow-track home-track">
              <div className="track-label">{homeTeamName}</div>
              {filteredPossessions
                .filter(p => p.team_id === homeTeamId)
                .map((possession, index) => {
                  const isSelected = selectedPossession?.id === possession.id;
                  const width = Math.max(30, Math.min(150, (possession.duration || 0) * 2));
                  
                  return (
                    <div
                      key={possession.id}
                      className={`flow-block home ${isSelected ? 'selected' : ''}`}
                      style={{ width: `${width}px` }}
                      onClick={() => setSelectedPossession(possession)}
                      title={`${formatDuration(possession.duration || 0)} - ${possession.shots_taken} shots`}
                    >
                      <span className="flow-label">#{index + 1}</span>
                      <span className="flow-result">{getResultIcon(possession.result)}</span>
                    </div>
                  );
                })}
            </div>

            <div className="flow-divider" />

            <div className="flow-track away-track">
              <div className="track-label">{awayTeamName}</div>
              {filteredPossessions
                .filter(p => p.team_id === awayTeamId)
                .map((possession, index) => {
                  const isSelected = selectedPossession?.id === possession.id;
                  const width = Math.max(30, Math.min(150, (possession.duration || 0) * 2));
                  
                  return (
                    <div
                      key={possession.id}
                      className={`flow-block away ${isSelected ? 'selected' : ''}`}
                      style={{ width: `${width}px` }}
                      onClick={() => setSelectedPossession(possession)}
                      title={`${formatDuration(possession.duration || 0)} - ${possession.shots_taken} shots`}
                    >
                      <span className="flow-label">#{index + 1}</span>
                      <span className="flow-result">{getResultIcon(possession.result)}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* Selected Possession Details */}
      {selectedPossession && (
        <div className="possession-details-panel">
          <button className="close-details" onClick={() => setSelectedPossession(null)}>×</button>
          <h4>Possession Details</h4>
          <div className="details-grid">
            <div className="detail-item">
              <span className="detail-label">Team:</span>
              <span className="detail-value">{selectedPossession.team_name}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Period:</span>
              <span className="detail-value">{selectedPossession.period}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Duration:</span>
              <span className="detail-value">{formatDuration(selectedPossession.duration || 0)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Shots Taken:</span>
              <span className="detail-value">{selectedPossession.shots_taken}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Started:</span>
              <span className="detail-value">{new Date(selectedPossession.started_at).toLocaleTimeString()}</span>
            </div>
            {selectedPossession.ended_at && (
              <div className="detail-item">
                <span className="detail-label">Ended:</span>
                <span className="detail-value">{new Date(selectedPossession.ended_at).toLocaleTimeString()}</span>
              </div>
            )}
            {selectedPossession.result && (
              <div className="detail-item highlight">
                <span className="detail-label">Result:</span>
                <span className="detail-value" style={{ color: getResultColor(selectedPossession.result) }}>
                  {getResultIcon(selectedPossession.result)} {selectedPossession.result}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flow-legend">
        <h4>Legend</h4>
        <div className="legend-items">
          <div className="legend-item">
            <span style={{ color: '#2196f3' }}>█</span>
            <span>{homeTeamName}</span>
          </div>
          <div className="legend-item">
            <span style={{ color: '#ff9800' }}>█</span>
            <span>{awayTeamName}</span>
          </div>
          <div className="legend-item">
            <span>⚽</span>
            <span>Goal</span>
          </div>
          <div className="legend-item">
            <span>🔄</span>
            <span>Turnover</span>
          </div>
          <div className="legend-item">
            <span>⏹️</span>
            <span>Period End</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PossessionFlowDiagram;
