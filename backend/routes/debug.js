const express = require('express');
const { execFile } = require('child_process');
const { statfs, access } = require('fs/promises');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pool } = require('../db');
const { optionalAuth, requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(optionalAuth, requireAuth);

// Helper: run a command, resolve to { ok, ... } — never rejects.
function runCmd(cmd, args, timeout = 5000) {
  return new Promise(resolve => {
    execFile(cmd, args, { timeout }, (err, stdout, stderr) => {
      if (err) resolve({ ok: false, detail: (stderr || err.message).trim().split('\n')[0] });
      else resolve({ ok: true, stdout: stdout.trim() });
    });
  });
}

// Helper: check if a file path exists and is executable.
async function checkPath(p) {
  try { await access(p, fs.constants.X_OK); return true; } catch { return false; }
}

// ── GET /api/debug/status ─────────────────────────────────────────────────────
router.get('/status', async (req, res) => {
  const uploadsDir = path.join(__dirname, '..', 'uploads');

  // Detect Docker: presence of /.dockerenv is the standard indicator.
  const inDocker = fs.existsSync('/.dockerenv');

  // Scan common binary locations so we can report exactly what's on disk
  // even when a binary exists but isn't in PATH.
  const knownPaths = {
    'yt-dlp': ['/usr/local/bin/yt-dlp', '/usr/bin/yt-dlp', '/opt/venv/bin/yt-dlp', '/usr/local/bin/yt-dlp3'],
    ffmpeg:   ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg-static'],
  };
  const foundOnDisk = {};
  for (const [name, paths] of Object.entries(knownPaths)) {
    for (const p of paths) {
      if (await checkPath(p)) { foundOnDisk[name] = p; break; }
    }
  }

  const [ytdlp, ffmpeg, db, disk] = await Promise.all([

    // yt-dlp
    runCmd('yt-dlp', ['--version']).then(r =>
      r.ok
        ? { ok: true, version: r.stdout }
        : { ...r, foundAt: foundOnDisk['yt-dlp'] || null }
    ),

    // ffmpeg — extract just the version string from the first line
    runCmd('ffmpeg', ['-version']).then(r => {
      if (!r.ok) return { ...r, foundAt: foundOnDisk['ffmpeg'] || null };
      const match = r.stdout.match(/ffmpeg version (\S+)/);
      return { ok: true, version: match ? match[1] : r.stdout.split('\n')[0] };
    }),

    // database
    pool.query('SELECT version() AS v')
      .then(({ rows }) => ({ ok: true, version: rows[0].v.split(',')[0] }))
      .catch(err => ({ ok: false, detail: err.message })),

    // disk — check the uploads volume; fall back to cwd if not mounted yet
    (async () => {
      for (const p of [uploadsDir, process.cwd()]) {
        try {
          const s = await statfs(p);
          const total = s.bsize * s.blocks;
          const free  = s.bsize * s.bavail;
          return { ok: true, totalBytes: total, freeBytes: free, usedBytes: total - free, path: p };
        } catch { /* try next */ }
      }
      return { ok: false, detail: 'Could not read disk stats' };
    })(),
  ]);

  // Count files owned by this user
  let fileCount = null;
  try {
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS n FROM files WHERE user_id = $1',
      [req.user.id]
    );
    fileCount = rows[0].n;
  } catch { /* non-critical */ }

  res.json({
    ytdlp,
    ffmpeg,
    db,
    disk,
    server: {
      ok: true,
      nodeVersion: process.version,
      platform: `${os.type()} ${os.release()} (${os.arch()})`,
      uptimeSeconds: Math.floor(process.uptime()),
      memUsedMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
      cpuCount: os.cpus().length,
      inDocker,
      PATH: process.env.PATH,
      cwd: process.cwd(),
    },
    fileCount,
  });
});

module.exports = router;
