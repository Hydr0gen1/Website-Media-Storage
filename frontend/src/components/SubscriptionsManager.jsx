import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const errDetail = (err) => {
  const status = err?.response?.status;
  const msg = err?.response?.data?.error;
  const parts = [];
  if (status) parts.push(`HTTP ${status}`);
  if (msg) parts.push(msg);
  return parts.join(' · ') || null;
};

function formatDuration(seconds) {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatUploadDate(raw) {
  if (!raw || raw.length !== 8) return '';
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

// ── Video Browser Panel ───────────────────────────────────────────────────────
function VideoBrowser({ sub, apiBase, authToken, onToast, onClose }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [downloading, setDownloading] = useState(false);

  const authHeaders = () => ({ Authorization: `Bearer ${authToken}` });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setVideos([]);
    setSelected(new Set());
    axios.get(`${apiBase}/subscriptions/${sub.id}/videos`, { headers: authHeaders() })
      .then(({ data }) => { if (!cancelled) setVideos(data); })
      .catch((err) => { if (!cancelled) onToast('Failed to fetch videos from this channel', 'error', errDetail(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sub.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(prev => prev.size === videos.length ? new Set() : new Set(videos.map(v => v.id)));
  }

  async function handleDownload() {
    const toDownload = videos.filter(v => selected.has(v.id));
    if (!toDownload.length) return;
    setDownloading(true);
    let queued = 0;
    for (const video of toDownload) {
      try {
        await axios.post(
          `${apiBase}/subscriptions/download-url`,
          { videoUrl: video.url },
          { headers: authHeaders() }
        );
        queued++;
      } catch (err) {
        onToast(`Failed to queue "${video.title}"`, 'error', errDetail(err));
      }
    }
    setDownloading(false);
    if (queued > 0) {
      onToast(`${queued} video${queued > 1 ? 's' : ''} queued for download. Check your library in a few minutes.`);
      setSelected(new Set());
    }
  }

  const allSelected = videos.length > 0 && selected.size === videos.length;

  return (
    <div className="video-browser">
      <div className="video-browser-header">
        <div className="video-browser-title">
          <button className="btn btn-ghost btn-sm video-browser-back" onClick={onClose}>
            ← Back
          </button>
          <span className="video-browser-channel">
            {sub.channel_name || sub.channel_url}
          </span>
        </div>
        {videos.length > 0 && (
          <div className="video-browser-actions">
            <button className="btn btn-ghost btn-sm" onClick={toggleAll}>
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleDownload}
              disabled={selected.size === 0 || downloading}
            >
              {downloading ? 'Queueing…' : `Download ${selected.size > 0 ? `(${selected.size})` : ''}`}
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <p className="subs-empty video-browser-loading">Fetching videos…</p>
      ) : videos.length === 0 ? (
        <p className="subs-empty">No recent videos found for this channel.</p>
      ) : (
        <ul className="video-list">
          {videos.map(video => (
            <li
              key={video.id}
              className={`video-item${selected.has(video.id) ? ' selected' : ''}`}
              onClick={() => toggle(video.id)}
            >
              <input
                type="checkbox"
                className="video-checkbox"
                checked={selected.has(video.id)}
                onChange={() => toggle(video.id)}
                onClick={e => e.stopPropagation()}
              />
              <div className="video-info">
                <span className="video-title">{video.title}</span>
                <span className="video-meta">
                  {formatUploadDate(video.uploadDate)}
                  {video.duration ? ` · ${formatDuration(video.duration)}` : ''}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function SubscriptionsManager({ apiBase, authToken, onToast }) {
  const [subscriptions, setSubscriptions] = useState([]);
  const [channelUrl, setChannelUrl] = useState('');
  const [channelName, setChannelName] = useState('');
  const [addingChannel, setAddingChannel] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [browsingSub, setBrowsingSub] = useState(null); // sub object being browsed

  const authHeaders = () => authToken ? { Authorization: `Bearer ${authToken}` } : {};

  const fetchSubscriptions = useCallback(async () => {
    try {
      const { data } = await axios.get(`${apiBase}/subscriptions`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setSubscriptions(data);
    } catch (err) {
      onToast(err.response?.data?.error || 'Failed to load subscriptions', 'error', errDetail(err));
    }
  }, [apiBase, authToken, onToast]);

  useEffect(() => {
    if (authToken) fetchSubscriptions();
  }, [authToken, fetchSubscriptions]);

  async function handleAddChannel(e) {
    e.preventDefault();
    if (!channelUrl.trim()) return;
    setAddingChannel(true);
    try {
      await axios.post(
        `${apiBase}/subscriptions`,
        { channelUrl: channelUrl.trim(), channelName: channelName.trim() || undefined },
        { headers: authHeaders() }
      );
      setChannelUrl('');
      setChannelName('');
      onToast('Channel subscribed! New videos will appear automatically.');
      await fetchSubscriptions();
    } catch (err) {
      onToast(err.response?.data?.error || 'Failed to add channel', 'error', errDetail(err));
    } finally {
      setAddingChannel(false);
    }
  }

  async function handleDelete(sub) {
    try {
      await axios.delete(`${apiBase}/subscriptions/${sub.id}`, { headers: authHeaders() });
      setConfirmDelete(null);
      if (browsingSub?.id === sub.id) setBrowsingSub(null);
      onToast('Subscription removed');
      await fetchSubscriptions();
    } catch (err) {
      onToast(err.response?.data?.error || 'Failed to remove subscription', 'error', errDetail(err));
    }
  }

  // Show video browser when a subscription is selected
  if (browsingSub) {
    return (
      <div className="subscriptions-manager">
        <VideoBrowser
          sub={browsingSub}
          apiBase={apiBase}
          authToken={authToken}
          onToast={onToast}
          onClose={() => setBrowsingSub(null)}
        />
      </div>
    );
  }

  return (
    <div className="subscriptions-manager">
      {/* ── Add Channel ─────────────────────────────────────────── */}
      <div className="subs-section">
        <h3 className="subs-heading">Subscribe to Channel</h3>
        <form className="subs-form" onSubmit={handleAddChannel}>
          <input
            className="subs-input"
            type="url"
            placeholder="YouTube channel URL"
            value={channelUrl}
            onChange={(e) => setChannelUrl(e.target.value)}
            required
          />
          <input
            className="subs-input"
            type="text"
            placeholder="Channel name (optional)"
            value={channelName}
            onChange={(e) => setChannelName(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={addingChannel}>
            {addingChannel ? 'Adding…' : 'Subscribe'}
          </button>
        </form>
      </div>

      {/* ── My Subscriptions ────────────────────────────────────── */}
      <div className="subs-section">
        <h3 className="subs-heading">
          My Subscriptions
          <span className="subs-hint">Checked every 15 min · click to browse videos</span>
        </h3>
        {subscriptions.length === 0 ? (
          <p className="subs-empty">No subscriptions yet.</p>
        ) : (
          <ul className="subs-list">
            {subscriptions.map((sub) => (
              <li key={sub.id} className="subs-item subs-item-clickable" onClick={() => setBrowsingSub(sub)}>
                <div className="subs-item-info">
                  <span className="subs-item-name">
                    {sub.channel_name || sub.channel_url}
                  </span>
                  {sub.channel_name && (
                    <span className="subs-item-url">{sub.channel_url}</span>
                  )}
                  <span className="subs-item-date">
                    Since {new Date(sub.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="subs-item-controls" onClick={e => e.stopPropagation()}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setBrowsingSub(sub)}
                    title="Browse videos"
                  >
                    Browse
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => setConfirmDelete(sub)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Confirm delete dialog ────────────────────────────────── */}
      {confirmDelete && (
        <div className="overlay" onClick={() => setConfirmDelete(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Remove Subscription?</h3>
            <p>
              Stop following &quot;{confirmDelete.channel_name || confirmDelete.channel_url}
              &quot;? Already downloaded files are kept.
            </p>
            <div className="dialog-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={() => handleDelete(confirmDelete)}>
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
