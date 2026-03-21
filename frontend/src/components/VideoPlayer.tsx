import React from 'react';
import type { VideoEvent, VideoHighlight } from '../types/advanced-analytics';

interface VideoPlayerProps {
  title?: string;
  videoUrl?: string | null;
  clips?: Array<VideoEvent | VideoHighlight>;
  selectedClipIndex?: number;
  onSelectClip?: (index: number) => void;
}

const formatTimestamp = (value?: string | number | null): string => {
  if (value === null || value === undefined) {
    return '--:--';
  }

  if (typeof value === 'number') {
    const minutes = Math.floor(value / 60);
    const seconds = value % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  return value;
};

const clipLabel = (clip: VideoEvent | VideoHighlight): string => {
  return clip.description || clip.event_type;
};

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  title = 'Video Preview',
  videoUrl,
  clips = [],
  selectedClipIndex = 0,
  onSelectClip,
}) => {
  const selected = clips[selectedClipIndex] || null;

  return (
    <section className="video-player" aria-label="Video preview section">
      <h3 className="video-player__title">{title}</h3>
      {videoUrl ? (
        <div className="video-player__frame-wrap" data-testid="video-frame-wrap">
          <iframe
            className="video-player__frame"
            src={videoUrl}
            title="Linked video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <p className="video-player__empty">No video URL selected for preview.</p>
      )}

      {selected && (
        <div className="video-player__selected" data-testid="selected-clip">
          <strong>{clipLabel(selected)}</strong>
          <span>
            {formatTimestamp(selected.timestamp_start)} - {formatTimestamp(selected.timestamp_end)}
          </span>
        </div>
      )}

      {clips.length > 0 && (
        <ul className="video-player__clip-list" data-testid="clip-list">
          {clips.map((clip, index) => (
            <li key={`${clip.event_id || clip.id || index}-${clip.event_type}`}>
              <button
                type="button"
                className={`video-player__clip ${index === selectedClipIndex ? 'is-active' : ''}`}
                onClick={() => onSelectClip?.(index)}
              >
                <span>{clipLabel(clip)}</span>
                <small>
                  {formatTimestamp(clip.timestamp_start)} - {formatTimestamp(clip.timestamp_end)}
                </small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default VideoPlayer;