import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import ClubDialog from '../components/ClubDialog';
import { clubsApi } from '../services/clubsApi';

vi.mock('../services/clubsApi', () => ({
  clubsApi: {
    create: vi.fn(),
    update: vi.fn(),
  }
}));

describe('ClubDialog', () => {
  const createMock = clubsApi.create as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with dialog semantics and focuses the name field', async () => {
    render(<ClubDialog isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Add Club' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByLabelText('Club name')).toHaveFocus();
    });
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(<ClubDialog isOpen onClose={onClose} onSuccess={vi.fn()} />);

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Add Club' }), { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('traps focus inside the dialog', async () => {
    const user = userEvent.setup();
    render(<ClubDialog isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Club name')).toHaveFocus();
    });

    await user.tab();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();

    await user.tab({ shift: true });
    expect(screen.getByLabelText('Club name')).toHaveFocus();
  });

  it('announces validation errors accessibly', async () => {
    render(<ClubDialog isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Club name is required')).toHaveAttribute('id', 'club-name-error');
    expect(screen.getByLabelText('Club name')).toHaveAttribute('aria-invalid', 'true');
    expect(createMock).not.toHaveBeenCalled();
  });
});