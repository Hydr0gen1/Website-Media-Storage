const express = require('express');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const {
  createPlaylist,
  listPlaylists,
  getPlaylist,
  updatePlaylist,
  deletePlaylist,
  addItem,
  removeItem,
  reorderItems,
} = require('../controllers/playlistController');

const router = express.Router();

// All playlist routes require authentication
router.use(optionalAuth, requireAuth);

router.post('/', createPlaylist);
router.get('/', listPlaylists);
router.get('/:id', getPlaylist);
router.put('/:id', updatePlaylist);
router.delete('/:id', deletePlaylist);

router.post('/:id/items', addItem);
router.delete('/:id/items/:fileId', removeItem);
router.put('/:id/reorder', reorderItems);

module.exports = router;
