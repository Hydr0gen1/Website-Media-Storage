const { pool } = require('../db');

function formatPlaylist(p) {
  return {
    id: p.id,
    userId: p.user_id,
    name: p.name,
    type: p.type,
    description: p.description || null,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    itemCount: p.itemcount !== undefined ? parseInt(p.itemcount, 10) : undefined,
  };
}

function formatItem(row) {
  return {
    id: row.item_id,
    position: row.position,
    file: {
      id: row.file_id,
      filename: row.filename,
      originalFilename: row.original_filename,
      fileType: row.file_type,
      mimeType: row.mime_type,
      size: row.size,
      uploadDate: row.upload_date,
    },
  };
}

async function createPlaylist(req, res, next) {
  try {
    const { name, type, description } = req.body;
    if (!name || !type) {
      return res.status(400).json({ error: 'name and type are required' });
    }
    if (!['audio', 'video'].includes(type)) {
      return res.status(400).json({ error: 'type must be "audio" or "video"' });
    }

    const result = await pool.query(
      `INSERT INTO playlists (user_id, name, type, description)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.id, name, type, description || null]
    );
    res.status(201).json(formatPlaylist(result.rows[0]));
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A playlist with that name already exists' });
    }
    next(err);
  }
}

async function listPlaylists(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT p.*, COUNT(pi.id)::int AS itemcount
       FROM playlists p
       LEFT JOIN playlist_items pi ON pi.playlist_id = p.id
       WHERE p.user_id = $1
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows.map(formatPlaylist));
  } catch (err) {
    next(err);
  }
}

async function getPlaylist(req, res, next) {
  try {
    const { id } = req.params;
    const pResult = await pool.query(
      'SELECT * FROM playlists WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (!pResult.rows.length) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    const itemsResult = await pool.query(
      `SELECT pi.id AS item_id, pi.position,
              f.id AS file_id, f.filename, f.original_filename,
              f.file_type, f.mime_type, f.size, f.upload_date
       FROM playlist_items pi
       JOIN files f ON f.id = pi.file_id
       WHERE pi.playlist_id = $1
       ORDER BY pi.position ASC`,
      [id]
    );

    const playlist = formatPlaylist(pResult.rows[0]);
    playlist.items = itemsResult.rows.map(formatItem);
    res.json(playlist);
  } catch (err) {
    next(err);
  }
}

async function updatePlaylist(req, res, next) {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const result = await pool.query(
      `UPDATE playlists SET name = $1, description = $2, updated_at = NOW()
       WHERE id = $3 AND user_id = $4 RETURNING *`,
      [name, description || null, id, req.user.id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Playlist not found' });
    }
    res.json(formatPlaylist(result.rows[0]));
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A playlist with that name already exists' });
    }
    next(err);
  }
}

async function deletePlaylist(req, res, next) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM playlists WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Playlist not found' });
    }
    res.json({ message: 'Playlist deleted' });
  } catch (err) {
    next(err);
  }
}

async function addItem(req, res, next) {
  try {
    const { id } = req.params;
    const { fileId } = req.body;
    if (!fileId) return res.status(400).json({ error: 'fileId is required' });

    // Verify playlist belongs to user
    const pl = await pool.query(
      'SELECT * FROM playlists WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (!pl.rows.length) return res.status(404).json({ error: 'Playlist not found' });

    // Verify file exists and belongs to this user
    const file = await pool.query(
      'SELECT id FROM files WHERE id = $1 AND user_id = $2',
      [fileId, req.user.id]
    );
    if (!file.rows.length) return res.status(404).json({ error: 'File not found' });

    // Next position = current count
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM playlist_items WHERE playlist_id = $1',
      [id]
    );
    const position = parseInt(countResult.rows[0].count, 10);

    const result = await pool.query(
      `INSERT INTO playlist_items (playlist_id, file_id, position)
       VALUES ($1, $2, $3) RETURNING *`,
      [id, fileId, position]
    );
    res.status(201).json({ id: result.rows[0].id, position: result.rows[0].position });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'File already in playlist' });
    }
    next(err);
  }
}

async function removeItem(req, res, next) {
  try {
    const { id, fileId } = req.params;

    // Verify playlist belongs to user
    const pl = await pool.query(
      'SELECT id FROM playlists WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (!pl.rows.length) return res.status(404).json({ error: 'Playlist not found' });

    const result = await pool.query(
      'DELETE FROM playlist_items WHERE playlist_id = $1 AND file_id = $2 RETURNING id',
      [id, fileId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Item not found in playlist' });
    }
    res.json({ message: 'Item removed from playlist' });
  } catch (err) {
    next(err);
  }
}

// Reorder all items at once — body: { orderedFileIds: [3, 7, 1, ...] }
async function reorderItems(req, res, next) {
  try {
    const { id } = req.params;
    const { orderedFileIds } = req.body;

    if (!Array.isArray(orderedFileIds)) {
      return res.status(400).json({ error: 'orderedFileIds must be an array' });
    }

    // Verify playlist belongs to user
    const pl = await pool.query(
      'SELECT id FROM playlists WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (!pl.rows.length) return res.status(404).json({ error: 'Playlist not found' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (let i = 0; i < orderedFileIds.length; i++) {
        await client.query(
          'UPDATE playlist_items SET position = $1 WHERE playlist_id = $2 AND file_id = $3',
          [i, id, orderedFileIds[i]]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.json({ message: 'Playlist reordered' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createPlaylist,
  listPlaylists,
  getPlaylist,
  updatePlaylist,
  deletePlaylist,
  addItem,
  removeItem,
  reorderItems,
};
