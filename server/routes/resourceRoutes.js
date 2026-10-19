const router = require('express').Router();
const { protect } = require('../middleware/authMiddleware');
const { getResourcesForUser, getUserResourceDownloadUrl } = require('../controllers/resourceController');

router.get('/:resourceId/download', protect, getUserResourceDownloadUrl);
router.get('/', protect, getResourcesForUser);

module.exports = router;