import React from 'react';

interface PredictionCardProps {
  title: string;
  value: string;
  subtitle: string;
  delta?: number;
  testId?: string;
}

const formatDelta = (value: number): string => {
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded}%`;
};

const deltaClass = (delta?: number): 'up' | 'down' | 'neutral' => {
  if (delta === undefined) return 'neutral';
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'neutral';
};

const PredictionCard: React.FC<PredictionCardProps> = ({
  title,
  value,
  subtitle,
  delta,
  testId,
}) => {
  const direction = deltaClass(delta);

  return (
    <article className="prediction-card" data-testid={testId}>
      <p className="prediction-card__title">{title}</p>
      <p className="prediction-card__value">{value}</p>
      <p className="prediction-card__subtitle">{subtitle}</p>
      <p className={`prediction-card__delta prediction-card__delta--${direction}`}>
        {delta === undefined ? 'Baseline unavailable' : `vs baseline ${formatDelta(delta)}`}
      </p>
    </article>
  );
};

export default PredictionCard;