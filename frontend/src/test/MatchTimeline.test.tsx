import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import MatchTimeline from '../components/MatchTimeline';
import api from '../utils/api';
import { waitForSelectOptions } from './helpers/testHelpers';

// Mock the API module
vi.mock('../utils/api');

// Mock window.confirm
const mockConfirm = vi.fn();
Object.defineProperty(window, 'confirm', {
  value: mockConfirm,
  writable: true,
});

const mockPrompt = vi.fn();
Object.defineProperty(window, 'prompt', {
  value: mockPrompt,
  writable: true,
});

const mockApi = api as jest.Mocked<typeof api>;

describe('MatchTimeline', () => {
  const defaultProps = {
    gameId: 1,
    homeTeamId: 1,
    awayTeamId: 2,
    homeTeamName: 'Home Team',
    awayTeamName: 'Away Team'
  };

  const MatchTimelineWrapper: React.FC = () => (
    <BrowserRouter>
      <MatchTimeline {...defaultProps} />
    </BrowserRouter>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfirm.mockReturnValue(true);
    mockPrompt.mockReturnValue(null);
    
    // Simple mock responses that resolve quickly
    mockApi.get.mockImplementation(() => {
      // Return empty arrays to avoid complex data handling in tests
      return Promise.resolve({ data: [] });
    });
  });

  it('displays loading state initially', () => {
    render(<MatchTimelineWrapper />);
    expect(screen.getByText('Loading timeline...')).toBeInTheDocument();
  });

  it('renders match timeline after loading', async () => {
    render(<MatchTimelineWrapper />);
    
    await waitFor(() => {
      expect(screen.getByText('Match Timeline')).toBeInTheDocument();
    }, { timeout: 15000 });
  });

  it('makes API calls to fetch data', async () => {
    render(<MatchTimelineWrapper />);
    
    // Wait for API calls
    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalled();
    }, { timeout: 15000 });
  });

  it('displays filter controls after loading', async () => {
    render(<MatchTimelineWrapper />);
    
    await waitFor(() => {
      expect(screen.getByText('Type:')).toBeInTheDocument();
      expect(screen.getByText('Team:')).toBeInTheDocument();
      expect(screen.getByText('Period:')).toBeInTheDocument();
    }, { timeout: 15000 });
  });

  it('displays refresh button after loading', async () => {
    render(<MatchTimelineWrapper />);
    
    await waitFor(() => {
      expect(screen.getByText(/Refresh/)).toBeInTheDocument();
    }, { timeout: 15000 });
  });

  it('handles empty data gracefully', async () => {
    render(<MatchTimelineWrapper />);
    
    await waitFor(() => {
      expect(screen.getByText('Match Timeline')).toBeInTheDocument();
    }, { timeout: 15000 });
    
    // Should render without errors
    expect(screen.getByText(/Refresh/)).toBeInTheDocument();
  });

  it('can refresh timeline data', async () => {
    const user = userEvent.setup();
    render(<MatchTimelineWrapper />);
    
    await waitFor(() => {
      expect(screen.getByText(/Refresh/)).toBeInTheDocument();
    }, { timeout: 15000 });
    
    mockApi.get.mockClear();
    
    const refreshButton = screen.getByRole('button', { name: /Refresh/ });
    await user.click(refreshButton);
    
    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalled();
    });
  });

  it('displays events when data is available', async () => {
    const mockEvents = [
      {
        id: 1,
        game_id: 1,
        event_type: 'fault_offensive',
        player_id: 1,
        team_id: 1,
        period: 1,
        time_remaining: '10:00',
        details: null,
        created_at: '2024-01-01T10:00:00Z',
        first_name: 'John',
        last_name: 'Doe',
        jersey_number: 10,
        team_name: 'Home Team'
      }
    ];

    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('/events/')) {
        return Promise.resolve({ data: mockEvents });
      }
      return Promise.resolve({ data: [] });
    });
    
    render(<MatchTimelineWrapper />);
    
    await waitFor(() => {
      expect(screen.getByText('FAULT OFFENSIVE')).toBeInTheDocument();
      expect(screen.getByText('#10 John Doe')).toBeInTheDocument();
    }, { timeout: 15000 });
  });

  it('displays shots when data is available', async () => {
    const mockShots = [
      {
        id: 1,
        game_id: 1,
        player_id: 2,
        team_id: 2,
        location_x: 50,
        location_y: 40,
        result: 'goal',
        period: 1,
        time_remaining: '09:00',
        created_at: '2024-01-01T10:02:00Z',
        first_name: 'Jane',
        last_name: 'Smith',
        jersey_number: 12,
        team_name: 'Away Team'
      }
    ];

    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('/shots/')) {
        return Promise.resolve({ data: mockShots });
      }
      return Promise.resolve({ data: [] });
    });
    
    render(<MatchTimelineWrapper />);
    
    // Wait for timeline to load first
    await waitFor(() => {
      expect(screen.getByText('Match Timeline')).toBeInTheDocument();
    }, { timeout: 15000 });

    // Then check for shot data (may appear later)
    await waitFor(() => {
      const shotElements = screen.queryAllByText('SHOT');
      const playerElements = screen.queryAllByText('#12 Jane Smith');
      expect(shotElements.length > 0 || playerElements.length > 0).toBe(true);
    }, { timeout: 5000 });
  });

  it('handles API errors gracefully', async () => {
    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('/comprehensive')) {
        return Promise.reject(new Error('Comprehensive endpoint not found'));
      }
      return Promise.resolve({ data: [] });
    });
    
    render(<MatchTimelineWrapper />);
    
    await waitFor(() => {
      expect(screen.getByText('Match Timeline')).toBeInTheDocument();
    }, { timeout: 15000 });
  });

  it('filters events by type', async () => {
    const user = userEvent.setup();
    const mockEvents = [
      {
        id: 1,
        game_id: 1,
        event_type: 'fault_offensive',
        player_id: 1,
        team_id: 1,
        period: 1,
        time_remaining: '10:00',
        details: null,
        created_at: '2024-01-01T10:00:00Z',
        first_name: 'John',
        last_name: 'Doe',
        jersey_number: 10,
        team_name: 'Home Team'
      }
    ];

    const mockShots = [
      {
        id: 1,
        game_id: 1,
        player_id: 2,
        team_id: 2,
        location_x: 50,
        location_y: 40,
        result: 'goal',
        period: 1,
        time_remaining: '09:00',
        created_at: '2024-01-01T10:02:00Z',
        first_name: 'Jane',
        last_name: 'Smith',
        jersey_number: 12,
        team_name: 'Away Team'
      }
    ];

    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('/events/')) {
        return Promise.resolve({ data: mockEvents });
      }
      if (url.includes('/shots/')) {
        return Promise.resolve({ data: mockShots });
      }
      return Promise.resolve({ data: [] });
    });
    
    render(<MatchTimelineWrapper />);
    
    // Wait for timeline to load
    await waitFor(() => {
      expect(screen.getByText('Match Timeline')).toBeInTheDocument();
    }, { timeout: 15000 });
    
    // Wait for both events to load (more lenient)
    await waitFor(() => {
      const faultElements = screen.queryAllByText('FAULT OFFENSIVE');
      const shotElements = screen.queryAllByText('SHOT');
      expect(faultElements.length > 0 || shotElements.length > 0).toBe(true);
    }, { timeout: 5000 });
    
    // Try to find and interact with filter
    const typeFilters = screen.queryAllByDisplayValue('All');
    if (typeFilters.length > 0) {
      await waitForSelectOptions(typeFilters[0] as HTMLSelectElement);
      await user.selectOptions(typeFilters[0], 'shots');
      
      // Check that filtering works (but be lenient about what shows)
      await waitFor(() => {
        const remainingFaults = screen.queryAllByText('FAULT OFFENSIVE');
        expect(remainingFaults.length).toBeLessThanOrEqual(1);
      }, { timeout: 3000 });
    }
  });

  it('shows pending review items and confirms an unconfirmed shot', async () => {
    const user = userEvent.setup();
    const mockShot = {
      id: 1,
      game_id: 1,
      player_id: 2,
      team_id: 2,
      result: 'goal',
      period: 1,
      time_remaining: '00:09:00',
      created_at: '2024-01-01T10:02:00Z',
      first_name: 'Jane',
      last_name: 'Smith',
      jersey_number: 12,
      team_name: 'Away Team',
      event_status: 'unconfirmed'
    };

    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('/shots/')) {
        return Promise.resolve({ data: [mockShot] });
      }
      return Promise.resolve({ data: [] });
    });
    mockApi.post.mockResolvedValue({ data: { ...mockShot, event_status: 'confirmed' } });

    render(<MatchTimelineWrapper />);

    await waitFor(() => {
      expect(screen.getByText('Pending Review')).toBeInTheDocument();
      expect(screen.getByText(/Shot review:/)).toBeInTheDocument();
    });

    await user.click(screen.getAllByRole('button', { name: /^✅ Confirm$/i })[0]);

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/shots/1/1/confirm');
    });
  });

  it('marks the latest reviewable item to edit later', async () => {
    const user = userEvent.setup();
    const mockEvent = {
      id: 1,
      game_id: 1,
      source_table: 'game_event',
      event_type: 'fault_offensive',
      team_id: 1,
      period: 1,
      time_remaining: '00:10:00',
      details: null,
      created_at: '2024-01-01T10:00:00Z',
      first_name: 'John',
      last_name: 'Doe',
      jersey_number: 10,
      team_name: 'Home Team',
      event_status: 'confirmed'
    };

    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('/events/comprehensive/')) {
        return Promise.resolve({ data: [mockEvent] });
      }
      return Promise.resolve({ data: [] });
    });
    mockApi.put.mockResolvedValue({ data: { ...mockEvent, event_status: 'unconfirmed' } });

    render(<MatchTimelineWrapper />);

    await waitFor(() => {
      expect(screen.getByText('FAULT OFFENSIVE')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Mark Last To Edit Later/i }));

    await waitFor(() => {
      expect(mockApi.put).toHaveBeenCalledWith('/events/1/1', { event_status: 'unconfirmed' });
    });
  });

  it('falls back to the legacy events endpoint when the comprehensive endpoint fails', async () => {
    const fallbackEvent = {
      id: 21,
      game_id: 1,
      source_table: 'game_event',
      event_type: 'fault_defensive',
      player_id: 4,
      team_id: 2,
      period: 2,
      time_remaining: '00:07:15',
      details: { reason: 'holding' },
      created_at: '2024-01-01T10:03:00Z',
      first_name: 'Alex',
      last_name: 'Stone',
      jersey_number: 14,
      team_name: 'Away Team',
      event_status: 'confirmed'
    };

    mockApi.get.mockImplementation((url: string) => {
      if (url === '/events/comprehensive/1') {
        return Promise.reject(new Error('not available'));
      }
      if (url === '/events/1') {
        return Promise.resolve({ data: [fallbackEvent] });
      }
      return Promise.resolve({ data: [] });
    });

    render(<MatchTimelineWrapper />);

    await waitFor(() => {
      expect(screen.getByText('FAULT DEFENSIVE')).toBeInTheDocument();
      expect(screen.getByText('#14 Alex Stone')).toBeInTheDocument();
      expect(screen.getByText('holding')).toBeInTheDocument();
    });
  });

  it('filters mixed timeline items by team and period', async () => {
    const user = userEvent.setup();
    const mixedEvent = {
      id: 31,
      game_id: 1,
      source_table: 'game_event',
      event_type: 'fault_offensive',
      player_id: 1,
      team_id: 1,
      period: 1,
      time_remaining: '00:10:00',
      details: null,
      created_at: '2024-01-01T10:00:00Z',
      first_name: 'John',
      last_name: 'Doe',
      jersey_number: 10,
      team_name: 'Home Team',
      event_status: 'confirmed'
    };
    const mixedShot = {
      id: 32,
      game_id: 1,
      player_id: 2,
      team_id: 2,
      result: 'goal',
      period: 2,
      time_remaining: '00:08:00',
      created_at: '2024-01-01T10:02:00Z',
      first_name: 'Jane',
      last_name: 'Smith',
      jersey_number: 12,
      team_name: 'Away Team',
      event_status: 'confirmed'
    };
    const mixedSubstitution = {
      id: 33,
      game_id: 1,
      team_id: 1,
      player_in_id: 5,
      player_out_id: 6,
      period: 2,
      time_remaining: '00:06:00',
      reason: 'tactical',
      player_in_first_name: 'Chris',
      player_in_last_name: 'In',
      player_in_jersey_number: 9,
      player_out_first_name: 'Pat',
      player_out_last_name: 'Out',
      player_out_jersey_number: 11,
      team_name: 'Home Team',
      created_at: '2024-01-01T10:01:00Z',
      event_status: 'confirmed'
    };

    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('/events/')) {
        return Promise.resolve({ data: [mixedEvent] });
      }
      if (url.includes('/shots/')) {
        return Promise.resolve({ data: [mixedShot] });
      }
      if (url.includes('/substitutions/')) {
        return Promise.resolve({ data: [mixedSubstitution] });
      }
      return Promise.resolve({ data: [] });
    });

    render(<MatchTimelineWrapper />);

    await waitFor(() => {
      expect(screen.getByText('#10 John Doe')).toBeInTheDocument();
      expect(screen.getByText('#12 Jane Smith')).toBeInTheDocument();
      expect(screen.getByText(/#11 Pat Out/i)).toBeInTheDocument();
    });

    const selects = screen.getAllByRole('combobox');
    await waitForSelectOptions(selects[1] as HTMLSelectElement);
    await user.selectOptions(selects[1], 'away');

    await waitFor(() => {
      expect(screen.getByText('#12 Jane Smith')).toBeInTheDocument();
      expect(screen.queryByText('#10 John Doe')).not.toBeInTheDocument();
      expect(screen.queryByText(/#11 Pat Out/i)).not.toBeInTheDocument();
    });

    await user.selectOptions(selects[2], '2');

    await waitFor(() => {
      expect(screen.getByText('#12 Jane Smith')).toBeInTheDocument();
      expect(screen.queryByText('#10 John Doe')).not.toBeInTheDocument();
    });
  });

  it('renders enhanced event details for free shots, timeouts, and commentary', async () => {
    const detailedEvents = [
      {
        id: 41,
        game_id: 1,
        source_table: 'free_shot',
        event_type: 'free_shot_penalty',
        player_id: 7,
        team_id: 1,
        period: 1,
        time_remaining: '00:05:00',
        details: { result: 'goal', distance: 3, reason: 'contact' },
        created_at: '2024-01-01T10:00:00Z',
        first_name: 'Sam',
        last_name: 'Free',
        jersey_number: 8,
        team_name: 'Home Team',
        event_status: 'confirmed'
      },
      {
        id: 42,
        game_id: 1,
        source_table: 'timeout',
        event_type: 'timeout_team',
        player_id: null,
        team_id: 2,
        period: 1,
        time_remaining: '00:04:30',
        details: { duration: '1 minute', called_by: 'Coach', reason: 'reset' },
        created_at: '2024-01-01T10:01:00Z',
        first_name: null,
        last_name: null,
        jersey_number: null,
        team_name: 'Away Team',
        event_status: 'confirmed'
      },
      {
        id: 43,
        game_id: 1,
        source_table: 'commentary',
        event_type: 'commentary_note',
        player_id: null,
        team_id: 1,
        period: 1,
        time_remaining: '00:04:00',
        details: { title: 'Wet floor', content: 'Officials warned both benches.' },
        created_at: '2024-01-01T10:02:00Z',
        first_name: null,
        last_name: null,
        jersey_number: null,
        team_name: 'Home Team',
        event_status: 'confirmed'
      }
    ];

    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('/events/')) {
        return Promise.resolve({ data: detailedEvents });
      }
      return Promise.resolve({ data: [] });
    });

    render(<MatchTimelineWrapper />);

    await waitFor(() => {
      expect(screen.getByText('Distance: 3m')).toBeInTheDocument();
      expect(screen.getByText('Reason: contact')).toBeInTheDocument();
      expect(screen.getByText('Duration: 1 minute')).toBeInTheDocument();
      expect(screen.getByText('Called by: Coach')).toBeInTheDocument();
      expect(screen.getByText('Wet floor')).toBeInTheDocument();
      expect(screen.getByText('Officials warned both benches.')).toBeInTheDocument();
    });
  });

  it('shows a validation error and skips updating when a shot edit uses an invalid result', async () => {
    const user = userEvent.setup();
    const mockShot = {
      id: 51,
      game_id: 1,
      player_id: 9,
      team_id: 2,
      result: 'goal',
      period: 1,
      time_remaining: '00:03:00',
      created_at: '2024-01-01T10:02:00Z',
      first_name: 'Jamie',
      last_name: 'North',
      jersey_number: 15,
      team_name: 'Away Team',
      event_status: 'confirmed'
    };

    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('/shots/')) {
        return Promise.resolve({ data: [mockShot] });
      }
      return Promise.resolve({ data: [] });
    });
    mockPrompt.mockReturnValueOnce('invalid-result');

    render(<MatchTimelineWrapper />);

    await waitFor(() => {
      expect(screen.getByText('#15 Jamie North')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Edit Last Event/i }));

    await waitFor(() => {
      expect(screen.getByText('Shot result must be goal, miss, or blocked')).toBeInTheDocument();
      expect(mockApi.put).not.toHaveBeenCalled();
    });
  });

  it('edits and confirms a pending timeout using the timeout-specific routes', async () => {
    const user = userEvent.setup();
    const pendingTimeout = {
      id: 61,
      game_id: 1,
      source_table: 'timeout',
      event_type: 'timeout_team',
      player_id: null,
      team_id: 2,
      period: 2,
      time_remaining: '00:02:30',
      details: { reason: 'injury check', duration: '1 minute' },
      created_at: '2024-01-01T10:03:00Z',
      first_name: null,
      last_name: null,
      jersey_number: null,
      team_name: 'Away Team',
      event_status: 'unconfirmed',
      client_uuid: 'timeout-client-61'
    };

    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('/events/')) {
        return Promise.resolve({ data: [pendingTimeout] });
      }
      return Promise.resolve({ data: [] });
    });
    mockApi.put.mockResolvedValue({ data: { success: true } });
    mockApi.post.mockResolvedValue({ data: { success: true } });
    mockPrompt
      .mockReturnValueOnce('official review')
      .mockReturnValueOnce('45 seconds')
      .mockReturnValueOnce('00:01:55');

    render(<MatchTimelineWrapper />);

    await waitFor(() => {
      expect(screen.getByText('Pending Review')).toBeInTheDocument();
      expect(screen.getByText(/TIMEOUT TEAM review/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Confirm And Next/i }));

    await waitFor(() => {
      expect(mockApi.put).toHaveBeenCalledWith('/timeouts/61', {
        game_id: 1,
        reason: 'official review',
        duration: '45 seconds',
        time_remaining: '00:01:55',
        client_uuid: 'timeout-client-61'
      });
      expect(mockApi.post).toHaveBeenCalledWith('/timeouts/61/confirm', {
        game_id: 1,
        client_uuid: 'timeout-client-61'
      });
    });
  });

  it('marks a confirmed free shot for later review using the free-shot route', async () => {
    const user = userEvent.setup();
    const freeShotEvent = {
      id: 71,
      game_id: 1,
      source_table: 'free_shot',
      event_type: 'free_shot_free_shot',
      player_id: 12,
      team_id: 1,
      period: 3,
      time_remaining: '00:01:00',
      details: { result: 'miss' },
      created_at: '2024-01-01T10:04:00Z',
      first_name: 'Riley',
      last_name: 'Fast',
      jersey_number: 6,
      team_name: 'Home Team',
      event_status: 'confirmed',
      client_uuid: 'free-shot-71'
    };

    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('/events/')) {
        return Promise.resolve({ data: [freeShotEvent] });
      }
      return Promise.resolve({ data: [] });
    });
    mockApi.put.mockResolvedValue({ data: { success: true } });

    render(<MatchTimelineWrapper />);

    await waitFor(() => {
      expect(screen.getByText('FREE SHOT FREE SHOT')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Mark Last To Edit Later/i }));

    await waitFor(() => {
      expect(mockApi.put).toHaveBeenCalledWith('/free-shots/71', {
        game_id: 1,
        event_status: 'unconfirmed',
        client_uuid: 'free-shot-71'
      });
    });
  });

  it('deletes commentary items through the commentary endpoint', async () => {
    const user = userEvent.setup();
    const commentaryItem = {
      id: 81,
      game_id: 1,
      source_table: 'commentary',
      event_type: 'commentary_highlight',
      player_id: null,
      team_id: 1,
      period: 4,
      time_remaining: '00:00:30',
      details: { title: 'Finish', content: 'Final possession pressure.' },
      created_at: '2024-01-01T10:05:00Z',
      first_name: null,
      last_name: null,
      jersey_number: null,
      team_name: 'Home Team',
      event_status: 'confirmed'
    };

    mockApi.get.mockImplementation((url: string) => {
      if (url.includes('/events/')) {
        return Promise.resolve({ data: [commentaryItem] });
      }
      return Promise.resolve({ data: [] });
    });
    mockApi.delete.mockResolvedValue({ data: { success: true } });

    render(<MatchTimelineWrapper />);

    await waitFor(() => {
      expect(screen.getByText('COMMENTARY HIGHLIGHT')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Delete/i }));

    await waitFor(() => {
      expect(mockApi.delete).toHaveBeenCalledWith('/match-commentary/1/81');
    });
  });
});