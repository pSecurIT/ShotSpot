import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import FocusMode from '../components/FocusMode';

// Mock CourtVisualization component
vi.mock('../components/CourtVisualization', () => ({
  default: ({ homeTeamName, awayTeamName }: { homeTeamName: string; awayTeamName: string }) => (
    <div data-testid="court-visualization">
      Court: {homeTeamName} vs {awayTeamName}
    </div>
  )
}));

// Mock SubstitutionPanel component
vi.mock('../components/SubstitutionPanel', () => ({
  default: ({ homeTeamName, awayTeamName }: { homeTeamName: string; awayTeamName: string }) => (
    <div data-testid="substitution-panel">
      Substitutions: {homeTeamName} vs {awayTeamName}
    </div>
  )
}));

describe('FocusMode Component', () => {
  const mockProps = {
    gameId: 1,
    homeTeamId: 1,
    awayTeamId: 2,
    homeTeamName: 'Home Team',
    awayTeamName: 'Away Team',
    homeScore: 5,
    awayScore: 3,
    currentPeriod: 2,
    numberOfPeriods: 4,
    homeAttackingSide: 'left' as const,
    timerState: 'running' as const,
    timeRemaining: '8:30',
    homePlayers: [],
    awayPlayers: [],
    activePossession: {
      id: 1,
      game_id: 1,
      team_id: 1,
      period: 2,
      started_at: new Date().toISOString(),
      ended_at: null,
      shots_taken: 3,
      team_name: 'Home Team'
    },
    possessionDuration: 45,
    onShotRecorded: vi.fn(),
    onCenterLineCross: vi.fn(),
    onStartTimer: vi.fn(),
    onPauseTimer: vi.fn(),
    onNextPeriod: vi.fn(),
    onEndGame: vi.fn(),
    onExitFocus: vi.fn(),
    onSubstitutionRecorded: vi.fn(),
    canAddEvents: vi.fn(() => true),
    onResumeTimer: vi.fn(),
    courtResetKey: 0
  };

  it('should render focus mode with header', () => {
    render(<FocusMode {...mockProps} />);
    
    expect(screen.getAllByText('Home Team').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Away Team').length).toBeGreaterThan(0);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('should display current period and timer', () => {
    render(<FocusMode {...mockProps} />);
    
    expect(screen.getByText('Period 2')).toBeInTheDocument();
    expect(screen.getByText('8:30')).toBeInTheDocument();
  });

  it('should render court visualization', () => {
    render(<FocusMode {...mockProps} />);
    
    const court = screen.getByTestId('court-visualization');
    expect(court).toBeInTheDocument();
    expect(court).toHaveTextContent('Court: Home Team vs Away Team');
  });

  it('should show side indicators with correct team names', () => {
    render(<FocusMode {...mockProps} />);
    
    const indicators = screen.getAllByText('Home Team');
    expect(indicators.length).toBeGreaterThan(1); // Header + left side indicator
    
    const awayIndicators = screen.getAllByText('Away Team');
    expect(awayIndicators.length).toBeGreaterThan(1); // Header + right side indicator
  });

  it('should highlight side with possession', () => {
    render(<FocusMode {...mockProps} />);
    
    // Home team has possession (left side)
    const leftIndicator = screen.getByText('⚽ BALL');
    expect(leftIndicator).toBeInTheDocument();
  });

  it('should show correct possession indicator on right side when away team has ball', () => {
    const propsWithAwayPossession = {
      ...mockProps,
      homeAttackingSide: 'right' as const,
      activePossession: {
        ...mockProps.activePossession,
        team_id: 2, // Away team
        team_name: 'Away Team'
      }
    };
    
    render(<FocusMode {...propsWithAwayPossession} />);
    
    const ballIndicators = screen.getAllByText('⚽ BALL');
    expect(ballIndicators.length).toBe(1);
  });

  it('should display possession information', () => {
    render(<FocusMode {...mockProps} />);
    
    expect(screen.getAllByText('Home Team').length).toBeGreaterThan(0);
    expect(screen.getByText('0:45')).toBeInTheDocument(); // 45 seconds
    expect(screen.getByText('3 shots')).toBeInTheDocument();
  });

  it('should show start button when timer is stopped', () => {
    const stoppedProps = { ...mockProps, timerState: 'stopped' as const };
    render(<FocusMode {...stoppedProps} />);
    
    expect(screen.getByText('Start')).toBeInTheDocument();
  });

  it('should show resume button when timer is paused', () => {
    const pausedProps = { ...mockProps, timerState: 'paused' as const };
    render(<FocusMode {...pausedProps} />);
    
    expect(screen.getByText('Resume')).toBeInTheDocument();
  });

  it('should show pause button when timer is running', () => {
    render(<FocusMode {...mockProps} />);
    
    expect(screen.getByText('Pause')).toBeInTheDocument();
  });

  it('should show next period button when not in final period', () => {
    render(<FocusMode {...mockProps} />);
    
    expect(screen.getByText('Next Period')).toBeInTheDocument();
  });

  it('should hide next period button in final period', () => {
    const finalPeriodProps = { ...mockProps, currentPeriod: 4 };
    render(<FocusMode {...finalPeriodProps} />);
    
    expect(screen.queryByText('Next Period')).not.toBeInTheDocument();
  });

  it('should call onStartTimer when start button is clicked', () => {
    const stoppedProps = { ...mockProps, timerState: 'stopped' as const };
    render(<FocusMode {...stoppedProps} />);
    
    const startButton = screen.getByText('Start');
    fireEvent.click(startButton);
    
    expect(mockProps.onStartTimer).toHaveBeenCalledTimes(1);
  });

  it('should call onPauseTimer when pause button is clicked', () => {
    render(<FocusMode {...mockProps} />);
    
    const pauseButton = screen.getByText('Pause');
    fireEvent.click(pauseButton);
    
    expect(mockProps.onPauseTimer).toHaveBeenCalledTimes(1);
  });

  it('should call onNextPeriod when next period button is clicked', () => {
    render(<FocusMode {...mockProps} />);
    
    const nextButton = screen.getByText('Next Period');
    fireEvent.click(nextButton);
    
    expect(mockProps.onNextPeriod).toHaveBeenCalledTimes(1);
  });

  it('should call onExitFocus when exit focus button is clicked', () => {
    render(<FocusMode {...mockProps} />);
    
    const exitButtons = screen.getAllByText('Exit Focus');
    fireEvent.click(exitButtons[0]); // Click the first one (floating button)
    
    expect(mockProps.onExitFocus).toHaveBeenCalledTimes(1);
  });

  it('should call onEndGame when end game button is clicked', () => {
    render(<FocusMode {...mockProps} />);
    
    const endButton = screen.getByText('End Game');
    fireEvent.click(endButton);
    
    expect(mockProps.onEndGame).toHaveBeenCalledTimes(1);
  });

  it('should render substitution panel', () => {
    render(<FocusMode {...mockProps} />);
    
    const subPanel = screen.getByTestId('substitution-panel');
    expect(subPanel).toBeInTheDocument();
    expect(subPanel).toHaveTextContent('Substitutions: Home Team vs Away Team');
  });

  it('should format possession duration correctly', () => {
    const longPossessionProps = {
      ...mockProps,
      possessionDuration: 125 // 2 minutes 5 seconds
    };
    
    render(<FocusMode {...longPossessionProps} />);
    
    expect(screen.getByText('2:05')).toBeInTheDocument();
  });

  it('should not show possession info when no active possession', () => {
    const noPossessionProps = {
      ...mockProps,
      activePossession: null
    };
    
    render(<FocusMode {...noPossessionProps} />);
    
    expect(screen.queryByText('shots')).not.toBeInTheDocument();
  });

  it('should render with all required accessibility elements', () => {
    const { container } = render(<FocusMode {...mockProps} />);
    
    // Check for proper structure
    expect(container.querySelector('.focus-mode')).toBeInTheDocument();
    expect(container.querySelector('.focus-header')).toBeInTheDocument();
    expect(container.querySelector('.focus-content')).toBeInTheDocument();
    expect(container.querySelector('.focus-controls')).toBeInTheDocument();
  });

  it('should pass correct props to CourtVisualization', () => {
    render(<FocusMode {...mockProps} />);
    
    const court = screen.getByTestId('court-visualization');
    expect(court).toHaveTextContent('Home Team vs Away Team');
  });
});
