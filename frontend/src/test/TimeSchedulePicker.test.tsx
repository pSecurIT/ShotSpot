import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import TimeSchedulePicker from '../components/TimeSchedulePicker';

describe('TimeSchedulePicker', () => {
  it('updates hour value through callback', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <TimeSchedulePicker hour={9} minute={15} onChange={onChange} />,
    );

    await user.selectOptions(screen.getByLabelText('Hour'), '10');

    expect(onChange).toHaveBeenCalledWith({ hour: 10, minute: 15 });
  });

  it('updates minute value through callback', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <TimeSchedulePicker hour={9} minute={15} onChange={onChange} />,
    );

    await user.selectOptions(screen.getByLabelText('Minute'), '30');

    expect(onChange).toHaveBeenCalledWith({ hour: 9, minute: 30 });
  });
});
