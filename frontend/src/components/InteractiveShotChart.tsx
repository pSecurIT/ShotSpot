import React, { useState, useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
import courtImageUrl from '../img/Korfbalveld-breed.PNG';
import '../styles/InteractiveShotChart.css';

interface Shot {
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
  shot_type?: string | null;
}

interface Zone {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

interface ZoneStats {
  shots: number;
  goals: number;
  misses: number;
  blocked: number;
  successRate: number;
}

interface InteractiveShotChartProps {
  shots: Shot[];
  title?: string;
  onZoneClick?: (zoneId: string) => void;
  showZones?: boolean;
  showExportButtons?: boolean;
}

const InteractiveShotChart: React.FC<InteractiveShotChartProps> = ({
  shots,
  title = 'Interactive Shot Chart',
  onZoneClick,
  showZones = true,
  showExportButtons = true
}) => {
  const [selectedShot, setSelectedShot] = useState<Shot | null>(null);
  const [hoveredShot, setHoveredShot] = useState<Shot | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [showZoneOverlay, setShowZoneOverlay] = useState(true);
  const chartRef = useRef<HTMLDivElement>(null);

  // Define court zones (9 zones: 3x3 grid) - memoized to prevent recreation on every render
  const zones: Zone[] = React.useMemo(() => [
    // Left third
    { id: 'left-top', name: 'Left Top', x: 0, y: 0, width: 33.33, height: 33.33, color: 'rgba(33, 150, 243, 0.2)' },
    { id: 'left-mid', name: 'Left Middle', x: 0, y: 33.33, width: 33.33, height: 33.33, color: 'rgba(33, 150, 243, 0.2)' },
    { id: 'left-bot', name: 'Left Bottom', x: 0, y: 66.66, width: 33.33, height: 33.34, color: 'rgba(33, 150, 243, 0.2)' },
    // Center third
    { id: 'center-top', name: 'Center Top', x: 33.33, y: 0, width: 33.34, height: 33.33, color: 'rgba(76, 175, 80, 0.2)' },
    { id: 'center-mid', name: 'Center Middle', x: 33.33, y: 33.33, width: 33.34, height: 33.33, color: 'rgba(76, 175, 80, 0.2)' },
    { id: 'center-bot', name: 'Center Bottom', x: 33.33, y: 66.66, width: 33.34, height: 33.34, color: 'rgba(76, 175, 80, 0.2)' },
    // Right third
    { id: 'right-top', name: 'Right Top', x: 66.67, y: 0, width: 33.33, height: 33.33, color: 'rgba(255, 152, 0, 0.2)' },
    { id: 'right-mid', name: 'Right Middle', x: 66.67, y: 33.33, width: 33.33, height: 33.33, color: 'rgba(255, 152, 0, 0.2)' },
    { id: 'right-bot', name: 'Right Bottom', x: 66.67, y: 66.66, width: 33.33, height: 33.34, color: 'rgba(255, 152, 0, 0.2)' }
  ], []);

  // Calculate zone statistics
  const getZoneStats = useCallback((zoneId: string): ZoneStats => {
    const zone = zones.find(z => z.id === zoneId);
    if (!zone) return { shots: 0, goals: 0, misses: 0, blocked: 0, successRate: 0 };

    const zoneShots = shots.filter(shot => {
      const inXRange = shot.x_coord >= zone.x && shot.x_coord < (zone.x + zone.width);
      const inYRange = shot.y_coord >= zone.y && shot.y_coord < (zone.y + zone.height);
      return inXRange && inYRange;
    });

    const goals = zoneShots.filter(s => s.result === 'goal').length;
    const misses = zoneShots.filter(s => s.result === 'miss').length;
    const blocked = zoneShots.filter(s => s.result === 'blocked').length;
    const successRate = zoneShots.length > 0 ? Math.round((goals / zoneShots.length) * 100) : 0;

    return {
      shots: zoneShots.length,
      goals,
      misses,
      blocked,
      successRate
    };
  }, [shots, zones]);

  // Get filtered shots for selected zone
  const getFilteredShots = useCallback(() => {
    if (!selectedZone) return shots;

    const zone = zones.find(z => z.id === selectedZone);
    if (!zone) return shots;

    return shots.filter(shot => {
      const inXRange = shot.x_coord >= zone.x && shot.x_coord < (zone.x + zone.width);
      const inYRange = shot.y_coord >= zone.y && shot.y_coord < (zone.y + zone.height);
      return inXRange && inYRange;
    });
  }, [selectedZone, shots, zones]);

  const handleZoneClick = useCallback((zoneId: string) => {
    setSelectedZone(prev => prev === zoneId ? null : zoneId);
    if (onZoneClick) {
      onZoneClick(zoneId);
    }
  }, [onZoneClick]);

  const getShotColor = (result: 'goal' | 'miss' | 'blocked'): string => {
    switch (result) {
      case 'goal': return '#4CAF50';
      case 'miss': return '#f44336';
      case 'blocked': return '#FF9800';
    }
  };

  const getShotMarker = (result: 'goal' | 'miss' | 'blocked'): string => {
    switch (result) {
      case 'goal': return '●';
      case 'miss': return '✕';
      case 'blocked': return '◼';
    }
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
      link.download = `shot-chart-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error exporting PNG:', error);
      alert('Failed to export image. Please try again.');
    }
  }, []);

  // Export as SVG
  const exportAsSVG = useCallback(() => {
    if (!chartRef.current) return;

    try {
      // Create SVG content
      const svgContent = `
        <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
          <rect width="800" height="600" fill="white"/>
          <text x="400" y="30" font-size="24" text-anchor="middle" font-weight="bold">${title}</text>
          
          <!-- Court background -->
          <rect x="50" y="50" width="700" height="500" fill="#e8f5e9" stroke="#4CAF50" stroke-width="2"/>
          
          <!-- Shots -->
          ${getFilteredShots().map(shot => `
            <circle 
              cx="${50 + (shot.x_coord / 100) * 700}" 
              cy="${50 + (shot.y_coord / 100) * 500}" 
              r="6" 
              fill="${getShotColor(shot.result)}"
              stroke="white"
              stroke-width="2"
            />
          `).join('')}
          
          <!-- Legend -->
          <g transform="translate(50, 560)">
            <circle cx="0" cy="0" r="6" fill="#4CAF50"/>
            <text x="15" y="5" font-size="12">Goal</text>
            
            <circle cx="80" cy="0" r="6" fill="#f44336"/>
            <text x="95" y="5" font-size="12">Miss</text>
            
            <circle cx="160" cy="0" r="6" fill="#FF9800"/>
            <text x="175" y="5" font-size="12">Blocked</text>
          </g>
        </svg>
      `;

      const blob = new Blob([svgContent], { type: 'image/svg+xml' });
      const link = document.createElement('a');
      link.download = `shot-chart-${Date.now()}.svg`;
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('Error exporting SVG:', error);
      alert('Failed to export SVG. Please try again.');
    }
  }, [title, getFilteredShots]);

  // Generate shareable link
  const generateShareableLink = useCallback(() => {
    const state = {
      shots: shots.map(s => ({ id: s.id, x: s.x_coord, y: s.y_coord, result: s.result })),
      selectedZone,
      title
    };
    
    const encodedState = btoa(JSON.stringify(state));
    const shareUrl = `${window.location.origin}${window.location.pathname}?chart=${encodedState}`;
    
    navigator.clipboard.writeText(shareUrl).then(() => {
      alert('Shareable link copied to clipboard!');
    }).catch(() => {
      prompt('Copy this link:', shareUrl);
    });
  }, [shots, selectedZone, title]);

  const filteredShots = getFilteredShots();

  return (
    <div className="interactive-shot-chart">
      {showExportButtons && (
        <div className="chart-controls">
          <h3>{title}</h3>
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
      )}

      {showZones && (
        <div className="zone-controls">
          <label>
            <input
              type="checkbox"
              checked={showZoneOverlay}
              onChange={(e) => setShowZoneOverlay(e.target.checked)}
            />
            Show Zone Overlay
          </label>
          {selectedZone && (
            <button onClick={() => setSelectedZone(null)} className="clear-zone-btn">
              Clear Zone Filter
            </button>
          )}
        </div>
      )}

      <div ref={chartRef} className="chart-container">
        <div className="court-wrapper">
          <img 
            src={courtImageUrl} 
            alt="Korfball Court" 
            className="court-image"
            draggable={false}
          />

          {/* Zone overlay */}
          {showZones && showZoneOverlay && (
            <div className="zones-overlay">
              {zones.map(zone => {
                const stats = getZoneStats(zone.id);
                const isSelected = selectedZone === zone.id;
                
                return (
                  <div
                    key={zone.id}
                    className={`zone-box ${isSelected ? 'selected' : ''}`}
                    style={{
                      left: `${zone.x}%`,
                      top: `${zone.y}%`,
                      width: `${zone.width}%`,
                      height: `${zone.height}%`,
                      backgroundColor: isSelected ? 'rgba(33, 150, 243, 0.4)' : zone.color
                    }}
                    onClick={() => handleZoneClick(zone.id)}
                    title={`${zone.name}: ${stats.shots} shots, ${stats.successRate}% success`}
                  >
                    <div className="zone-label">
                      <div className="zone-name">{zone.name}</div>
                      <div className="zone-stats">
                        <span className="stat">{stats.shots} shots</span>
                        <span className="stat success-rate">{stats.successRate}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Shot markers */}
          <div className="shots-overlay">
            {filteredShots.map(shot => (
              <div
                key={shot.id}
                className={`shot-marker ${shot.result} ${hoveredShot?.id === shot.id ? 'hovered' : ''} ${selectedShot?.id === shot.id ? 'selected' : ''}`}
                style={{
                  left: `${shot.x_coord}%`,
                  top: `${shot.y_coord}%`,
                  backgroundColor: getShotColor(shot.result)
                }}
                onClick={() => setSelectedShot(shot)}
                onMouseEnter={() => setHoveredShot(shot)}
                onMouseLeave={() => setHoveredShot(null)}
                title={`${shot.first_name} ${shot.last_name} - ${shot.result}`}
              >
                {getShotMarker(shot.result)}
              </div>
            ))}
          </div>

          {/* Hover tooltip */}
          {hoveredShot && !selectedShot && (
            <div 
              className="hover-tooltip"
              style={{
                left: `${hoveredShot.x_coord}%`,
                top: `${hoveredShot.y_coord}%`
              }}
            >
              <div className="tooltip-content">
                <strong>#{hoveredShot.jersey_number} {hoveredShot.first_name} {hoveredShot.last_name}</strong>
                <div className="tooltip-team">{hoveredShot.team_name}</div>
                <div className="tooltip-result">
                  <span className={`result-badge ${hoveredShot.result}`}>
                    {hoveredShot.result.toUpperCase()}
                  </span>
                </div>
                {hoveredShot.distance && (
                  <div className="tooltip-distance">Distance: {hoveredShot.distance}m</div>
                )}
                {hoveredShot.shot_type && (
                  <div className="tooltip-type">Type: {hoveredShot.shot_type}</div>
                )}
                <div className="tooltip-period">Period {hoveredShot.period}</div>
              </div>
            </div>
          )}
        </div>

        {/* Zone statistics panel */}
        {showZones && selectedZone && (
          <div className="zone-stats-panel">
            <h4>{zones.find(z => z.id === selectedZone)?.name} Statistics</h4>
            {(() => {
              const stats = getZoneStats(selectedZone);
              return (
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-label">Total Shots:</span>
                    <span className="stat-value">{stats.shots}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Goals:</span>
                    <span className="stat-value success">{stats.goals}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Misses:</span>
                    <span className="stat-value miss">{stats.misses}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Blocked:</span>
                    <span className="stat-value blocked">{stats.blocked}</span>
                  </div>
                  <div className="stat-item highlight">
                    <span className="stat-label">Success Rate:</span>
                    <span className="stat-value">{stats.successRate}%</span>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Selected shot modal */}
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
                {selectedShot.distance && <p><strong>Distance:</strong> {selectedShot.distance}m</p>}
                {selectedShot.shot_type && <p><strong>Type:</strong> {selectedShot.shot_type}</p>}
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

      {/* Legend */}
      <div className="chart-legend">
        <h4>Legend</h4>
        <div className="legend-items">
          <div className="legend-item">
            <span className="marker goal">●</span>
            <span>Goal ({shots.filter(s => s.result === 'goal').length})</span>
          </div>
          <div className="legend-item">
            <span className="marker miss">✕</span>
            <span>Miss ({shots.filter(s => s.result === 'miss').length})</span>
          </div>
          <div className="legend-item">
            <span className="marker blocked">◼</span>
            <span>Blocked ({shots.filter(s => s.result === 'blocked').length})</span>
          </div>
        </div>
        {selectedZone && (
          <div className="legend-note">
            Showing {filteredShots.length} shots in selected zone
          </div>
        )}
      </div>
    </div>
  );
};

export default InteractiveShotChart;
