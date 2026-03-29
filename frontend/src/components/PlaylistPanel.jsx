import { useState } from 'react';
import axios from 'axios';

export default function PlaylistPanel({ playlists, apiBase, authToken, onSelectPlaylist, onCreatePlaylist, onDeletePlaylist, onPlayPlaylist }) {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('video');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const headers = { Authorization: `Bearer ${authToken}` };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await axios.post(
        `${apiBase}/playlists`,
        { name, type, description: description || undefined },
        { headers }
      );
      onCreatePlaylist(data);
      setName('');
      setType('video');
      setDescription('');
      setShowCreate(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create playlist');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const pl = confirmDelete;
    setConfirmDelete(null);
    try {
      await axios.delete(`${apiBase}/playlists/${pl.id}`, { headers });
      onDeletePlaylist(pl.id);
    } catch {
      // parent will show toast
    }
  };

  const handlePlay = (playlist, items) => {
    onPlayPlaylist(playlist, items);
  };

  const handlePlayClick = async (e, pl) => {
    e.stopPropagation();
    try {
      const { data } = await axios.get(`${apiBase}/playlists/${pl.id}`, { headers });
      handlePlay(data, data.items);
    } catch {
      // ignore errors
    }
  };

  if (playlists.length === 0 && !showCreate) {
    return (
      <div className="playlist-panel-empty">
        <span className="empty-icon" style={{ opacity: 0.4, fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>🎶</span>
        <p>No playlists yet.</p>
        <button className="btn btn-primary" style={{ marginTop: '0.75rem' }} onClick={() => setShowCreate(true)}>
          + New Playlist
        </button>
      </div>
    );
  }

  return (
    <div className="playlist-panel">
      <div className="playlist-panel-actions">
        <button className="btn btn-primary" style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }} onClick={() => setShowCreate(true)}>
          + New
        </button>
      </div>

      {showCreate && (
        <form className="playlist-create-form" onSubmit={handleCreate}>
          <input
            type="text"
            className="form-input"
            placeholder="Playlist name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
          />
          <div className="form-row">
            <select className="form-input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="video">Video</option>
              <option value="audio">Audio</option>
            </select>
          </div>
          <input
            type="text"
            className="form-input"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {error && <p className="auth-error">{error}</p>}
          <div className="form-row" style={{ gap: '0.5rem' }}>
            <button type="button" className="btn btn-ghost" style={{ flex: 1, fontSize: '0.8125rem' }} onClick={() => { setShowCreate(false); setError(''); }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, fontSize: '0.8125rem' }} disabled={loading}>
              {loading ? '…' : 'Create'}
            </button>
          </div>
        </form>
      )}

      <div className="playlist-list">
        {playlists.map((pl) => (
          <div
            key={pl.id}
            className="playlist-item"
            onClick={() => onSelectPlaylist(pl.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onSelectPlaylist(pl.id)}
          >
            <span className="playlist-type-icon">{pl.type === 'video' ? '🎬' : '🎵'}</span>
            <div className="playlist-item-info">
              <div className="playlist-item-name">{pl.name}</div>
              <div className="playlist-item-meta">
                {pl.itemCount ?? 0} {pl.itemCount === 1 ? 'file' : 'files'}
              </div>
            </div>
            <button
              className="btn btn-ghost icon-btn"
              title="Play playlist"
              onClick={(e) => handlePlayClick(e, pl)}
            >
              ▶
            </button>
            <button
              className="btn btn-danger"
              title="Delete playlist"
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(pl); }}
            >
              🗑
            </button>
          </div>
        ))}
      </div>

      {confirmDelete && (
        <div className="overlay" onClick={() => setConfirmDelete(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Delete playlist?</h3>
            <p>&quot;{confirmDelete.name}&quot; and all its items will be removed. Files are not deleted.</p>
            <div className="dialog-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn-confirm-delete" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
