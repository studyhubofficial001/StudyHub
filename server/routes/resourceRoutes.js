const router = require('express').Router();
const { protect } = require('../middleware/authMiddleware');
const {
    getResourcesForUser,
    getUserResourceDownloadUrl,
    getUserPyqCodeResources,
    getUserPyqCodeResourceDownloadUrl,
} = require('../controllers/resourceController');

router.get('/pyq-code', protect, getUserPyqCodeResources);
router.get('/pyq-code/:resourceId/download', protect, getUserPyqCodeResourceDownloadUrl);
router.get('/:resourceId/download', protect, getUserResourceDownloadUrl);
router.get('/', protect, getResourcesForUser);

module.exports = router;