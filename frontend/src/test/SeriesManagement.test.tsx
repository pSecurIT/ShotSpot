import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import SeriesManagement from '../components/SeriesManagement';
import { seriesApi } from '../services/seriesApi';

vi.mock('../services/seriesApi', () => ({
  seriesApi: {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
}));

describe('SeriesManagement', () => {
  const listMock = seriesApi.list as unknown as Mock;
  const getByIdMock = seriesApi.getById as unknown as Mock;
  const createMock = seriesApi.create as unknown as Mock;
  const updateMock = seriesApi.update as unknown as Mock;
  const deleteMock = seriesApi.delete as unknown as Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    listMock.mockResolvedValue([
      { id: 1, name: 'Eerste Klasse', level: 1, region: 'National', competition_count: 2, created_at: '', updated_at: '' },
      { id: 2, name: 'Tweede Klasse', level: 2, region: 'Flanders', competition_count: 0, created_at: '', updated_at: '' },
    ]);

    getByIdMock.mockResolvedValue({
      id: 1,
      name: 'Eerste Klasse',
      level: 1,
      region: 'National',
      competitions: [
        { id: 10, name: 'Top League', competition_type: 'league', status: 'in_progress', season_id: 3, start_date: '2025-09-01', end_date: null }
      ],
      created_at: '',
      updated_at: ''
    });

    createMock.mockResolvedValue({ id: 3 });
    updateMock.mockResolvedValue({ id: 1 });
    deleteMock.mockResolvedValue({ message: 'ok' });
  });

  const renderPage = () => {
    render(
      <MemoryRouter>
        <SeriesManagement />
      </MemoryRouter>
    );
  };

  it('loads and renders series ordered by level', async () => {
    renderPage();

    expect(await screen.findByText('Series / Divisions Management')).toBeInTheDocument();

    await waitFor(() => {
      expect(listMock).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Eerste Klasse')).toBeInTheDocument();
      expect(screen.getByText('Tweede Klasse')).toBeInTheDocument();
    });
  });

  it('creates a series with region assignment', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Eerste Klasse');
    await user.click(screen.getByRole('button', { name: 'Create Series' }));

    await user.type(screen.getByLabelText('Series name'), 'Derde Klasse');
    await user.clear(screen.getByLabelText('Level'));
    await user.type(screen.getByLabelText('Level'), '3');
    await user.clear(screen.getByLabelText('Region'));
    await user.type(screen.getByLabelText('Region'), 'Wallonia');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith({
        name: 'Derde Klasse',
        level: 3,
        region: 'Wallonia',
      });
    });
  });

  it('edits a series and updates region', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Eerste Klasse');
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);

    await user.clear(screen.getByLabelText('Region'));
    await user.type(screen.getByLabelText('Region'), 'Brussels');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(1, expect.objectContaining({ region: 'Brussels' }));
    });
  });

  it('reorders levels with up/down controls', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Tweede Klasse');
    await user.click(screen.getByRole('button', { name: /Move Tweede Klasse up/i }));

    await waitFor(() => {
      expect(updateMock).toHaveBeenNthCalledWith(1, 2, { level: 1 });
      expect(updateMock).toHaveBeenNthCalledWith(2, 1, { level: 2 });
    });
  });

  it('shows competitions for selected series', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Eerste Klasse');
    await user.click(screen.getAllByRole('button', { name: 'View Competitions' })[0]);

    await waitFor(() => {
      expect(getByIdMock).toHaveBeenCalledWith(1);
      expect(screen.getByText('Top League')).toBeInTheDocument();
    });
  });

  it('deletes a series', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Tweede Klasse');
    await user.click(screen.getAllByRole('button', { name: 'Delete' })[1]);

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledWith(2);
    });
  });
});
