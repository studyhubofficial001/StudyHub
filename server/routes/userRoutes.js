const router = require('express').Router();
const {protect} = require('../middleware/authMiddleware');
const {onboarding} = require('../controllers/userController');

router.patch('/onboarding', protect, onboarding);

module.exports = router;