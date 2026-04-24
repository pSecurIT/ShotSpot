import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import NotificationPreferences from '../components/NotificationPreferences';

describe('NotificationPreferences', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders grouped notification sections', () => {
    render(<NotificationPreferences />);

    expect(screen.getByRole('heading', { name: 'Notification center' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Delivery channels' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Notification types' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Timing controls' })).toBeInTheDocument();
  });

  it('persists changes immediately and shows confirmation feedback', async () => {
    const user = userEvent.setup();
    render(<NotificationPreferences />);

    await user.click(screen.getByLabelText('Email channel'));

    expect(await screen.findByRole('status')).toHaveTextContent('Email notifications enabled.');
    expect(localStorage.getItem('notificationPreferences:v1')).toContain('"email":true');
    expect(localStorage.getItem('emailNotifications')).toBe('true');
  });

  it('clearly communicates enabled and disabled states', async () => {
    const user = userEvent.setup();
    render(<NotificationPreferences />);

    expect(screen.getAllByText('Enabled').length).toBeGreaterThan(0);

    await user.click(screen.getByLabelText('Enable notifications'));

    expect(await screen.findByRole('status')).toHaveTextContent('All notifications disabled.');
    expect(screen.getAllByText('Disabled').length).toBeGreaterThan(0);
  });

  it('resets to defaults and confirms reset', async () => {
    const user = userEvent.setup();
    render(<NotificationPreferences />);

    await user.click(screen.getByLabelText('Email channel'));
    await user.click(screen.getByRole('button', { name: 'Reset notification defaults' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Notification preferences reset to defaults.');
    expect(localStorage.getItem('notificationPreferences:v1')).toContain('"email":false');
  });
});
