const express = require('express');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db');
const { optionalAuth, requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(optionalAuth, requireAuth);

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

const MIME_BY_EXT = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.flac': 'audio/flac',
  '.wav': 'audio/wav',
};

function getMime(filename) {
  const ext = path.extname(filename).toLowerCase();
  return MIME_BY_EXT[ext] || 'video/mp4';
}

function getFileType(mime) {
  if (mime.startsWith('audio/')) return 'audio';
  return 'video';
}

async function registerDownloadedFile(userId, storedName, originalName, absPath) {
  const mime = getMime(storedName);
  const fileType = getFileType(mime);
  const stats = fs.statSync(absPath);
  await pool.query(
    `INSERT INTO files (user_id, filename, original_filename, file_type, mime_type, size, file_path)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (filename) DO NOTHING`,
    [userId, storedName, originalName, fileType, mime, stats.size, absPath]
  );
}

function downloadVideo(videoUrl, userDir, extraArgs = []) {
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    const outputTemplate = path.join(userDir, `${id}.%(ext)s`);
    const args = [
      '--no-playlist',
      '--print', 'title',
      '-o', outputTemplate,
      ...extraArgs,
      videoUrl,
    ];
    execFile('yt-dlp', args, { timeout: 300000 }, (err, stdout) => {
      if (err) return reject(err);
      const title = stdout.trim().split('\n')[0] || 'Unknown title';
      const files = fs.readdirSync(userDir).filter(f => f.startsWith(id));
      if (files.length === 0) return reject(new Error('yt-dlp produced no output file'));
      const storedName = files[0];
      resolve({ title, storedName, absPath: path.join(userDir, storedName) });
    });
  });
}

// GET /api/subscriptions
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

// POST /api/subscriptions
router.post('/', async (req, res, next) => {
  try {
    const { channelUrl, channelName } = req.body;
    if (!channelUrl) return res.status(400).json({ error: 'channelUrl is required' });

    const result = await pool.query(
      `INSERT INTO subscriptions (user_id, channel_url, channel_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, channel_url) DO NOTHING
       RETURNING *`,
      [req.user.id, channelUrl, channelName || null]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'Already subscribed to this channel' });
    }
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/subscriptions/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      'DELETE FROM subscriptions WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    res.json({ message: 'Subscription removed' });
  } catch (err) {
    next(err);
  }
});

// POST /api/subscriptions/download-url
router.post('/download-url', async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });

    const userDir = UPLOADS_DIR;
    res.json({ status: 'downloading' });

    downloadVideo(url, userDir)
      .then(({ title, storedName, absPath }) =>
        registerDownloadedFile(req.user.id, storedName, title, absPath)
      )
      .catch(err => console.error('Background download failed:', err.message));
  } catch (err) {
    next(err);
  }
});

module.exports = { router, downloadVideo, registerDownloadedFile };
