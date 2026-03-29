const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { nanoid } = require('nanoid');
const { poolPromise } = require('../db');

const UPLOADS_DIR = path.join(__dirname, '../uploads/temp');
const MEDIA_DIR = path.join(__dirname, '../uploads/media');

// Ensure directories exist
[UPLOADS_DIR, MEDIA_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const ALLOWED_EXTENSIONS = [
  // Video
  '.mov', '.mp4', '.webm', '.avi', '.mkv',
  // Audio
  '.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a',
  // Image
  '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.heic', '.heif',
];

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB

// Helper to get file type from extension
function getFileType(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (['.mp4', '.mov', '.webm', '.avi', '.mkv'].includes(ext)) return 'video';
  if (['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'].includes(ext)) return 'audio';
  if (['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.heic', '.heif'].includes(ext)) return 'image';
  return 'unknown';
}

// Initialize upload session
function initializeUpload(req, res) {
  try {
    const { originalFilename, mimeType, fileSize } = req.body;

    // Validate fileSize
    if (!fileSize || typeof fileSize !== 'number' || fileSize <= 0) {
      return res.status(400).json({ error: 'Valid fileSize (positive number) is required' });
    }

    if (!originalFilename) {
      return res.status(400).json({ error: 'originalFilename is required' });
    }

    if (fileSize > MAX_FILE_SIZE) {
      return res.status(400).json({ error: 'File size exceeds maximum allowed size (2GB)' });
    }

    const ext = path.extname(originalFilename).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return res.status(400).json({ error: 'File type not supported' });
    }

    const uploadId = uuidv4();
    const uploadDir = path.join(UPLOADS_DIR, uploadId);

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    res.json({
      success: true,
      uploadId,
      CHUNK_SIZE: 20 * 1024 * 1024, // 20 MB
    });
  } catch (error) {
    console.error('initializeUpload error:', error);
    res.status(500).json({ error: 'Failed to initialize upload' });
  }
}

// Upload a chunk
function uploadChunk(req, res) {
  try {
    const { uploadId, chunkIndex, totalChunks, originalFilename } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No chunk file provided' });
    }

    if (!uploadId) {
      return res.status(400).json({ error: 'uploadId is required' });
    }

    const uploadDir = path.join(UPLOADS_DIR, uploadId);

    if (!fs.existsSync(uploadDir)) {
      return res.status(404).json({ error: 'Upload session not found' });
    }

    const chunkPath = path.join(uploadDir, `chunk_${chunkIndex}`);

    fs.renameSync(req.file.path, chunkPath);

    // Count uploaded chunks
    const uploadedChunks = fs.readdirSync(uploadDir).length;
    const progress = Math.round((uploadedChunks / totalChunks) * 100);

    // Check if all chunks received
    if (uploadedChunks === totalChunks) {
      // Auto-finalize
      const result = finalizeUpload({
        file: null,
        body: { uploadId, originalFilename },
      }, res);
      return result;
    }

    res.json({
      success: true,
      chunkIndex,
      uploadedChunks,
      totalChunks,
      progress,
    });
  } catch (error) {
    console.error('uploadChunk error:', error);
    res.status(500).json({ error: 'Failed to upload chunk' });
  }
}

// Finalize upload - merge chunks into final file
async function finalizeUpload(req, res) {
  try {
    const { uploadId, originalFilename, fileType, mimeType } = req.body;

    if (!uploadId) {
      return res.status(400).json({ error: 'uploadId is required' });
    }

    let client = null;
    try {
      const uploadDir = path.join(UPLOADS_DIR, uploadId);

      if (!fs.existsSync(uploadDir)) {
        return res.status(404).json({ error: 'Upload session not found' });
      }

      // Get all chunks and sort them
      const chunks = fs.readdirSync(uploadDir)
        .filter(f => f.startsWith('chunk_'))
        .map(f => ({
          name: f,
          index: parseInt(f.replace('chunk_', '')),
        }))
        .sort((a, b) => a.index - b.index);

      if (chunks.length === 0) {
        return res.status(400).json({ error: 'No chunks found for this upload' });
      }

      // Determine the file extension
      const ext = path.extname(originalFilename);
      const baseName = path.basename(originalFilename, ext);
      const safeId = nanoid(12);
      const finalFilename = `${baseName}_${safeId}${ext}`;
      const finalPath = path.join(MEDIA_DIR, finalFilename);

      // Merge chunks sequentially
      const { createReadStream, createWriteStream } = require('fs');
      const { pipeline } = require('stream/promises');
      
      // Create write stream in append mode
      const writeStream = createWriteStream(finalPath, { flags: 'a' });
      
      // Write first chunk (creates file)
      const firstChunkPath = path.join(uploadDir, chunks[0].name);
      await pipeline(createReadStream(firstChunkPath), writeStream);
      
      // Append subsequent chunks
      for (let i = 1; i < chunks.length; i++) {
        const chunkPath = path.join(uploadDir, chunks[i].name);
        await pipeline(createReadStream(chunkPath), writeStream);
      }
      
      // Ensure all data is flushed
      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      // Get file size
      const fileSize = fs.statSync(finalPath).size;

      // Save to database
      const pool = await poolPromise;

      try {
        await pool.query('BEGIN');

        const fileName = originalFilename || finalFilename;
        const storedType = fileType || getFileType(fileName);
        const storedMimeType = mimeType || 'application/octet-stream';

        const uploadResult = await pool.query(
          `INSERT INTO uploads (
            filename, original_filename, file_type, mime_type, file_path, file_size
          ) VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id, created_at`,
          [finalFilename, fileName, storedType, storedMimeType, finalFilename, fileSize]
        );

        const upload = uploadResult.rows[0];

        // Update storage quota
        await pool.query(
          `UPDATE storage_quota 
           SET used_space = COALESCE(used_space, 0) + $1
           WHERE user_id = $2
           RETURNING *`,
          [fileSize, req.user?.id || 1]
        );

        await pool.query('COMMIT');

        // Clean up temp upload directory
        try {
          fs.rmSync(uploadDir, { recursive: true, force: true });
        } catch (cleanupErr) {
          console.error('Cleanup error:', cleanupErr);
        }

        res.json({
          success: true,
          upload,
          message: 'Upload finalized successfully',
        });
      } catch (dbError) {
        await pool.query('ROLLBACK');
        throw dbError;
      }
    } finally {
      if (client) {
        client.release();
      }
    }
  } catch (error) {
    console.error('finalizeUpload error:', error);
    res.status(500).json({ error: 'Failed to finalize upload' });
  }
}

// Cancel upload and clean up
function cancelUpload(req, res) {
  try {
    const { uploadId } = req.params;

    const uploadDir = path.join(UPLOADS_DIR, uploadId);

    if (!fs.existsSync(uploadDir)) {
      return res.status(404).json({ error: 'Upload session not found' });
    }

    fs.rmSync(uploadDir, { recursive: true, force: true });

    res.json({
      success: true,
      message: 'Upload cancelled successfully',
    });
  } catch (error) {
    console.error('cancelUpload error:', error);
    res.status(500).json({ error: 'Failed to cancel upload' });
  }
}

module.exports = {
  initializeUpload,
  uploadChunk,
  finalizeUpload,
  cancelUpload,
};