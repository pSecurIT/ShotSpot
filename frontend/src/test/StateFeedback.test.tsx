import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import RoutePending from '../components/ui/RoutePending';
import StatePanel from '../components/ui/StatePanel';
import Toast from '../components/ui/Toast';

describe('State feedback primitives', () => {
  it('renders loading and error panels with accessible roles', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();

    render(
      <>
        <StatePanel
          variant="loading"
          title="Loading report templates"
          message="Preparing the saved layouts and the template editor."
        />
        <StatePanel
          variant="error"
          title="Couldn’t load templates"
          message="Network request failed"
          actionLabel="Retry"
          onAction={onAction}
        />
      </>
    );

    expect(screen.getByRole('status')).toHaveTextContent('Loading report templates');
    expect(screen.getByRole('alert')).toHaveTextContent('Network request failed');

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('auto dismisses toast feedback after the configured duration', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();

    render(
      <Toast
        title="Template saved"
        message="Template created successfully"
        onDismiss={onDismiss}
        duration={1000}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent('Template created successfully');

    vi.advanceTimersByTime(1000);
    expect(onDismiss).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('renders the route pending shell accessibly', () => {
    render(<RoutePending />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading page');
    expect(screen.getByText('Preparing your workspace and pulling in the latest data.')).toBeInTheDocument();
  });
});