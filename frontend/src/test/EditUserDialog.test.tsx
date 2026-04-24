import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import EditUserDialog from '../components/EditUserDialog';

describe('EditUserDialog', () => {
  const onClose = vi.fn();
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with dialog semantics and focuses the username field', async () => {
    render(
      <EditUserDialog
        isOpen
        onClose={onClose}
        onSuccess={onSuccess}
        user={{ id: 2, username: 'sam', email: 'sam@example.com', role: 'coach' }}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Edit User Profile' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByLabelText('Username *')).toHaveFocus();
    });
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(
      <EditUserDialog
        isOpen
        onClose={onClose}
        onSuccess={onSuccess}
        user={{ id: 2, username: 'sam', email: 'sam@example.com', role: 'coach' }}
      />,
    );

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalled();
  });

  it('exposes field help text through aria-describedby', () => {
    render(
      <EditUserDialog
        isOpen
        onClose={onClose}
        onSuccess={onSuccess}
        user={{ id: 2, username: 'sam', email: 'sam@example.com', role: 'coach' }}
      />,
    );

    expect(screen.getByLabelText('Username *')).toHaveAttribute('aria-describedby', 'edit-username-hint');
  });
});