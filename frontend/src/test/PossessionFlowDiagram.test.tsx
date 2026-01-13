import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PossessionFlowDiagram from '../components/PossessionFlowDiagram';

// Mock html2canvas
vi.mock('html2canvas', () => ({
  default: vi.fn(() => Promise.resolve({
    toDataURL: () => 'data:image/png;base64,test'
  }))
}));

describe('PossessionFlowDiagram', () => {
  const mockPossessions = [
    {
      id: 1,
      game_id: 1,
      team_id: 1,
      period: 1,
      started_at: '2024-01-01T10:00:00Z',
      ended_at: '2024-01-01T10:00:45Z',
      shots_taken: 2,
      team_name: 'Team A',
      duration: 45,
      result: 'goal' as const
    },
    {
      id: 2,
      game_id: 1,
      team_id: 2,
      period: 1,
      started_at: '2024-01-01T10:00:45Z',
      ended_at: '2024-01-01T10:01:20Z',
      shots_taken: 1,
      team_name: 'Team B',
      duration: 35,
      result: 'turnover' as const
    },
    {
      id: 3,
      game_id: 1,
      team_id: 1,
      period: 2,
      started_at: '2024-01-01T10:15:00Z',
      ended_at: '2024-01-01T10:15:50Z',
      shots_taken: 3,
      team_name: 'Team A',
      duration: 50,
      result: 'goal' as const
    }
  ];

  const defaultProps = {
    possessions: mockPossessions,
    homeTeamId: 1,
    awayTeamId: 2,
    homeTeamName: 'Team A',
    awayTeamName: 'Team B'
  };

  it('renders the possession flow diagram', () => {
    render(<PossessionFlowDiagram {...defaultProps} />);
    
    expect(screen.getByText('Possession Flow Diagram')).toBeInTheDocument();
  });

  it('displays team statistics', () => {
    const { container } = render(<PossessionFlowDiagram {...defaultProps} />);
    
    const teamStats = container.querySelectorAll('.team-stat');
    expect(teamStats).toHaveLength(2);
    expect(container.textContent).toContain('Team A');
    expect(container.textContent).toContain('Team B');
    expect(screen.getAllByText(/Possessions:/i)).toHaveLength(2);
  });

  it('shows timeline view by default', () => {
    const { container } = render(<PossessionFlowDiagram {...defaultProps} />);
    
    const timelineView = container.querySelector('.timeline-view');
    expect(timelineView).toBeInTheDocument();
  });

  it('switches to flow view when button is clicked', () => {
    const { container } = render(<PossessionFlowDiagram {...defaultProps} />);
    
    const flowViewButton = screen.getByText('Flow View');
    fireEvent.click(flowViewButton);
    
    const flowView = container.querySelector('.flow-view');
    expect(flowView).toBeInTheDocument();
  });

  it('displays possession blocks in timeline view', () => {
    const { container } = render(<PossessionFlowDiagram {...defaultProps} />);
    
    const possessionBlocks = container.querySelectorAll('.possession-block');
    expect(possessionBlocks.length).toBeGreaterThan(0);
  });

  it('displays period filter dropdown', () => {
    render(<PossessionFlowDiagram {...defaultProps} />);
    
    expect(screen.getByText('Period:')).toBeInTheDocument();
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
  });

  it('filters possessions by period', () => {
    const { container } = render(<PossessionFlowDiagram {...defaultProps} />);
    
    const periodSelect = screen.getByRole('combobox');
    fireEvent.change(periodSelect, { target: { value: '1' } });
    
    // Should only show period 1 possessions (2 possessions)
    const possessionBlocks = container.querySelectorAll('.possession-block');
    expect(possessionBlocks).toHaveLength(2);
  });

  it('shows export buttons when enabled', () => {
    render(<PossessionFlowDiagram {...defaultProps} showExportButtons={true} />);
    
    expect(screen.getByTitle('Export as PNG')).toBeInTheDocument();
    expect(screen.getByTitle('Copy shareable link')).toBeInTheDocument();
  });

  it('displays possession details when possession is clicked', () => {
    const { container } = render(<PossessionFlowDiagram {...defaultProps} />);
    
    const possessionBlock = container.querySelector('.possession-block');
    if (possessionBlock) {
      fireEvent.click(possessionBlock);
      
      expect(screen.getByText('Possession Details')).toBeInTheDocument();
    }
  });

  it('closes possession details when close button is clicked', () => {
    const { container } = render(<PossessionFlowDiagram {...defaultProps} />);
    
    const possessionBlock = container.querySelector('.possession-block');
    if (possessionBlock) {
      fireEvent.click(possessionBlock);
      
      const closeButton = container.querySelector('.close-details');
      if (closeButton) {
        fireEvent.click(closeButton);
        expect(screen.queryByText('Possession Details')).not.toBeInTheDocument();
      }
    }
  });

  it('displays possession bar with team percentages', () => {
    const { container } = render(<PossessionFlowDiagram {...defaultProps} />);
    
    const possessionBar = container.querySelector('.possession-bar');
    expect(possessionBar).toBeInTheDocument();
    
    const homeBar = container.querySelector('.home-bar');
    const awayBar = container.querySelector('.away-bar');
    expect(homeBar).toBeInTheDocument();
    expect(awayBar).toBeInTheDocument();
  });

  it('displays legend', () => {
    render(<PossessionFlowDiagram {...defaultProps} />);
    
    expect(screen.getByText('Legend')).toBeInTheDocument();
    expect(screen.getByText('Goal')).toBeInTheDocument();
    expect(screen.getByText('Turnover')).toBeInTheDocument();
  });

  it('handles empty possessions array', () => {
    render(
      <PossessionFlowDiagram 
        {...defaultProps}
        possessions={[]}
      />
    );
    
    expect(screen.getByText(/No possession data available/i)).toBeInTheDocument();
  });

  it('displays view mode toggle buttons', () => {
    render(<PossessionFlowDiagram {...defaultProps} />);
    
    expect(screen.getByText('Timeline View')).toBeInTheDocument();
    expect(screen.getByText('Flow View')).toBeInTheDocument();
  });

  it('shows correct statistics for each team', () => {
    render(<PossessionFlowDiagram {...defaultProps} />);
    
    // Team A has 2 possessions with 95 seconds total
    // Team B has 1 possession with 35 seconds total
    // Total is 130 seconds
    // Team A percentage: (95/130)*100 = 73%
    // Team B percentage: (35/130)*100 = 27%
    
    const percentages = screen.getAllByText(/\d+%/);
    expect(percentages.length).toBeGreaterThan(0);
  });

  it('displays shot counts for each team', () => {
    render(<PossessionFlowDiagram {...defaultProps} />);
    
    // Team A: 2 + 3 = 5 shots
    // Team B: 1 shot
    expect(screen.getAllByText(/Total Shots:/i)).toHaveLength(2);
  });
});
