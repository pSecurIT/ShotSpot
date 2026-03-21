import React, { useMemo } from 'react';
import PredictionCard from './PredictionCard';
import type {
  FatigueGameAnalysis,
  NextGamePredictionResponse,
  PlayerComparisonResponse,
} from '../types/advanced-analytics';
import '../styles/Predictions.css';

interface PredictionsPanelProps {
  prediction: NextGamePredictionResponse | null;
  comparison: PlayerComparisonResponse | null;
  latestFatigue: FatigueGameAnalysis | null;
}

const roundToOne = (value: number): number => Math.round(value * 10) / 10;

const confidenceMargin = (confidence: number, value: number): number => {
  const uncertainty = Math.max(0.05, (100 - confidence) / 100);
  return roundToOne(value * uncertainty * 0.5);
};

const interval = (value: number, confidence: number): string => {
  const margin = confidenceMargin(confidence, value);
  const low = roundToOne(Math.max(0, value - margin));
  const high = roundToOne(value + margin);
  return `${low} - ${high}`;
};

const PredictionsPanel: React.FC<PredictionsPanelProps> = ({
  prediction,
  comparison,
  latestFatigue,
}) => {
  const isUnavailable = !prediction || prediction.prediction === 'insufficient_data';

  const confidence = prediction?.confidence_score ?? 0;
  const predictedFg = prediction?.predicted_fg_percentage ?? 0;
  const predictedShots = prediction?.predicted_shots ?? 0;
  const predictedGoals = prediction?.predicted_goals ?? 0;

  const historical = prediction?.historical_avg;

  const factors = useMemo(() => {
    const restFactor = (() => {
      if (!latestFatigue) {
        return {
          label: 'Rest',
          effect: 'neutral',
          detail: 'No fatigue sample available. Rest impact is assumed neutral.',
        };
      }

      if (latestFatigue.fatigue_level === 'exhausted' || latestFatigue.fatigue_level === 'tired') {
        return {
          label: 'Rest',
          effect: 'negative',
          detail: `Recent fatigue level is ${latestFatigue.fatigue_level}. Output may dip without recovery.`,
        };
      }

      return {
        label: 'Rest',
        effect: 'positive',
        detail: `Recent fatigue level is ${latestFatigue.fatigue_level}. Recovery state supports performance.`,
      };
    })();

    const matchupAdjustment = prediction?.adjustments?.matchup_adjustment ?? 0;
    const opponentFactor = {
      label: 'Opponent',
      effect: matchupAdjustment > 0 ? 'positive' : matchupAdjustment < 0 ? 'negative' : 'neutral',
      detail: prediction?.opponent_id
        ? `Matchup adjustment ${matchupAdjustment > 0 ? '+' : ''}${matchupAdjustment}%.`
        : 'Opponent context is unavailable. Matchup adjustment defaults to neutral.',
    };

    const venueFactor = {
      label: 'Venue',
      effect: 'neutral',
      detail: 'Venue-specific signal is not available yet, so this model assumes a neutral environment.',
    };

    return [restFactor, opponentFactor, venueFactor];
  }, [latestFatigue, prediction]);

  return (
    <section className="predictions-panel" aria-label="Predictions panel">
      <h3>Predictions and Benchmarks</h3>
      <p className="predictions-panel__note">
        Expected next-game output from recent form, fatigue, and matchup context.
      </p>

      {isUnavailable ? (
        <p className="predictions-panel__empty">{prediction?.message || 'Not enough data for prediction.'}</p>
      ) : (
        <>
          <div className="predictions-panel__cards">
            <PredictionCard
              testId="prediction-card-shots"
              title="Predicted Shots"
              value={`${predictedShots}`}
              subtitle="Shot volume estimate"
              delta={historical ? roundToOne(((predictedShots - historical.shots_per_game) / Math.max(1, historical.shots_per_game)) * 100) : undefined}
            />
            <PredictionCard
              testId="prediction-card-goals"
              title="Predicted Goals"
              value={`${predictedGoals}`}
              subtitle="Scoring output estimate"
              delta={historical ? roundToOne(((predictedGoals - historical.goals_per_game) / Math.max(1, historical.goals_per_game)) * 100) : undefined}
            />
            <PredictionCard
              testId="prediction-card-efficiency"
              title="Predicted Efficiency"
              value={`${predictedFg}%`}
              subtitle="Field goal percentage"
              delta={historical ? roundToOne(predictedFg - historical.fg_percentage) : comparison?.comparison?.fg_vs_league}
            />
          </div>

          <article className="predictions-panel__block" data-testid="confidence-intervals">
            <h4>Confidence Intervals</h4>
            <ul className="predictions-panel__list">
              <li>FG% range ({confidence}% confidence): {interval(predictedFg, confidence)}%</li>
              <li>Shots range ({confidence}% confidence): {interval(predictedShots, confidence)}</li>
              <li>Goals range ({confidence}% confidence): {interval(predictedGoals, confidence)}</li>
            </ul>
          </article>

          <article className="predictions-panel__block" data-testid="historical-comparison">
            <h4>Historical Comparison</h4>
            {historical ? (
              <ul className="predictions-panel__list">
                <li>Efficiency: {predictedFg}% predicted vs {historical.fg_percentage}% historical average</li>
                <li>Shots: {predictedShots} predicted vs {historical.shots_per_game} historical average</li>
                <li>Goals: {predictedGoals} predicted vs {historical.goals_per_game} historical average</li>
              </ul>
            ) : (
              <p className="predictions-panel__empty">Historical baseline is unavailable for this player.</p>
            )}
          </article>

          <article className="predictions-panel__block" data-testid="prediction-factors">
            <h4>Factors Affecting Prediction</h4>
            <ul className="predictions-panel__list">
              {factors.map((factor) => (
                <li key={factor.label}>
                  <strong>{factor.label}:</strong> <span className={`predictions-panel__factor predictions-panel__factor--${factor.effect}`}>{factor.effect}</span> - {factor.detail}
                </li>
              ))}
            </ul>
          </article>
        </>
      )}

      <p className="predictions-panel__disclaimer" data-testid="prediction-disclaimer">
        Disclaimer: Predictions are probabilistic estimates based on historical data and should support, not replace, coaching decisions.
      </p>
    </section>
  );
};

export default PredictionsPanel;