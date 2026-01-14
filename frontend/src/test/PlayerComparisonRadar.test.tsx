import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PlayerComparisonRadar from '../components/PlayerComparisonRadar';

// Mock html2canvas
vi.mock('html2canvas', () => ({
  default: vi.fn(() => Promise.resolve({
    toDataURL: () => 'data:image/png;base64,test'
  }))
}));

describe('PlayerComparisonRadar', () => {
  const mockPlayerStats = [
    {
      player_id: 1,
      first_name: 'John',
      last_name: 'Doe',
      jersey_number: 10,
      team_name: 'Team A',
      total_shots: 20,
      goals: 12,
      field_goal_percentage: 60,
      average_distance: 6.5,
      zone_performance: {
        left: { success_rate: 55 },
        center: { success_rate: 70 },
        right: { success_rate: 50 }
      }
    },
    {
      player_id: 2,
      first_name: 'Jane',
      last_name: 'Smith',
      jersey_number: 7,
      team_name: 'Team B',
      total_shots: 15,
      goals: 10,
      field_goal_percentage: 67,
      average_distance: 5.2,
      zone_performance: {
        left: { success_rate: 60 },
        center: { success_rate: 75 },
        right: { success_rate: 65 }
      }
    },
    {
      player_id: 3,
      first_name: 'Bob',
      last_name: 'Johnson',
      jersey_number: 5,
      team_name: 'Team A',
      total_shots: 18,
      goals: 8,
      field_goal_percentage: 44,
      average_distance: 7.8,
      zone_performance: {
        left: { success_rate: 40 },
        center: { success_rate: 50 },
        right: { success_rate: 45 }
      }
    }
  ];

  it('renders the player comparison radar component', () => {
    render(
      <PlayerComparisonRadar 
        players={[]} 
        availablePlayers={mockPlayerStats}
      />
    );
    
    expect(screen.getByText('Player Selection')).toBeInTheDocument();
    expect(screen.getByText('Metrics')).toBeInTheDocument();
  });

  it('displays empty state when no players are selected', () => {
    render(
      <PlayerComparisonRadar 
        players={[]} 
        availablePlayers={mockPlayerStats}
      />
    );
    
    expect(screen.getByText('No Players Selected')).toBeInTheDocument();
    expect(screen.getByText(/Select players from the dropdown/i)).toBeInTheDocument();
  });

  it('displays player selection dropdown', () => {
    render(
      <PlayerComparisonRadar 
        players={[]} 
        availablePlayers={mockPlayerStats}
      />
    );
    
    expect(screen.getByText('Add player to compare...')).toBeInTheDocument();
  });

  it('shows selected players as chips', () => {
    const selectedPlayers = [mockPlayerStats[0]];
    
    const { container } = render(
      <PlayerComparisonRadar 
        players={selectedPlayers} 
        availablePlayers={mockPlayerStats}
      />
    );
    
    const playerChip = container.querySelector('.player-chip');
    expect(playerChip).toBeInTheDocument();
    expect(playerChip?.textContent).toContain('John');
    expect(playerChip?.textContent).toContain('Doe');
  });

  it('displays radar chart when players are selected', () => {
    const selectedPlayers = [mockPlayerStats[0], mockPlayerStats[1]];
    
    render(
      <PlayerComparisonRadar 
        players={selectedPlayers} 
        availablePlayers={mockPlayerStats}
      />
    );
    
    expect(screen.getByText('Player Comparison Radar Chart')).toBeInTheDocument();
  });

  it('displays comparison table with player stats', () => {
    const selectedPlayers = [mockPlayerStats[0]];
    
    render(
      <PlayerComparisonRadar 
        players={selectedPlayers} 
        availablePlayers={mockPlayerStats}
      />
    );
    
    expect(screen.getByText('Detailed Statistics')).toBeInTheDocument();
    expect(screen.getByText(/Total Shots/i)).toBeInTheDocument();
  });

  it('shows metric checkboxes', () => {
    const { container } = render(
      <PlayerComparisonRadar 
        players={[]} 
        availablePlayers={mockPlayerStats}
      />
    );
    
    const metricCheckboxes = container.querySelectorAll('.metric-checkbox');
    expect(metricCheckboxes.length).toBeGreaterThan(0);
    
    // Check for specific metric labels
    expect(container.textContent).toContain('Accuracy');
    expect(container.textContent).toContain('Volume');
  });

  it('displays export buttons', () => {
    render(
      <PlayerComparisonRadar 
        players={[]} 
        availablePlayers={mockPlayerStats}
      />
    );
    
    expect(screen.getByTitle('Export as PNG')).toBeInTheDocument();
    expect(screen.getByTitle('Copy shareable link')).toBeInTheDocument();
  });

  it('calls onPlayerSelect when player is selected', () => {
    const onPlayerSelect = vi.fn();
    
    render(
      <PlayerComparisonRadar 
        players={[]} 
        availablePlayers={mockPlayerStats}
        onPlayerSelect={onPlayerSelect}
      />
    );
    
    const dropdown = screen.getByRole('combobox');
    fireEvent.change(dropdown, { target: { value: '1' } });
    
    expect(onPlayerSelect).toHaveBeenCalledWith(1);
  });

  it('calls onPlayerRemove when remove button is clicked', () => {
    const onPlayerRemove = vi.fn();
    const selectedPlayers = [mockPlayerStats[0]];
    
    render(
      <PlayerComparisonRadar 
        players={selectedPlayers} 
        availablePlayers={mockPlayerStats}
        onPlayerRemove={onPlayerRemove}
      />
    );
    
    const removeButton = screen.getByTitle('Remove player');
    fireEvent.click(removeButton);
    
    expect(onPlayerRemove).toHaveBeenCalledWith(1);
  });

  it('shows max players notice when limit is reached', () => {
    const selectedPlayers = mockPlayerStats.slice(0, 3); // Use 3 players to test logic
    
    const { container } = render(
      <PlayerComparisonRadar 
        players={selectedPlayers} 
        availablePlayers={mockPlayerStats}
        maxPlayers={3}
      />
    );
    
    // When at max, the dropdown should not be shown or a notice should appear
    const maxNotice = container.querySelector('.max-players-notice');
    expect(maxNotice).toBeInTheDocument();
  });

  it('displays help section', () => {
    render(
      <PlayerComparisonRadar 
        players={[]} 
        availablePlayers={mockPlayerStats}
      />
    );
    
    expect(screen.getByText(/How to Use/i)).toBeInTheDocument();
  });

  it('handles empty available players', () => {
    render(
      <PlayerComparisonRadar 
        players={[]} 
        availablePlayers={[]}
      />
    );
    
    expect(screen.getByText('No Players Selected')).toBeInTheDocument();
  });
});
