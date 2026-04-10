const express = require('express');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { pool } = require('../db');
const { optionalAuth, requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(optionalAuth, requireAuth);

// ── File registration helper ──────────────────────────────────────────────────
// Called after yt-dlp finishes to insert the file record into the DB.
// storedName  — basename on disk (e.g. "<uuid>.mp4")
// originalName — human-readable title (e.g. "My Video.mp4")
// absPath      — absolute path to the file
async function registerDownloadedFile(userId, storedName, originalName, absPath) {
  const ext = path.extname(storedName).toLowerCase();
  const MIME = {
    '.mp4': 'video/mp4', '.webm': 'video/webm', '.mkv': 'video/x-matroska',
    '.mov': 'video/quicktime', '.avi': 'video/x-msvideo',
    '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg',
    '.wav': 'audio/wav', '.flac': 'audio/flac', '.aac': 'audio/aac',
  };
  const TYPE = {
    '.mp4': 'video', '.webm': 'video', '.mkv': 'video', '.mov': 'video', '.avi': 'video',
    '.mp3': 'audio', '.m4a': 'audio', '.ogg': 'audio', '.wav': 'audio',
    '.flac': 'audio', '.aac': 'audio',
  };
  const mimeType = MIME[ext] || 'video/mp4';
  const fileType = TYPE[ext] || 'video';

  let size = 0;
  try { size = fs.statSync(absPath).size; } catch { return; }

  try {
    await pool.query(
      `INSERT INTO files (user_id, filename, original_filename, file_type, mime_type, size, file_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (filename) DO NOTHING`,
      [userId, storedName, originalName, fileType, mimeType, size, absPath]
    );
  } catch (err) {
    console.error('registerDownloadedFile DB error:', err.message);
  }
}

// Run yt-dlp and return { title, storedName, absPath } for the downloaded file.
// Downloads into userDir using a UUID-prefixed output template so we can find
// the file reliably even after yt-dlp sanitises the filename.
function downloadVideo(videoUrl, userDir, extraArgs = []) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(userDir, { recursive: true });
    const uuid = crypto.randomUUID();
    const outputTemplate = path.join(userDir, `${uuid}.%(ext)s`);

    const args = [
      videoUrl,
      '--print', 'title',
      '--no-simulate',       // prevent yt-dlp from entering simulation mode when --print is used
      '-o', outputTemplate,
      '--no-playlist',
      '-f', 'best[ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '--quiet',
      ...extraArgs,
    ];

    execFile('yt-dlp', args, { timeout: 300000 }, (err, stdout, stderr) => {
      if (err) { return reject(new Error(stderr || err.message)); }

      const title = stdout.trim().split('\n')[0] || 'download';

      // Find the file yt-dlp wrote (starts with our uuid)
      let entries;
      try { entries = fs.readdirSync(userDir).filter(f => f.startsWith(uuid)); }
      catch { return reject(new Error('Could not read user upload directory')); }

      if (!entries.length) return reject(new Error('yt-dlp finished but no output file found'));

      const storedName = entries[0];
      const ext = path.extname(storedName);
      const absPath = path.join(userDir, storedName);
      resolve({ title: `${title}${ext}`, storedName, absPath });
    });
  });
}

// ── GET /api/subscriptions ────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/subscriptions ───────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { channelUrl, channelName } = req.body;
    if (!channelUrl) return res.status(400).json({ error: 'channelUrl is required' });

    // Basic URL validation
    try { new URL(channelUrl); } catch {
      return res.status(400).json({ error: 'channelUrl must be a valid URL' });
    }

    const result = await pool.query(
      `INSERT INTO subscriptions (user_id, channel_url, channel_name)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.user.id, channelUrl, channelName || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Already subscribed to this channel' });
    }
    next(err);
  }
});

// ── DELETE /api/subscriptions/:id ────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      'DELETE FROM subscriptions WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    res.json({ message: 'Subscription removed' });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/subscriptions/:id/videos ────────────────────────────────────────
// Returns up to 20 recent videos from a channel without downloading them.
// Uses yt-dlp's --flat-playlist to enumerate quickly.
router.get('/:id/videos', async (req, res, next) => {
  try {
    const sub = await pool.query(
      'SELECT * FROM subscriptions WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!sub.rows.length) return res.status(404).json({ error: 'Subscription not found' });

    const { channel_url } = sub.rows[0];

    const videos = await new Promise((resolve, reject) => {
      const args = [
        channel_url,
        '--flat-playlist',
        '--playlist-end', '20',
        '--print', '%(id)s\t%(title)s\t%(duration)s\t%(upload_date)s',
        '--no-warnings',
        '--quiet',
      ];
      execFile('yt-dlp', args, { timeout: 30000 }, (err, stdout, stderr) => {
        if (err && !stdout) return reject(new Error(stderr || err.message));
        const items = stdout.trim().split('\n').filter(Boolean).map(line => {
          const [id, title, duration, uploadDate] = line.split('\t');
          return {
            id,
            title: title || id,
            duration: parseInt(duration, 10) || null,
            uploadDate: uploadDate || null,
            url: `https://www.youtube.com/watch?v=${id}`,
          };
        });
        resolve(items);
      });
    });

    res.json(videos);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/subscriptions/download-url ─────────────────────────────────────
router.post('/download-url', async (req, res) => {
  const { videoUrl } = req.body;
  if (!videoUrl) return res.status(400).json({ error: 'videoUrl is required' });
  try { new URL(videoUrl); } catch {
    return res.status(400).json({ error: 'videoUrl must be a valid URL' });
  }

  const userId = req.user.id;
  const userDir = path.join(__dirname, '..', 'uploads', `user_${userId}`);

  // Return immediately — download runs in the background
  res.json({ status: 'downloading', videoUrl });

  downloadVideo(videoUrl, userDir)
    .then(({ title, storedName, absPath }) =>
      registerDownloadedFile(userId, storedName, title, absPath)
    )
    .catch(err => console.error(`[download-url] user ${userId}: ${err.message}`));
});

module.exports = { router, downloadVideo, registerDownloadedFile };
