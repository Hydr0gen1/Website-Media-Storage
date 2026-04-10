import { useState, useCallback } from 'react';
import axios from 'axios';

function fmt(bytes) {
  if (bytes == null) return '—';
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)} TB`;
  if (bytes >= 1e9)  return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6)  return `${(bytes / 1e6).toFixed(0)} MB`;
  return `${(bytes / 1e3).toFixed(0)} KB`;
}

function fmtUptime(s) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

function StatusDot({ ok }) {
  return <span className={`debug-dot ${ok ? 'debug-dot-ok' : 'debug-dot-fail'}`} />;
}

function CheckCard({ title, data, children }) {
  if (!data) return (
    <div className="debug-card">
      <div className="debug-card-header">
        <span className="debug-dot debug-dot-loading" />
        <span className="debug-card-title">{title}</span>
      </div>
    </div>
  );
  return (
    <div className={`debug-card ${data.ok ? '' : 'debug-card-fail'}`}>
      <div className="debug-card-header">
        <StatusDot ok={data.ok} />
        <span className="debug-card-title">{title}</span>
        <span className="debug-card-status">{data.ok ? 'OK' : 'FAIL'}</span>
      </div>
      {children}
      {!data.ok && data.detail && (
        <div className="debug-card-error">{data.detail}</div>
      )}
    </div>
  );
}

export default function DebugPanel({ apiBase, authToken, onClose }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get(`${apiBase}/debug/status`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setStatus(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  }, [apiBase, authToken]);

  // Fetch on first open
  useState(() => { refresh(); }, []);

  const d = status;
  const diskPct = d?.disk?.ok
    ? Math.round((d.disk.usedBytes / d.disk.totalBytes) * 100)
    : null;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="debug-panel" onClick={e => e.stopPropagation()}>

        <div className="debug-panel-header">
          <h2 className="debug-panel-title">System Status</h2>
          <div className="debug-panel-actions">
            <button
              className="btn btn-ghost btn-sm"
              onClick={refresh}
              disabled={loading}
            >
              {loading ? 'Checking…' : 'Refresh'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
          </div>
        </div>

        {error && <div className="debug-error-banner">{error}</div>}

        <div className="debug-grid">

          {/* yt-dlp */}
          <CheckCard title="yt-dlp" data={d?.ytdlp}>
            {d?.ytdlp?.ok && (
              <div className="debug-card-detail">Version {d.ytdlp.version}</div>
            )}
          </CheckCard>

          {/* ffmpeg */}
          <CheckCard title="ffmpeg" data={d?.ffmpeg}>
            {d?.ffmpeg?.ok && (
              <div className="debug-card-detail">Version {d.ffmpeg.version}</div>
            )}
          </CheckCard>

          {/* Database */}
          <CheckCard title="Database" data={d?.db}>
            {d?.db?.ok && (
              <div className="debug-card-detail">{d.db.version}</div>
            )}
          </CheckCard>

          {/* Disk */}
          <CheckCard title="Disk" data={d?.disk}>
            {d?.disk?.ok && (
              <>
                <div className="debug-disk-bar">
                  <div
                    className="debug-disk-fill"
                    style={{ width: `${diskPct}%`, background: diskPct > 90 ? 'var(--error)' : diskPct > 70 ? 'var(--warning)' : 'var(--success)' }}
                  />
                </div>
                <div className="debug-card-detail">
                  {fmt(d.disk.usedBytes)} used / {fmt(d.disk.totalBytes)} total
                  &nbsp;·&nbsp;{fmt(d.disk.freeBytes)} free ({diskPct}% used)
                </div>
              </>
            )}
          </CheckCard>

          {/* Server */}
          <CheckCard title="Server" data={d?.server}>
            {d?.server?.ok && (
              <div className="debug-card-detail">
                <div>Node {d.server.nodeVersion} · {d.server.platform}</div>
                <div>Uptime {fmtUptime(d.server.uptimeSeconds)} · {d.server.memUsedMB} MB RSS · {d.server.cpuCount} CPU</div>
              </div>
            )}
          </CheckCard>

          {/* Files */}
          {d?.fileCount != null && (
            <div className="debug-card">
              <div className="debug-card-header">
                <span className="debug-dot debug-dot-ok" />
                <span className="debug-card-title">Your Files</span>
                <span className="debug-card-status">OK</span>
              </div>
              <div className="debug-card-detail">{d.fileCount} file{d.fileCount !== 1 ? 's' : ''} in library</div>
            </div>
          )}

        </div>

        {!d && !loading && !error && (
          <p className="debug-empty">Press Refresh to run diagnostics.</p>
        )}
      </div>
    </div>
  );
}
