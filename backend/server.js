require('dotenv').config();

if (!process.env.DB_PASSWORD) {
  console.error('ERROR: DB_PASSWORD environment variable is not set. Refusing to start.');
  process.exit(1);
}

const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./db');
const filesRouter = require('./routes/files');
const authRouter = require('./routes/auth');
const playlistsRouter = require('./routes/playlists');

const app = express();
const server = http.createServer(app);
server.timeout = 600000;        // 10 minutes — covers finalize of large uploads
server.keepAliveTimeout = 620000;
const PORT = process.env.PORT || 3001;

if (process.env.NODE_ENV !== 'production') {
  app.use(cors({ origin: 'http://localhost:5173' }));
}
app.use(express.json());

// Serve uploaded files statically (fallback)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API routes
app.use('/api', filesRouter);
app.use('/api/auth', authRouter);
app.use('/api/playlists', playlistsRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve React frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'public')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

async function start() {
  try {
    await initDB();
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
