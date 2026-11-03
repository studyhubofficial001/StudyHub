const router = require('express').Router();
const {
    registerUser,
    verifyOTP,
    loginUser,
    googleAuth,
    resendOTP,
    getMe,
    logoutUser,
    requestEmailChange,
    verifyEmailChange,
    sendPasswordResetOTP,
    verifyPasswordResetOTP,
    resetPassword,
    updatePassword,
    sendForgotPasswordOTP,
    verifyForgotPasswordOTP,
    resetForgotPassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/verify-otp', protect, verifyOTP);
router.post('/resend-otp', protect, resendOTP);
router.post('/login', loginUser);
router.post('/google', googleAuth);
router.get('/me', protect, getMe);
router.post('/change-email', protect, requestEmailChange);
router.post('/verify-email-change', protect, verifyEmailChange);
router.post('/send-password-reset-otp', protect, sendPasswordResetOTP);
router.post('/verify-password-reset-otp', protect, verifyPasswordResetOTP);
router.post('/reset-password', protect, resetPassword);
router.post('/forgot-password/send-otp', sendForgotPasswordOTP);
router.post('/forgot-password/verify-otp', verifyForgotPasswordOTP);
router.post('/forgot-password/reset', resetForgotPassword);
router.post('/update-password', protect, updatePassword);
router.post('/logout', logoutUser);

module.exports = router;