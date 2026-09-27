const router = require('express').Router();
const { registerUser, verifyOTP, loginUser, googleAuth , resendOTP , getMe,logoutUser } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/verify-otp',protect, verifyOTP);
router.post('/resend-otp',protect, resendOTP);
router.post('/login', loginUser);
router.post('/google', googleAuth);
router.get('/me', protect, getMe);
router.post('/logout', logoutUser);

module.exports = router;