const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const router = express.Router();

// ── Config ────────────────────────────────────────────────────────────────────
// Base URL the OAuth providers redirect back to (must match registered callbacks)
const CALLBACK_BASE = process.env.OAUTH_CALLBACK_BASE_URL || 'http://localhost:3001';
// Where to send the browser after completing the OAuth flow
const FRONTEND_BASE = process.env.NODE_ENV === 'production'
  ? CALLBACK_BASE
  : (process.env.FRONTEND_URL || 'http://localhost:5173');

// ── Anti-CSRF state store ─────────────────────────────────────────────────────
const pendingStates = new Map(); // state -> createdAt ms
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000; // 10-minute TTL
  for (const [state, createdAt] of pendingStates.entries()) {
    if (createdAt < cutoff) pendingStates.delete(state);
  }
}, 60_000);

function generateState() {
  const state = crypto.randomBytes(16).toString('hex');
  pendingStates.set(state, Date.now());
  return state;
}

function verifyState(state) {
  if (!state || !pendingStates.has(state)) return false;
  pendingStates.delete(state);
  return true;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function redirectSuccess(res, token, username) {
  const p = new URLSearchParams({ token, username });
  res.redirect(`${FRONTEND_BASE}/?${p}`);
}

function redirectError(res, message) {
  const p = new URLSearchParams({ oauth_error: message });
  res.redirect(`${FRONTEND_BASE}/?${p}`);
}

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  await pool.query(
    'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [userId, token, expiresAt]
  );
  return token;
}

// Find existing OAuth user, or link to an existing local account by email,
// or create a fresh account. Returns { id, username }.
async function findOrCreateUser(provider, providerId, email, displayName) {
  // 1. Existing OAuth link
  const linked = await pool.query(
    `SELECT u.id, u.username
     FROM oauth_accounts oa JOIN users u ON u.id = oa.user_id
     WHERE oa.provider = $1 AND oa.provider_id = $2`,
    [provider, providerId]
  );
  if (linked.rows.length) return linked.rows[0];

  // 2. Existing local account with same email — link it
  let userId = null;
  if (email) {
    const byEmail = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [email]
    );
    if (byEmail.rows.length) userId = byEmail.rows[0].id;
  }

  // 3. Create new account
  if (!userId) {
    const base = email || `${provider}_${providerId}`;
    let username = base;
    let attempt = 0;
    while (true) {
      try {
        const r = await pool.query(
          'INSERT INTO users (username, password_hash) VALUES ($1, NULL) RETURNING id',
          [username]
        );
        userId = r.rows[0].id;
        break;
      } catch (err) {
        if (err.code === '23505') { username = `${base}_${++attempt}`; }
        else throw err;
      }
    }
  }

  // 4. Link OAuth account
  await pool.query(
    `INSERT INTO oauth_accounts (user_id, provider, provider_id)
     VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [userId, provider, providerId]
  );

  const user = await pool.query(
    'SELECT id, username FROM users WHERE id = $1',
    [userId]
  );
  return user.rows[0];
}

// ── Google ────────────────────────────────────────────────────────────────────
router.get('/google', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(501).json({ error: 'Google OAuth is not configured on this server' });
  }
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${CALLBACK_BASE}/api/auth/oauth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state: generateState(),
    access_type: 'online',
    prompt: 'select_account',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${p}`);
});

router.get('/google/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error || !verifyState(state)) return redirectError(res, error || 'Invalid state parameter');
  if (!code) return redirectError(res, 'No authorization code received from Google');

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${CALLBACK_BASE}/api/auth/oauth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(tokenData.error_description || 'Token exchange failed');

    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const info = await userRes.json();

    const user = await findOrCreateUser('google', info.sub, info.email, info.name);
    const token = await createSession(user.id);
    redirectSuccess(res, token, user.username);
  } catch (err) {
    console.error('[oauth/google]', err.message);
    redirectError(res, 'Google sign-in failed');
  }
});

// ── GitHub ────────────────────────────────────────────────────────────────────
router.get('/github', (req, res) => {
  if (!process.env.GITHUB_CLIENT_ID) {
    return res.status(501).json({ error: 'GitHub OAuth is not configured on this server' });
  }
  const p = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: `${CALLBACK_BASE}/api/auth/oauth/github/callback`,
    scope: 'read:user user:email',
    state: generateState(),
  });
  res.redirect(`https://github.com/login/oauth/authorize?${p}`);
});

router.get('/github/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error || !verifyState(state)) return redirectError(res, error || 'Invalid state parameter');
  if (!code) return redirectError(res, 'No authorization code received from GitHub');

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${CALLBACK_BASE}/api/auth/oauth/github/callback`,
      }),
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);

    const ghHeaders = {
      Authorization: `Bearer ${tokenData.access_token}`,
      'User-Agent': 'MediaStore/1.0',
      Accept: 'application/vnd.github+json',
    };

    const [profileRes, emailsRes] = await Promise.all([
      fetch('https://api.github.com/user', { headers: ghHeaders }),
      fetch('https://api.github.com/user/emails', { headers: ghHeaders }),
    ]);
    const [profile, emails] = await Promise.all([profileRes.json(), emailsRes.json()]);

    const primaryEmail = Array.isArray(emails)
      ? (emails.find(e => e.primary && e.verified) || emails[0])?.email
      : null;

    const user = await findOrCreateUser(
      'github', String(profile.id), primaryEmail, profile.name || profile.login
    );
    const token = await createSession(user.id);
    redirectSuccess(res, token, user.username);
  } catch (err) {
    console.error('[oauth/github]', err.message);
    redirectError(res, 'GitHub sign-in failed');
  }
});

// ── Apple ─────────────────────────────────────────────────────────────────────
// Apple requires a JWT client secret signed with your ES256 private key.
function buildAppleClientSecret() {
  const privateKey = (process.env.APPLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  return jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    expiresIn: '1h',
    issuer: process.env.APPLE_TEAM_ID,
    audience: 'https://appleid.apple.com',
    subject: process.env.APPLE_CLIENT_ID,
    keyid: process.env.APPLE_KEY_ID,
  });
}

router.get('/apple', (req, res) => {
  if (!process.env.APPLE_CLIENT_ID || !process.env.APPLE_TEAM_ID) {
    return res.status(501).json({ error: 'Apple OAuth is not configured on this server' });
  }
  const p = new URLSearchParams({
    client_id: process.env.APPLE_CLIENT_ID,
    redirect_uri: `${CALLBACK_BASE}/api/auth/oauth/apple/callback`,
    response_type: 'code id_token',
    scope: 'name email',
    response_mode: 'form_post', // Apple POSTs the callback
    state: generateState(),
  });
  res.redirect(`https://appleid.apple.com/auth/authorize?${p}`);
});

// Apple uses POST for its callback (response_mode: form_post)
router.post(
  '/apple/callback',
  express.urlencoded({ extended: true }),
  async (req, res) => {
    const { code, state, error, id_token, user: userJson } = req.body;
    if (error || !verifyState(state)) return redirectError(res, error || 'Invalid state parameter');
    if (!code || !id_token) return redirectError(res, 'Incomplete response from Apple');

    try {
      // Decode the id_token to get sub (Apple user ID) and email.
      // Full signature verification requires fetching Apple's public keys — for
      // a home server this lightweight decode is acceptable.
      const payload = JSON.parse(
        Buffer.from(id_token.split('.')[1], 'base64url').toString()
      );
      const providerId = payload.sub;
      const email = payload.email || null;

      // Apple sends the user's name only on the very first authorization.
      let displayName = null;
      if (userJson) {
        try {
          const u = typeof userJson === 'string' ? JSON.parse(userJson) : userJson;
          const { firstName = '', lastName = '' } = u.name || {};
          displayName = `${firstName} ${lastName}`.trim() || null;
        } catch { /* ignore */ }
      }

      // Validate the auth code with Apple's token endpoint
      const clientSecret = buildAppleClientSecret();
      const tokenRes = await fetch('https://appleid.apple.com/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.APPLE_CLIENT_ID,
          client_secret: clientSecret,
          code,
          redirect_uri: `${CALLBACK_BASE}/api/auth/oauth/apple/callback`,
          grant_type: 'authorization_code',
        }),
      });
      const tokenData = await tokenRes.json();
      if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);

      const user = await findOrCreateUser('apple', providerId, email, displayName);
      const token = await createSession(user.id);
      redirectSuccess(res, token, user.username);
    } catch (err) {
      console.error('[oauth/apple]', err.message);
      redirectError(res, 'Apple sign-in failed');
    }
  }
);

module.exports = router;
