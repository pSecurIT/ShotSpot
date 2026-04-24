import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ReportScheduleDialog from '../components/ReportScheduleDialog';

const templates = [
  { id: 2, name: 'Default Weekly', type: 'summary', is_default: true, is_active: true },
];

const teams = [
  { id: 12, name: 'U19 A' },
];

const initialSchedule = {
  id: 33,
  name: 'Existing Schedule',
  created_by: 5,
  template_id: 2,
  schedule_type: 'weekly' as const,
  is_active: true,
  team_id: 12,
  game_filters: {
    schedule_options: {
      weeklyDay: 2,
      monthlyDay: 1,
      hour: 9,
      minute: 0,
    },
    filters: {
      game_status: 'all',
      last_n_days: 30,
      include_practice: false,
    },
  },
  send_email: false,
  email_recipients: [],
  email_subject: null,
  email_body: null,
  last_run_at: null,
  next_run_at: null,
  run_count: 0,
  created_at: '2026-03-20T10:00:00.000Z',
  updated_at: '2026-03-20T10:00:00.000Z',
};

describe('ReportScheduleDialog', () => {
  it('does not render when closed', () => {
    render(
      <ReportScheduleDialog
        isOpen={false}
        templates={templates}
        teams={teams}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders edit title and closes from dialog controls', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <ReportScheduleDialog
        isOpen
        templates={templates}
        teams={teams}
        initialSchedule={initialSchedule}
        onClose={onClose}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Edit Scheduled Report' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('focuses the close button and closes on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <ReportScheduleDialog
        isOpen
        templates={templates}
        teams={teams}
        onClose={onClose}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus();
    });

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('saves a new schedule and closes the dialog', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <ReportScheduleDialog
        isOpen
        templates={templates}
        teams={teams}
        onClose={onClose}
        onSave={onSave}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Create Scheduled Report' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Name'), 'Fresh Schedule');
    await user.click(screen.getByRole('button', { name: 'Save Schedule' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Fresh Schedule',
          template_id: 2,
          schedule_type: 'weekly',
          team_id: 12,
        }),
        undefined,
      );
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps the dialog open when save fails', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSave = vi.fn().mockRejectedValue(new Error('Save failed'));

    render(
      <ReportScheduleDialog
        isOpen
        templates={templates}
        teams={teams}
        onClose={onClose}
        onSave={onSave}
      />,
    );

    await user.type(screen.getByLabelText('Name'), 'Broken Schedule');
    await user.click(screen.getByRole('button', { name: 'Save Schedule' }));

    expect(await screen.findByText('Save failed')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});