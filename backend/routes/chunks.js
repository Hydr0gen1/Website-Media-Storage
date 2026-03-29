const express = require('express');
const {
  initializeUpload,
  uploadChunk,
  finalizeUpload,
  cancelUpload,
} = require('../controllers/chunksController');

const router = express.Router();

router.post('/upload-chunk', uploadChunk);
router.post('/upload-finalize', finalizeUpload);
router.post('/initialize-upload', initializeUpload);
router.delete('/upload-cancel/:uploadId', cancelUpload);

module.exports = router;