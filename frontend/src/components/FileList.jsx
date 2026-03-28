const FILE_ICONS = {
  mp4: '🎬',
  mov: '🎬',
  mp3: '🎵',
  wav: '🎵',
  ogg: '🎵',
};

function getIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return FILE_ICONS[ext] || '📄';
}

export default function FileList({
  files,
  activeFile,
  loading,
  onSelect,
  onDelete,
  formatBytes,
  formatDate,
}) {
  if (loading) {
    return (
      <div className="file-list-empty">
        <span className="empty-icon">⏳</span>
        Loading files...
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="file-list-empty">
        <span className="empty-icon">📭</span>
        No files yet. Upload some media to get started.
      </div>
    );
  }

  const videos = files.filter((f) => f.fileType === 'video');
  const audio = files.filter((f) => f.fileType === 'audio');

  const renderSection = (sectionFiles, type, label) => {
    if (sectionFiles.length === 0) return null;
    return (
      <>
        <div className="section-heading">
          <span className={`section-dot ${type}`} />
          {label} ({sectionFiles.length})
        </div>
        {sectionFiles.map((file) => (
          <FileItem
            key={file.id}
            file={file}
            active={activeFile?.id === file.id}
            onSelect={onSelect}
            onDelete={onDelete}
            formatBytes={formatBytes}
            formatDate={formatDate}
          />
        ))}
      </>
    );
  };

  // If all same type, render flat list
  if (videos.length === 0 || audio.length === 0) {
    return (
      <div className="file-list">
        {files.map((file) => (
          <FileItem
            key={file.id}
            file={file}
            active={activeFile?.id === file.id}
            onSelect={onSelect}
            onDelete={onDelete}
            formatBytes={formatBytes}
            formatDate={formatDate}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="file-list">
      {renderSection(videos, 'video', 'Videos')}
      {renderSection(audio, 'audio', 'Audio')}
    </div>
  );
}

function FileItem({ file, active, onSelect, onDelete, formatBytes, formatDate }) {
  return (
    <div
      className={`file-item ${active ? 'active' : ''}`}
      onClick={() => onSelect(file)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(file)}
    >
      <span className="file-icon">{getIcon(file.originalFilename)}</span>
      <div className="file-info">
        <div className="file-name" title={file.originalFilename}>
          {file.originalFilename}
        </div>
        <div className="file-meta">
          {formatBytes(file.size)} · {formatDate(file.uploadDate)}
        </div>
      </div>
      <div className="file-actions">
        <button
          className="btn btn-danger"
          title="Delete file"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(file);
          }}
        >
          🗑
        </button>
      </div>
    </div>
  );
}
