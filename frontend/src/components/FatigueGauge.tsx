import React, { useMemo } from 'react';
import '../styles/FatigueAnalysis.css';

interface FatigueGaugeProps {
  score: number;
  label?: string;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

const FatigueGauge: React.FC<FatigueGaugeProps> = ({
  score,
  label = 'Fatigue Score',
  size = 'medium',
  showLabel = true
}) => {
  // Clamp score between 0 and 100
  const clampedScore = Math.max(0, Math.min(100, score));

  // Determine color based on score
  const getColor = (value: number): string => {
    if (value < 30) return '#4CAF50'; // Green - Fresh
    if (value < 60) return '#FFC107'; // Yellow - Moderate
    if (value < 80) return '#FF9800'; // Orange - Tired
    return '#F44336'; // Red - Exhausted
  };

  // Determine status text
  const getStatus = (value: number): string => {
    if (value < 30) return 'Fresh';
    if (value < 60) return 'Moderate';
    if (value < 80) return 'Tired';
    return 'Exhausted';
  };

  const color = useMemo(() => getColor(clampedScore), [clampedScore]);
  const status = useMemo(() => getStatus(clampedScore), [clampedScore]);

  // Size dimensions
  const sizeConfig = {
    small: { radius: 60, width: 140, height: 140 },
    medium: { radius: 90, width: 210, height: 210 },
    large: { radius: 120, width: 280, height: 280 }
  };

  const config = sizeConfig[size];
  const circumference = 2 * Math.PI * config.radius;
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  return (
    <div className={`fatigue-gauge fatigue-gauge--${size}`}>
      <svg width={config.width} height={config.height} className="fatigue-gauge__svg">
        {/* Background circle */}
        <circle
          cx={config.width / 2}
          cy={config.width / 2}
          r={config.radius}
          fill="none"
          stroke="var(--border-color)"
          strokeWidth="8"
        />

        {/* Progress circle */}
        <circle
          cx={config.width / 2}
          cy={config.width / 2}
          r={config.radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="fatigue-gauge__progress"
          style={{
            transition: 'stroke-dashoffset 0.5s ease'
          }}
        />

        {/* Center text */}
        <text
          x={config.width / 2}
          y={config.width / 2 - 10}
          textAnchor="middle"
          className="fatigue-gauge__score"
          fill="var(--text-primary)"
        >
          {clampedScore}
        </text>
        <text
          x={config.width / 2}
          y={config.width / 2 + 25}
          textAnchor="middle"
          className="fatigue-gauge__unit"
          fill="var(--text-secondary)"
        >
          out of 100
        </text>
      </svg>

      {showLabel && (
        <div className="fatigue-gauge__info">
          <h3 className="fatigue-gauge__label">{label}</h3>
          <p className={`fatigue-gauge__status fatigue-gauge__status--${status.toLowerCase().replace(' ', '-')}`}>
            {status}
          </p>
        </div>
      )}
    </div>
  );
};

export default FatigueGauge;
