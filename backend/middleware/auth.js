const { pool } = require('../db');

/**
 * Attaches req.user if a valid session token is present.
 * Never rejects — use requireAuth for protected routes.
 */
async function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return next();

  const token = header.slice(7);
  try {
    const result = await pool.query(
      `SELECT s.user_id, u.username
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = $1 AND s.expires_at > NOW()`,
      [token]
    );
    if (result.rows.length) {
      req.user = { id: result.rows[0].user_id, username: result.rows[0].username };
    }
  } catch {
    // ignore DB errors — treat as unauthenticated
  }
  next();
}

/**
 * Rejects with 401 if no valid session is attached.
 */
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  next();
}

module.exports = { optionalAuth, requireAuth };
