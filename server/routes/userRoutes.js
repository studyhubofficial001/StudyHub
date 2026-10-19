const router = require('express').Router();
const {protect} = require('../middleware/authMiddleware');
const {onboarding,getSubjectsByYear} = require('../controllers/userController');

router.patch('/onboarding', protect, onboarding);
router.get('/subjects', protect, getSubjectsByYear);

module.exports = router;