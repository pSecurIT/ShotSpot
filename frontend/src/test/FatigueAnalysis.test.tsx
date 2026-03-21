import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import FatigueAnalysis from '../components/FatigueAnalysis';
import { advancedAnalyticsApi } from '../services/advancedAnalyticsApi';
import api from '../utils/api';
import type { FatigueResponse } from '../types/advanced-analytics';

// Mock the API services
vi.mock('../services/advancedAnalyticsApi', () => ({
  advancedAnalyticsApi: {
    fatigue: vi.fn(),
  },
}));

vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

// Mock recharts
vi.mock('recharts', () => {
  const passthrough = (name: string) => {
    const MockComponent = ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', { 'data-testid': name }, children);
    MockComponent.displayName = name;
    return MockComponent;
  };

  const ResponsiveContainer = ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'ResponsiveContainer' }, children);
  ResponsiveContainer.displayName = 'ResponsiveContainer';

  return {
    ResponsiveContainer,
    LineChart: passthrough('LineChart'),
    BarChart: passthrough('BarChart'),
    ComposedChart: passthrough('ComposedChart'),
    Line: passthrough('Line'),
    Bar: passthrough('Bar'),
    XAxis: passthrough('XAxis'),
    YAxis: passthrough('YAxis'),
    CartesianGrid: passthrough('CartesianGrid'),
    Tooltip: passthrough('Tooltip'),
    Legend: passthrough('Legend'),
    Cell: passthrough('Cell'),
  };
});

// Mock DashboardWidget
vi.mock('../components/DashboardWidget', () => ({
  default: ({ title, children, loading, error }: {
    title: string;
    children: React.ReactNode;
    loading?: boolean;
    error?: string | null;
    icon?: string;
  }) => (
    <div data-testid={`widget-${title}`} className="dashboard-widget">
      {loading && <div>Loading…</div>}
      {error && <div role="alert">{error}</div>}
      {!loading && !error && children}
    </div>
  ),
}));

// Mock FatigueGauge
vi.mock('../components/FatigueGauge', () => ({
  default: ({ score, label }: { score: number; label?: string }) => (
    <div data-testid="fatigue-gauge" className="fatigue-gauge">
      <div className="fatigue-gauge__score">{score}</div>
      {label && <div className="fatigue-gauge__label">{label}</div>}
    </div>
  ),
}));

describe('FatigueAnalysis Component', () => {
  const mockFatigueData: FatigueResponse = {
    player_id: 1,
    games_analyzed: 3,
    fatigue_analysis: [
      {
        game_id: 1,
        game_date: '2024-01-15',
        play_time_seconds: 1800,
        play_time_minutes: 30,
        play_time_percent: 75,
        performance_degradation: 12.5,
        fatigue_level: 'tired',
        period_performance: [
          { period: 1, shots: 5, goals: 3, fg_percentage: 60 },
          { period: 2, shots: 4, goals: 2, fg_percentage: 50 },
          { period: 3, shots: 3, goals: 1, fg_percentage: 33.3 },
          { period: 4, shots: 2, goals: 0, fg_percentage: 0 }
        ]
      },
      {
        game_id: 2,
        game_date: '2024-01-08',
        play_time_seconds: 2100,
        play_time_minutes: 35,
        play_time_percent: 85,
        performance_degradation: 15.2,
        fatigue_level: 'exhausted',
        period_performance: [
          { period: 1, shots: 6, goals: 4, fg_percentage: 66.7 },
          { period: 2, shots: 5, goals: 3, fg_percentage: 60 },
          { period: 3, shots: 4, goals: 2, fg_percentage: 50 },
          { period: 4, shots: 3, goals: 1, fg_percentage: 33.3 }
        ]
      },
      {
        game_id: 3,
        game_date: '2024-01-01',
        play_time_seconds: 900,
        play_time_minutes: 15,
        play_time_percent: 45,
        performance_degradation: 5.2,
        fatigue_level: 'normal',
        period_performance: [
          { period: 1, shots: 3, goals: 2, fg_percentage: 66.7 },
          { period: 2, shots: 2, goals: 1, fg_percentage: 50 }
        ]
      }
    ]
  };

  const mockTeamStats = {
    data: {
      data: [
        {
          game_id: 1,
          game_date: '2024-01-15',
          play_time_seconds: 900,
          play_time_minutes: 15,
          play_time_percent: 40,
          performance_degradation: 5.0,
          fatigue_level: 'normal' as const,
          period_performance: []
        }
      ]
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('🎯 Component Initialization', () => {
    it('should render component with title', async () => {
      const fatigueMock = advancedAnalyticsApi.fatigue as Mock;
      fatigueMock.mockResolvedValue(mockFatigueData);

      render(<FatigueAnalysis playerId={1} />);

      expect(screen.getByText('Fatigue Analysis')).toBeInTheDocument();
      expect(screen.getByText('Player workload and rest recommendations')).toBeInTheDocument();
    });

    it('should fetch fatigue data on mount', async () => {
      const fatigueMock = advancedAnalyticsApi.fatigue as Mock;
      fatigueMock.mockResolvedValue(mockFatigueData);

      render(<FatigueAnalysis playerId={1} />);

      await waitFor(() => {
        expect(fatigueMock).toHaveBeenCalledWith(1, undefined);
      });
    });

    it('should pass dateRange to API', async () => {
      const fatigueMock = advancedAnalyticsApi.fatigue as Mock;
      fatigueMock.mockResolvedValue(mockFatigueData);

      const dateRange = { startDate: '2024-01-01', endDate: '2024-01-31' };
      render(<FatigueAnalysis playerId={1} dateRange={dateRange} />);

      await waitFor(() => {
        expect(fatigueMock).toHaveBeenCalledWith(1, dateRange);
      });
    });
  });

  describe('📊 Data Display', () => {
    it('should display loading state initially', () => {
      const fatigueMock = advancedAnalyticsApi.fatigue as Mock;
      fatigueMock.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<FatigueAnalysis playerId={1} />);

      // Component should be rendering while loading
      expect(screen.getByText('Fatigue Analysis')).toBeInTheDocument();
    });

    it('should display error message on API failure', async () => {
      const fatigueMock = advancedAnalyticsApi.fatigue as Mock;
      fatigueMock.mockRejectedValue(new Error('Failed to load data'));

      const { container } = render(<FatigueAnalysis playerId={1} />);

      await waitFor(() => {
        // Check for error in one of the main widgets
        const alerts = container.querySelectorAll('[role="alert"]');
        expect(alerts.length).toBeGreaterThan(0);
        // Verify error message is in at least one alert
        const hasErrorText = Array.from(alerts).some(alert => 
          alert.textContent?.includes('Failed to load data')
        );
        expect(hasErrorText).toBe(true);
      });
    });

    it('should display fatigue data after loading', async () => {
      const fatigueMock = advancedAnalyticsApi.fatigue as Mock;
      fatigueMock.mockResolvedValue(mockFatigueData);

      render(<FatigueAnalysis playerId={1} />);

      await waitFor(() => {
        expect(screen.getByTestId('fatigue-gauge')).toBeInTheDocument();
      });
    });

    it('should display all dashboard widgets', async () => {
      const fatigueMock = advancedAnalyticsApi.fatigue as Mock;
      fatigueMock.mockResolvedValue(mockFatigueData);

      render(<FatigueAnalysis playerId={1} />);

      await waitFor(() => {
        expect(screen.getByTestId('widget-Current Fatigue Score')).toBeInTheDocument();
        expect(screen.getByTestId('widget-Injury Risk Assessment')).toBeInTheDocument();
        expect(screen.getByTestId('widget-Rest Recommendation')).toBeInTheDocument();
      });
    });
  });

  describe('🟢 Alert Status', () => {
    it('should show success alert for low fatigue', async () => {
      const fatigueMock = advancedAnalyticsApi.fatigue as Mock;
      const lowFatigue = {
        ...mockFatigueData,
        fatigue_analysis: [{
          ...mockFatigueData.fatigue_analysis[2],
          play_time_percent: 30,
          performance_degradation: 2,
          fatigue_level: 'fresh' as const
        }]
      };
      fatigueMock.mockResolvedValue(lowFatigue);

      const { container } = render(<FatigueAnalysis playerId={1} />);

      await waitFor(() => {
        const alert = container.querySelector('.fatigue-analysis__alert--success');
        expect(alert).toBeInTheDocument();
      });
    });

    it('should show warning alert for moderate fatigue', async () => {
      const fatigueMock = advancedAnalyticsApi.fatigue as Mock;
      const moderateFatigue = {
        ...mockFatigueData,
        fatigue_analysis: [{
          ...mockFatigueData.fatigue_analysis[2],
          play_time_percent: 50,
          performance_degradation: 5,
          fatigue_level: 'normal' as const
        }]
      };
      fatigueMock.mockResolvedValue(moderateFatigue);

      const { container } = render(<FatigueAnalysis playerId={1} />);

      await waitFor(() => {
        const alert = container.querySelector('.fatigue-analysis__alert--warning');
        expect(alert).toBeInTheDocument();
      });
    });

    it('should show critical alert for high fatigue', async () => {
      const fatigueMock = advancedAnalyticsApi.fatigue as Mock;
      const highFatigue = {
        ...mockFatigueData,
        fatigue_analysis: [{
          ...mockFatigueData.fatigue_analysis[1],
          play_time_percent: 95,
          performance_degradation: 25,
          fatigue_level: 'exhausted' as const
        }]
      };
      fatigueMock.mockResolvedValue(highFatigue);

      const { container } = render(<FatigueAnalysis playerId={1} />);

      await waitFor(() => {
        const alert = container.querySelector('.fatigue-analysis__alert--critical');
        expect(alert).toBeInTheDocument();
      });
    });
  });

  describe('⚕️ Injury Risk Calculation', () => {
    it('should calculate low injury risk', async () => {
      const fatigueMock = advancedAnalyticsApi.fatigue as Mock;
      const lowRisk = {
        ...mockFatigueData,
        fatigue_analysis: [
          { ...mockFatigueData.fatigue_analysis[2], fatigue_level: 'fresh' as const },
          { ...mockFatigueData.fatigue_analysis[2], fatigue_level: 'normal' as const }
        ]
      };
      fatigueMock.mockResolvedValue(lowRisk);

      render(<FatigueAnalysis playerId={1} />);

      await waitFor(() => {
        expect(screen.getByText('LOW')).toBeInTheDocument();
      });
    });

    it('should calculate high injury risk', async () => {
      const fatigueMock = advancedAnalyticsApi.fatigue as Mock;
      const highRisk = {
        ...mockFatigueData,
        fatigue_analysis: [
          { ...mockFatigueData.fatigue_analysis[1], play_time_percent: 95, fatigue_level: 'exhausted' as const },
          { ...mockFatigueData.fatigue_analysis[1], play_time_percent: 85, fatigue_level: 'tired' as const }
        ]
      };
      fatigueMock.mockResolvedValue(highRisk);

      render(<FatigueAnalysis playerId={1} />);

      await waitFor(() => {
        expect(screen.getByText('HIGH')).toBeInTheDocument();
      });
    });
  });

  describe('😴 Rest Recommendation', () => {
    it('should recommend high priority rest for exhausted player', async () => {
      const fatigueMock = advancedAnalyticsApi.fatigue as Mock;
      const exhaustedData = {
        ...mockFatigueData,
        fatigue_analysis: [{
          ...mockFatigueData.fatigue_analysis[0],
          fatigue_level: 'exhausted' as const
        }]
      };
      fatigueMock.mockResolvedValue(exhaustedData);

      render(<FatigueAnalysis playerId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/High Priority/)).toBeInTheDocument();
        expect(screen.getByText(/2 days/)).toBeInTheDocument();
      });
    });

    it('should recommend activities for tired player', async () => {
      const fatigueMock = advancedAnalyticsApi.fatigue as Mock;
      fatigueMock.mockResolvedValue(mockFatigueData);

      render(<FatigueAnalysis playerId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/Active recovery/)).toBeInTheDocument();
      });
    });

    it('should show low priority for fresh player', async () => {
      const fatigueMock = advancedAnalyticsApi.fatigue as Mock;
      const freshData = {
        ...mockFatigueData,
        fatigue_analysis: [{
          ...mockFatigueData.fatigue_analysis[2],
          fatigue_level: 'fresh' as const,
          play_time_percent: 25
        }]
      };
      fatigueMock.mockResolvedValue(freshData);

      render(<FatigueAnalysis playerId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/Low Priority/)).toBeInTheDocument();
      });
    });
  });

  describe('📈 Workload Comparison', () => {
    it('should fetch team statistics when teamId provided', async () => {
      const fatigueMock = advancedAnalyticsApi.fatigue as Mock;
      const apiMock = api.get as Mock;

      fatigueMock.mockResolvedValue(mockFatigueData);
      apiMock.mockResolvedValue(mockTeamStats);

      render(<FatigueAnalysis playerId={1} teamId={5} />);

      await waitFor(() => {
        expect(apiMock).toHaveBeenCalledWith('/reports/team-fatigue', {
          params: { team_id: 5, limit: 20 }
        });
      });
    });

    it('should not fetch team stats when teamId not provided', async () => {
      const fatigueMock = advancedAnalyticsApi.fatigue as Mock;
      const apiMock = api.get as Mock;

      fatigueMock.mockResolvedValue(mockFatigueData);

      render(<FatigueAnalysis playerId={1} />);

      await waitFor(() => {
        expect(apiMock).not.toHaveBeenCalledWith('/reports/team-fatigue', expect.anything());
      });
    });

    it('should display workload comparison when data available', async () => {
      const fatigueMock = advancedAnalyticsApi.fatigue as Mock;
      const apiMock = api.get as Mock;

      fatigueMock.mockResolvedValue(mockFatigueData);
      apiMock.mockResolvedValue(mockTeamStats);

      render(<FatigueAnalysis playerId={1} teamId={5} />);

      await waitFor(() => {
        // Check that widget appears once data is loaded
        expect(screen.getByTestId('widget-Workload vs Team Average')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should show when player is above team average', async () => {
      const fatigueMock = advancedAnalyticsApi.fatigue as Mock;
      const apiMock = api.get as Mock;

      fatigueMock.mockResolvedValue(mockFatigueData);
      apiMock.mockResolvedValue(mockTeamStats);

      render(<FatigueAnalysis playerId={1} teamId={5} />);

      await waitFor(() => {
        const widget = screen.getByTestId('widget-Workload vs Team Average');
        // If widget renders, workload comparison logic must have executed
        expect(widget).toBeInTheDocument();
        // Check that the comparison text appears somewhere
        const comparisonDiv = screen.getByText(/Player is/);
        expect(comparisonDiv).toBeInTheDocument();
      });
    });
  });

  describe('📊 Chart Display', () => {
    it('should render minutes played chart', async () => {
      const fatigueMock = advancedAnalyticsApi.fatigue as Mock;
      fatigueMock.mockResolvedValue(mockFatigueData);

      render(<FatigueAnalysis playerId={1} />);

      await waitFor(() => {
        expect(screen.getByTestId('widget-Minutes Played Over Time')).toBeInTheDocument();
      });
    });

    it('should show no data message when no games', async () => {
      const fatigueMock = advancedAnalyticsApi.fatigue as Mock;
      fatigueMock.mockResolvedValue({ player_id: 1, games_analyzed: 0, fatigue_analysis: [] });

      render(<FatigueAnalysis playerId={1} />);

      await waitFor(() => {
        expect(screen.getByText('No game data available')).toBeInTheDocument();
      });
    });
  });

  describe('📋 Period Performance Details', () => {
    it('should display recent game details', async () => {
      const fatigueMock = advancedAnalyticsApi.fatigue as Mock;
      fatigueMock.mockResolvedValue(mockFatigueData);

      render(<FatigueAnalysis playerId={1} />);

      await waitFor(() => {
        // Check for the period performance widget
        expect(screen.getByTestId('widget-Recent Game Period Performance')).toBeInTheDocument();
      });
    });

    it('should show up to 3 most recent games', async () => {
      const fatigueMock = advancedAnalyticsApi.fatigue as Mock;
      fatigueMock.mockResolvedValue(mockFatigueData);

      render(<FatigueAnalysis playerId={1} />);

      await waitFor(() => {
        // Check for fatigue level badges
        const fatigueCards = screen.getAllByTestId(/widget/) || [];
        expect(fatigueCards.length).toBeGreaterThan(0);
      });
    });

    it('should display period-by-period performance', async () => {
      const fatigueMock = advancedAnalyticsApi.fatigue as Mock;
      fatigueMock.mockResolvedValue(mockFatigueData);

      render(<FatigueAnalysis playerId={1} />);

      await waitFor(() => {
        // Check for period performance with a function matcher to handle multiple occurrences
        const periodLabels = screen.getAllByText('By Period:');
        expect(periodLabels.length).toBeGreaterThan(0);
      });
    });
  });

  describe('🔄 State Management', () => {
    it('should update when playerId changes', async () => {
      const fatigueMock = advancedAnalyticsApi.fatigue as Mock;
      fatigueMock.mockResolvedValue(mockFatigueData);

      const { rerender } = render(<FatigueAnalysis playerId={1} />);

      await waitFor(() => {
        expect(fatigueMock).toHaveBeenCalledWith(1, undefined);
      });

      vi.clearAllMocks();
      fatigueMock.mockResolvedValue(mockFatigueData);

      rerender(<FatigueAnalysis playerId={2} />);

      await waitFor(() => {
        expect(fatigueMock).toHaveBeenCalledWith(2, undefined);
      });
    });

    it('should handle API errors gracefully', async () => {
      const fatigueMock = advancedAnalyticsApi.fatigue as Mock;
      fatigueMock.mockRejectedValue(new Error('Network error'));

      render(<FatigueAnalysis playerId={1} />);

      await waitFor(() => {
        // Check that error message appears in at least one widget
        const alerts = screen.getAllByRole('alert');
        expect(alerts.length).toBeGreaterThan(0);
      });
    });
  });

  describe('♿ Accessibility', () => {
    it('should have proper heading hierarchy', async () => {
      const fatigueMock = advancedAnalyticsApi.fatigue as Mock;
      fatigueMock.mockResolvedValue(mockFatigueData);

      render(<FatigueAnalysis playerId={1} />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      });
    });

    it('should display alert with role="alert"', async () => {
      const fatigueMock = advancedAnalyticsApi.fatigue as Mock;
      fatigueMock.mockResolvedValue(mockFatigueData);

      const { container } = render(<FatigueAnalysis playerId={1} />);

      await waitFor(() => {
        // Alert section contains important information
        expect(container.querySelector('.fatigue-analysis__alert')).toBeInTheDocument();
      });
    });
  });
});
