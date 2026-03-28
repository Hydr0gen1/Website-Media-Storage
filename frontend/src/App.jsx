import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import UploadZone from './components/UploadZone';
import FileList from './components/FileList';
import MediaPlayer from './components/MediaPlayer';

const API_BASE = '/api';

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function App() {
  const [files, setFiles] = useState([]);
  const [filter, setFilter] = useState('all');
  const [activeFile, setActiveFile] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [loading, setLoading] = useState(true);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const fetchFiles = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/files`);
      setFiles(data);
    } catch {
      showToast('Failed to load files', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleUploadComplete = useCallback(
    (newFile) => {
      setFiles((prev) => [newFile, ...prev]);
      showToast(`"${newFile.originalFilename}" uploaded successfully`);
    },
    [showToast]
  );

  const handleUploadError = useCallback(
    (message) => {
      showToast(message, 'error');
    },
    [showToast]
  );

  const handleDeleteRequest = useCallback((file) => {
    setConfirmDelete(file);
  }, []);

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    const file = confirmDelete;
    setConfirmDelete(null);
    try {
      await axios.delete(`${API_BASE}/files/${file.id}`);
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      if (activeFile?.id === file.id) setActiveFile(null);
      showToast(`"${file.originalFilename}" deleted`);
    } catch {
      showToast('Failed to delete file', 'error');
    }
  };

  const filteredFiles = files.filter((f) => {
    if (filter === 'all') return true;
    return f.fileType === filter;
  });

  return (
    <div className="app">
      <header className="app-header">
        <span className="header-icon">🎬</span>
        <h1>Media Storage</h1>
      </header>

      <main className="app-main">
        <aside className="sidebar">
          <div className="card">
            <div className="card-header">
              <span className="card-title">Upload</span>
            </div>
            <UploadZone
              apiBase={API_BASE}
              onUploadComplete={handleUploadComplete}
              onError={handleUploadError}
            />
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">
                Files ({files.length})
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {['all', 'video', 'audio'].map((f) => (
                  <button
                    key={f}
                    className={`filter-tab ${filter === f ? 'active' : ''}`}
                    onClick={() => setFilter(f)}
                  >
                    {f === 'all' ? 'All' : f === 'video' ? '🎬' : '🎵'}
                  </button>
                ))}
              </div>
            </div>
            <FileList
              files={filteredFiles}
              activeFile={activeFile}
              loading={loading}
              onSelect={setActiveFile}
              onDelete={handleDeleteRequest}
              formatBytes={formatBytes}
              formatDate={formatDate}
            />
          </div>
        </aside>

        <section className="content">
          <div className="card player-card">
            <div className="card-header">
              <span className="card-title">Player</span>
            </div>
            <MediaPlayer
              file={activeFile}
              apiBase={API_BASE}
              formatBytes={formatBytes}
              formatDate={formatDate}
            />
          </div>
        </section>
      </main>

      {/* Toast notifications */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <div className="overlay" onClick={() => setConfirmDelete(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Delete file?</h3>
            <p>
              "{confirmDelete.originalFilename}" will be permanently removed.
              This cannot be undone.
            </p>
            <div className="dialog-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button className="btn-confirm-delete" onClick={handleDeleteConfirm}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
