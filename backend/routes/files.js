const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const { uploadFile, listFiles, deleteFile, downloadFile } = require('../controllers/fileController');
const { uploadChunk, finalizeChunkedUpload, getUploadStatus } = require('../controllers/chunkController');

const router = express.Router();

const ALLOWED_EXTENSIONS = ['.mov', '.mp4', '.mp3', '.wav', '.ogg'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed. Accepted: ${ALLOWED_EXTENSIONS.join(', ')}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2 GB
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

// Separate multer instance for chunk uploads — stores to .chunks/, no extension filter
const CHUNK_DIR = path.join(__dirname, '..', 'uploads', '.chunks');
fs.mkdirSync(CHUNK_DIR, { recursive: true });

const chunkStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, CHUNK_DIR),
  filename: (req, file, cb) =>
    cb(null, `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`),
});
const uploadChunkMiddleware = multer({
  storage: chunkStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max per chunk
});

router.post('/upload', uploadLimiter, optionalAuth, requireAuth, upload.single('file'), uploadFile);
router.post('/upload-chunk', uploadLimiter, optionalAuth, requireAuth, uploadChunkMiddleware.single('chunk'), uploadChunk);
router.post('/upload-finalize', uploadLimiter, optionalAuth, requireAuth, finalizeChunkedUpload);
router.get('/upload-status/:uploadId', optionalAuth, requireAuth, getUploadStatus);
router.get('/files', listFiles);
router.delete('/files/:id', optionalAuth, requireAuth, deleteFile);
router.get('/files/:id/download', downloadFile);

module.exports = router;
