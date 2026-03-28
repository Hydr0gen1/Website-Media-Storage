const express = require('express');
const multer = require('multer');
const path = require('path');
const { uploadFile, listFiles, deleteFile, downloadFile } = require('../controllers/fileController');

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

router.post('/upload', upload.single('file'), uploadFile);
router.get('/files', listFiles);
router.delete('/files/:id', deleteFile);
router.get('/files/:id/download', downloadFile);

module.exports = router;
