import { useState } from 'react';
import axios from 'axios';

export default function VideoDownloader({ apiBase, authToken, onToast }) {
  const [videoUrl, setVideoUrl] = useState('');
  const [downloading, setDownloading] = useState(false);

  const authHeaders = () => authToken ? { Authorization: `Bearer ${authToken}` } : {};

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

  if (!authToken) {
    return (
      <div className="subscriptions-manager">
        <div className="subs-section">
          <p className="subs-empty">Please log in to download videos.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="subscriptions-manager">
      <div className="subs-section">
        <h3 className="subs-heading">Download a Video</h3>
        <p className="subs-empty" style={{ marginBottom: 'var(--spacing-sm)' }}>
          Paste a YouTube URL below. The video will be downloaded in the background
          and appear in your Files library when finished.
        </p>
        <form className="subs-form" onSubmit={handleDownload}>
          <input
            className="subs-input"
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            required
          />
          <button className="btn btn-primary" type="submit" disabled={downloading}>
            {downloading ? 'Starting…' : 'Download'}
          </button>
        </form>
      </div>
    </div>
  );
}
