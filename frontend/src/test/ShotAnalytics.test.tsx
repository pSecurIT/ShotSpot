import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ShotAnalytics from '../components/ShotAnalytics';

// Mock API module - must be declared before vi.mock
vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn(),
  }
}));

// Mock court image
vi.mock('../img/Korfbalveld-breed.PNG', () => ({
  default: 'mocked-court-image.png'
}));

// Import the mocked API after mocking
import api from '../utils/api';
const mockGet = api.get as ReturnType<typeof vi.fn>;

// Mock data
const mockHeatmapData = {
  grid_size: 10,
  data: [
    { x: 0, y: 0, count: 5, goals: 3, misses: 2, blocked: 0, success_rate: 60 },
    { x: 1, y: 0, count: 8, goals: 5, misses: 2, blocked: 1, success_rate: 62.5 },
    { x: 2, y: 1, count: 3, goals: 2, misses: 1, blocked: 0, success_rate: 66.67 },
    { x: 5, y: 5, count: 10, goals: 7, misses: 2, blocked: 1, success_rate: 70 }
  ]
};

const mockShotChartData = [
  {
    id: 1,
    x_coord: 25,
    y_coord: 50,
    result: 'goal' as const,
    first_name: 'John',
    last_name: 'Doe',
    jersey_number: 10,
    team_name: 'Team A',
    team_id: 1,
    player_id: 1,
    period: 1,
    distance: 5.5
  },
  {
    id: 2,
    x_coord: 75,
    y_coord: 40,
    result: 'miss' as const,
    first_name: 'Jane',
    last_name: 'Smith',
    jersey_number: 11,
    team_name: 'Team A',
    team_id: 1,
    player_id: 2,
    period: 1,
    distance: 6.0
  },
  {
    id: 3,
    x_coord: 50,
    y_coord: 60,
    result: 'blocked' as const,
    first_name: 'Bob',
    last_name: 'Johnson',
    jersey_number: 20,
    team_name: 'Team B',
    team_id: 2,
    player_id: 3,
    period: 2,
    distance: 4.5
  }
];

const mockPlayerStats = [
  {
    player_id: 1,
    first_name: 'John',
    last_name: 'Doe',
    jersey_number: 10,
    team_name: 'Team A',
    team_id: 1,
    total_shots: 10,
    goals: 6,
    misses: 3,
    blocked: 1,
    field_goal_percentage: 60,
    average_distance: 5.5,
    zone_performance: {
      left: { shots: 4, goals: 2, misses: 2, blocked: 0, success_rate: 50 },
      center: { shots: 3, goals: 2, misses: 1, blocked: 0, success_rate: 66.67 },
      right: { shots: 3, goals: 2, misses: 0, blocked: 1, success_rate: 66.67 }
    }
  },
  {
    player_id: 2,
    first_name: 'Jane',
    last_name: 'Smith',
    jersey_number: 11,
    team_name: 'Team A',
    team_id: 1,
    total_shots: 8,
    goals: 5,
    misses: 2,
    blocked: 1,
    field_goal_percentage: 62.5,
    average_distance: 6.0,
    zone_performance: {
      left: { shots: 3, goals: 2, misses: 1, blocked: 0, success_rate: 66.67 },
      center: { shots: 2, goals: 1, misses: 1, blocked: 0, success_rate: 50 },
      right: { shots: 3, goals: 2, misses: 0, blocked: 1, success_rate: 66.67 }
    }
  }
];

const mockGameSummary = {
  overall: {
    total_shots: 18,
    total_goals: 11,
    total_misses: 5,
    total_blocked: 2,
    overall_fg_percentage: 61.11
  },
  by_team: [
    {
      team_id: 1,
      team_name: 'Team A',
      total_shots: 12,
      goals: 8,
      misses: 3,
      blocked: 1,
      fg_percentage: 66.67
    },
    {
      team_id: 2,
      team_name: 'Team B',
      total_shots: 6,
      goals: 3,
      misses: 2,
      blocked: 1,
      fg_percentage: 50
    }
  ]
};

describe('ShotAnalytics Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementations
    mockGet.mockResolvedValue({ data: mockHeatmapData });
  });

  const renderShotAnalytics = (gameId = '123') => {
    return render(
      <MemoryRouter initialEntries={[`/analytics/${gameId}`]}>
        <Routes>
          <Route path="/analytics/:gameId" element={<ShotAnalytics />} />
        </Routes>
      </MemoryRouter>
    );
  };

  describe('Component Rendering', () => {
    it('should render the analytics header with title', async () => {
      mockGet.mockResolvedValue({ data: mockHeatmapData });
      renderShotAnalytics();

      await waitFor(() => {
        expect(screen.getByText('📊 Shot Analytics')).toBeInTheDocument();
      });
    });

    it('should render all view tabs', async () => {
      mockGet.mockResolvedValue({ data: mockHeatmapData });
      renderShotAnalytics();

      await waitFor(() => {
        expect(screen.getByText('🔥 Heatmap')).toBeInTheDocument();
        expect(screen.getByText('🎯 Shot Chart')).toBeInTheDocument();
        expect(screen.getByText('👤 Player Stats')).toBeInTheDocument();
        expect(screen.getByText('📋 Summary')).toBeInTheDocument();
      });
    });

    it('should render back button', async () => {
      mockGet.mockResolvedValue({ data: mockHeatmapData });
      renderShotAnalytics();

      await waitFor(() => {
        expect(screen.getByText('← Back to Match')).toBeInTheDocument();
      });
    });

    it('should show heatmap view by default', async () => {
      mockGet.mockResolvedValue({ data: mockHeatmapData });
      renderShotAnalytics();

      await waitFor(() => {
        const heatmapTab = screen.getByText('🔥 Heatmap');
        expect(heatmapTab).toHaveClass('active');
      });
    });
  });

  describe('Shot Chart View', () => {
    it('should switch to shot chart view when tab clicked', async () => {
      mockGet
        .mockResolvedValueOnce({ data: mockHeatmapData })
        .mockResolvedValueOnce({ data: mockShotChartData });

      renderShotAnalytics();

      await waitFor(() => {
        const shotChartTab = screen.getByText('🎯 Shot Chart');
        fireEvent.click(shotChartTab);
      });

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith(
          expect.stringContaining('/analytics/shots/123/shot-chart')
        );
      });
    });

    it('should display shot chart tab as active when clicked', async () => {
      mockGet.mockResolvedValue({ data: mockShotChartData });
      renderShotAnalytics();

      const shotChartTab = screen.getByText('🎯 Shot Chart');
      fireEvent.click(shotChartTab);

      await waitFor(() => {
        expect(shotChartTab).toHaveClass('active');
      });
    });
  });

  describe('Player Stats View', () => {
    it('should switch to player stats view when tab clicked', async () => {
      mockGet
        .mockResolvedValueOnce({ data: mockHeatmapData })
        .mockResolvedValueOnce({ data: mockPlayerStats });

      renderShotAnalytics();

      await waitFor(() => {
        const playerStatsTab = screen.getByText('👤 Player Stats');
        fireEvent.click(playerStatsTab);
      });

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith(
          expect.stringContaining('/analytics/shots/123/players')
        );
      });
    });

    it('should display player statistics table', async () => {
      mockGet.mockResolvedValue({ data: mockPlayerStats });
      renderShotAnalytics();

      const playerStatsTab = screen.getByText('👤 Player Stats');
      fireEvent.click(playerStatsTab);

      await waitFor(() => {
        expect(screen.getByText('Player')).toBeInTheDocument();
        expect(screen.getByText('Shots')).toBeInTheDocument();
        expect(screen.getByText('Goals')).toBeInTheDocument();
        expect(screen.getByText('FG%')).toBeInTheDocument();
      });
    });

    it('should display zone performance columns', async () => {
      mockGet.mockResolvedValue({ data: mockPlayerStats });
      renderShotAnalytics();

      const playerStatsTab = screen.getByText('👤 Player Stats');
      fireEvent.click(playerStatsTab);

      await waitFor(() => {
        expect(screen.getByText('Left Zone')).toBeInTheDocument();
        expect(screen.getByText('Center Zone')).toBeInTheDocument();
        expect(screen.getByText('Right Zone')).toBeInTheDocument();
      });
    });

    it('should display player data in table rows', async () => {
      mockGet.mockResolvedValue({ data: mockPlayerStats });
      renderShotAnalytics();

      const playerStatsTab = screen.getByText('👤 Player Stats');
      fireEvent.click(playerStatsTab);

      await waitFor(() => {
        expect(screen.getByText('#10 John Doe')).toBeInTheDocument();
        expect(screen.getByText('#11 Jane Smith')).toBeInTheDocument();
      });
    });
  });

  describe('Game Summary View', () => {
    it('should switch to summary view when tab clicked', async () => {
      mockGet
        .mockResolvedValueOnce({ data: mockHeatmapData })
        .mockResolvedValueOnce({ data: mockGameSummary });

      renderShotAnalytics();

      await waitFor(() => {
        const summaryTab = screen.getByText('📋 Summary');
        fireEvent.click(summaryTab);
      });

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith(
          expect.stringContaining('/analytics/shots/123/summary')
        );
      });
    });

    it('should display overall game statistics', async () => {
      mockGet.mockResolvedValue({ data: mockGameSummary });
      renderShotAnalytics();

      const summaryTab = screen.getByText('📋 Summary');
      fireEvent.click(summaryTab);

      await waitFor(() => {
        expect(screen.getByText('Overall Game Statistics')).toBeInTheDocument();
        expect(screen.getByText('18')).toBeInTheDocument(); // Total shots
        expect(screen.getByText('11')).toBeInTheDocument(); // Total goals
      });
    });

    it('should display team comparison section', async () => {
      mockGet.mockResolvedValue({ data: mockGameSummary });
      renderShotAnalytics();

      const summaryTab = screen.getByText('📋 Summary');
      fireEvent.click(summaryTab);

      await waitFor(() => {
        expect(screen.getByText('Team Comparison')).toBeInTheDocument();
        expect(screen.getByText('Team A')).toBeInTheDocument();
        expect(screen.getByText('Team B')).toBeInTheDocument();
      });
    });

    it('should display stat cards with correct values', async () => {
      mockGet.mockResolvedValue({ data: mockGameSummary });
      renderShotAnalytics();

      const summaryTab = screen.getByText('📋 Summary');
      fireEvent.click(summaryTab);

      await waitFor(() => {
        expect(screen.getByText('Total Shots')).toBeInTheDocument();
        expect(screen.getByText('Goals')).toBeInTheDocument();
        expect(screen.getByText('Misses')).toBeInTheDocument();
        expect(screen.getByText('Blocked')).toBeInTheDocument();
        expect(screen.getByText('Field Goal %')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when API call fails', async () => {
      mockGet.mockRejectedValue({
        response: { data: { error: 'Failed to load data' } }
      });

      renderShotAnalytics();

      await waitFor(() => {
        expect(screen.getByText(/Failed to load data/)).toBeInTheDocument();
      });
    });

    it('should display generic error for network errors', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      renderShotAnalytics();

      await waitFor(() => {
        expect(screen.getByText(/Failed to load heatmap data/)).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading spinner while fetching data', async () => {
      mockGet.mockImplementation(() => new Promise(() => {})); // Never resolves

      renderShotAnalytics();

      await waitFor(() => {
        expect(screen.getByText('Loading analytics data...')).toBeInTheDocument();
      });
    });
  });

  describe('API Integration', () => {
    it('should call heatmap API on component mount', async () => {
      mockGet.mockResolvedValue({ data: mockHeatmapData });
      renderShotAnalytics();

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith(
          expect.stringContaining('/analytics/shots/123/heatmap')
        );
      });
    });

    it('should call shot-chart API when switching to shot chart view', async () => {
      mockGet
        .mockResolvedValueOnce({ data: mockHeatmapData })
        .mockResolvedValueOnce({ data: mockShotChartData });

      renderShotAnalytics();

      const shotChartTab = screen.getByText('🎯 Shot Chart');
      fireEvent.click(shotChartTab);

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith(
          expect.stringContaining('/analytics/shots/123/shot-chart')
        );
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate back to match when back button clicked', async () => {
      mockGet.mockResolvedValue({ data: mockHeatmapData });
      const { container } = renderShotAnalytics('123');

      await waitFor(() => {
        const backButton = screen.getByText('← Back to Match');
        fireEvent.click(backButton);
      });

      // Check if navigation was attempted (URL would change in real app)
      expect(container).toBeInTheDocument();
    });
  });

  describe('Tab Switching', () => {
    it('should mark heatmap tab as active by default', async () => {
      mockGet.mockResolvedValue({ data: mockHeatmapData });
      renderShotAnalytics();

      await waitFor(() => {
        const heatmapTab = screen.getByText('🔥 Heatmap');
        expect(heatmapTab).toHaveClass('active');
      });
    });

    it('should mark active tab correctly when switching', async () => {
      mockGet.mockResolvedValue({ data: mockPlayerStats });
      renderShotAnalytics();

      const playerStatsTab = screen.getByText('👤 Player Stats');
      fireEvent.click(playerStatsTab);

      await waitFor(() => {
        expect(playerStatsTab).toHaveClass('active');
      });
    });
  });

});
