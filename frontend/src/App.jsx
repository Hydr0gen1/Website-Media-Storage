import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import ChunkedUploadZone from './components/ChunkedUploadZone';
import FileList from './components/FileList';
import MediaPlayer from './components/MediaPlayer';
import AuthModal from './components/AuthModal';
import PlaylistPanel from './components/PlaylistPanel';
import PlaylistView from './components/PlaylistView';

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
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export default function App() {
  // ── Files ────────────────────────────────────────────────────────────────
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [sort, setSort] = useState({ field: 'date', order: 'desc' });
  const [activeFile, setActiveFile] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // ── Auth ─────────────────────────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [showAuth, setShowAuth] = useState(false);

  // ── Playlists ────────────────────────────────────────────────────────────
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null); // detail view
  const [playlistDetail, setPlaylistDetail] = useState(null);
  const [sidebarTab, setSidebarTab] = useState('files'); // 'files' | 'playlists'

  // ── Player playlist state ─────────────────────────────────────────────────
  const [activePlaylist, setActivePlaylist] = useState(null); // { playlist, items, currentIndex }

  // ── Toasts ───────────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState([]);
  const toastTimers = useRef({});

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(toastTimers.current[id]);
    delete toastTimers.current[id];
  }, []);

  const showToast = useCallback((message, type = 'success', duration = 4000) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    toastTimers.current[id] = setTimeout(() => dismissToast(id), duration);
  }, [dismissToast]);

  // Clear all pending timers on unmount
  useEffect(() => {
    const timers = toastTimers.current;
    return () => Object.values(timers).forEach(clearTimeout);
  }, []);

  // ── Auth helpers ──────────────────────────────────────────────────────────
  const authHeaders = useCallback(
    (token = authToken) => ({ Authorization: `Bearer ${token}` }),
    [authToken]
  );

  const handleLogin = useCallback((user, token) => {
    setCurrentUser(user);
    setAuthToken(token);
    localStorage.setItem('authToken', token);
    setShowAuth(false);
    showToast(`Welcome, ${user.username}!`);
  }, [showToast]);

  const handleLogout = useCallback(async () => {
    try {
      await axios.post(`${API_BASE}/auth/logout`, {}, { headers: authHeaders() });
    } catch { /* ignore */ }
    setCurrentUser(null);
    setAuthToken(null);
    setPlaylists([]);
    setSelectedPlaylistId(null);
    setPlaylistDetail(null);
    setActivePlaylist(null);
    setSidebarTab('files');
    localStorage.removeItem('authToken');
    showToast('Logged out');
  }, [authHeaders, showToast]);

  // ── Restore session on mount ──────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) return;
    axios.get(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => {
        setCurrentUser(data.user);
        setAuthToken(token);
      })
      .catch(() => localStorage.removeItem('authToken'));
  }, []);

  // ── Fetch files ───────────────────────────────────────────────────────────
  const fetchFiles = useCallback(async () => {
    if (!authToken) { setLoading(false); return; }
    try {
      const params = { sort: sort.field, order: sort.order };
      if (typeFilter !== 'all') params.type = typeFilter;
      const { data } = await axios.get(`${API_BASE}/files`, {
        params,
        headers: authHeaders(),
      });
      setFiles(data);
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem('authToken');
        setAuthToken(null);
        setCurrentUser(null);
      } else {
        showToast('Failed to load files', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [sort, typeFilter, authToken, authHeaders, showToast]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  // ── Fetch playlists when logged in ────────────────────────────────────────
  const fetchPlaylists = useCallback(async (token) => {
    if (!token) return;
    try {
      const { data } = await axios.get(`${API_BASE}/playlists`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPlaylists(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (authToken) fetchPlaylists(authToken);
  }, [authToken, fetchPlaylists]);

  // ── Fetch playlist detail ─────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedPlaylistId || !authToken) return;
    axios.get(`${API_BASE}/playlists/${selectedPlaylistId}`, { headers: authHeaders() })
      .then(({ data }) => setPlaylistDetail(data))
      .catch(() => showToast('Failed to load playlist', 'error'));
  }, [selectedPlaylistId, authToken, authHeaders, showToast]);

  // ── File handlers ─────────────────────────────────────────────────────────
  const handleUploadComplete = useCallback((newFile) => {
    setFiles((prev) => [newFile, ...prev]);
    showToast(`"${newFile.originalFilename}" uploaded successfully`);
  }, [showToast]);

  const handleDeleteRequest = useCallback((file) => setConfirmDelete(file), []);

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    const file = confirmDelete;
    setConfirmDelete(null);
    try {
      await axios.delete(`${API_BASE}/files/${file.id}`, { headers: authHeaders() });
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      if (activeFile?.id === file.id) { setActiveFile(null); setActivePlaylist(null); }
      showToast(`"${file.originalFilename}" deleted`);
    } catch {
      showToast('Failed to delete file', 'error');
    }
  };

  // ── Playlist handlers ─────────────────────────────────────────────────────
  const handlePlaylistCreated = useCallback((pl) => {
    setPlaylists((prev) => [pl, ...prev]);
    showToast(`Playlist "${pl.name}" created`);
  }, [showToast]);

  const handlePlaylistDeleted = useCallback((id) => {
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
    if (selectedPlaylistId === id) { setSelectedPlaylistId(null); setPlaylistDetail(null); }
    if (activePlaylist?.playlist?.id === id) setActivePlaylist(null);
    showToast('Playlist deleted');
  }, [selectedPlaylistId, activePlaylist, showToast]);

  const handlePlaylistUpdated = useCallback((updated) => {
    setPlaylistDetail(updated);
    setPlaylists((prev) => prev.map((p) =>
      p.id === updated.id ? { ...p, itemCount: updated.items?.length ?? p.itemCount } : p
    ));
    if (activePlaylist?.playlist?.id === updated.id) {
      setActivePlaylist((ap) => ap ? { ...ap, items: updated.items } : ap);
    }
  }, [activePlaylist]);

  const handleAddToPlaylist = useCallback(async (playlistId, fileId) => {
    try {
      await axios.post(`${API_BASE}/playlists/${playlistId}/items`, { fileId }, { headers: authHeaders() });
      setPlaylists((prev) => prev.map((p) =>
        p.id === playlistId ? { ...p, itemCount: (p.itemCount ?? 0) + 1 } : p
      ));
      showToast('Added to playlist');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to add to playlist', 'error');
    }
  }, [authHeaders, showToast]);

  const handlePlayPlaylist = useCallback((playlist, items) => {
    if (!items.length) return;
    setActivePlaylist({ playlist, items, currentIndex: 0 });
    setActiveFile(items[0].file);
  }, []);

  // ── Playlist player controls ───────────────────────────────────────────────
  const handleNextTrack = useCallback(() => {
    if (!activePlaylist) return;
    const next = activePlaylist.currentIndex + 1;
    if (next >= activePlaylist.items.length) return;
    setActivePlaylist((ap) => ({ ...ap, currentIndex: next }));
    setActiveFile(activePlaylist.items[next].file);
  }, [activePlaylist]);

  const handlePrevTrack = useCallback(() => {
    if (!activePlaylist) return;
    const prev = activePlaylist.currentIndex - 1;
    if (prev < 0) return;
    setActivePlaylist((ap) => ({ ...ap, currentIndex: prev }));
    setActiveFile(activePlaylist.items[prev].file);
  }, [activePlaylist]);

  const handleTrackEnd = useCallback(() => {
    if (!activePlaylist) return;
    const next = activePlaylist.currentIndex + 1;
    if (next < activePlaylist.items.length) {
      setActivePlaylist((ap) => ({ ...ap, currentIndex: next }));
      setActiveFile(activePlaylist.items[next].file);
    }
  }, [activePlaylist]);

  const handleSelectTrack = useCallback((index) => {
    if (!activePlaylist) return;
    setActivePlaylist((ap) => ({ ...ap, currentIndex: index }));
    setActiveFile(activePlaylist.items[index].file);
  }, [activePlaylist]);

  // ── Derived state ─────────────────────────────────────────────────────────
  // When user selects a file directly (not via playlist), clear playlist context
  const handleSelectFile = useCallback((file) => {
    setActiveFile(file);
    setActivePlaylist(null);
  }, []);

  const displayedFiles = files; // already filtered/sorted by server

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="app-header">
        <span className="header-icon">🎬</span>
        <h1>Media Storage</h1>
        <div className="header-spacer" />
        {currentUser ? (
          <div className="header-auth">
            <span className="header-username">👤 {currentUser.username}</span>
            <button className="btn btn-ghost header-auth-btn" onClick={handleLogout}>Sign Out</button>
          </div>
        ) : (
          <button className="btn btn-ghost header-auth-btn" onClick={() => setShowAuth(true)}>
            Sign In
          </button>
        )}
      </header>

      <main className="app-main">
        {/* ── Sidebar ── */}
        <aside className="sidebar">
          {/* Upload card — always visible */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Upload</span>
            </div>
            <ChunkedUploadZone
              apiBase={API_BASE}
              authToken={authToken}
              onUploadComplete={handleUploadComplete}
              onError={(msg) => showToast(msg, 'error')}
            />
          </div>

          {/* Tabbed Files / Playlists card */}
          <div className="card">
            <div className="card-header">
              <div className="sidebar-tabs">
                <button
                  className={`sidebar-tab ${sidebarTab === 'files' ? 'active' : ''}`}
                  onClick={() => setSidebarTab('files')}
                >
                  Files <span className="tab-count">({files.length})</span>
                </button>
                <button
                  className={`sidebar-tab ${sidebarTab === 'playlists' ? 'active' : ''}`}
                  onClick={() => { setSidebarTab('playlists'); if (!currentUser) setShowAuth(true); }}
                >
                  Playlists {currentUser && <span className="tab-count">({playlists.length})</span>}
                </button>
              </div>

              {/* Type filter only on Files tab */}
              {sidebarTab === 'files' && (
                <div style={{ display: 'flex', gap: '0.375rem' }}>
                  {[
                    { key: 'all', label: 'All' },
                    { key: 'video', label: '🎬' },
                    { key: 'audio', label: '🎵' },
                    { key: 'image', label: '🖼️' },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      className={`filter-tab ${typeFilter === key ? 'active' : ''}`}
                      onClick={() => setTypeFilter(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Files tab content */}
            {sidebarTab === 'files' && (
              <FileList
                files={displayedFiles}
                activeFile={activeFile}
                loading={loading}
                sort={sort}
                onSortChange={setSort}
                onSelect={handleSelectFile}
                onDelete={handleDeleteRequest}
                playlists={currentUser ? playlists : null}
                onAddToPlaylist={currentUser ? handleAddToPlaylist : null}
                formatBytes={formatBytes}
                formatDate={formatDate}
              />
            )}

            {/* Playlists tab content */}
            {sidebarTab === 'playlists' && currentUser && (
              selectedPlaylistId && playlistDetail ? (
                <PlaylistView
                  playlist={playlistDetail}
                  allFiles={files}
                  apiBase={API_BASE}
                  authToken={authToken}
                  onBack={() => { setSelectedPlaylistId(null); setPlaylistDetail(null); }}
                  onPlay={handlePlayPlaylist}
                  onPlaylistUpdated={handlePlaylistUpdated}
                />
              ) : (
                <PlaylistPanel
                  playlists={playlists}
                  apiBase={API_BASE}
                  authToken={authToken}
                  onSelect={(id) => setSelectedPlaylistId(id)}
                  onCreated={handlePlaylistCreated}
                  onDeleted={handlePlaylistDeleted}
                />
              )
            )}

            {/* Playlists tab — not logged in prompt */}
            {sidebarTab === 'playlists' && !currentUser && (
              <div className="file-list-empty">
                <span className="empty-icon" style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem', opacity: 0.4 }}>🔒</span>
                Sign in to create and manage playlists.
              </div>
            )}
          </div>
        </aside>

        {/* ── Player ── */}
        <section className="content">
          <div className="card player-card">
            <div className="card-header">
              <span className="card-title">
                {activePlaylist ? `▶ ${activePlaylist.playlist.name}` : 'Player'}
              </span>
              {activePlaylist && (
                <button className="btn btn-ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                  onClick={() => { setActivePlaylist(null); }}>
                  ✕ Clear queue
                </button>
              )}
            </div>
            <MediaPlayer
              file={activeFile}
              apiBase={API_BASE}
              playlist={activePlaylist}
              onNext={handleNextTrack}
              onPrev={handlePrevTrack}
              onTrackEnd={handleTrackEnd}
              onSelectTrack={handleSelectTrack}
              formatBytes={formatBytes}
              formatDate={formatDate}
            />
          </div>
        </section>
      </main>

      {/* ── Toasts ── */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`} role="alert">
            <span className="toast-content">{t.message}</span>
            <button
              className="toast-dismiss"
              onClick={() => dismissToast(t.id)}
              aria-label="Dismiss"
            >✕</button>
          </div>
        ))}
      </div>

      {/* ── Delete confirmation ── */}
      {confirmDelete && (
        <div className="overlay" onClick={() => setConfirmDelete(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Delete file?</h3>
            <p>"{confirmDelete.originalFilename}" will be permanently removed. This cannot be undone.</p>
            <div className="dialog-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn-confirm-delete" onClick={handleDeleteConfirm}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Auth modal ── */}
      {showAuth && (
        <AuthModal
          apiBase={API_BASE}
          onLogin={handleLogin}
          onClose={() => setShowAuth(false)}
        />
      )}
    </div>
  );
}
