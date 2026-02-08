import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import StandingsRow from '../components/StandingsRow';
import type { LeagueStanding } from '../types/competitions';

describe('StandingsRow', () => {
  const mockStanding: LeagueStanding = {
    id: 1,
    competition_id: 1,
    team_id: 1,
    team_name: 'Team A',
    rank: 1,
    games_played: 10,
    wins: 8,
    draws: 1,
    losses: 1,
    goals_for: 30,
    goals_against: 15,
    goal_difference: 15,
    points: 25,
    form: 'WWDWW'
  };

  it('renders standings row with all data', () => {
    const onEditPoints = vi.fn();

    const { container } = render(
      <table>
        <tbody>
          <StandingsRow
            standing={mockStanding}
            position={1}
            positionClass=""
            isAdmin={false}
            isEditing={false}
            editingValue=""
            onEditPoints={onEditPoints}
            onSavePoints={vi.fn()}
            onCancelPoints={vi.fn()}
            onEditingValueChange={vi.fn()}
          />
        </tbody>
      </table>
    );

    expect(screen.getByText('Team A')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument(); // Points (unique)
    expect(screen.getByText('8')).toBeInTheDocument(); // wins
    expect(screen.getByText('30')).toBeInTheDocument(); // goals for
    
    // Verify the first td is position "1"
    const positionCell = container.querySelector('td.position-col');
    expect(positionCell).toHaveTextContent('1');
  });

  it('displays points in display mode', () => {
    render(
      <table>
        <tbody>
          <StandingsRow
            standing={mockStanding}
            position={2}
            positionClass=""
            isAdmin={false}
            isEditing={false}
            editingValue=""
            onEditPoints={vi.fn()}
            onSavePoints={vi.fn()}
            onCancelPoints={vi.fn()}
            onEditingValueChange={vi.fn()}
          />
        </tbody>
      </table>
    );

    const pointsValue = screen.getByText('25');
    expect(pointsValue).toBeInTheDocument();
  });

  it('shows edit icon for admin users', () => {
    const onEditPoints = vi.fn();

    render(
      <table>
        <tbody>
          <StandingsRow
            standing={mockStanding}
            position={1}
            positionClass=""
            isAdmin={true}
            isEditing={false}
            editingValue=""
            onEditPoints={onEditPoints}
            onSavePoints={vi.fn()}
            onCancelPoints={vi.fn()}
            onEditingValueChange={vi.fn()}
          />
        </tbody>
      </table>
    );

    const editButton = screen.getByRole('button', { name: /Edit points/i });
    expect(editButton).toBeInTheDocument();
  });

  it('hides edit icon for non-admin users', () => {
    render(
      <table>
        <tbody>
          <StandingsRow
            standing={mockStanding}
            position={1}
            positionClass=""
            isAdmin={false}
            isEditing={false}
            editingValue=""
            onEditPoints={vi.fn()}
            onSavePoints={vi.fn()}
            onCancelPoints={vi.fn()}
            onEditingValueChange={vi.fn()}
          />
        </tbody>
      </table>
    );

    const editButton = screen.queryByRole('button', { name: /Edit points/i });
    expect(editButton).not.toBeInTheDocument();
  });

  it('calls onEditPoints when edit button is clicked', async () => {
    const onEditPoints = vi.fn();

    render(
      <table>
        <tbody>
          <StandingsRow
            standing={mockStanding}
            position={1}
            positionClass=""
            isAdmin={true}
            isEditing={false}
            editingValue=""
            onEditPoints={onEditPoints}
            onSavePoints={vi.fn()}
            onCancelPoints={vi.fn()}
            onEditingValueChange={vi.fn()}
          />
        </tbody>
      </table>
    );

    const editButton = screen.getByRole('button', { name: /Edit points/i });
    await userEvent.click(editButton);

    expect(onEditPoints).toHaveBeenCalledTimes(1);
  });

  it('shows input field when editing', () => {
    render(
      <table>
        <tbody>
          <StandingsRow
            standing={mockStanding}
            position={1}
            positionClass=""
            isAdmin={true}
            isEditing={true}
            editingValue="30"
            onEditPoints={vi.fn()}
            onSavePoints={vi.fn()}
            onCancelPoints={vi.fn()}
            onEditingValueChange={vi.fn()}
          />
        </tbody>
      </table>
    );

    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('30');
  });

  it('calls onEditingValueChange when input changes', async () => {
    const onEditingValueChange = vi.fn();

    render(
      <table>
        <tbody>
          <StandingsRow
            standing={mockStanding}
            position={1}
            positionClass=""
            isAdmin={true}
            isEditing={true}
            editingValue="25"
            onEditPoints={vi.fn()}
            onSavePoints={vi.fn()}
            onCancelPoints={vi.fn()}
            onEditingValueChange={onEditingValueChange}
          />
        </tbody>
      </table>
    );

    const input = screen.getByRole('spinbutton');
    await userEvent.clear(input);
    await userEvent.type(input, '35');

    // Should have been called at least once with the new value
    expect(onEditingValueChange).toHaveBeenCalled();
  });

  it('calls onSavePoints when save button is clicked', async () => {
    const onSavePoints = vi.fn();

    render(
      <table>
        <tbody>
          <StandingsRow
            standing={mockStanding}
            position={1}
            positionClass=""
            isAdmin={true}
            isEditing={true}
            editingValue="30"
            onEditPoints={vi.fn()}
            onSavePoints={onSavePoints}
            onCancelPoints={vi.fn()}
            onEditingValueChange={vi.fn()}
          />
        </tbody>
      </table>
    );

    const saveButton = screen.getByRole('button', { name: '✓' });
    await userEvent.click(saveButton);

    expect(onSavePoints).toHaveBeenCalledTimes(1);
  });

  it('calls onCancelPoints when cancel button is clicked', async () => {
    const onCancelPoints = vi.fn();

    render(
      <table>
        <tbody>
          <StandingsRow
            standing={mockStanding}
            position={1}
            positionClass=""
            isAdmin={true}
            isEditing={true}
            editingValue="30"
            onEditPoints={vi.fn()}
            onSavePoints={vi.fn()}
            onCancelPoints={onCancelPoints}
            onEditingValueChange={vi.fn()}
          />
        </tbody>
      </table>
    );

    const cancelButton = screen.getByRole('button', { name: '✕' });
    await userEvent.click(cancelButton);

    expect(onCancelPoints).toHaveBeenCalledTimes(1);
  });

  it('calls onSavePoints when Enter is pressed in input', async () => {
    const onSavePoints = vi.fn();

    render(
      <table>
        <tbody>
          <StandingsRow
            standing={mockStanding}
            position={1}
            positionClass=""
            isAdmin={true}
            isEditing={true}
            editingValue="30"
            onEditPoints={vi.fn()}
            onSavePoints={onSavePoints}
            onCancelPoints={vi.fn()}
            onEditingValueChange={vi.fn()}
          />
        </tbody>
      </table>
    );

    const input = screen.getByRole('spinbutton');
    await userEvent.click(input);
    await userEvent.keyboard('{Enter}');

    expect(onSavePoints).toHaveBeenCalledTimes(1);
  });

  it('calls onCancelPoints when Escape is pressed in input', async () => {
    const onCancelPoints = vi.fn();

    render(
      <table>
        <tbody>
          <StandingsRow
            standing={mockStanding}
            position={1}
            positionClass=""
            isAdmin={true}
            isEditing={true}
            editingValue="30"
            onEditPoints={vi.fn()}
            onSavePoints={vi.fn()}
            onCancelPoints={onCancelPoints}
            onEditingValueChange={vi.fn()}
          />
        </tbody>
      </table>
    );

    const input = screen.getByRole('spinbutton');
    await userEvent.click(input);
    await userEvent.keyboard('{Escape}');

    expect(onCancelPoints).toHaveBeenCalledTimes(1);
  });

  it('applies position class to row', () => {
    const { container } = render(
      <table>
        <tbody>
          <StandingsRow
            standing={mockStanding}
            position={1}
            positionClass="position-promotion"
            isAdmin={false}
            isEditing={false}
            editingValue=""
            onEditPoints={vi.fn()}
            onSavePoints={vi.fn()}
            onCancelPoints={vi.fn()}
            onEditingValueChange={vi.fn()}
          />
        </tbody>
      </table>
    );

    const row = container.querySelector('tr');
    expect(row).toHaveClass('position-promotion');
  });

  it('handles null values in standing data', () => {
    const standingWithNulls: LeagueStanding = {
      ...mockStanding,
      draws: null as unknown as number,
      goal_difference: null as unknown as number
    };

    render(
      <table>
        <tbody>
          <StandingsRow
            standing={standingWithNulls}
            position={1}
            positionClass=""
            isAdmin={false}
            isEditing={false}
            editingValue=""
            onEditPoints={vi.fn()}
            onSavePoints={vi.fn()}
            onCancelPoints={vi.fn()}
            onEditingValueChange={vi.fn()}
          />
        </tbody>
      </table>
    );

    // Should show 0 for null values
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThan(0);
  });

  it('renders with correct position number', () => {
    const { rerender, container } = render(
      <table>
        <tbody>
          <StandingsRow
            standing={mockStanding}
            position={5}
            positionClass=""
            isAdmin={false}
            isEditing={false}
            editingValue=""
            onEditPoints={vi.fn()}
            onSavePoints={vi.fn()}
            onCancelPoints={vi.fn()}
            onEditingValueChange={vi.fn()}
          />
        </tbody>
      </table>
    );

    let positionCell = container.querySelector('td.position-col');
    expect(positionCell).toHaveTextContent('5');

    // Change position
    rerender(
      <table>
        <tbody>
          <StandingsRow
            standing={mockStanding}
            position={12}
            positionClass=""
            isAdmin={false}
            isEditing={false}
            editingValue=""
            onEditPoints={vi.fn()}
            onSavePoints={vi.fn()}
            onCancelPoints={vi.fn()}
            onEditingValueChange={vi.fn()}
          />
        </tbody>
      </table>
    );

    positionCell = container.querySelector('td.position-col');
    expect(positionCell).toHaveTextContent('12');
  });

  it('displays goals_against correctly', () => {
    const standing: LeagueStanding = {
      ...mockStanding,
      goals_against: 12
    };

    const { container } = render(
      <table>
        <tbody>
          <StandingsRow
            standing={standing}
            position={1}
            positionClass=""
            isAdmin={false}
            isEditing={false}
            editingValue=""
            onEditPoints={vi.fn()}
            onSavePoints={vi.fn()}
            onCancelPoints={vi.fn()}
            onEditingValueChange={vi.fn()}
          />
        </tbody>
      </table>
    );

    // Find all cells with value 12 to uniquely identify goals_against
    const cells = container.querySelectorAll('td');
    const gaCell = Array.from(cells).find(cell => cell.textContent === '12');
    expect(gaCell).toBeInTheDocument();
  });

  it('displays goal_difference correctly', () => {
    const standing: LeagueStanding = {
      ...mockStanding,
      goal_difference: 18
    };

    const { container } = render(
      <table>
        <tbody>
          <StandingsRow
            standing={standing}
            position={1}
            positionClass=""
            isAdmin={false}
            isEditing={false}
            editingValue=""
            onEditPoints={vi.fn()}
            onSavePoints={vi.fn()}
            onCancelPoints={vi.fn()}
            onEditingValueChange={vi.fn()}
          />
        </tbody>
      </table>
    );

    // Find the cell with 18 to verify goal_difference
    const cells = container.querySelectorAll('td');
    const gdCell = Array.from(cells).find(cell => cell.textContent === '18');
    expect(gdCell).toBeInTheDocument();
  });
});
