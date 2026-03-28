const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

function formatFileRecord(f) {
  return {
    id: f.id,
    filename: f.filename,
    originalFilename: f.originalfilename,
    fileType: f.filetype,
    mimeType: f.mimetype,
    size: f.size,
    uploadDate: f.uploaddate,
  };
}

const ALLOWED_EXTENSIONS = ['.mov', '.mp4', '.mp3', '.wav', '.ogg'];
const MIME_TO_TYPE = {
  'video/quicktime': 'video',
  'video/mp4': 'video',
  'audio/mpeg': 'audio',
  'audio/mp3': 'audio',
  'audio/wav': 'audio',
  'audio/wave': 'audio',
  'audio/x-wav': 'audio',
  'audio/ogg': 'audio',
  'video/ogg': 'audio',
};

function getFileType(mimetype, originalname) {
  if (MIME_TO_TYPE[mimetype]) return MIME_TO_TYPE[mimetype];
  const ext = path.extname(originalname).toLowerCase();
  if (['.mp4', '.mov'].includes(ext)) return 'video';
  if (['.mp3', '.wav', '.ogg'].includes(ext)) return 'audio';
  return null;
}

async function uploadFile(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({
        error: `File type not allowed. Accepted types: ${ALLOWED_EXTENSIONS.join(', ')}`,
      });
    }

    const fileType = getFileType(req.file.mimetype, req.file.originalname);
    if (!fileType) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'Unable to determine file type' });
    }

    const result = await pool.query(
      `INSERT INTO files (filename, originalFilename, fileType, mimeType, size, filePath)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        req.file.filename,
        req.file.originalname,
        fileType,
        req.file.mimetype,
        req.file.size,
        req.file.path,
      ]
    );

    res.status(201).json(formatFileRecord(result.rows[0]));
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
    next(err);
  }
}

async function listFiles(req, res, next) {
  try {
    const result = await pool.query(
      'SELECT * FROM files ORDER BY uploadDate DESC'
    );
    res.json(result.rows.map(formatFileRecord));
  } catch (err) {
    next(err);
  }
}

async function deleteFile(req, res, next) {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM files WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = result.rows[0];

    await pool.query('DELETE FROM files WHERE id = $1', [id]);

    try {
      await fs.promises.unlink(file.filepath);
    } catch (err) {
      console.warn(`Warning: Could not delete file from disk: ${file.filepath}`, err.message);
    }

    res.json({ message: 'File deleted successfully' });
  } catch (err) {
    next(err);
  }
}

async function downloadFile(req, res, next) {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM files WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = result.rows[0];

    if (!fs.existsSync(file.filepath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    const stat = fs.statSync(file.filepath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': file.mimetype,
        'Content-Disposition': `inline; filename="${encodeURIComponent(file.originalfilename)}"`,
      });

      fs.createReadStream(file.filepath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': file.mimetype,
        'Accept-Ranges': 'bytes',
        'Content-Disposition': `inline; filename="${encodeURIComponent(file.originalfilename)}"`,
      });
      fs.createReadStream(file.filepath).pipe(res);
    }
  } catch (err) {
    next(err);
  }
}

module.exports = { uploadFile, listFiles, deleteFile, downloadFile };
