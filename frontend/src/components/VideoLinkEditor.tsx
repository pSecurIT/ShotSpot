import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { advancedAnalyticsApi } from '../services/advancedAnalyticsApi';
import type { VideoEvent, VideoHighlight } from '../types/advanced-analytics';
import VideoPlayer from './VideoPlayer';
import '../styles/VideoAnalysis.css';

interface VideoLinkEditorProps {
  gameId: number;
}

const EVENT_OPTIONS = ['shot', 'goal', 'foul', 'assist', 'turnover', 'timeout'];

const isValidVideoUrl = (url: string): boolean => {
  if (!url.trim()) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const VideoLinkEditor: React.FC<VideoLinkEditorProps> = ({ gameId }) => {
  const [videoUrl, setVideoUrl] = useState('');
  const [eventType, setEventType] = useState('shot');
  const [eventId, setEventId] = useState('');
  const [timestampStart, setTimestampStart] = useState(0);
  const [timestampEnd, setTimestampEnd] = useState(10);
  const [description, setDescription] = useState('');
  const [isHighlight, setIsHighlight] = useState(true);
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [events, setEvents] = useState<VideoEvent[]>([]);
  const [clips, setClips] = useState<VideoHighlight[]>([]);
  const [selectedClipIndex, setSelectedClipIndex] = useState(0);

  const fetchVideoData = useCallback(async () => {
    setError(null);
    try {
      const [videoEvents, highlights] = await Promise.all([
        advancedAnalyticsApi.videoEvents(gameId),
        advancedAnalyticsApi.videoHighlights(gameId),
      ]);

      setEvents(videoEvents);
      setClips([...(highlights.marked_highlights || []), ...(highlights.auto_identified_highlights || [])]);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : 'Failed to load video links';
      setError(message);
    }
  }, [gameId]);

  useEffect(() => {
    void fetchVideoData();
  }, [fetchVideoData]);

  const previewClips = useMemo(() => {
    if (events.length > 0) {
      return events;
    }
    return clips;
  }, [events, clips]);

  const validationMessage = useMemo(() => {
    if (!videoUrl.trim()) {
      return 'Video URL is required.';
    }
    if (!isValidVideoUrl(videoUrl)) {
      return 'Please enter a valid HTTP/HTTPS video URL.';
    }
    if (timestampEnd < timestampStart) {
      return 'End timestamp must be greater than or equal to start timestamp.';
    }
    return null;
  }, [timestampEnd, timestampStart, videoUrl]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccessMessage(null);

    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await advancedAnalyticsApi.linkVideoEvent({
        game_id: gameId,
        event_type: eventType,
        event_id: eventId ? Number(eventId) : undefined,
        video_url: videoUrl,
        timestamp_start: timestampStart,
        timestamp_end: timestampEnd,
        description: description || undefined,
        is_highlight: isHighlight,
        tags: tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      });

      setSuccessMessage('Video link saved successfully.');
      await fetchVideoData();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Failed to save video link';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const generateHighlights = async () => {
    setLoading(true);
    setError(null);
    try {
      const highlights = await advancedAnalyticsApi.videoHighlights(gameId);
      setClips([...(highlights.marked_highlights || []), ...(highlights.auto_identified_highlights || [])]);
      setSelectedClipIndex(0);
      setSuccessMessage('Auto-highlights generated.');
    } catch (highlightError) {
      const message = highlightError instanceof Error ? highlightError.message : 'Failed to generate highlights';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const exportReel = async () => {
    setLoading(true);
    setError(null);
    try {
      const reel = await advancedAnalyticsApi.videoHighlights(gameId, 50);
      const payload = {
        game_id: reel.game_id,
        total_clips: reel.total_clips,
        reel_metadata: reel.reel_metadata,
        clips: [...(reel.marked_highlights || []), ...(reel.auto_identified_highlights || [])],
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = `highlight-reel-game-${gameId}.json`;
      link.click();
      URL.revokeObjectURL(href);
      setSuccessMessage('Highlight reel exported.');
    } catch (exportError) {
      const message = exportError instanceof Error ? exportError.message : 'Failed to export highlight reel';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="video-link-editor" aria-label="Video link editor">
      <header className="video-link-editor__header">
        <h2>Video Event Linking</h2>
        <p>Link timestamps to in-game events and generate highlight reels.</p>
      </header>

      {error && <p role="alert" className="video-link-editor__error">{error}</p>}
      {successMessage && <p className="video-link-editor__success">{successMessage}</p>}

      <form className="video-link-editor__form" onSubmit={handleSubmit}>
        <label htmlFor="video-url">Video URL</label>
        <input
          id="video-url"
          type="url"
          placeholder="https://..."
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          aria-invalid={Boolean(validationMessage && videoUrl.length > 0)}
        />

        <label htmlFor="event-type">Event Type</label>
        <select id="event-type" value={eventType} onChange={(e) => setEventType(e.target.value)}>
          {EVENT_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>

        <label htmlFor="event-id">Event ID (optional)</label>
        <input
          id="event-id"
          type="number"
          min={1}
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
        />

        <div className="video-link-editor__timestamps">
          <label htmlFor="timestamp-start">Start (seconds)</label>
          <input
            id="timestamp-start"
            type="number"
            min={0}
            value={timestampStart}
            onChange={(e) => setTimestampStart(Number(e.target.value))}
          />

          <label htmlFor="timestamp-end">End (seconds)</label>
          <input
            id="timestamp-end"
            type="number"
            min={0}
            value={timestampEnd}
            onChange={(e) => setTimestampEnd(Number(e.target.value))}
          />
        </div>

        <label htmlFor="description">Description</label>
        <input
          id="description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <label htmlFor="tags">Tags (comma separated)</label>
        <input
          id="tags"
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />

        <label htmlFor="is-highlight" className="video-link-editor__checkbox">
          <input
            id="is-highlight"
            type="checkbox"
            checked={isHighlight}
            onChange={(e) => setIsHighlight(e.target.checked)}
          />
          Mark as highlight
        </label>

        <div className="video-link-editor__actions">
          <button type="submit" disabled={loading}>Link Event</button>
          <button type="button" onClick={() => void generateHighlights()} disabled={loading}>
            Auto-Generate Highlights
          </button>
          <button type="button" onClick={() => void exportReel()} disabled={loading}>
            Export Highlight Reel
          </button>
        </div>
      </form>

      <VideoPlayer
        title="Linked Video Preview"
        videoUrl={videoUrl || previewClips[0]?.video_url || null}
        clips={previewClips}
        selectedClipIndex={selectedClipIndex}
        onSelectClip={setSelectedClipIndex}
      />
    </section>
  );
};

export default VideoLinkEditor;