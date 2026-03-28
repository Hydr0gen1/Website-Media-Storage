import { useState } from 'react';
import axios from 'axios';

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function PlaylistView({
  playlist,
  allFiles,
  apiBase,
  authToken,
  onBack,
  onPlay,
  onPlaylistUpdated,
}) {
  const [showAddFiles, setShowAddFiles] = useState(false);
  const [adding, setAdding] = useState(false);

  const headers = { Authorization: `Bearer ${authToken}` };

  const items = playlist.items || [];

  const handleRemove = async (fileId) => {
    try {
      await axios.delete(`${apiBase}/playlists/${playlist.id}/items/${fileId}`, { headers });
      const updated = {
        ...playlist,
        items: items.filter((i) => i.file.id !== fileId),
      };
      onPlaylistUpdated(updated);
    } catch {
      // silent — parent can show toast
    }
  };

  const handleMove = async (index, direction) => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= items.length) return;

    const newItems = [...items];
    [newItems[index], newItems[swapIndex]] = [newItems[swapIndex], newItems[index]];

    const orderedFileIds = newItems.map((i) => i.file.id);
    try {
      await axios.put(`${apiBase}/playlists/${playlist.id}/reorder`, { orderedFileIds }, { headers });
      onPlaylistUpdated({ ...playlist, items: newItems.map((item, pos) => ({ ...item, position: pos })) });
    } catch {
      // silent
    }
  };

  const handleAddFile = async (fileId) => {
    if (adding) return;
    setAdding(true);
    try {
      await axios.post(`${apiBase}/playlists/${playlist.id}/items`, { fileId }, { headers });
      const file = allFiles.find((f) => f.id === fileId);
      const newItem = { id: Date.now(), position: items.length, file };
      onPlaylistUpdated({ ...playlist, items: [...items, newItem] });
    } catch {
      // silent
    } finally {
      setAdding(false);
      setShowAddFiles(false);
    }
  };

  const existingFileIds = new Set(items.map((i) => i.file.id));
  const addableFiles = allFiles.filter(
    (f) => f.fileType === playlist.type && !existingFileIds.has(f.id)
  );

  return (
    <div className="playlist-view">
      <div className="playlist-view-header">
        <button className="btn btn-ghost" style={{ padding: '0.375rem 0.5rem', fontSize: '0.8125rem' }} onClick={onBack}>
          ← Back
        </button>
        <div className="playlist-view-title">
          <span>{playlist.type === 'video' ? '🎬' : '🎵'}</span>
          <span>{playlist.name}</span>
        </div>
        {items.length > 0 && (
          <button
            className="btn btn-primary"
            style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
            onClick={() => onPlay(playlist, items)}
          >
            ▶ Play All
          </button>
        )}
      </div>

      {playlist.description && (
        <p className="playlist-description">{playlist.description}</p>
      )}

      {items.length === 0 ? (
        <div className="file-list-empty" style={{ padding: '2rem 1rem' }}>
          <span className="empty-icon" style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem', opacity: 0.4 }}>📭</span>
          No files yet.
        </div>
      ) : (
        <div className="playlist-items">
          {items.map((item, index) => (
            <div key={item.file.id} className="playlist-track">
              <span className="track-num">{index + 1}</span>
              <div className="track-info">
                <div className="file-name" title={item.file.originalFilename}>{item.file.originalFilename}</div>
                <div className="file-meta">{formatBytes(item.file.size)}</div>
              </div>
              <div className="track-controls">
                <button
                  className="btn btn-ghost icon-btn"
                  disabled={index === 0}
                  onClick={() => handleMove(index, 'up')}
                  title="Move up"
                >↑</button>
                <button
                  className="btn btn-ghost icon-btn"
                  disabled={index === items.length - 1}
                  onClick={() => handleMove(index, 'down')}
                  title="Move down"
                >↓</button>
                <button
                  className="btn btn-danger icon-btn"
                  onClick={() => handleRemove(item.file.id)}
                  title="Remove"
                >✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="playlist-view-footer">
        <button
          className="btn btn-ghost"
          style={{ width: '100%', fontSize: '0.8125rem', marginTop: '0.5rem' }}
          onClick={() => setShowAddFiles((v) => !v)}
        >
          {showAddFiles ? '− Hide files' : '+ Add files'}
        </button>

        {showAddFiles && (
          <div className="add-files-list">
            {addableFiles.length === 0 ? (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', padding: '0.75rem', textAlign: 'center' }}>
                No compatible files to add.
              </p>
            ) : (
              addableFiles.map((f) => (
                <div
                  key={f.id}
                  className="add-file-item"
                  onClick={() => handleAddFile(f.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddFile(f.id)}
                >
                  <span>{playlist.type === 'video' ? '🎬' : '🎵'}</span>
                  <span className="file-name" style={{ flex: 1 }}>{f.originalFilename}</span>
                  <span style={{ color: 'var(--accent)', fontSize: '0.8125rem' }}>+ Add</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
