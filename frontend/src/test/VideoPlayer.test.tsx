import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VideoPlayer from '../components/VideoPlayer';

describe('VideoPlayer', () => {
  it('renders iframe preview when video URL is provided', () => {
    render(<VideoPlayer videoUrl="https://example.com/video" clips={[]} />);

    expect(screen.getByTitle('Linked video')).toBeInTheDocument();
  });

  it('renders clips and handles clip selection', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <VideoPlayer
        clips={[
          { game_id: 1, event_type: 'goal', event_id: 10, description: 'Goal clip', timestamp_start: '00:10', timestamp_end: '00:15' },
          { game_id: 1, event_type: 'foul', event_id: 11, description: 'Foul clip', timestamp_start: '00:20', timestamp_end: '00:24' },
        ]}
        onSelectClip={onSelect}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Foul clip/i }));
    expect(onSelect).toHaveBeenCalledWith(1);
  });
});