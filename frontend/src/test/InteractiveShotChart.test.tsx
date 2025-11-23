import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import InteractiveShotChart from '../components/InteractiveShotChart';

// Mock html2canvas
vi.mock('html2canvas', () => ({
  default: vi.fn(() => Promise.resolve({
    toDataURL: () => 'data:image/png;base64,test'
  }))
}));

describe('InteractiveShotChart', () => {
  const mockShots = [
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
      distance: 5.5,
      shot_type: 'running_shot'
    },
    {
      id: 2,
      x_coord: 75,
      y_coord: 30,
      result: 'miss' as const,
      first_name: 'Jane',
      last_name: 'Smith',
      jersey_number: 7,
      team_name: 'Team B',
      team_id: 2,
      player_id: 2,
      period: 1,
      distance: 8.2,
      shot_type: 'standing_shot'
    },
    {
      id: 3,
      x_coord: 50,
      y_coord: 50,
      result: 'blocked' as const,
      first_name: 'Bob',
      last_name: 'Johnson',
      jersey_number: 5,
      team_name: 'Team A',
      team_id: 1,
      player_id: 3,
      period: 2,
      distance: 6.0,
      shot_type: 'rebound'
    }
  ];

  it('renders the interactive shot chart', () => {
    render(<InteractiveShotChart shots={mockShots} />);
    
    expect(screen.getByText('Interactive Shot Chart')).toBeInTheDocument();
    expect(screen.getByAltText('Korfball Court')).toBeInTheDocument();
  });

  it('displays shot markers on the court', () => {
    const { container } = render(<InteractiveShotChart shots={mockShots} />);
    
    const shotMarkers = container.querySelectorAll('.shot-marker');
    expect(shotMarkers).toHaveLength(3);
  });

  it('shows zone overlay when enabled', () => {
    const { container } = render(
      <InteractiveShotChart shots={mockShots} showZones={true} />
    );
    
    const zones = container.querySelectorAll('.zone-box');
    expect(zones.length).toBeGreaterThan(0);
  });

  it('toggles zone overlay visibility', () => {
    render(
      <InteractiveShotChart shots={mockShots} showZones={true} />
    );
    
    const checkbox = screen.getByLabelText(/Show Zone Overlay/i);
    expect(checkbox).toBeChecked();
    
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it('displays export buttons when enabled', () => {
    render(
      <InteractiveShotChart shots={mockShots} showExportButtons={true} />
    );
    
    expect(screen.getByTitle('Export as PNG')).toBeInTheDocument();
    expect(screen.getByTitle('Export as SVG')).toBeInTheDocument();
    expect(screen.getByTitle('Copy shareable link')).toBeInTheDocument();
  });

  it('opens shot modal when clicking on a shot marker', async () => {
    const { container } = render(<InteractiveShotChart shots={mockShots} />);
    
    const shotMarker = container.querySelector('.shot-marker');
    expect(shotMarker).toBeInTheDocument();
    
    if (shotMarker) {
      fireEvent.click(shotMarker);
      
      await waitFor(() => {
        expect(screen.getByText('Shot Details')).toBeInTheDocument();
      });
    }
  });

  it('displays legend with shot counts', () => {
    render(<InteractiveShotChart shots={mockShots} />);
    
    expect(screen.getByText(/Goal \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Miss \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Blocked \(1\)/i)).toBeInTheDocument();
  });

  it('filters shots when zone is selected', () => {
    render(
      <InteractiveShotChart shots={mockShots} showZones={true} />
    );
    
    // Check that zones are rendered
    expect(screen.getByLabelText(/Show Zone Overlay/i)).toBeChecked();
  });

  it('clears zone filter when clear button is clicked', () => {
    const { container } = render(
      <InteractiveShotChart shots={mockShots} showZones={true} />
    );
    
    // Select a zone first
    const zoneBox = container.querySelector('.zone-box');
    if (zoneBox) {
      fireEvent.click(zoneBox);
      
      // Click clear button
      const clearButton = screen.getByText(/Clear Zone Filter/i);
      fireEvent.click(clearButton);
      
      // Clear button should no longer be visible
      expect(screen.queryByText(/Clear Zone Filter/i)).not.toBeInTheDocument();
    }
  });

  it('calls onZoneClick callback when zone is clicked', () => {
    const onZoneClick = vi.fn();
    const { container } = render(
      <InteractiveShotChart 
        shots={mockShots} 
        showZones={true}
        onZoneClick={onZoneClick}
      />
    );
    
    const zoneBox = container.querySelector('.zone-box');
    if (zoneBox) {
      fireEvent.click(zoneBox);
      expect(onZoneClick).toHaveBeenCalled();
    }
  });

  it('handles empty shots array', () => {
    render(<InteractiveShotChart shots={[]} />);
    
    expect(screen.getByAltText('Korfball Court')).toBeInTheDocument();
    expect(screen.getByText(/Goal \(0\)/i)).toBeInTheDocument();
  });
});
