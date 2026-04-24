import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import TeamRegistrationDialog from '../components/TeamRegistrationDialog';
import api from '../utils/api';
import { competitionsApi } from '../services/competitionsApi';

vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('../services/competitionsApi', () => ({
  competitionsApi: {
    getTeams: vi.fn(),
    addTeam: vi.fn(),
    removeTeam: vi.fn(),
    generateBracket: vi.fn(),
  },
}));

describe('TeamRegistrationDialog', () => {
  const apiGetMock = api.get as unknown as ReturnType<typeof vi.fn>;
  const getTeamsMock = competitionsApi.getTeams as unknown as ReturnType<typeof vi.fn>;

  const competition = {
    id: 3,
    name: 'Spring Cup',
    type: 'tournament',
  } as const;

  beforeEach(() => {
    vi.clearAllMocks();
    apiGetMock.mockResolvedValue({ data: [{ id: 7, name: 'A Team', club_name: 'Alpha' }] });
    getTeamsMock.mockResolvedValue([]);
  });

  it('renders with dialog semantics and focuses the close button', async () => {
    render(
      <TeamRegistrationDialog
        competition={competition as never}
        isOpen
        onClose={vi.fn()}
        onNavigateToBracket={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Manage Teams - Spring Cup' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByLabelText('Close')).toHaveFocus();
    });
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <TeamRegistrationDialog
        competition={competition as never}
        isOpen
        onClose={onClose}
        onNavigateToBracket={vi.fn()}
      />,
    );

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});