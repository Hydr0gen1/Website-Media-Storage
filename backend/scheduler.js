const schedule = require('node-schedule');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { pool } = require('./db');
const { registerDownloadedFile } = require('./routes/subscriptions');

// Run yt-dlp for a channel subscription and register any new files.
async function processSubscription(sub) {
  const userDir = path.join(__dirname, 'uploads', `user_${sub.user_id}`);
  fs.mkdirSync(userDir, { recursive: true });

  const outputTemplate = path.join(userDir, '%(title)s.%(ext)s');
  const args = [
    sub.channel_url,
    '--dateafter', 'now-2d',   // only check last 48 hours — keeps frequent checks fast
    '-o', outputTemplate,
    '-f', 'best[ext=mp4]/best',
    '--merge-output-format', 'mp4',
    '--quiet',
    '--no-overwrites',
  ];

  // Snapshot directory before download to detect new files
  const before = new Set(
    fs.existsSync(userDir) ? fs.readdirSync(userDir) : []
  );

  await new Promise((resolve) => {
    execFile('yt-dlp', args, { timeout: 1800000 }, (err, _stdout, stderr) => {
      if (err) {
        console.error(
          `[scheduler] subscription ${sub.id} (user ${sub.user_id}) failed:`,
          stderr || err.message
        );
      }
      resolve();
    });
  });

  // Register files that weren't there before
  const after = fs.existsSync(userDir) ? fs.readdirSync(userDir) : [];
  const newFiles = after.filter(f => !before.has(f));

  for (const filename of newFiles) {
    const absPath = path.join(userDir, filename);
    await registerDownloadedFile(sub.user_id, filename, filename, absPath);
    console.log(`[scheduler] registered: user ${sub.user_id} — ${filename}`);
  }
}

// Check every 15 minutes for near-real-time new video detection
schedule.scheduleJob('*/15 * * * *', async () => {
  let subs;
  try {
    const result = await pool.query('SELECT * FROM subscriptions ORDER BY user_id');
    subs = result.rows;
  } catch (err) {
    console.error('[scheduler] Failed to fetch subscriptions:', err.message);
    return;
  }

  if (!subs.length) return; // nothing to do — skip noisy log
  console.log(`[scheduler] Checking ${subs.length} subscription(s) for new videos...`);

  for (const sub of subs) {
    await processSubscription(sub);
  }
  console.log('[scheduler] Subscription check complete');
});

console.log('[scheduler] Subscription job scheduled (runs every 15 minutes)');
