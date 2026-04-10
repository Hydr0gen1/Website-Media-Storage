import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

export default function SubscriptionsManager({ apiBase, authToken, onToast }) {
  const [subscriptions, setSubscriptions] = useState([]);
  const [channelUrl, setChannelUrl] = useState('');
  const [channelName, setChannelName] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [addingChannel, setAddingChannel] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const authHeaders = () => authToken ? { Authorization: `Bearer ${authToken}` } : {};

  const fetchSubscriptions = useCallback(async () => {
    try {
      const { data } = await axios.get(`${apiBase}/subscriptions`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setSubscriptions(data);
    } catch (err) {
      onToast(err.response?.data?.error || 'Failed to load subscriptions', 'error');
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
      onToast('Channel added! Next check runs at midnight.');
      await fetchSubscriptions();
    } catch (err) {
      onToast(err.response?.data?.error || 'Failed to add channel', 'error');
    } finally {
      setAddingChannel(false);
    }
  }

  async function handleDelete(sub) {
    try {
      await axios.delete(`${apiBase}/subscriptions/${sub.id}`, {
        headers: authHeaders(),
      });
      setConfirmDelete(null);
      onToast('Subscription removed');
      await fetchSubscriptions();
    } catch (err) {
      onToast(err.response?.data?.error || 'Failed to remove subscription', 'error');
    }
  }

  async function handleDownload(e) {
    e.preventDefault();
    if (!videoUrl.trim()) return;
    setDownloading(true);
    try {
      await axios.post(
        `${apiBase}/subscriptions/download-url`,
        { videoUrl: videoUrl.trim() },
        { headers: authHeaders() }
      );
      setVideoUrl('');
      onToast('Download started! Check your library in a few minutes.');
    } catch (err) {
      onToast(err.response?.data?.error || 'Failed to start download', 'error');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="subscriptions-manager">
      {/* ── Add Channel ─────────────────────────────────────────── */}
      <div className="subs-section">
        <h3 className="subs-heading">Add Channel</h3>
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
          <span className="subs-hint">New uploads checked daily at midnight</span>
        </h3>
        {subscriptions.length === 0 ? (
          <p className="subs-empty">No subscriptions yet.</p>
        ) : (
          <ul className="subs-list">
            {subscriptions.map((sub) => (
              <li key={sub.id} className="subs-item">
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
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => setConfirmDelete(sub)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Download by URL ─────────────────────────────────────── */}
      <div className="subs-section">
        <h3 className="subs-heading">Download Video</h3>
        <form className="subs-form" onSubmit={handleDownload}>
          <input
            className="subs-input"
            type="url"
            placeholder="YouTube video URL"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            required
          />
          <button className="btn btn-primary" type="submit" disabled={downloading}>
            {downloading ? 'Starting…' : 'Download Video'}
          </button>
        </form>
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
