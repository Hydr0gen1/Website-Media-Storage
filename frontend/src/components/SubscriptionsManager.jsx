import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

export default function SubscriptionsManager({ apiBase, authToken, onToast }) {
  const [subscriptions, setSubscriptions] = useState([]);
  const [channelUrl, setChannelUrl] = useState('');
  const [channelName, setChannelName] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchSubscriptions = useCallback(async () => {
    try {
      const res = await axios.get(`${apiBase}/subscriptions`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setSubscriptions(res.data);
    } catch (err) {
      onToast(err.response?.data?.error || 'Failed to load subscriptions', 'error');
    }
  }, [apiBase, authToken, onToast]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  async function handleAddSubscription(e) {
    e.preventDefault();
    if (!channelUrl.trim()) return;
    setAdding(true);
    try {
      await axios.post(
        `${apiBase}/subscriptions`,
        { channelUrl: channelUrl.trim(), channelName: channelName.trim() || undefined },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      setChannelUrl('');
      setChannelName('');
      onToast('Subscription added', 'success');
      fetchSubscriptions();
    } catch (err) {
      onToast(err.response?.data?.error || 'Failed to add subscription', 'error');
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id) {
    try {
      await axios.delete(`${apiBase}/subscriptions/${id}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setDeleteConfirm(null);
      onToast('Subscription removed', 'success');
      fetchSubscriptions();
    } catch (err) {
      onToast(err.response?.data?.error || 'Failed to remove subscription', 'error');
    }
  }

  async function handleDownloadUrl(e) {
    e.preventDefault();
    if (!downloadUrl.trim()) return;
    setDownloading(true);
    try {
      await axios.post(
        `${apiBase}/subscriptions/download-url`,
        { url: downloadUrl.trim() },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      setDownloadUrl('');
      onToast('Download started in background', 'success');
    } catch (err) {
      onToast(err.response?.data?.error || 'Failed to start download', 'error');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="subscriptions-manager">
      <section className="sub-section">
        <h3>Download Video / Audio</h3>
        <form onSubmit={handleDownloadUrl} className="sub-form">
          <input
            type="url"
            placeholder="YouTube or other URL"
            value={downloadUrl}
            onChange={e => setDownloadUrl(e.target.value)}
            required
          />
          <button type="submit" disabled={downloading}>
            {downloading ? 'Starting...' : 'Download'}
          </button>
        </form>
      </section>

      <section className="sub-section">
        <h3>Channel Subscriptions</h3>
        <form onSubmit={handleAddSubscription} className="sub-form">
          <input
            type="url"
            placeholder="Channel URL"
            value={channelUrl}
            onChange={e => setChannelUrl(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Channel name (optional)"
            value={channelName}
            onChange={e => setChannelName(e.target.value)}
          />
          <button type="submit" disabled={adding}>
            {adding ? 'Adding...' : 'Subscribe'}
          </button>
        </form>

        {subscriptions.length === 0 ? (
          <p className="empty-state">No subscriptions yet.</p>
        ) : (
          <ul className="sub-list">
            {subscriptions.map(sub => (
              <li key={sub.id} className="sub-item">
                <div className="sub-info">
                  <span className="sub-name">{sub.channel_name || sub.channel_url}</span>
                  {sub.channel_name && (
                    <span className="sub-url">{sub.channel_url}</span>
                  )}
                </div>
                {deleteConfirm === sub.id ? (
                  <span className="sub-confirm">
                    Remove?{' '}
                    <button onClick={() => handleDelete(sub.id)}>Yes</button>{' '}
                    <button onClick={() => setDeleteConfirm(null)}>No</button>
                  </span>
                ) : (
                  <button
                    className="sub-delete"
                    onClick={() => setDeleteConfirm(sub.id)}
                    title="Remove subscription"
                  >
                    &times;
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
