import { render, screen } from '@testing-library/react';
import PredictionsPanel from '../components/PredictionsPanel';
import type {
  FatigueGameAnalysis,
  NextGamePredictionResponse,
  PlayerComparisonResponse,
} from '../types/advanced-analytics';

describe('PredictionsPanel', () => {
  const prediction: NextGamePredictionResponse = {
    player_id: 7,
    opponent_id: 42,
    predicted_fg_percentage: 63.2,
    predicted_shots: 9,
    predicted_goals: 6,
    confidence_score: 80,
    form_trend: 'improving',
    historical_avg: {
      fg_percentage: 58.5,
      shots_per_game: 8.2,
      goals_per_game: 5.1,
    },
    adjustments: {
      form_adjustment: 4,
      matchup_adjustment: 2,
    },
  };

  const comparison: PlayerComparisonResponse = {
    player_id: 7,
    comparison: {
      shots_vs_league: 3,
      goals_vs_league: 8,
      fg_vs_league: 5,
      distance_vs_league: 1,
    },
  };

  const latestFatigue: FatigueGameAnalysis = {
    game_id: 1,
    game_date: '2026-03-20',
    play_time_seconds: 1800,
    play_time_minutes: 30,
    play_time_percent: 75,
    performance_degradation: 8,
    fatigue_level: 'normal',
    period_performance: [],
  };

  it('renders predicted stats cards, confidence intervals, comparisons, factors, and disclaimer', () => {
    render(
      <PredictionsPanel
        prediction={prediction}
        comparison={comparison}
        latestFatigue={latestFatigue}
      />, 
    );

    expect(screen.getByTestId('prediction-card-shots')).toBeInTheDocument();
    expect(screen.getByTestId('prediction-card-goals')).toBeInTheDocument();
    expect(screen.getByTestId('prediction-card-efficiency')).toBeInTheDocument();

    expect(screen.getByTestId('confidence-intervals')).toBeInTheDocument();
    expect(screen.getByText(/FG% range/)).toBeInTheDocument();

    expect(screen.getByTestId('historical-comparison')).toBeInTheDocument();
    expect(screen.getAllByText(/historical average/).length).toBeGreaterThan(0);

    expect(screen.getByTestId('prediction-factors')).toBeInTheDocument();
    expect(screen.getByText(/Rest:/)).toBeInTheDocument();
    expect(screen.getByText(/Opponent:/)).toBeInTheDocument();
    expect(screen.getByText(/Venue:/)).toBeInTheDocument();

    expect(screen.getByTestId('prediction-disclaimer')).toBeInTheDocument();
  });

  it('shows insufficient data message with disclaimer', () => {
    render(
      <PredictionsPanel
        prediction={{ player_id: 7, opponent_id: null, prediction: 'insufficient_data', message: 'Need 5 games.' }}
        comparison={null}
        latestFatigue={null}
      />, 
    );

    expect(screen.getByText('Need 5 games.')).toBeInTheDocument();
    expect(screen.getByTestId('prediction-disclaimer')).toBeInTheDocument();
  });
});