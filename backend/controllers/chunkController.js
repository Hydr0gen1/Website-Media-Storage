const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pool } = require('../db');

const CHUNK_DIR = path.join(__dirname, '..', 'uploads', '.chunks');

// Ensure chunk directory exists at module load
fs.mkdirSync(CHUNK_DIR, { recursive: true });

// In-memory upload session store
const uploadSessions = new Map();

const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

// Cleanup expired sessions every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of uploadSessions.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      for (const chunkIdx of session.uploadedChunks) {
        fs.unlink(path.join(CHUNK_DIR, `${id}-${chunkIdx}`), () => {});
      }
      uploadSessions.delete(id);
    }
  }
}, 30 * 60 * 1000); // run every 30 minutes

function formatFileRecord(f) {
  return {
    id: f.id,
    filename: f.filename,
    originalFilename: f.original_filename,
    fileType: f.file_type,
    mimeType: f.mime_type,
    size: f.size,
    uploadDate: f.upload_date,
  };
}

const MIME_TO_TYPE = {
  // Video
  'video/quicktime': 'video',
  'video/mp4': 'video',
  'video/webm': 'video',
  'video/avi': 'video',
  'video/x-msvideo': 'video',
  'video/x-matroska': 'video',
  // Audio
  'audio/mpeg': 'audio',
  'audio/mp3': 'audio',
  'audio/wav': 'audio',
  'audio/wave': 'audio',
  'audio/x-wav': 'audio',
  'audio/ogg': 'audio',
  'audio/flac': 'audio',
  'audio/aac': 'audio',
  'audio/mp4': 'audio',
  'audio/x-m4a': 'audio',
  'video/ogg': 'audio',
  // Image
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/svg+xml': 'image',
  'image/webp': 'image',
  'image/heic': 'image',
  'image/heif': 'image',
  'image/avif': 'image',
  'image/bmp': 'image',
  'image/tiff': 'image',
  'image/x-icon': 'image',
};

function getFileType(mimeType, filename) {
  if (MIME_TO_TYPE[mimeType]) return MIME_TO_TYPE[mimeType];
  const ext = path.extname(filename).toLowerCase();
  if (['.mp4', '.mov', '.webm', '.avi', '.mkv'].includes(ext)) return 'video';
  if (['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'].includes(ext)) return 'audio';
  if (['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.heic', '.heif', '.avif', '.bmp', '.tiff', '.ico'].includes(ext)) return 'image';
  return null;
}

async function uploadChunk(req, res, next) {
  try {
    const { uploadId, chunkIndex, totalChunks, originalFilename } = req.body;

    if (!req.file || !uploadId || chunkIndex === undefined || !totalChunks || !originalFilename) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate uploadId format to prevent path traversal
    if (!uploadId || !/^[-\w.]+$/.test(uploadId)) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'Invalid uploadId format' });
    }

    const idx = parseInt(chunkIndex, 10);
    const total = parseInt(totalChunks, 10);

    if (isNaN(idx) || isNaN(total) || idx < 0 || idx >= total) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'Invalid chunkIndex or totalChunks' });
    }

    if (!uploadSessions.has(uploadId)) {
      uploadSessions.set(uploadId, {
        uploadId,
        originalFilename,
        totalChunks: total,
        uploadedChunks: new Set(),
        createdAt: Date.now(),
        fileExt: path.extname(originalFilename).toLowerCase(),
        userId: req.user?.id,
      });
    }

    const session = uploadSessions.get(uploadId);

    // Reject if a different user tries to resume another user's session
    if (session.userId !== req.user?.id) {
      fs.unlink(req.file.path, () => {});
      return res.status(403).json({ error: 'Forbidden' });
    }

    const chunkPath = path.join(CHUNK_DIR, `${uploadId}-${idx}`);
    fs.renameSync(req.file.path, chunkPath);
    session.uploadedChunks.add(idx);

    const allChunksReceived = session.uploadedChunks.size === session.totalChunks;

    res.json({
      uploadId,
      chunkIndex: idx,
      totalChunks: session.totalChunks,
      uploadedChunks: session.uploadedChunks.size,
      allChunksReceived,
      message: allChunksReceived
        ? 'All chunks received, ready to finalize'
        : `Chunk ${idx} received`,
    });
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
    next(err);
  }
}

async function finalizeChunkedUpload(req, res, next) {
  const { uploadId, originalFilename, mimeType } = req.body;

  // Validate uploadId format to prevent path traversal
  if (!uploadId || !/^[-\w.]+$/.test(uploadId)) {
    return res.status(400).json({ error: 'Invalid uploadId format' });
  }

  let finalPath;
  try {
    if (!uploadId || !uploadSessions.has(uploadId)) {
      return res.status(400).json({ error: 'Invalid or expired upload session' });
    }

    const session = uploadSessions.get(uploadId);

    if (session.userId !== req.user?.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (session.uploadedChunks.size !== session.totalChunks) {
      return res.status(400).json({
        error: `Missing chunks. Received ${session.uploadedChunks.size}, expected ${session.totalChunks}`,
      });
    }

    // Verify all expected chunk files exist before starting merge
    for (let i = 0; i < session.totalChunks; i++) {
      const chunkPath = path.join(CHUNK_DIR, `${uploadId}-${i}`);
      if (!fs.existsSync(chunkPath)) {
        return res.status(400).json({ error: `Chunk ${i} missing from disk` });
      }
    }

    const finalFilename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${session.fileExt}`;
    finalPath = path.join(__dirname, '..', 'uploads', finalFilename);

    // Stream-merge chunks in order without loading all data into memory
    const writeStream = fs.createWriteStream(finalPath);
    for (let i = 0; i < session.totalChunks; i++) {
      const chunkPath = path.join(CHUNK_DIR, `${uploadId}-${i}`);
      await new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(chunkPath);
        readStream.on('error', (err) => {
          writeStream.destroy();
          reject(err);
        });
        readStream.on('end', resolve);
        readStream.pipe(writeStream, { end: false });
      });
      await fs.promises.unlink(chunkPath);
    }
    await new Promise((resolve, reject) => {
      writeStream.end();
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    const fileStats = fs.statSync(finalPath);
    const resolvedFilename = originalFilename || session.originalFilename;
    const resolvedMime = mimeType || 'application/octet-stream';
    const fileType = getFileType(resolvedMime, resolvedFilename);

    if (!fileType) {
      fs.unlink(finalPath, () => {});
      return res.status(400).json({ error: 'Unable to determine file type' });
    }

    const result = await pool.query(
      `INSERT INTO files (user_id, filename, original_filename, file_type, mime_type, size, file_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.user.id, finalFilename, resolvedFilename, fileType, resolvedMime, fileStats.size, finalPath]
    );

    uploadSessions.delete(uploadId);

    res.status(201).json(formatFileRecord(result.rows[0]));
  } catch (err) {
    // Clean up partial merged file
    if (finalPath) fs.unlink(finalPath, () => {});
    // Clean up remaining chunks on error
    if (uploadSessions.has(uploadId)) {
      const session = uploadSessions.get(uploadId);
      for (const chunkIdx of session.uploadedChunks) {
        const chunkPath = path.join(CHUNK_DIR, `${uploadId}-${chunkIdx}`);
        fs.unlink(chunkPath, () => {});
      }
      uploadSessions.delete(uploadId);
    }
    next(err);
  }
}

async function getUploadStatus(req, res, next) {
  try {
    const { uploadId } = req.params;

    // Validate uploadId format to prevent path traversal
    if (!uploadId || !/^[-\w.]+$/.test(uploadId)) {
      return res.status(400).json({ error: 'Invalid uploadId format' });
    }

    if (!uploadSessions.has(uploadId)) {
      return res.status(404).json({ error: 'Upload session not found' });
    }

    const session = uploadSessions.get(uploadId);

    if (session.userId !== req.user?.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json({
      uploadId,
      originalFilename: session.originalFilename,
      totalChunks: session.totalChunks,
      uploadedChunks: session.uploadedChunks.size,
      progress: Math.round((session.uploadedChunks.size / session.totalChunks) * 100),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { uploadChunk, finalizeChunkedUpload, getUploadStatus };
