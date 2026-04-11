import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Mock } from 'vitest';
import TeamManagement from '../components/TeamManagement';
import api from '../utils/api';

// Mock the api module with proper types
vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}));

const mockUseAuth = vi.fn();
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('TeamManagement', () => {
  const apiGetMock = api.get as unknown as Mock;
  const apiPostMock = api.post as unknown as Mock;
  const apiPutMock = api.put as unknown as Mock;
  const apiDeleteMock = api.delete as unknown as Mock;

  const mockTeams = [
    { id: 1, name: 'Team Alpha', club_id: 1, club_name: 'Alpha Club', age_group: 'U17', gender: 'mixed', is_active: true },
    { id: 2, name: 'Team Beta', club_id: 2, club_name: 'Beta Club', age_group: 'Seniors', gender: 'female', is_active: true }
  ];

  const mockClubs = [
    { id: 1, name: 'Alpha Club' },
    { id: 2, name: 'Beta Club' },
    { id: 3, name: 'Gamma Club' }
  ];

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 99, role: 'admin' } });

    // Mock successful API responses
    apiGetMock.mockImplementation((url: string) => {
      if (url === '/teams') return Promise.resolve({ data: mockTeams });
      if (url === '/clubs') return Promise.resolve({ data: mockClubs });
      return Promise.resolve({ data: [] });
    });
    apiPostMock.mockResolvedValue({ data: { id: 3, name: 'New Team', club_id: 1, club_name: 'Alpha Club', age_group: null, gender: null, is_active: true } });
    apiPutMock.mockResolvedValue({ data: { id: 1, club_id: 1, name: 'Team Apex', age_group: 'U19', gender: 'female', is_active: true } });
    apiDeleteMock.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const getCreateTeamForm = () => {
    const heading = screen.getByRole('heading', { name: /create team/i });
    const formContainer = heading.closest('.create-team-form');
    if (!formContainer) throw new Error('Create Team form container not found');
    if (!(formContainer instanceof HTMLElement)) throw new Error('Create Team form container is not an HTMLElement');
    return within(formContainer);
  };

  const getTeamsSection = () => {
    const heading = screen.getByRole('heading', { name: /^teams$/i });
    const section = heading.closest('.players-list-section');
    if (!section) throw new Error('Teams section container not found');
    if (!(section instanceof HTMLElement)) throw new Error('Teams section container is not an HTMLElement');
    return within(section);
  };

  it('renders the team management interface', async () => {
    render(<TeamManagement />);
    expect(screen.getByText('Team Management')).toBeInTheDocument();
    const createTeamForm = getCreateTeamForm();
    const teamsSection = getTeamsSection();
    expect(createTeamForm.getByLabelText(/team name/i)).toBeInTheDocument();
    expect(createTeamForm.getByRole('button', { name: /^add team$/i })).toBeInTheDocument();
    expect(createTeamForm.getByLabelText(/club/i)).toBeInTheDocument();
    expect(teamsSection.getByLabelText(/club/i)).toBeInTheDocument();
    expect(teamsSection.getByLabelText('Team')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^add team$/i })).toHaveLength(1);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/clubs');
      expect(api.get).toHaveBeenCalledWith('/teams');
    });
  });

  it('fetches and displays teams on mount', async () => {
    render(<TeamManagement />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/teams');
      expect(screen.getByText('Team Alpha', { selector: 'span.player-name' })).toBeInTheDocument();
      expect(screen.getByText('Team Beta', { selector: 'span.player-name' })).toBeInTheDocument();
      expect(screen.getByText('Showing 2 of 2 teams')).toBeInTheDocument();
    });
  });

  it('filters teams by club and team selectors', async () => {
    const user = userEvent.setup();
    render(<TeamManagement />);

    await screen.findByText('Team Alpha', { selector: 'span.player-name' });

    const teamsSection = getTeamsSection();
    const clubFilter = teamsSection.getByLabelText(/club/i);
    await user.selectOptions(clubFilter, '2');

    await waitFor(() => {
      expect(screen.getByText('Showing 1 of 2 teams')).toBeInTheDocument();
      expect(screen.queryByText('Team Alpha', { selector: 'span.player-name' })).not.toBeInTheDocument();
      expect(screen.getByText('Team Beta', { selector: 'span.player-name' })).toBeInTheDocument();
    });

    const teamFilter = teamsSection.getByLabelText('Team');
    await user.selectOptions(teamFilter, '2');

    expect(screen.getByText('Showing 1 of 2 teams')).toBeInTheDocument();
  });

  it('resets the team filter when the club filter changes', async () => {
    const user = userEvent.setup();
    render(<TeamManagement />);

    await screen.findByText('Team Alpha', { selector: 'span.player-name' });

    const teamsSection = getTeamsSection();
    const teamFilter = teamsSection.getByLabelText('Team') as HTMLSelectElement;
    const clubFilter = teamsSection.getByLabelText(/club/i);

    await user.selectOptions(teamFilter, '1');
    expect(teamFilter).toHaveValue('1');

    await user.selectOptions(clubFilter, '2');

    await waitFor(() => {
      expect(teamFilter).toHaveValue('');
      expect(screen.getByText('Team Beta', { selector: 'span.player-name' })).toBeInTheDocument();
      expect(screen.queryByText('Team Alpha', { selector: 'span.player-name' })).not.toBeInTheDocument();
    });
  });

  it('shows an empty-state message when filters produce no matches', async () => {
    render(<TeamManagement />);

    await screen.findByText('Team Alpha', { selector: 'span.player-name' });

    const teamsSection = getTeamsSection();
    const user = userEvent.setup();
    await user.selectOptions(teamsSection.getByLabelText(/club/i), '3');

    await waitFor(() => {
      expect(screen.getByText('No teams found.')).toBeInTheDocument();
      expect(screen.getByText('Showing 0 of 2 teams')).toBeInTheDocument();
    });
  });

  it('handles team creation successfully', async () => {
    const user = userEvent.setup();
    render(<TeamManagement />);

    const createTeamForm = getCreateTeamForm();
    const input = createTeamForm.getByLabelText(/team name/i);
    const ageGroupInput = createTeamForm.getByLabelText('Age group');
    const genderSelect = createTeamForm.getByLabelText('Gender');
    const submitButton = createTeamForm.getByRole('button', { name: /^add team$/i });

    await user.type(input, 'New Team');
    await user.type(ageGroupInput, 'U15');
    await user.selectOptions(genderSelect, 'mixed');
    await user.click(submitButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/teams', { club_id: 1, name: 'New Team', age_group: 'U15', gender: 'mixed' });
      expect(screen.getByText('New Team', { selector: 'span.player-name' })).toBeInTheDocument();
      expect(screen.getByText('Team created successfully!')).toBeInTheDocument();
    });

    // Input should be cleared after successful submission
    expect(input).toHaveValue('');
  });

  it('uses the selected club from the create form when creating a team', async () => {
    const user = userEvent.setup();
    render(<TeamManagement />);

    const createTeamForm = getCreateTeamForm();
    await waitFor(() => {
      expect(createTeamForm.getByLabelText(/club/i)).toHaveValue('1');
    });

    await user.selectOptions(createTeamForm.getByLabelText(/club/i), '2');
    await user.type(createTeamForm.getByLabelText(/team name/i), 'Beta Juniors');
    await user.click(createTeamForm.getByRole('button', { name: /^add team$/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/teams', {
        club_id: 2,
        name: 'Beta Juniors',
        age_group: null,
        gender: null,
      });
    });
  });

  it('opens a team for editing when clicked and saves updates', async () => {
    const user = userEvent.setup();
    render(<TeamManagement />);

    await user.click(await screen.findByText('Team Alpha', { selector: 'span.player-name' }));

    const editForm = screen.getByRole('heading', { name: /edit team/i }).closest('.editing-section');
    if (!editForm) throw new Error('Edit Team form container not found');
    const scopedEditForm = within(editForm as HTMLElement);

    const clubSelect = scopedEditForm.getByLabelText(/club/i);
    const nameInput = scopedEditForm.getByLabelText(/team name/i);
    const ageGroupInput = scopedEditForm.getByLabelText('Age group');
    const genderSelect = scopedEditForm.getByLabelText('Gender');

    await user.selectOptions(clubSelect, '2');
    await user.clear(nameInput);
    await user.type(nameInput, 'Team Apex');
    await user.clear(ageGroupInput);
    await user.type(ageGroupInput, 'U19');
    await user.selectOptions(genderSelect, 'female');
    await user.click(scopedEditForm.getByRole('button', { name: /update team/i }));

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/teams/1', {
        club_id: 2,
        name: 'Team Apex',
        age_group: 'U19',
        gender: 'female',
        is_active: true,
      });
      expect(screen.getByText('Team updated successfully!')).toBeInTheDocument();
      expect(screen.getByText('Team Apex', { selector: 'span.player-name' })).toBeInTheDocument();
      expect(screen.getByText('Beta Club', { selector: 'span.player-team' })).toBeInTheDocument();
    });
  });

  it('shows club selection in edit mode for admins', async () => {
    const user = userEvent.setup();
    render(<TeamManagement />);

    await user.click(await screen.findByText('Team Alpha', { selector: 'span.player-name' }));
    const editForm = screen.getByRole('heading', { name: /edit team/i }).closest('.editing-section');
    if (!editForm) throw new Error('Edit Team form container not found');
    expect(within(editForm as HTMLElement).getByLabelText(/club/i)).toBeInTheDocument();
  });

  it('hides club selection in edit mode for non-admin users', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 1, role: 'coach' } });
    const user = userEvent.setup();
    render(<TeamManagement />);

    await user.click(await screen.findByText('Team Alpha', { selector: 'span.player-name' }));
    const editForm = screen.getByRole('heading', { name: /edit team/i }).closest('.editing-section');
    if (!editForm) throw new Error('Edit Team form container not found');
    expect(within(editForm as HTMLElement).queryByLabelText(/club/i)).not.toBeInTheDocument();
  });

  it('does not include club_id in update payload for non-admin users', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 1, role: 'coach' } });
    const user = userEvent.setup();
    render(<TeamManagement />);

    await user.click(await screen.findByText('Team Alpha', { selector: 'span.player-name' }));

    const editForm = screen.getByRole('heading', { name: /edit team/i }).closest('.editing-section');
    if (!editForm) throw new Error('Edit Team form container not found');
    const scopedEditForm = within(editForm as HTMLElement);

    await user.clear(scopedEditForm.getByLabelText(/team name/i));
    await user.type(scopedEditForm.getByLabelText(/team name/i), 'Coach Updated Team');
    await user.click(scopedEditForm.getByRole('button', { name: /update team/i }));

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/teams/1', {
        name: 'Coach Updated Team',
        age_group: 'U17',
        gender: 'mixed',
        is_active: true,
      });
    });
  });

  it('cancels editing without saving changes', async () => {
    const user = userEvent.setup();
    render(<TeamManagement />);

    await user.click(await screen.findByText('Team Alpha', { selector: 'span.player-name' }));
    expect(screen.getByRole('heading', { name: /edit team/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^cancel$/i }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /edit team/i })).not.toBeInTheDocument();
      expect(api.put).not.toHaveBeenCalled();
    });
  });

  it('opens the export dialog for a selected team', async () => {
    const user = userEvent.setup();
    render(<TeamManagement />);

    expect(screen.getByRole('button', { name: /export season summary/i })).toBeDisabled();

    const teamAlphaCard = (await screen.findByText('Team Alpha', { selector: 'span.player-name' })).closest('.team-card');
    if (!teamAlphaCard) throw new Error('Team Alpha card not found');
    await user.click(within(teamAlphaCard as HTMLElement).getByRole('button', { name: /export season summary/i }));

    expect(screen.getByRole('heading', { name: /export team alpha season summary/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close dialog/i })).toBeInTheDocument();
  });

  it('removes a team after confirmation', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<TeamManagement />);

    await user.click(await screen.findByText('Team Alpha', { selector: 'span.player-name' }));
    await user.click(screen.getByRole('button', { name: /remove team/i }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith('Delete Team Alpha? This cannot be undone.');
      expect(api.delete).toHaveBeenCalledWith('/teams/1');
      expect(screen.queryByText('Team Alpha', { selector: 'span.player-name' })).not.toBeInTheDocument();
      expect(screen.getByText('Team removed successfully!')).toBeInTheDocument();
    });

    confirmSpy.mockRestore();
  });

  it('shows backend delete errors when a team cannot be removed', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    apiDeleteMock.mockRejectedValueOnce({ response: { data: { details: 'Team cannot be removed while players are assigned.' } } });

    render(<TeamManagement />);

    await user.click(await screen.findByText('Team Alpha', { selector: 'span.player-name' }));
    await user.click(screen.getByRole('button', { name: /remove team/i }));

    await waitFor(() => {
      expect(screen.getByText('Team cannot be removed while players are assigned.')).toBeInTheDocument();
    });
  });

  it('displays error message when team fetch fails', async () => {
    const errorMessage = 'Failed to fetch teams';
    apiGetMock.mockImplementation((url: string) => {
      if (url === '/clubs') return Promise.resolve({ data: mockClubs });
      if (url === '/teams') return Promise.reject({ response: { data: { error: errorMessage } } });
      return Promise.resolve({ data: [] });
    });

    render(<TeamManagement />);

    await waitFor(() => {
      expect(screen.getByText('Couldn’t load teams')).toBeInTheDocument();
    });

    expect(screen.getByRole('alert')).toHaveTextContent(errorMessage);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('displays error message when team creation fails', async () => {
    const user = userEvent.setup();
    const errorMessage = 'Team name already exists';
    apiPostMock.mockRejectedValueOnce({ response: { data: { error: errorMessage } } });

    render(<TeamManagement />);

    const createTeamForm = getCreateTeamForm();
    const input = createTeamForm.getByLabelText(/team name/i);
    const submitButton = createTeamForm.getByRole('button', { name: /^add team$/i });

    await user.type(input, 'New Team');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(errorMessage);
    });
  });

  it('retries team loading from the error state', async () => {
    const user = userEvent.setup();
    apiGetMock.mockImplementation((url: string) => {
      if (url === '/clubs') return Promise.resolve({ data: mockClubs });
      if (url === '/teams') return Promise.reject({ response: { data: { error: 'Failed to fetch teams' } } });
      return Promise.resolve({ data: [] });
    });

    render(<TeamManagement />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });

    apiGetMock.mockImplementation((url: string) => {
      if (url === '/clubs') return Promise.resolve({ data: mockClubs });
      if (url === '/teams') return Promise.resolve({ data: mockTeams });
      return Promise.resolve({ data: [] });
    });

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(screen.getByText('Team Alpha', { selector: 'span.player-name' })).toBeInTheDocument();
    });
  });

  it('disables team creation when no clubs are available', async () => {
    apiGetMock.mockImplementation((url: string) => {
      if (url === '/clubs') return Promise.resolve({ data: [] });
      if (url === '/teams') return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });

    render(<TeamManagement />);

    const createTeamForm = getCreateTeamForm();

    await waitFor(() => {
      expect(screen.getByText('Create a club first to add teams.')).toBeInTheDocument();
      expect(createTeamForm.getByRole('button', { name: /^add team$/i })).toBeDisabled();
      expect(createTeamForm.getByLabelText(/club/i)).toBeDisabled();
    });
  });

  it('requires team name input before submission', async () => {
    const user = userEvent.setup();
    render(<TeamManagement />);

    const createTeamForm = getCreateTeamForm();
    const submitButton = createTeamForm.getByRole('button', { name: /^add team$/i });
    await user.click(submitButton);

    // Post should not be called if input is empty
    expect(api.post).not.toHaveBeenCalled();
  });

  it('rejects whitespace-only team names on create', async () => {
    const user = userEvent.setup();
    render(<TeamManagement />);

    const createTeamForm = getCreateTeamForm();
    const input = createTeamForm.getByLabelText(/team name/i);
    const submitButton = createTeamForm.getByRole('button', { name: /^add team$/i });

    await user.type(input, '   ');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Team name is required')).toBeInTheDocument();
      expect(api.post).not.toHaveBeenCalled();
    });
  });

  it('rejects whitespace-only team names on update', async () => {
    const user = userEvent.setup();
    render(<TeamManagement />);

    await user.click(await screen.findByText('Team Alpha', { selector: 'span.player-name' }));

    const editForm = screen.getByRole('heading', { name: /edit team/i }).closest('.editing-section');
    if (!editForm) throw new Error('Edit Team form container not found');
    const scopedEditForm = within(editForm as HTMLElement);

    const nameInput = scopedEditForm.getByLabelText(/team name/i);
    await user.clear(nameInput);
    await user.type(nameInput, '   ');
    await user.click(scopedEditForm.getByRole('button', { name: /update team/i }));

    await waitFor(() => {
      expect(screen.getByText('Team name is required')).toBeInTheDocument();
      expect(api.put).not.toHaveBeenCalled();
    });
  });

  it('normalizes legacy invalid optional values on update so transfer still works', async () => {
    const user = userEvent.setup();
    apiGetMock.mockImplementation((url: string) => {
      if (url === '/teams') {
        return Promise.resolve({
          data: [
            { id: 1, name: 'Legacy Team', club_id: 1, club_name: 'Alpha Club', age_group: 'VeryLongLegacyAgeGroupNameExceedingLimit', gender: 'boys', is_active: true },
          ],
        });
      }
      if (url === '/clubs') return Promise.resolve({ data: mockClubs });
      return Promise.resolve({ data: [] });
    });

    render(<TeamManagement />);

    await user.click(await screen.findByText('Legacy Team', { selector: 'span.player-name' }));

    const editForm = screen.getByRole('heading', { name: /edit team/i }).closest('.editing-section');
    if (!editForm) throw new Error('Edit Team form container not found');
    const scopedEditForm = within(editForm as HTMLElement);

    await user.selectOptions(scopedEditForm.getByLabelText(/club/i), '2');
    await user.click(scopedEditForm.getByRole('button', { name: /update team/i }));

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/teams/1', {
        club_id: 2,
        name: 'Legacy Team',
        age_group: null,
        gender: null,
        is_active: true,
      });
    });
  });
});