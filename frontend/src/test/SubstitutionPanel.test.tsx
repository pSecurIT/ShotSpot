import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SubstitutionPanel from '../components/SubstitutionPanel';
import api from '../utils/api';

// Mock the api module
vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn()
  }
}));

describe('SubstitutionPanel', () => {
  const mockGameId = 1;
  const mockHomeTeamId = 10;
  const mockAwayTeamId = 20;
  const mockHomeTeamName = 'Home Warriors';
  const mockAwayTeamName = 'Away Tigers';
  const mockCurrentPeriod = 2;
  const mockTimeRemaining = '00:05:30';

  const mockActivePlayers = {
    home_team: {
      active: [
        { id: 1, team_id: 10, first_name: 'John', last_name: 'Doe', jersey_number: 10, gender: 'male', team_name: 'Home Warriors' },
        { id: 2, team_id: 10, first_name: 'Jane', last_name: 'Smith', jersey_number: 15, gender: 'female', team_name: 'Home Warriors' }
      ],
      bench: [
        { id: 3, team_id: 10, first_name: 'Bob', last_name: 'Johnson', jersey_number: 20, gender: 'male', team_name: 'Home Warriors' },
        { id: 4, team_id: 10, first_name: 'Alice', last_name: 'Williams', jersey_number: 25, gender: 'female', team_name: 'Home Warriors' }
      ]
    },
    away_team: {
      active: [
        { id: 5, team_id: 20, first_name: 'Charlie', last_name: 'Brown', jersey_number: 12, gender: 'male', team_name: 'Away Tigers' }
      ],
      bench: [
        { id: 6, team_id: 20, first_name: 'Diana', last_name: 'Prince', jersey_number: 18, gender: 'female', team_name: 'Away Tigers' }
      ]
    }
  };

  const mockSubstitutions = [
    {
      id: 1,
      game_id: 1,
      team_id: 10,
      player_in_id: 3,
      player_out_id: 1,
      period: 1,
      time_remaining: '00:05:00',
      reason: 'tactical',
      player_in_first_name: 'Bob',
      player_in_last_name: 'Johnson',
      player_in_jersey_number: 20,
      player_out_first_name: 'John',
      player_out_last_name: 'Doe',
      player_out_jersey_number: 10,
      team_name: 'Home Warriors',
      created_at: new Date().toISOString()
    }
  ];

  const mockOnSubstitutionRecorded = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock API responses
    const mockGet = api.get as unknown as ReturnType<typeof vi.fn>;
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/active-players')) {
        return Promise.resolve({ data: mockActivePlayers });
      }
      if (url.includes('/substitutions')) {
        return Promise.resolve({ data: mockSubstitutions });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });
    
    const mockPost = api.post as unknown as ReturnType<typeof vi.fn>;
    mockPost.mockResolvedValue({
      data: {
        id: 2,
        game_id: mockGameId,
        team_id: mockHomeTeamId,
        player_in_id: 3,
        player_out_id: 1,
        period: mockCurrentPeriod,
        reason: 'tactical'
      }
    });

    const mockDelete = api.delete as unknown as ReturnType<typeof vi.fn>;
    mockDelete.mockResolvedValue({ data: { message: 'Substitution deleted successfully' } });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('renders the substitution panel with correct header', async () => {
    render(
      <SubstitutionPanel
        gameId={mockGameId}
        homeTeamId={mockHomeTeamId}
        awayTeamId={mockAwayTeamId}
        homeTeamName={mockHomeTeamName}
        awayTeamName={mockAwayTeamName}
        currentPeriod={mockCurrentPeriod}
        timeRemaining={mockTimeRemaining}
      />
    );

    expect(screen.getByText(/Substitutions/i)).toBeInTheDocument();
    expect(screen.getByText(/Period\s+2/i)).toBeInTheDocument();
    expect(screen.getByText(/00:05:30/i)).toBeInTheDocument();
  });

  it('fetches and displays active players and substitutions on mount', async () => {
    render(
      <SubstitutionPanel
        gameId={mockGameId}
        homeTeamId={mockHomeTeamId}
        awayTeamId={mockAwayTeamId}
        homeTeamName={mockHomeTeamName}
        awayTeamName={mockAwayTeamName}
        currentPeriod={mockCurrentPeriod}
      />
    );

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(`/substitutions/${mockGameId}/active-players`);
      expect(api.get).toHaveBeenCalledWith(`/substitutions/${mockGameId}`);
    });
  });

  it('displays team selection buttons', async () => {
    render(
      <SubstitutionPanel
        gameId={mockGameId}
        homeTeamId={mockHomeTeamId}
        awayTeamId={mockAwayTeamId}
        homeTeamName={mockHomeTeamName}
        awayTeamName={mockAwayTeamName}
        currentPeriod={mockCurrentPeriod}
      />
    );

    await waitFor(() => {
      const homeButton = screen.getByRole('button', { name: mockHomeTeamName });
      const awayButton = screen.getByRole('button', { name: mockAwayTeamName });
      expect(homeButton).toBeInTheDocument();
      expect(awayButton).toBeInTheDocument();
    });
  });

  it('switches between teams when team buttons are clicked', async () => {
    const user = userEvent.setup();
    render(
      <SubstitutionPanel
        gameId={mockGameId}
        homeTeamId={mockHomeTeamId}
        awayTeamId={mockAwayTeamId}
        homeTeamName={mockHomeTeamName}
        awayTeamName={mockAwayTeamName}
        currentPeriod={mockCurrentPeriod}
      />
    );

    await waitFor(() => {
      const homeButton = screen.getByRole('button', { name: mockHomeTeamName });
      expect(homeButton).toBeInTheDocument();
    });

    const awayButton = screen.getByRole('button', { name: mockAwayTeamName });
    await user.click(awayButton);

    // After switching, the dropdowns should update
    await waitFor(() => {
      const playerOutSelect = screen.getByRole('combobox', { name: /player out/i });
      expect(playerOutSelect).toBeInTheDocument();
    });
  });

  it('displays player dropdowns with correct options', async () => {
    render(
      <SubstitutionPanel
        gameId={mockGameId}
        homeTeamId={mockHomeTeamId}
        awayTeamId={mockAwayTeamId}
        homeTeamName={mockHomeTeamName}
        awayTeamName={mockAwayTeamName}
        currentPeriod={mockCurrentPeriod}
      />
    );

    await waitFor(() => {
      const playerOutSelect = screen.getByRole('combobox', { name: /player out/i });
      const playerInSelect = screen.getByRole('combobox', { name: /player in/i });

      expect(playerOutSelect).toBeInTheDocument();
      expect(playerInSelect).toBeInTheDocument();
    });
  });

  it('displays reason selection buttons', async () => {
    render(
      <SubstitutionPanel
        gameId={mockGameId}
        homeTeamId={mockHomeTeamId}
        awayTeamId={mockAwayTeamId}
        homeTeamName={mockHomeTeamName}
        awayTeamName={mockAwayTeamName}
        currentPeriod={mockCurrentPeriod}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /tactical/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /fatigue/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /injury/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /disciplinary/i })).toBeInTheDocument();
    });
  });

  it('records a substitution when form is submitted', async () => {
    const user = userEvent.setup();
    render(
      <SubstitutionPanel
        gameId={mockGameId}
        homeTeamId={mockHomeTeamId}
        awayTeamId={mockAwayTeamId}
        homeTeamName={mockHomeTeamName}
        awayTeamName={mockAwayTeamName}
        currentPeriod={mockCurrentPeriod}
        timeRemaining={mockTimeRemaining}
        onSubstitutionRecorded={mockOnSubstitutionRecorded}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /player out/i })).toBeInTheDocument();
    });

    // Select player out
    const playerOutSelect = screen.getByRole('combobox', { name: /player out/i });
    await user.selectOptions(playerOutSelect, '1'); // John Doe

    // Select player in
    const playerInSelect = screen.getByRole('combobox', { name: /player in/i });
    await user.selectOptions(playerInSelect, '3'); // Bob Johnson

    // Select reason
    const fatigueButton = screen.getByRole('button', { name: /fatigue/i });
    await user.click(fatigueButton);

    // Submit
    const submitButton = screen.getByRole('button', { name: /record substitution/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(`/substitutions/${mockGameId}`, {
        team_id: mockHomeTeamId,
        player_in_id: 3,
        player_out_id: 1,
        period: mockCurrentPeriod,
        time_remaining: mockTimeRemaining,
        reason: 'fatigue'
      });
    });

    await waitFor(() => {
      expect(mockOnSubstitutionRecorded).toHaveBeenCalled();
      expect(screen.getByText(/substitution recorded successfully/i)).toBeInTheDocument();
    });
  });

  it('shows error when trying to record substitution without selecting players', async () => {
    render(
      <SubstitutionPanel
        gameId={mockGameId}
        homeTeamId={mockHomeTeamId}
        awayTeamId={mockAwayTeamId}
        homeTeamName={mockHomeTeamName}
        awayTeamName={mockAwayTeamName}
        currentPeriod={mockCurrentPeriod}
      />
    );

    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /record substitution/i });
      expect(submitButton).toBeInTheDocument();
      // Button should be disabled when no players are selected
      expect(submitButton).toBeDisabled();
    });

    expect(api.post).not.toHaveBeenCalled();
  });

  it('shows error when server returns error', async () => {
    const user = userEvent.setup();
    const errorMessage = 'Player is already on the court';
    
    const mockPost = api.post as unknown as ReturnType<typeof vi.fn>;
    mockPost.mockRejectedValueOnce({
      response: {
        data: {
          error: errorMessage
        }
      }
    });

    render(
      <SubstitutionPanel
        gameId={mockGameId}
        homeTeamId={mockHomeTeamId}
        awayTeamId={mockAwayTeamId}
        homeTeamName={mockHomeTeamName}
        awayTeamName={mockAwayTeamName}
        currentPeriod={mockCurrentPeriod}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /player out/i })).toBeInTheDocument();
    });

    // Select players
    const playerOutSelect = screen.getByRole('combobox', { name: /player out/i });
    await user.selectOptions(playerOutSelect, '1');

    const playerInSelect = screen.getByRole('combobox', { name: /player in/i });
    await user.selectOptions(playerInSelect, '3');

    // Submit
    const submitButton = screen.getByRole('button', { name: /record substitution/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('displays recent substitutions', async () => {
    render(
      <SubstitutionPanel
        gameId={mockGameId}
        homeTeamId={mockHomeTeamId}
        awayTeamId={mockAwayTeamId}
        homeTeamName={mockHomeTeamName}
        awayTeamName={mockAwayTeamName}
        currentPeriod={mockCurrentPeriod}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/recent substitutions/i)).toBeInTheDocument();
      // Use getAllByText to handle multiple instances of player names
      const bobElements = screen.getAllByText(/Bob/);
      const johnElements = screen.getAllByText(/John/);
      expect(bobElements.length).toBeGreaterThan(0);
      expect(johnElements.length).toBeGreaterThan(0);
    });
  });

  it('allows undoing the most recent substitution', async () => {
    const user = userEvent.setup();
    
    // Mock window.confirm to return true
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <SubstitutionPanel
        gameId={mockGameId}
        homeTeamId={mockHomeTeamId}
        awayTeamId={mockAwayTeamId}
        homeTeamName={mockHomeTeamName}
        awayTeamName={mockAwayTeamName}
        currentPeriod={mockCurrentPeriod}
        onSubstitutionRecorded={mockOnSubstitutionRecorded}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/undo/i)).toBeInTheDocument();
    });

    const undoButton = screen.getByRole('button', { name: /undo/i });
    await user.click(undoButton);

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to undo this substitution?');
      expect(api.delete).toHaveBeenCalledWith(`/substitutions/${mockGameId}/1`);
    });

    await waitFor(() => {
      expect(mockOnSubstitutionRecorded).toHaveBeenCalled();
      expect(screen.getByText(/substitution undone successfully/i)).toBeInTheDocument();
    });

    confirmSpy.mockRestore();
  });

  it('cancels undo when user cancels confirmation', async () => {
    const user = userEvent.setup();
    
    // Mock window.confirm to return false
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(
      <SubstitutionPanel
        gameId={mockGameId}
        homeTeamId={mockHomeTeamId}
        awayTeamId={mockAwayTeamId}
        homeTeamName={mockHomeTeamName}
        awayTeamName={mockAwayTeamName}
        currentPeriod={mockCurrentPeriod}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/undo/i)).toBeInTheDocument();
    });

    const undoButton = screen.getByRole('button', { name: /undo/i });
    await user.click(undoButton);

    expect(confirmSpy).toHaveBeenCalled();
    expect(api.delete).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('displays current status summary', async () => {
    render(
      <SubstitutionPanel
        gameId={mockGameId}
        homeTeamId={mockHomeTeamId}
        awayTeamId={mockAwayTeamId}
        homeTeamName={mockHomeTeamName}
        awayTeamName={mockAwayTeamName}
        currentPeriod={mockCurrentPeriod}
      />
    );

    await waitFor(() => {
      // Use getAllByText since team names appear in multiple places
      const homeTeamElements = screen.getAllByText(mockHomeTeamName);
      const awayTeamElements = screen.getAllByText(mockAwayTeamName);
      expect(homeTeamElements.length).toBeGreaterThan(0);
      expect(awayTeamElements.length).toBeGreaterThan(0);
      
      // Should show player counts - use getAllByText since "On Court:" appears twice
      const courtLabels = screen.getAllByText(/on court/i);
      expect(courtLabels.length).toBeGreaterThan(0);
    });
  });

  it('resets form after successful substitution', async () => {
    const user = userEvent.setup();
    render(
      <SubstitutionPanel
        gameId={mockGameId}
        homeTeamId={mockHomeTeamId}
        awayTeamId={mockAwayTeamId}
        homeTeamName={mockHomeTeamName}
        awayTeamName={mockAwayTeamName}
        currentPeriod={mockCurrentPeriod}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /player out/i })).toBeInTheDocument();
    });

    // Select players and submit
    const playerOutSelect = screen.getByRole('combobox', { name: /player out/i }) as HTMLSelectElement;
    await user.selectOptions(playerOutSelect, '1');

    const playerInSelect = screen.getByRole('combobox', { name: /player in/i }) as HTMLSelectElement;
    await user.selectOptions(playerInSelect, '3');

    const submitButton = screen.getByRole('button', { name: /record substitution/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/substitution recorded successfully/i)).toBeInTheDocument();
    });

    // Form should be reset
    await waitFor(() => {
      expect(playerOutSelect.value).toBe('');
      expect(playerInSelect.value).toBe('');
    });
  });

  it('disables submit button when players are not selected', async () => {
    render(
      <SubstitutionPanel
        gameId={mockGameId}
        homeTeamId={mockHomeTeamId}
        awayTeamId={mockAwayTeamId}
        homeTeamName={mockHomeTeamName}
        awayTeamName={mockAwayTeamName}
        currentPeriod={mockCurrentPeriod}
      />
    );

    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /record substitution/i });
      expect(submitButton).toBeDisabled();
    });
  });

  it('enables submit button when both players are selected', async () => {
    const user = userEvent.setup();
    render(
      <SubstitutionPanel
        gameId={mockGameId}
        homeTeamId={mockHomeTeamId}
        awayTeamId={mockAwayTeamId}
        homeTeamName={mockHomeTeamName}
        awayTeamName={mockAwayTeamName}
        currentPeriod={mockCurrentPeriod}
      />
    );

    // Wait for player options to load (not just the select element)
    await waitFor(() => {
      const playerOutSelect = screen.getByRole('combobox', { name: /player out/i });
      expect(playerOutSelect.querySelectorAll('option').length).toBeGreaterThan(1);
    });

    const playerOutSelect = screen.getByRole('combobox', { name: /player out/i });
    await user.selectOptions(playerOutSelect, '1');

    const playerInSelect = screen.getByRole('combobox', { name: /player in/i });
    await user.selectOptions(playerInSelect, '3');

    const submitButton = screen.getByRole('button', { name: /record substitution/i });
    expect(submitButton).not.toBeDisabled();
  });

  it('clears selections when switching teams', async () => {
    const user = userEvent.setup();
    render(
      <SubstitutionPanel
        gameId={mockGameId}
        homeTeamId={mockHomeTeamId}
        awayTeamId={mockAwayTeamId}
        homeTeamName={mockHomeTeamName}
        awayTeamName={mockAwayTeamName}
        currentPeriod={mockCurrentPeriod}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /player out/i })).toBeInTheDocument();
    });

    // Select players for home team
    const playerOutSelect = screen.getByRole('combobox', { name: /player out/i }) as HTMLSelectElement;
    await user.selectOptions(playerOutSelect, '1');

    // Switch to away team
    const awayButton = screen.getByRole('button', { name: mockAwayTeamName });
    await user.click(awayButton);

    // Selections should be cleared
    await waitFor(() => {
      expect(playerOutSelect.value).toBe('');
    });
  });
});
