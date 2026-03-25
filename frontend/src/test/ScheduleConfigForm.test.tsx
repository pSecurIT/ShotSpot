import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ScheduleConfigForm from '../components/ScheduleConfigForm';

const templates = [
  { id: 2, name: 'Default Weekly', type: 'summary', is_default: true, is_active: true },
];

const teams = [
  { id: 12, name: 'U19 A' },
];

const initialSchedule = {
  id: 77,
  name: 'Existing Report',
  created_by: 5,
  template_id: 2,
  schedule_type: 'monthly' as const,
  is_active: true,
  team_id: 12,
  game_filters: {
    schedule_options: {
      weeklyDay: 2,
      monthlyDay: 18,
      hour: 14,
      minute: 30,
    },
    filters: {
      game_status: 'scheduled',
      last_n_days: 21,
      include_practice: true,
    },
  },
  send_email: true,
  email_recipients: ['existing@example.com'],
  email_subject: 'Existing Subject',
  email_body: 'Existing Body',
  last_run_at: null,
  next_run_at: null,
  run_count: 0,
  created_at: '2026-03-20T10:00:00.000Z',
  updated_at: '2026-03-20T10:00:00.000Z',
};

describe('ScheduleConfigForm', () => {
  it('shows conditional fields based on selected schedule type', async () => {
    const user = userEvent.setup();

    render(
      <ScheduleConfigForm
        templates={templates}
        teams={teams}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Weekday')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Monthly'));

    expect(screen.getByLabelText('Day of Month')).toBeInTheDocument();
  });

  it('validates multiple email recipients and blocks invalid addresses', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <ScheduleConfigForm
        templates={templates}
        teams={teams}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText('Name'), 'Weekly Report');
    await user.click(screen.getByLabelText('Send report by email'));
    await user.type(screen.getByLabelText('Email Recipients (comma-separated)'), 'valid@example.com, bad-email');

    await user.click(screen.getByRole('button', { name: 'Save Schedule' }));

    expect(await screen.findByText('Invalid email recipient: bad-email')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits valid form values with filters and schedule options', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <ScheduleConfigForm
        templates={templates}
        teams={teams}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText('Name'), 'Weekly Report');
    await user.selectOptions(screen.getByLabelText('Game Status'), 'completed');
    await user.clear(screen.getByLabelText('Last N Days'));
    await user.type(screen.getByLabelText('Last N Days'), '14');
    await user.click(screen.getByLabelText('Include practice matches'));
    await user.click(screen.getByLabelText('Send report by email'));
    await user.type(screen.getByLabelText('Email Recipients (comma-separated)'), 'coach@example.com, analyst@example.com');

    await user.click(screen.getByRole('button', { name: 'Save Schedule' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const payload = onSubmit.mock.calls[0][0];
    expect(payload.name).toBe('Weekly Report');
    expect(payload.template_id).toBe(2);
    expect(payload.schedule_type).toBe('weekly');
    expect(payload.email_recipients).toEqual(['coach@example.com', 'analyst@example.com']);
    expect(payload.game_filters.filters.game_status).toBe('completed');
    expect(payload.game_filters.filters.last_n_days).toBe(14);
    expect(payload.game_filters.filters.include_practice).toBe(true);
  });

  it('renders next execution preview', () => {
    render(
      <ScheduleConfigForm
        templates={templates}
        teams={teams}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText(/Next Execution Preview:/)).toBeInTheDocument();
  });

  it('requires at least one recipient when email delivery is enabled', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <ScheduleConfigForm
        templates={templates}
        teams={teams}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText('Name'), 'Weekly Report');
    await user.click(screen.getByLabelText('Send report by email'));
    await user.click(screen.getByRole('button', { name: 'Save Schedule' }));

    expect(await screen.findByText('Add at least one email recipient.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('hides time fields and updates preview for after-match schedules', async () => {
    const user = userEvent.setup();

    render(
      <ScheduleConfigForm
        templates={templates}
        teams={teams}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('group', { name: 'Execution Time (daily schedules)' })).toBeInTheDocument();

    await user.click(screen.getByLabelText('After Match'));

    expect(screen.queryByRole('group', { name: 'Execution Time (daily schedules)' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('After the next completed match.');
  });

  it('submits the edited schedule id and updated values', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <ScheduleConfigForm
        templates={templates}
        teams={teams}
        initialSchedule={initialSchedule}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Day of Month')).toHaveValue(18);
    expect(screen.getByLabelText('Email Recipients (comma-separated)')).toHaveValue('existing@example.com');

    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Updated Report');
    await user.clear(screen.getByLabelText('Day of Month'));
    await user.type(screen.getByLabelText('Day of Month'), '25');
    await user.selectOptions(screen.getByLabelText('Game Status'), 'completed');

    await user.click(screen.getByRole('button', { name: 'Save Schedule' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Updated Report',
        schedule_type: 'monthly',
        team_id: 12,
        send_email: true,
        email_recipients: ['existing@example.com'],
        game_filters: expect.objectContaining({
          schedule_options: expect.objectContaining({
            monthlyDay: 25,
            hour: 14,
            minute: 30,
          }),
          filters: expect.objectContaining({
            game_status: 'completed',
            last_n_days: 21,
            include_practice: true,
          }),
        }),
      }),
      77,
    );
  });

  it('shows submit errors and disables actions while saving', async () => {
    const user = userEvent.setup();
    let rejectSubmit: ((reason?: unknown) => void) | undefined;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((_, reject) => {
          rejectSubmit = reject;
        }),
    );

    render(
      <ScheduleConfigForm
        templates={templates}
        teams={teams}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText('Name'), 'Weekly Report');
    await user.click(screen.getByRole('button', { name: 'Save Schedule' }));

    expect(await screen.findByRole('button', { name: 'Saving...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    rejectSubmit?.(new Error('Server exploded'));

    expect(await screen.findByText('Server exploded')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save Schedule' })).toBeEnabled();
    });
  });
});
