import { useState, useEffect } from 'react';
import ReactPlayer from 'react-player';

export default function MediaPlayer({
  file,
  playlist,
  apiBase,
  onNext,
  onPrev,
  onTrackEnd,
  onSelectTrack,
  formatBytes,
  formatDate,
}) {
  const [imageError, setImageError] = useState(false);
  useEffect(() => { setImageError(false); }, [file?.id]);

  if (!file && !playlist) {
    return (
      <div className="player-empty">
        <span className="player-empty-icon">▶️</span>
        <p>Select a file to start playback</p>
      </div>
    );
  }

  const streamUrl = `${apiBase}/files/${file?.id || playlist?.items[0]?.file?.id}/download`;
  const isVideo = file?.fileType === 'video' || playlist?.items?.[0]?.file?.fileType === 'video';
  const isAudio = file?.fileType === 'audio' || playlist?.items?.[0]?.file?.fileType === 'audio';
  const isImage = file?.fileType === 'image' || playlist?.items?.[0]?.file?.fileType === 'image';

  const hasPrev = playlist && playlist.currentIndex > 0;
  const hasNext = playlist && playlist.currentIndex < playlist.items.length - 1;

  return (
    <div className="player-content">
      {/* Now playing header */}
      <div className="player-now-playing">
        <span style={{ fontSize: '1.25rem' }}>{isVideo ? '🎬' : isAudio ? '🎵' : '🖼️'}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          {playlist && (
            <div className="now-playing-label">
              {playlist.playlist.name} — {playlist.currentIndex + 1} / {playlist.items.length}
            </div>
          )}
          {!playlist && <div className="now-playing-label">Now Playing</div>}
          <div className="now-playing-name" title={file?.originalFilename || playlist?.items?.[0]?.file?.originalFilename}>
            {file?.originalFilename || playlist?.items?.[0]?.file?.originalFilename}
          </div>
        </div>
      </div>

      {/* Image viewer */}
      {isImage && (
        <div className="player-image-container">
          {!imageError ? (
            <img
              key={file?.id || playlist?.items[0]?.file?.id}
              src={streamUrl}
              alt={file?.originalFilename || playlist?.items[0]?.file?.originalFilename}
              className="player-image"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="player-image-error">Failed to load image</div>
          )}
        </div>
      )}

      {/* Video player */}
      {isVideo && (
        <div className="player-wrapper">
          <ReactPlayer
            key={file?.id || playlist?.items[0]?.file?.id}
            url={streamUrl}
            controls
            width="100%"
            height="auto"
            style={{ aspectRatio: '16/9', display: 'block' }}
            onEnded={onTrackEnd}
            config={{
              file: {
                attributes: {
                  controlsList: 'nodownload',
                  preload: 'metadata',
                },
              },
            }}
          />
        </div>
      )}

      {/* Audio player */}
      {isAudio && (
        <div className="player-wrapper audio-player">
          <span className="audio-icon-large">🎵</span>
          <audio
            key={file?.id || playlist?.items[0]?.file?.id}
            className="native-audio"
            controls
            preload="metadata"
            src={streamUrl}
            onEnded={onTrackEnd}
          >
            Your browser does not support the audio element.
          </audio>
        </div>
      )}

      {/* Playlist prev/next controls */}
      {playlist && (
        <div className="player-playlist-controls">
          <button className="btn btn-ghost" disabled={!hasPrev} onClick={onPrev}>
            ⏮ Prev
          </button>
          <span className="player-track-indicator">
            {playlist.currentIndex + 1} / {playlist.items.length}
          </span>
          <button className="btn btn-ghost" disabled={!hasNext} onClick={onNext}>
            Next ⏭
          </button>
        </div>
      )}

      {/* File metadata */}
      <div className="player-meta">
        <span>{formatBytes(file?.size || playlist?.items[0]?.file?.size)}</span>
        <span>·</span>
        <span>{file?.mimeType || playlist?.items[0]?.file?.mimeType}</span>
        <span>·</span>
        <span>{formatDate(file?.uploadDate || playlist?.items[0]?.file?.uploadDate)}</span>
      </div>

      {/* Playlist queue */}
      {playlist && playlist.items.length > 1 && (
        <div className="player-queue">
          <div className="player-queue-title">Queue</div>
          {playlist.items.map((item, idx) => (
            <div
              key={item.file.id}
              className={`queue-item ${idx === playlist.currentIndex ? 'active' : ''}`}
              onClick={() => onSelectTrack(idx)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onSelectTrack(idx)}
            >
              <span className="queue-num">{idx + 1}</span>
              <span className="queue-name">{item.file.originalFilename}</span>
              {idx === playlist.currentIndex && <span className="queue-playing">▶</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
