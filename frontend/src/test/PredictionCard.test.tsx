import { render, screen } from '@testing-library/react';
import PredictionCard from '../components/PredictionCard';

describe('PredictionCard', () => {
  it('renders title, value, subtitle, and positive delta', () => {
    render(
      <PredictionCard
        title="Predicted Efficiency"
        value="62.4%"
        subtitle="Field goal percentage"
        delta={4.8}
      />,
    );

    expect(screen.getByText('Predicted Efficiency')).toBeInTheDocument();
    expect(screen.getByText('62.4%')).toBeInTheDocument();
    expect(screen.getByText('Field goal percentage')).toBeInTheDocument();
    expect(screen.getByText('vs baseline +4.8%')).toHaveClass('prediction-card__delta--up');
  });

  it('shows neutral text when baseline delta is unavailable', () => {
    render(
      <PredictionCard
        title="Predicted Goals"
        value="5"
        subtitle="Scoring output estimate"
      />,
    );

    expect(screen.getByText('Baseline unavailable')).toHaveClass('prediction-card__delta--neutral');
  });
});