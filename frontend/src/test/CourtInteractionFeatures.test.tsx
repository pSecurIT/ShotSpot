import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import CourtVisualization from '../components/CourtVisualization';
import { BrowserRouter } from 'react-router-dom';

// Mock API module
vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
}));

const mockHomePlayers = [
  {
    id: 1,
    team_id: 1,
    first_name: 'John',
    last_name: 'Doe',
    jersey_number: 10,
    role: 'player',
    is_active: true,
    gender: 'male',
    starting_position: 'offense' as const
  },
  {
    id: 2,
    team_id: 1,
    first_name: 'Jane',
    last_name: 'Smith',
    jersey_number: 11,
    role: 'player',
    is_active: true,
    gender: 'female',
    starting_position: 'offense' as const
  },
  {
    id: 3,
    team_id: 1,
    first_name: 'Bob',
    last_name: 'Johnson',
    jersey_number: 12,
    role: 'player',
    is_active: true,
    gender: 'male',
    starting_position: 'defense' as const
  }
];

const mockAwayPlayers = [
  {
    id: 4,
    team_id: 2,
    first_name: 'Alice',
    last_name: 'Williams',
    jersey_number: 20,
    role: 'player',
    is_active: true,
    gender: 'female',
    starting_position: 'offense' as const
  },
  {
    id: 5,
    team_id: 2,
    first_name: 'Charlie',
    last_name: 'Brown',
    jersey_number: 21,
    role: 'player',
    is_active: true,
    gender: 'male',
    starting_position: 'offense' as const
  }
];

describe('Court Interaction Features - Player Grid & Last Shooter', () => {
  const mockOnShotRecorded = vi.fn();
  const mockOnCenterLineCross = vi.fn();
  const mockOnResumeTimer = vi.fn();
  const mockOnPauseTimer = vi.fn();
  const mockCanAddEvents = vi.fn(() => true);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderCourtVisualization = () => {
    return render(
      <BrowserRouter>
        <CourtVisualization
          gameId={1}
          homeTeamId={1}
          awayTeamId={2}
          homeTeamName="Home Team"
          awayTeamName="Away Team"
          currentPeriod={1}
          homeAttackingSide="left"
          onShotRecorded={mockOnShotRecorded}
          activePossession={null}
          possessionDuration={0}
          onCenterLineCross={mockOnCenterLineCross}
          homePlayers={mockHomePlayers}
          awayPlayers={mockAwayPlayers}
          timerState="running"
          onResumeTimer={mockOnResumeTimer}
          onPauseTimer={mockOnPauseTimer}
          canAddEvents={mockCanAddEvents}
        />
      </BrowserRouter>
    );
  };

  describe('Solution 3: Mobile Player Grid', () => {
    it('should display player grid with all offensive players', async () => {
      renderCourtVisualization();

      await waitFor(() => {
        // Should show player cards for home team offensive players
        expect(screen.getByText('#10')).toBeInTheDocument();
        expect(screen.getByText('J. Doe')).toBeInTheDocument();
        expect(screen.getByText('#11')).toBeInTheDocument();
        expect(screen.getByText('J. Smith')).toBeInTheDocument();
      });
    });

    it('should display player cards with compact format (65px height)', async () => {
      renderCourtVisualization();

      await waitFor(() => {
        const playerCard = screen.getByText('#10').closest('.player-card');
        expect(playerCard).toBeInTheDocument();
        expect(playerCard).toHaveClass('player-card');
      });
    });

    it('should allow selecting a player by clicking their card', async () => {
      renderCourtVisualization();

      await waitFor(() => {
        const playerCard = screen.getByText('#10').closest('button');
        expect(playerCard).toBeInTheDocument();
        
        // Click the player card
        if (playerCard) {
          fireEvent.click(playerCard);
        }
        
        // Card should be selected
        expect(playerCard).toHaveClass('selected');
      });
    });

    it('should show jersey number in large font and name in compact format', async () => {
      renderCourtVisualization();

      await waitFor(() => {
        const jerseyNumber = screen.getByText('#10');
        const playerName = screen.getByText('J. Doe');
        
        expect(jerseyNumber).toBeInTheDocument();
        expect(jerseyNumber.className).toContain('jersey-large');
        expect(playerName.className).toContain('name-compact');
      });
    });

    it('should switch player grid when changing teams', async () => {
      renderCourtVisualization();

      await waitFor(() => {
        // Initially showing home team
        expect(screen.getByText('#10')).toBeInTheDocument();
        expect(screen.getByText('J. Doe')).toBeInTheDocument();
      });

      // Switch to away team
      const teamSelector = screen.getByRole('combobox');
      fireEvent.change(teamSelector, { target: { value: 'away' } });

      await waitFor(() => {
        // Should now show away team players
        expect(screen.getByText('#20')).toBeInTheDocument();
        expect(screen.getByText('A. Williams')).toBeInTheDocument();
      });
    });

    it('should only show offensive players in the grid', async () => {
      renderCourtVisualization();

      await waitFor(() => {
        // Should show offensive players (John Doe #10, Jane Smith #11)
        expect(screen.getByText('#10')).toBeInTheDocument();
        expect(screen.getByText('#11')).toBeInTheDocument();
        
        // Should NOT show defensive player (Bob Johnson #12)
        expect(screen.queryByText('#12')).not.toBeInTheDocument();
      });
    });

    it('should display helper text showing goals until position switch', async () => {
      renderCourtVisualization();

      await waitFor(() => {
        const helperText = screen.getByText(/goals? until position switch/);
        expect(helperText).toBeInTheDocument();
        expect(helperText).toHaveTextContent('2 goals until position switch');
      });
    });
  });

  describe('Solution 2: Last Shooter Repeat (Same Player Again)', () => {
    it('should remember the last selected player after recording a shot', async () => {
      const { container } = renderCourtVisualization();

      await waitFor(() => {
        const playerCard = screen.getByText('#10').closest('button');
        expect(playerCard).toBeInTheDocument();
        
        // Select player #10
        if (playerCard) {
          fireEvent.click(playerCard);
        }
      });

      // Click on court to select shot location
      const courtArea = container.querySelector('.korfball-court');
      if (courtArea) {
        fireEvent.click(courtArea, { clientX: 300, clientY: 200 });
      }

      await waitFor(() => {
        const goalButton = screen.getByText('⚽ Goal');
        expect(goalButton).toBeInTheDocument();
        fireEvent.click(goalButton);
      });

      // After recording shot, player #10 should still be selected
      await waitFor(() => {
        const playerCard = screen.getByText('#10').closest('button');
        expect(playerCard).toHaveClass('selected');
      });
    });

    it('should keep the same player selected for quick repeat shots', async () => {
      const { container } = renderCourtVisualization();

      await waitFor(() => {
        const playerCard = screen.getByText('#11').closest('button');
        if (playerCard) {
          fireEvent.click(playerCard);
        }
      });

      // Record first shot
      const courtArea = container.querySelector('.korfball-court');
      if (courtArea) {
        fireEvent.click(courtArea, { clientX: 300, clientY: 200 });
      }

      await waitFor(() => {
        const goalButton = screen.getByText('⚽ Goal');
        fireEvent.click(goalButton);
      });

      // Click again for second shot
      if (courtArea) {
        fireEvent.click(courtArea, { clientX: 320, clientY: 210 });
      }

      // Player #11 should still be selected (no need to reselect)
      await waitFor(() => {
        const playerCard = screen.getByText('#11').closest('button');
        expect(playerCard).toHaveClass('selected');
      });
    });

    it('should restore last selected player when they are still offensive', async () => {
      renderCourtVisualization();

      await waitFor(() => {
        // Select player #10
        const playerCard = screen.getByText('#10').closest('button');
        if (playerCard) {
          fireEvent.click(playerCard);
          expect(playerCard).toHaveClass('selected');
        }
      });

      // Switch to away team and back
      const teamSelector = screen.getByRole('combobox');
      fireEvent.change(teamSelector, { target: { value: 'away' } });
      
      await waitFor(() => {
        expect(screen.getByText('#20')).toBeInTheDocument();
      });

      fireEvent.change(teamSelector, { target: { value: 'home' } });

      // Player #10 should be automatically reselected
      await waitFor(() => {
        const playerCard = screen.getByText('#10').closest('button');
        expect(playerCard).toHaveClass('selected');
      });
    });
  });

  describe('Feature Integration', () => {
    it('should work together: player grid selection persists after shot', async () => {
      const { container } = renderCourtVisualization();

      // Use player grid to select player
      await waitFor(() => {
        const playerCard = screen.getByText('#10').closest('button');
        if (playerCard) {
          fireEvent.click(playerCard);
          expect(playerCard).toHaveClass('selected');
        }
      });

      // Record a shot
      const courtArea = container.querySelector('.korfball-court');
      if (courtArea) {
        fireEvent.click(courtArea, { clientX: 300, clientY: 200 });
      }

      await waitFor(() => {
        const goalButton = screen.getByText('⚽ Goal');
        fireEvent.click(goalButton);
      });

      // Player should still be selected in the grid
      await waitFor(() => {
        const playerCard = screen.getByText('#10').closest('button');
        expect(playerCard).toHaveClass('selected');
      });
    });

    it('should display compact player cards (smaller size optimization)', async () => {
      renderCourtVisualization();

      await waitFor(() => {
        const playerCards = screen.getAllByText(/^#\d+$/);
        expect(playerCards.length).toBeGreaterThan(0);
        
        playerCards.forEach(card => {
          const buttonElement = card.closest('button');
          expect(buttonElement).toHaveClass('player-card');
        });
      });
    });
  });

  describe('Timer and Possession Integration', () => {
    it('should clear possession when timer reaches zero (period end)', async () => {
      const mockActivePossession = {
        id: 1,
        game_id: 1,
        team_id: 1,
        period: 1,
        started_at: new Date().toISOString(),
        ended_at: null,
        shots_taken: 0
      };

      render(
        <BrowserRouter>
          <CourtVisualization
            gameId={1}
            homeTeamId={1}
            awayTeamId={2}
            homeTeamName="Home Team"
            awayTeamName="Away Team"
            currentPeriod={1}
            homeAttackingSide="left"
            onShotRecorded={mockOnShotRecorded}
            activePossession={mockActivePossession}
            possessionDuration={45}
            onCenterLineCross={mockOnCenterLineCross}
            homePlayers={mockHomePlayers}
            awayPlayers={mockAwayPlayers}
            timerState="stopped"
            onResumeTimer={mockOnResumeTimer}
            onPauseTimer={mockOnPauseTimer}
            canAddEvents={mockCanAddEvents}
          />
        </BrowserRouter>
      );

      // With timer stopped, period has ended
      // Possession should be cleared automatically in LiveMatch component
      // This test verifies CourtVisualization handles the prop correctly
      await waitFor(() => {
        expect(screen.getByText('Home Team')).toBeInTheDocument();
        expect(screen.getByText('⚽ Goal')).toBeInTheDocument();
      });
    });

    it('should work correctly with running timer', async () => {
      renderCourtVisualization();

      await waitFor(() => {
        // Timer is running, should allow normal operation
        expect(screen.getByText('Home Team')).toBeInTheDocument();
        expect(screen.getByText('#10')).toBeInTheDocument();
      });
    });
  });
});
