import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import ChunkedUploadZone from './components/ChunkedUploadZone';
import FileList from './components/FileList';
import MediaPlayer from './components/MediaPlayer';
import AuthModal from './components/AuthModal';
import PlaylistPanel from './components/PlaylistPanel';
import PlaylistView from './components/PlaylistView';
import SubscriptionsManager from './components/SubscriptionsManager';
import VideoDownloader from './components/VideoDownloader';
import LoginPage from './components/LoginPage';

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

// Formats an axios error into a short debug string for toast detail lines.
function errDetail(err) {
  const status = err?.response?.status;
  const msg = err?.response?.data?.error;
  const parts = [];
  if (status) parts.push(`HTTP ${status}`);
  if (msg) parts.push(msg);
  return parts.join(' · ') || null;
}

export default function App() {
  // ── Files ────────────────────────────────────────────────────────────
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter] = useState('all');
  const [sort, setSort] = useState({ field: 'date', order: 'desc' });
  const [activeFile, setActiveFile] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // ── Auth ─────────────────────────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authReady, setAuthReady] = useState(false); // true once initial session check is done

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

  const showToast = useCallback((message, type = 'success', duration = 4000, detail = null) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type, detail }]);
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
    setActiveFile(null);
    setActivePlaylist(null);
    setSidebarTab('files');
    localStorage.removeItem('authToken');
    showToast('Logged out');
  }, [authHeaders, showToast]);

  // ── Restore session on mount (also handles OAuth callback params) ────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authCode = params.get('auth_code');
    const oauthError = params.get('oauth_error');

    // OAuth code exchange: frontend receives a one-time code and exchanges it
    // for the real session token via POST (token never appears in the URL).
    if (authCode) {
      window.history.replaceState({}, '', window.location.pathname);
      axios.post(`${API_BASE}/auth/oauth/exchange`, { code: authCode })
        .then(({ data }) => {
          localStorage.setItem('authToken', data.token);
          setAuthToken(data.token);
          setCurrentUser(data.user);
          showToast(`Welcome, ${data.user.username}!`);
        })
        .catch(() => showToast('Sign-in failed. Please try again.', 'error'))
        .finally(() => setAuthReady(true));
      return;
    }

    if (oauthError) {
      window.history.replaceState({}, '', window.location.pathname);
      // Sanitize the error message to prevent XSS via crafted URL params
      const safeError = oauthError.replace(/[<>"'&]/g, '');
      showToast(`Sign-in failed: ${safeError || 'Unknown error'}`, 'error');
      setAuthReady(true);
      return;
    }

    const token = localStorage.getItem('authToken');
    if (!token) {
      setAuthReady(true);
      return;
    }
    axios.get(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => {
        setCurrentUser(data.user);
        setAuthToken(token);
      })
      .catch(() => localStorage.removeItem('authToken'))
      .finally(() => setAuthReady(true));
  }, []); // intentionally [] — runs once on mount only

  // ── Fetch files ───────────────────────────────────────────────────────────
  const fetchFiles = useCallback(async () => {
    if (!authToken) {
      setLoading(false);
      return;
    }
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
        showToast('Failed to load files', 'error', 4000, errDetail(err));
      }
    } finally {
      setLoading(false);
    }
  }, [sort, typeFilter, authToken, authHeaders, showToast]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  // ── Fetch playlists when logged in ────────────────────────────────────────
  const fetchPlaylists = useCallback(async () => {
    if (!authToken) return;
    try {
      const { data } = await axios.get(`${API_BASE}/playlists`, {
        headers: authHeaders(),
      });
      setPlaylists(data);
    } catch { /* ignore */ }
  }, [authToken, authHeaders]);

  useEffect(() => {
    if (authToken) fetchPlaylists();
  }, [authToken, fetchPlaylists]);

  // ── Fetch playlist detail ─────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedPlaylistId || !authToken) return;
    axios.get(`${API_BASE}/playlists/${selectedPlaylistId}`, { headers: authHeaders() })
      .then(({ data }) => setPlaylistDetail(data))
      .catch((err) => showToast('Failed to load playlist', 'error', 4000, errDetail(err)));
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
    } catch (err) {
      showToast('Failed to delete file', 'error', 4000, errDetail(err));
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

  const handlePlaylistUpdated = useCallback((updatedPlaylist) => {
    setPlaylistDetail(updatedPlaylist);
    setPlaylists((prev) => prev.map((p) => (p.id === updatedPlaylist.id ? updatedPlaylist : p)));
  }, []);

  const handlePlayPlaylist = useCallback((playlist, items) => {
    setActivePlaylist({ playlist, items, currentIndex: 0 });
    setActiveFile(null);
    setSidebarTab('files');
  }, []);

  // ── Player ────────────────────────────────────────────────────────────────
  const handlePlayFile = useCallback((file) => {
    setActiveFile(file);
    setActivePlaylist(null);
  }, []);

  const handleNextFile = useCallback(() => {
    if (!activeFile) return;
    const idx = files.findIndex((f) => f.id === activeFile.id);
    if (idx >= 0 && idx < files.length - 1) {
      setActiveFile(files[idx + 1]);
    }
  }, [activeFile, files]);

  const handlePrevFile = useCallback(() => {
    if (!activeFile) return;
    const idx = files.findIndex((f) => f.id === activeFile.id);
    if (idx > 0) {
      setActiveFile(files[idx - 1]);
    }
  }, [activeFile, files]);

  // ── Render ────────────────────────────────────────────────────────────────

  // Waiting for initial session check — show nothing to prevent a flash of the login page
  if (!authReady) {
    return (
      <div className="auth-loading">
        <span className="auth-loading-icon">🎬</span>
      </div>
    );
  }

  // Not logged in — show the full-screen login page
  if (!currentUser) {
    return (
      <>
        <LoginPage onLogin={handleLogin} />
        <div className="toast-container">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.type}`}>
              <div className="toast-content">
                <span>{t.message}</span>
                {t.detail && <span className="toast-detail">{t.detail}</span>}
              </div>
              <button className="toast-dismiss" onClick={() => dismissToast(t.id)}>✕</button>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className={`app${activeFile || activePlaylist ? ' has-player' : ''}`}>
      <header className="app-header">
        <div className="logo">
          <span className="logo-icon">🎬</span>
          <span className="logo-text">MediaStore</span>
        </div>
        <nav className="nav-tabs">
          <button
            className={sidebarTab === 'files' ? 'active' : ''}
            onClick={() => setSidebarTab('files')}
          >
            📁 Files
          </button>
          <button
            className={sidebarTab === 'playlists' ? 'active' : ''}
            onClick={() => setSidebarTab('playlists')}
          >
            📋 Playlists
          </button>
          <button
            className={sidebarTab === 'download' ? 'active' : ''}
            onClick={() => setSidebarTab('download')}
          >
            🎥 Request
          </button>
          <button
            className={sidebarTab === 'downloads' ? 'active' : ''}
            onClick={() => setSidebarTab('downloads')}
          >
            ⬇️ Subscriptions
          </button>
        </nav>
        <div className="user-actions">
          {currentUser ? (
            <button className="btn btn-ghost" onClick={handleLogout}>
              {currentUser.username} (Logout)
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => setShowAuth(true)}>
              Login
            </button>
          )}
        </div>
      </header>

      <main className="app-main">
        <aside className="sidebar">
          {sidebarTab === 'files' ? (
            <>
              <ChunkedUploadZone
                apiBase={API_BASE}
                authToken={authToken}
                onUploadComplete={handleUploadComplete}
                onError={(msg) => showToast(msg, 'error')}
              />
              <FileList
                files={files}
                loading={loading}
                activeFile={activeFile}
                onSelect={handlePlayFile}
                onDelete={handleDeleteRequest}
                sort={sort}
                onSortChange={setSort}
                playlists={playlists}
                onAddToPlaylist={async (playlistId, fileId) => {
                  try {
                    await axios.post(
                      `${API_BASE}/playlists/${playlistId}/items`,
                      { fileId },
                      { headers: authHeaders() }
                    );
                    showToast('Added to playlist');
                    fetchPlaylists();
                  } catch (err) {
                    showToast(err.response?.data?.error || 'Failed to add to playlist', 'error', 4000, errDetail(err));
                  }
                }}
                formatBytes={formatBytes}
                formatDate={formatDate}
              />
            </>
          ) : sidebarTab === 'playlists' ? (
            <PlaylistPanel
              playlists={playlists}
              selectedPlaylistId={selectedPlaylistId}
              onSelectPlaylist={setSelectedPlaylistId}
              onCreatePlaylist={handlePlaylistCreated}
              onDeletePlaylist={handlePlaylistDeleted}
              onPlayPlaylist={handlePlayPlaylist}
              apiBase={API_BASE}
              authToken={authToken}
            />
          ) : sidebarTab === 'download' ? (
            <VideoDownloader
              apiBase={API_BASE}
              authToken={authToken}
              onToast={(msg, type, detail) => showToast(msg, type, 4000, detail)}
            />
          ) : (
            <SubscriptionsManager
              apiBase={API_BASE}
              authToken={authToken}
              onToast={(msg, type, detail) => showToast(msg, type, 4000, detail)}
            />
          )}
        </aside>

        <section className="content">
          {selectedPlaylistId && playlistDetail ? (
            <PlaylistView
              playlist={playlistDetail}
              allFiles={files}
              apiBase={API_BASE}
              authToken={authToken}
              onBack={() => setSelectedPlaylistId(null)}
              onPlay={handlePlayPlaylist}
              onPlaylistUpdated={handlePlaylistUpdated}
            />
          ) : (
            <div className="file-list-empty">
              <span className="empty-icon">📭</span>
              {loading ? 'Loading files...' : currentUser ? 'Select a file to play' : 'Please log in to view your files'}
            </div>
          )}
        </section>
      </main>

      {activeFile && (
        <MediaPlayer
          file={activeFile}
          playlist={null}
          apiBase={API_BASE}
          onNext={handleNextFile}
          onPrev={handlePrevFile}
          onTrackEnd={handleNextFile}
          onSelectTrack={null}
          onClose={() => setActiveFile(null)}
          formatBytes={formatBytes}
          formatDate={formatDate}
        />
      )}

      {activePlaylist && (
        <MediaPlayer
          playlist={activePlaylist}
          apiBase={API_BASE}
          onNext={() => setActivePlaylist((p) => ({ ...p, currentIndex: Math.min(p.currentIndex + 1, p.items.length - 1) }))}
          onPrev={() => setActivePlaylist((p) => ({ ...p, currentIndex: Math.max(p.currentIndex - 1, 0) }))}
          onTrackEnd={() =>
            setActivePlaylist((p) =>
              p.currentIndex < p.items.length - 1
                ? { ...p, currentIndex: p.currentIndex + 1 }
                : p
            )
          }
          onSelectTrack={(idx) =>
            setActivePlaylist((p) => ({ ...p, currentIndex: idx }))
          }
          onClose={() => setActivePlaylist(null)}
          formatBytes={formatBytes}
          formatDate={formatDate}
        />
      )}

      {showAuth && (
        <AuthModal
          onLogin={handleLogin}
          onClose={() => setShowAuth(false)}
          apiBase={API_BASE}
        />
      )}

      {confirmDelete && (
        <div className="overlay" onClick={() => setConfirmDelete(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Delete File?</h3>
            <p>Are you sure you want to delete &quot;{confirmDelete.originalFilename}&quot;?</p>
            <div className="dialog-actions">
              <button className="btn btn-danger" onClick={handleDeleteConfirm}>
                Delete
              </button>
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <div className="toast-content">
              <span>{t.message}</span>
              {t.detail && <span className="toast-detail">{t.detail}</span>}
            </div>
            <button className="toast-dismiss" onClick={() => dismissToast(t.id)}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}
