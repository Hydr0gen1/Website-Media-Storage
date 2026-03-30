const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const schedule = require('node-schedule');
const { pool } = require('./db');
const { registerDownloadedFile } = require('./routes/subscriptions');

const UPLOADS_DIR = path.join(__dirname, 'uploads');

async function checkSubscriptions() {
  console.log('[scheduler] Running daily subscription check');
  let subs;
  try {
    const result = await pool.query('SELECT * FROM subscriptions');
    subs = result.rows;
  } catch (err) {
    console.error('[scheduler] Failed to fetch subscriptions:', err.message);
    return;
  }

  for (const sub of subs) {
    try {
      const before = new Set(fs.readdirSync(UPLOADS_DIR));
      await new Promise((resolve, reject) => {
        execFile(
          'yt-dlp',
          [
            '--dateafter', 'now-7d',
            '--no-overwrites',
            '-o', path.join(UPLOADS_DIR, '%(id)s.%(ext)s'),
            sub.channel_url,
          ],
          { timeout: 30 * 60 * 1000 },
          (err) => (err ? reject(err) : resolve())
        );
      });
      const after = fs.readdirSync(UPLOADS_DIR);
      const newFiles = after.filter(f => !before.has(f) && !f.startsWith('.'));
      for (const storedName of newFiles) {
        const absPath = path.join(UPLOADS_DIR, storedName);
        const originalName = storedName.replace(/^[^.]+\./, `${sub.channel_name || 'download'}.`);
        await registerDownloadedFile(sub.user_id, storedName, originalName, absPath);
      }
    } catch (err) {
      console.error(`[scheduler] Error processing subscription ${sub.id}:`, err.message);
    }
  }
}

// Run daily at midnight
schedule.scheduleJob('0 0 * * *', checkSubscriptions);

console.log('[scheduler] Daily subscription check scheduled');
