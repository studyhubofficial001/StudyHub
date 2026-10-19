const router = require('express').Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getCurrentSyllabus,
  getCurrentSyllabusDownloadUrl,
} = require('../controllers/syllabusController');

router.get('/', protect, getCurrentSyllabus);
router.get('/download', protect, getCurrentSyllabusDownloadUrl);

module.exports = router;
