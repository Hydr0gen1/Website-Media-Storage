const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { pool } = require('../db');

const BCRYPT_ROUNDS = 10;
const SESSION_DAYS = 30;

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function formatUser(u) {
  return { id: u.id, username: u.username, createdAt: u.created_at };
}

async function register(req, res, next) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    if (username.length < 2 || username.length > 64) {
      return res.status(400).json({ error: 'Username must be 2–64 characters' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const result = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING *',
      [username, hash]
    );

    const user = result.rows[0];
    const token = generateToken();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400 * 1000);

    await pool.query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );

    res.status(201).json({ user: formatUser(user), token });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (!result.rows.length) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400 * 1000);

    await pool.query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );

    res.json({ user: formatUser(user), token });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
      const token = header.slice(7);
      await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
    }
    res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
}

async function me(req, res) {
  res.json({ user: req.user });
}

module.exports = { register, login, logout, me };
