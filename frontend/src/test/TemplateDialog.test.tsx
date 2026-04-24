import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import TemplateDialog from '../components/TemplateDialog';

describe('TemplateDialog', () => {
  it('renders with dialog semantics and focuses the name field', async () => {
    render(<TemplateDialog isOpen onClose={vi.fn()} onSave={vi.fn()} template={null} />);

    expect(screen.getByRole('dialog', { name: 'Create Template' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByLabelText('Template Name *')).toHaveFocus();
    });
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<TemplateDialog isOpen onClose={onClose} onSave={vi.fn()} template={null} />);

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});