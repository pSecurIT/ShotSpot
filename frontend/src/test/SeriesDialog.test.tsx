import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import SeriesDialog from '../components/SeriesDialog';

describe('SeriesDialog', () => {
  it('renders with dialog semantics and focuses the name field', async () => {
    render(<SeriesDialog isOpen onClose={vi.fn()} onSave={vi.fn().mockResolvedValue(undefined)} />);

    expect(screen.getByRole('dialog', { name: 'Create Series' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByLabelText('Series name')).toHaveFocus();
    });
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SeriesDialog isOpen onClose={onClose} onSave={vi.fn().mockResolvedValue(undefined)} />);

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('announces validation errors on the relevant field', async () => {
    const user = userEvent.setup();
    render(<SeriesDialog isOpen onClose={vi.fn()} onSave={vi.fn().mockResolvedValue(undefined)} />);

    await user.clear(screen.getByLabelText('Series name'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Series name is required')).toHaveAttribute('id', 'series-name-error');
    expect(screen.getByLabelText('Series name')).toHaveAttribute('aria-invalid', 'true');
  });
});