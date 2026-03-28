import ReactPlayer from 'react-player';

export default function MediaPlayer({
  file,
  apiBase,
  playlist,       // { playlist, items, currentIndex } | null
  onNext,
  onPrev,
  onTrackEnd,
  onSelectTrack,
  formatBytes,
  formatDate,
}) {
  if (!file) {
    return (
      <div className="player-empty">
        <span className="player-empty-icon">▶️</span>
        <p>Select a file to start playback</p>
      </div>
    );
  }

  const streamUrl = `${apiBase}/files/${file.id}/download`;
  const isVideo = file.fileType === 'video';
  const isAudio = file.fileType === 'audio';

  const hasPrev = playlist && playlist.currentIndex > 0;
  const hasNext = playlist && playlist.currentIndex < playlist.items.length - 1;

  return (
    <div className="player-content">
      {/* Now playing header */}
      <div className="player-now-playing">
        <span style={{ fontSize: '1.25rem' }}>{isVideo ? '🎬' : '🎵'}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          {playlist && (
            <div className="now-playing-label">
              {playlist.playlist.name} — {playlist.currentIndex + 1} / {playlist.items.length}
            </div>
          )}
          {!playlist && <div className="now-playing-label">Now Playing</div>}
          <div className="now-playing-name" title={file.originalFilename}>
            {file.originalFilename}
          </div>
        </div>
      </div>

      {/* Video player */}
      {isVideo && (
        <div className="player-wrapper">
          <ReactPlayer
            key={file.id}
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
            key={file.id}
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
        <span>{formatBytes(file.size)}</span>
        <span>·</span>
        <span>{file.mimeType}</span>
        <span>·</span>
        <span>{formatDate(file.uploadDate)}</span>
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
