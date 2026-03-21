import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { Mock } from 'vitest';
import VideoLinkEditor from '../components/VideoLinkEditor';
import { advancedAnalyticsApi } from '../services/advancedAnalyticsApi';

vi.mock('../services/advancedAnalyticsApi', () => ({
  advancedAnalyticsApi: {
    linkVideoEvent: vi.fn(),
    videoEvents: vi.fn(),
    videoHighlights: vi.fn(),
  },
}));

describe('VideoLinkEditor', () => {
  const linkMock = advancedAnalyticsApi.linkVideoEvent as unknown as Mock;
  const eventsMock = advancedAnalyticsApi.videoEvents as unknown as Mock;
  const highlightsMock = advancedAnalyticsApi.videoHighlights as unknown as Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    eventsMock.mockResolvedValue([
      {
        id: 1,
        game_id: 77,
        event_type: 'goal',
        description: 'Linked goal',
        timestamp_start: '00:12',
        timestamp_end: '00:18',
        video_url: 'https://example.com/video',
        is_highlight: true,
      },
    ]);

    highlightsMock.mockResolvedValue({
      game_id: 77,
      total_clips: 2,
      marked_highlights: [
        { event_id: 1, event_type: 'goal', description: 'Marked clip', timestamp_start: '00:12', timestamp_end: '00:18' },
      ],
      auto_identified_highlights: [
        { event_id: 2, event_type: 'foul', description: 'Auto clip', suggested_duration: 8, priority: 'high' },
      ],
      reel_metadata: {
        suggested_total_duration: 20,
        clip_ordering: 'chronological',
        include_transitions: true,
      },
    });

    linkMock.mockResolvedValue({ id: 12 });
  });

  it('loads and previews linked events', async () => {
    render(<VideoLinkEditor gameId={77} />);

    await waitFor(() => {
      expect(eventsMock).toHaveBeenCalledWith(77);
      expect(highlightsMock).toHaveBeenCalledWith(77);
    });

    expect(screen.getAllByText('Linked goal').length).toBeGreaterThan(0);
  });

  it('marks invalid URL and blocks submission', async () => {
    const user = userEvent.setup();
    render(<VideoLinkEditor gameId={77} />);

    const urlInput = screen.getByLabelText('Video URL');
    await user.type(urlInput, 'not-a-url');
    await user.click(screen.getByRole('button', { name: 'Link Event' }));

    expect(urlInput).toHaveAttribute('aria-invalid', 'true');
    expect(linkMock).not.toHaveBeenCalled();
  });

  it('submits linked video event with selected fields', async () => {
    const user = userEvent.setup();
    render(<VideoLinkEditor gameId={77} />);

    await user.type(screen.getByLabelText('Video URL'), 'https://example.com/video');
    await user.clear(screen.getByLabelText('Start (seconds)'));
    await user.type(screen.getByLabelText('Start (seconds)'), '15');
    await user.clear(screen.getByLabelText('End (seconds)'));
    await user.type(screen.getByLabelText('End (seconds)'), '25');
    await user.type(screen.getByLabelText('Description'), 'Wing goal');
    await user.type(screen.getByLabelText('Tags (comma separated)'), 'left, key-moment');
    await user.click(screen.getByRole('button', { name: 'Link Event' }));

    await waitFor(() => {
      expect(linkMock).toHaveBeenCalledWith(expect.objectContaining({
        game_id: 77,
        video_url: 'https://example.com/video',
        timestamp_start: 15,
        timestamp_end: 25,
        description: 'Wing goal',
        tags: ['left', 'key-moment'],
      }));
    });
  });

  it('generates auto-highlights and exports highlight reel', async () => {
    const user = userEvent.setup();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    render(<VideoLinkEditor gameId={77} />);

    await user.click(screen.getByRole('button', { name: 'Auto-Generate Highlights' }));
    await waitFor(() => {
      expect(highlightsMock).toHaveBeenCalledWith(77);
      expect(screen.getByText('Auto-highlights generated.')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Export Highlight Reel' }));
    await waitFor(() => {
      expect(highlightsMock).toHaveBeenCalledWith(77, 50);
      expect(clickSpy).toHaveBeenCalled();
      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalled();
    });

    clickSpy.mockRestore();
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
  });
});