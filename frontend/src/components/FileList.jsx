import { useState, useRef, useEffect } from 'react';

const FILE_ICONS = {
  mp4: '🎬',
  mov: '🎬',
  webm: '🎬',
  avi: '🎬',
  mkv: '🎬',
  mp3: '🎵',
  wav: '🎵',
  ogg: '🎵',
  flac: '🎵',
  aac: '🎵',
  m4a: '🎵',
  jpg: '🖼️',
  jpeg: '🖼️',
  png: '🖼️',
  gif: '🖼️',
  svg: '🖼️',
  webp: '🖼️',
  heic: '🖼️',
  heif: '🖼️',
  avif: '🖼️',
  bmp: '🖼️',
  tiff: '🖼️',
  ico: '🖼️',
};

function getIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return FILE_ICONS[ext] || '📄';
}

const SORT_OPTIONS = [
  { value: 'date', label: 'Date' },
  { value: 'name', label: 'Name' },
  { value: 'size', label: 'Size' },
];

export default function FileList({
  files,
  activeFile,
  loading,
  sort,
  onSortChange,
  onSelect,
  onDelete,
  playlists,
  onAddToPlaylist,
  formatBytes,
  formatDate,
}) {
  const handleSortField = (field) => {
    if (sort.field === field) {
      onSortChange({ ...sort, order: sort.order === 'asc' ? 'desc' : 'asc' });
    } else {
      onSortChange({ field, order: field === 'name' ? 'asc' : 'desc' });
    }
  };

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
      <>
        <div className="sort-bar">
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.value}
              className={`sort-btn ${sort.field === o.value ? 'active' : ''}`}
              onClick={() => handleSortField(o.value)}
            >
              {o.label}
              {sort.field === o.value && (
                <span className="sort-arrow">{sort.order === 'asc' ? ' ↑' : ' ↓'}</span>
              )}
            </button>
          ))}
        </div>
        <div className="file-list-empty">
          <span className="empty-icon">📭</span>
          No files yet. Upload some media to get started.
        </div>
      </>
    );
  }

  return (
    <>
      <div className="sort-bar">
        {SORT_OPTIONS.map((o) => (
          <button
            key={o.value}
            className={`sort-btn ${sort.field === o.value ? 'active' : ''}`}
            onClick={() => handleSortField(o.value)}
          >
            {o.label}
            {sort.field === o.value && (
              <span className="sort-arrow">{sort.order === 'asc' ? ' ↑' : ' ↓'}</span>
            )}
          </button>
        ))}
      </div>
      <div className="file-list">
        {files.map((file) => (
          <FileItem
            key={file.id}
            file={file}
            active={activeFile?.id === file.id}
            onSelect={onSelect}
            onDelete={onDelete}
            playlists={playlists}
            onAddToPlaylist={onAddToPlaylist}
            formatBytes={formatBytes}
            formatDate={formatDate}
          />
        ))}
      </div>
    </>
  );
}

function FileItem({ file, active, onSelect, onDelete, playlists, onAddToPlaylist, formatBytes, formatDate }) {
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!showPlaylistMenu) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowPlaylistMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPlaylistMenu]);

  const compatiblePlaylists = playlists?.filter((p) => p.type === file.fileType) ?? [];

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
        <div className="file-name" title={file.originalFilename}>{file.originalFilename}</div>
        <div className="file-meta">{formatBytes(file.size)} · {formatDate(file.uploadDate)}</div>
      </div>
      <div className="file-actions">
        {onAddToPlaylist && (
          <div className="playlist-menu-wrap" ref={menuRef}>
            <button
              className="btn btn-ghost icon-btn"
              title="Add to playlist"
              onClick={(e) => { e.stopPropagation(); setShowPlaylistMenu((v) => !v); }}
            >
              +
            </button>
            {showPlaylistMenu && (
              <div className="playlist-dropdown" onClick={(e) => e.stopPropagation()}>
                {compatiblePlaylists.length === 0 ? (
                  <div className="playlist-dropdown-empty">No {file.fileType} playlists</div>
                ) : (
                  compatiblePlaylists.map((pl) => (
                    <button
                      key={pl.id}
                      className="playlist-dropdown-item"
                      onClick={() => { onAddToPlaylist(pl.id, file.id); setShowPlaylistMenu(false); }}
                    >
                      {pl.type === 'video' ? '🎬' : '🎵'} {pl.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
        <button
          className="btn btn-danger icon-btn"
          title="Delete file"
          onClick={(e) => { e.stopPropagation(); onDelete(file); }}
        >
          🗑
        </button>
      </div>
    </div>
  );
}
