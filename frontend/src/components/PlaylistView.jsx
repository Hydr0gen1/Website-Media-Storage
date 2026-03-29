import { useState } from 'react';
import axios from 'axios';

export default function PlaylistView({
  playlist,
  allFiles,
  apiBase,
  authToken,
  onBack,
  onPlay,
  onPlaylistUpdated,
}) {
  const [busy, setBusy] = useState(false);

  const authHeaders = () => ({ Authorization: `Bearer ${authToken}` });

  async function refetch() {
    const { data } = await axios.get(`${apiBase}/playlists/${playlist.id}`, {
      headers: authHeaders(),
    });
    onPlaylistUpdated(data);
  }

  async function handleAdd(fileId) {
    setBusy(true);
    try {
      await axios.post(
        `${apiBase}/playlists/${playlist.id}/items`,
        { fileId },
        { headers: authHeaders() }
      );
      await refetch();
    } catch (err) {
      alert(err.response?.data?.error ?? 'Failed to add file');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(fileId) {
    setBusy(true);
    try {
      await axios.delete(`${apiBase}/playlists/${playlist.id}/items/${fileId}`, {
        headers: authHeaders(),
      });
      await refetch();
    } catch (err) {
      alert(err.response?.data?.error ?? 'Failed to remove file');
    } finally {
      setBusy(false);
    }
  }

  async function handleMove(index, direction) {
    const items = playlist.items;
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= items.length) return;
    const reordered = [...items];
    [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];
    const orderedFileIds = reordered.map((item) => item.file.id);
    setBusy(true);
    try {
      await axios.put(
        `${apiBase}/playlists/${playlist.id}/reorder`,
        { orderedFileIds },
        { headers: authHeaders() }
      );
      await refetch();
    } catch (err) {
      alert(err.response?.data?.error ?? 'Failed to reorder');
    } finally {
      setBusy(false);
    }
  }

  const inPlaylistIds = new Set(playlist.items.map((item) => item.file.id));
  const addableFiles = allFiles.filter(
    (f) => f.fileType === playlist.type && !inPlaylistIds.has(f.id)
  );

  return (
    <div className="playlist-view">
      <div className="playlist-view-header">
        <button className="btn btn-ghost" onClick={onBack}>
          ← Back
        </button>
        <div className="playlist-view-title">
          <h2>{playlist.name}</h2>
          {playlist.description && (
            <p className="playlist-view-desc">{playlist.description}</p>
          )}
          <span className="playlist-type-badge">{playlist.type}</span>
        </div>
        {playlist.items.length > 0 && (
          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={() => onPlay(playlist, playlist.items)}
          >
            ▶ Play All
          </button>
        )}
      </div>

      <div className="playlist-view-items">
        <h3>Queue ({playlist.items.length})</h3>
        {playlist.items.length === 0 ? (
          <p className="playlist-view-empty">No files yet. Add some below.</p>
        ) : (
          playlist.items.map((item, idx) => (
            <div key={item.id} className="playlist-view-item">
              <span className="queue-num">{idx + 1}</span>
              <span className="queue-name">{item.file.originalFilename}</span>
              <div className="playlist-view-item-actions">
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={busy || idx === 0}
                  onClick={() => handleMove(idx, -1)}
                  aria-label="Move up"
                >
                  ↑
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={busy || idx === playlist.items.length - 1}
                  onClick={() => handleMove(idx, 1)}
                  aria-label="Move down"
                >
                  ↓
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  disabled={busy}
                  onClick={() => handleRemove(item.file.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {addableFiles.length > 0 && (
        <div className="playlist-view-add">
          <h3>Add {playlist.type} files</h3>
          {addableFiles.map((file) => (
            <div key={file.id} className="playlist-view-item">
              <span className="queue-name">{file.originalFilename}</span>
              <button
                className="btn btn-secondary btn-sm"
                disabled={busy}
                onClick={() => handleAdd(file.id)}
              >
                + Add
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
