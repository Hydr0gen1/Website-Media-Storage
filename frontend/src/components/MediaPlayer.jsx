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
  onClose,
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

  const currentItem = playlist
    ? playlist.items[playlist.currentIndex]
    : null;
  const activeFile = file ?? currentItem?.file;

  const streamUrl = `${apiBase}/files/${activeFile?.id}/download`;
  const isVideo = activeFile?.fileType === 'video';
  const isAudio = activeFile?.fileType === 'audio';
  const isImage = activeFile?.fileType === 'image';

  const hasPrev = playlist && playlist.currentIndex > 0;
  const hasNext = playlist && playlist.currentIndex < playlist.items.length - 1;

  return (
    <div className="player-content">
      <button
        className="btn btn-ghost player-close"
        onClick={onClose}
        title="Close player"
      >
        ✕
      </button>
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
          <div className="now-playing-name" title={activeFile?.originalFilename}>
            {activeFile?.originalFilename}
          </div>
        </div>
      </div>

      {/* Image viewer */}
      {isImage && activeFile && (
        <div className="player-image-container">
          {!imageError ? (
            <img
              key={activeFile.id}
              src={streamUrl}
              alt={activeFile.originalFilename}
              className="player-image"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="player-image-error">Failed to load image</div>
          )}
        </div>
      )}

      {/* Video player */}
      {isVideo && activeFile && (
        <div className="player-wrapper">
          <ReactPlayer
            key={activeFile.id}
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
      {isAudio && activeFile && (
        <div className="player-wrapper audio-player">
          <span className="audio-icon-large">🎵</span>
          <audio
            key={activeFile.id}
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
      {(file || currentItem) && (
        <div className="player-meta">
          <span>{formatBytes(activeFile.size)}</span>
          <span>·</span>
          <span>{activeFile.mimeType}</span>
          <span>·</span>
          <span>{formatDate(activeFile.uploadDate)}</span>
        </div>
      )}

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
