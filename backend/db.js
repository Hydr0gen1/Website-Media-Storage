const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'mediastore',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

async function initDB() {
  const client = await pool.connect();
  try {
    // users must exist before files (files.user_id FK)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS files (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        filename VARCHAR(255) UNIQUE NOT NULL,
        original_filename VARCHAR(255) NOT NULL,
        file_type VARCHAR(50) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        size BIGINT NOT NULL,
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        file_path VARCHAR(500) NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS playlists (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, name)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS playlist_items (
        id SERIAL PRIMARY KEY,
        playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
        file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(playlist_id, file_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        channel_url VARCHAR(500) NOT NULL,
        channel_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, channel_url)
      )
    `);

    // ── Migrations ────────────────────────────────────────────────────────────
    // Rename files.userid → files.user_id if the table was created with the old name
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'files' AND column_name = 'userid'
        ) THEN
          ALTER TABLE files RENAME COLUMN userid TO user_id;
        END IF;
      END
      $$
    `);

    // Add user_id to subscriptions if it was somehow created without it
    await client.query(`
      ALTER TABLE IF EXISTS subscriptions
      ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
    `);

    // ── Indexes ───────────────────────────────────────────────────────────────
    await client.query(`CREATE INDEX IF NOT EXISTS idx_files_userid ON files(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sessions_userid ON sessions(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_playlists_userid ON playlists(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_playlistitems_playlistid ON playlist_items(playlist_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_playlistitems_fileid ON playlist_items(file_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_subscriptions_userid ON subscriptions(user_id)`);

    await client.query('DELETE FROM sessions WHERE expires_at < NOW()');

    console.log('Database initialized successfully');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
