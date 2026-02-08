import type { ComponentProps } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Mock } from 'vitest';
import { vi } from 'vitest';
import CompetitionDialog from '../components/CompetitionDialog';
import { competitionsApi } from '../services/competitionsApi';
import { seasonsApi } from '../services/seasonsApi';
import { seriesApi } from '../services/seriesApi';
import type { Competition } from '../types/competitions';

vi.mock('../services/competitionsApi', () => ({
  competitionsApi: {
    create: vi.fn(),
    update: vi.fn()
  }
}));

vi.mock('../services/seasonsApi', () => ({
  seasonsApi: {
    list: vi.fn()
  }
}));

vi.mock('../services/seriesApi', () => ({
  seriesApi: {
    list: vi.fn()
  }
}));

const makeCompetition = (overrides: Partial<Competition>): Competition => ({
  id: 1,
  name: 'Competition',
  type: 'tournament',
  season_id: null,
  series_id: null,
  start_date: '2025-01-01',
  end_date: null,
  status: 'upcoming',
  format_config: { bracket_type: 'single_elimination' },
  created_at: '',
  updated_at: '',
  ...overrides
});

describe('CompetitionDialog', () => {
  const createMock = competitionsApi.create as unknown as Mock;
  const updateMock = competitionsApi.update as unknown as Mock;
  const seasonsListMock = seasonsApi.list as unknown as Mock;
  const seriesListMock = seriesApi.list as unknown as Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    seasonsListMock.mockResolvedValue([
      {
        id: 1,
        name: '2025-2026',
        start_date: '2025-09-01',
        end_date: '2026-06-30',
        season_type: 'indoor',
        is_active: true,
        created_at: '',
        updated_at: ''
      }
    ]);
    seriesListMock.mockResolvedValue([
      {
        id: 10,
        name: 'Eerste Klasse',
        level: 1,
        created_at: '',
        updated_at: ''
      }
    ]);
  });

  const renderDialog = (props?: Partial<ComponentProps<typeof CompetitionDialog>>) => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();

    render(
      <CompetitionDialog
        isOpen
        onClose={onClose}
        onSuccess={onSuccess}
        {...props}
      />
    );

    return { onClose, onSuccess };
  };

  it('prevents end date earlier than start date', async () => {
    renderDialog();

    await userEvent.type(screen.getByLabelText('Competition name'), 'Winter League');
    await userEvent.type(screen.getByLabelText('Start date'), '2025-12-01');
    await userEvent.type(screen.getByLabelText('End date (optional)'), '2025-11-01');

    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(screen.getByText('End date cannot be before start date')).toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('requires a start date before saving', async () => {
    renderDialog();

    await userEvent.type(screen.getByLabelText('Competition name'), 'No Date Cup');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(screen.getByText('Start date is required')).toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('creates a league with season and series selection', async () => {
    createMock.mockResolvedValue({ id: 2 });
    renderDialog();

    await userEvent.type(screen.getByLabelText('Competition name'), 'Spring League');
    await userEvent.selectOptions(screen.getByLabelText('Competition type'), 'league');
    await userEvent.type(screen.getByLabelText('Start date'), '2026-02-01');

    await waitFor(() => {
      expect(seasonsListMock).toHaveBeenCalledTimes(1);
      expect(seriesListMock).toHaveBeenCalledTimes(1);
    });

    await userEvent.selectOptions(screen.getByLabelText('Season (optional)'), '1');
    await userEvent.selectOptions(screen.getByLabelText('Series (optional)'), '10');

    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Spring League',
          type: 'league',
          start_date: '2026-02-01',
          season_id: 1,
          series_id: 10,
          format_config: { points_win: 3, points_draw: 1, points_loss: 0 }
        })
      );
    });
  });

  it('creates a tournament with bracket config', async () => {
    createMock.mockResolvedValue({ id: 3 });
    renderDialog();

    await userEvent.type(screen.getByLabelText('Competition name'), 'Cup');
    await userEvent.type(screen.getByLabelText('Start date'), '2026-03-15');
    await userEvent.selectOptions(screen.getByLabelText('Bracket type'), 'double_elimination');

    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Cup',
          type: 'tournament',
          start_date: '2026-03-15',
          format_config: { bracket_type: 'double_elimination' }
        })
      );
    });
  });

  it('updates a competition and allows clearing season and series', async () => {
    updateMock.mockResolvedValue({ id: 1 });

    renderDialog({
      competition: makeCompetition({
        id: 1,
        name: 'Summer Tournament',
        season_id: 1,
        series_id: 10,
        status: 'upcoming'
      })
    });

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'in_progress');
    await userEvent.selectOptions(screen.getByLabelText('Season (optional)'), '');
    await userEvent.selectOptions(screen.getByLabelText('Series (optional)'), '');

    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          status: 'in_progress',
          season_id: null,
          series_id: null
        })
      );
    });
  });
});
