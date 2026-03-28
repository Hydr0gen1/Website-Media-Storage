import ReactPlayer from 'react-player';

export default function MediaPlayer({ file, apiBase, formatBytes, formatDate }) {
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

  return (
    <div className="player-content">
      <div className="player-now-playing">
        <span style={{ fontSize: '1.25rem' }}>{isVideo ? '🎬' : '🎵'}</span>
        <div style={{ minWidth: 0 }}>
          <div className="now-playing-label">Now Playing</div>
          <div className="now-playing-name" title={file.originalFilename}>
            {file.originalFilename}
          </div>
        </div>
      </div>

      {isVideo && (
        <div className="player-wrapper">
          <ReactPlayer
            key={file.id}
            url={streamUrl}
            controls
            width="100%"
            height="auto"
            style={{ aspectRatio: '16/9', display: 'block' }}
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

      {isAudio && (
        <div className="player-wrapper audio-player">
          <span className="audio-icon-large">🎵</span>
          <audio
            key={file.id}
            className="native-audio"
            controls
            preload="metadata"
            src={streamUrl}
          >
            Your browser does not support the audio element.
          </audio>
        </div>
      )}

      <div className="player-meta">
        <span>{formatBytes(file.size)}</span>
        <span>·</span>
        <span>{file.mimeType}</span>
        <span>·</span>
        <span>{formatDate(file.uploadDate)}</span>
      </div>
    </div>
  );
}
