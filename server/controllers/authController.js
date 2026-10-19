const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sendEmail = require('../utils/sendEmail');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (id) => { 
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

const sendVerificationOTPEmail = async (email, name, otp) => {
    const displayName = name || 'there';
    const text = `Hello ${displayName},\n\nYour StudyHub email verification code is: ${otp}\n\nUse this code to verify your email address. It will expire in 10 minutes.\n\nIf you did not request this, please ignore this email.`;
    await sendEmail(email, 'StudyHub - Verify your email address', text);
};

const sendEmailChangeOTPEmail = async (email, name, otp, pendingEmail) => {
    const displayName = name || 'there';
    const text = `Hello ${displayName},\n\nWe received a request to change your StudyHub email to ${pendingEmail}.\n\nYour email change OTP is: ${otp}\n\nThis code expires in 10 minutes. If you did not request this change, please secure your account immediately.`;
    await sendEmail(email, 'StudyHub - Confirm your email change', text);
};

const sendPasswordResetOTPEmail = async (email, name, otp) => {
    const displayName = name || 'there';
    const text = `Hello ${displayName},\n\nWe received a request to reset your StudyHub password.\n\nYour password reset OTP is: ${otp}\n\nThis code will expire in 10 minutes. If you did not request this reset, please ignore this email.`;
    await sendEmail(email, 'StudyHub - Reset your password', text);
};

const getAuthUser = (user) => ({
    _id: user._id,
    name: user.username,
    email: user.email,
    role: user.role,
    year: user.year,
    isVerified: user.verified,
    isProfileComplete: user.isProfileComplete,
});

const setAuthCookie = (res, token) => {
    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 24 * 60 * 60 * 1000,
    });
}
 
const registerUser = async (req, res) => {
    const { username, email, password } = req.body;

    try {
        if(username == null || username == undefined || username === '') {
            return res.status(400).json({ message: 'Username is required' });
        }
        if(email == null || email == undefined || email === '') {
            return res.status(400).json({ message: 'Email is required' });
        }
        if(password == null || password == undefined || password === '') {
            return res.status(400).json({ message: 'Password is required' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }
        
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({ message: 'Password must be at least 8 characters long and contain both letters and numbers' });
        }
        const existingUser = await User.findOne({ email });
        if (existingUser && existingUser.verified) {
            return res.status(400).json({ message: 'User already exists. Please log in.' });
        }
        if (existingUser && !existingUser.verified) {
            const otp = generateOTP();
            existingUser.otp = otp;
            existingUser.otpExpiration = Date.now() + 10 * 60 * 1000; // 10 minutes from now
            await existingUser.save();
            await sendVerificationOTPEmail(email, existingUser.username, otp);
            const token = generateToken(existingUser._id);
            setAuthCookie(res, token);
            return res.status(200).json({
                message: 'A new OTP has been sent to your email.',
                user: getAuthUser(existingUser),
            });
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const otp = generateOTP();
        const user = await User.create({
            username,
            email,
            password: hashedPassword,
            otp,
            otpExpiration: Date.now() + 10 * 60 * 1000, // 10 minutes from now
        });

        if (user) {
            await sendVerificationOTPEmail(email, user.username, otp);
            const token = generateToken(user._id);
            setAuthCookie(res, token);
            res.status(201).json({
                message: 'User registered successfully. Please verify your email using the OTP sent.',
                user: getAuthUser(user),
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const verifyOTP = async (req, res) => {
    const { otp } = req.body;
    try {
        if(otp == null || otp == undefined || otp === '') {
            return res.status(400).json({ message: 'OTP is required' });
        }
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(400).json({ message: 'User not found' });
        }
        if (user.verified) {
            return res.status(400).json({ message: 'User already verified' });
        }
        if (!user.otp || !user.otpExpiration || user.otpExpiration < Date.now()) {
            return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
        }
        if (user.otp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }
        user.verified = true;
        user.otp = null;
        user.otpExpiration = null;
        await user.save();
        res.status(200).json({
            message: 'Email verified successfully',
            user: getAuthUser(user),
        });
    } catch (error) {
        console.error('Error verifying OTP:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

const resendOTP = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(400).json({ message: 'User not found' });
        }
        if (user.verified) {
            return res.status(400).json({ message: 'User already verified' });
        }
        const otp = generateOTP();
        user.otp = otp;
        user.otpExpiration = Date.now() + 10 * 60 * 1000; // 10 minutes from now
        await user.save();
        await sendVerificationOTPEmail(user.email, user.username, otp);
        return res.status(200).json({
            message: 'A new OTP has been sent to your email.',
            email: user.email,
        });
    } catch (error) {
        console.error('Error resending OTP:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }
        if (!user.verified) {
            return res.status(400).json({ message: 'Please verify your email before logging in' });
        }
        if(!user.password) {
            return res.status(400).json({ message: 'Please log in using Google OAuth' });
        }
        if(await bcrypt.compare(password, user.password)) {
            setAuthCookie(res, generateToken(user._id));
            res.status(200).json({
                message: 'Login successfully',
                user: getAuthUser(user),
            });
        } else {
            res.status(400).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        console.error('Error logging in user:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const googleAuth = async (req, res) => {
    const { credential } = req.body;
    if (!credential) {
        return res.status(400).json({ message: 'Google credential is required' });
    }

    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const { sub: googleId, email, name } = payload;

        let user = await User.findOne({ email });
        
        if (!user) {
            user = await User.create({
                username: name,
                email,
                googleId,
                verified: true, // Google accounts are considered verified
                isProfileComplete: false, // User needs to complete onboarding
            });
        } else if (!user.googleId) {
            user.googleId = googleId;
            user.verified = true; // Mark as verified since it's a Google account
            user.isProfileComplete = false; // User needs to complete onboarding
            await user.save();
        }

        setAuthCookie(res, generateToken(user._id));
        res.status(200).json({
            message: 'Google authentication successful',
            user: getAuthUser(user),
        });
    } catch (error) {
        console.error('Error during Google authentication:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getMe = async (req, res) => {
    try{
        res.json({ 
            user: getAuthUser(req.user),
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const requestEmailChange = async (req, res) => {
    const { email } = req.body;

    try {
        if (!email || !email.trim()) {
            return res.status(400).json({ message: 'New email is required' });
        }

        const normalizedEmail = email.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.email.toLowerCase() === normalizedEmail.toLowerCase()) {
            return res.status(400).json({ message: 'This is already your current email address' });
        }

        const existingUser = await User.findOne({ email: normalizedEmail.toLowerCase() });
        if (existingUser && existingUser._id.toString() !== user._id.toString()) {
            return res.status(400).json({ message: 'This email is already in use' });
        }

        const otp = generateOTP();
        user.pendingEmail = normalizedEmail.toLowerCase();
        user.otp = otp;
        user.otpPurpose = 'email-change';
        user.otpExpiration = Date.now() + 10 * 60 * 1000;
        await user.save();

        await sendEmailChangeOTPEmail(user.email, user.username, otp, normalizedEmail);

        return res.status(200).json({
            message: 'OTP sent to your current email address. Please verify to complete the change.',
            currentEmail: user.email,
            pendingEmail: normalizedEmail.toLowerCase(),
        });
    } catch (error) {
        console.error('Error requesting email change:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const verifyEmailChange = async (req, res) => {
    const { otp } = req.body;

    try {
        if (!otp || otp === '') {
            return res.status(400).json({ message: 'OTP is required' });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.otpPurpose !== 'email-change') {
            return res.status(400).json({ message: 'No email-change verification is pending' });
        }

        if (!user.otp || !user.otpExpiration || user.otpExpiration < Date.now()) {
            return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
        }

        if (user.otp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        user.email = user.pendingEmail;
        user.pendingEmail = null;
        user.otp = null;
        user.otpPurpose = null;
        user.otpExpiration = null;
        await user.save();

        return res.status(200).json({
            message: 'Email updated successfully',
            user: getAuthUser(user),
        });
    } catch (error) {
        console.error('Error verifying email change:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const sendPasswordResetOTP = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!user.password) {
            return res.status(400).json({ message: 'Password reset is only available for email/password accounts' });
        }

        const otp = generateOTP();
        user.otp = otp;
        user.otpPurpose = 'password-reset';
        user.otpExpiration = Date.now() + 10 * 60 * 1000;
        await user.save();

        await sendPasswordResetOTPEmail(user.email, user.username, otp);

        return res.status(200).json({
            message: 'OTP sent to your email address. Please verify to continue.',
            email: user.email,
        });
    } catch (error) {
        console.error('Error sending password reset OTP:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const sendForgotPasswordOTP = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || !email.trim()) {
            return res.status(400).json({ message: 'Email is required' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(404).json({ message: 'No account found with that email address.' });
        }

        if (!user.password) {
            return res.status(400).json({ message: 'Password reset is only available for email/password accounts' });
        }

        const otp = generateOTP();
        user.otp = otp;
        user.otpPurpose = 'password-reset';
        user.otpExpiration = Date.now() + 10 * 60 * 1000;
        await user.save();

        await sendPasswordResetOTPEmail(user.email, user.username, otp);

        return res.status(200).json({
            message: 'OTP sent to your email address. Please verify to continue.',
            email: user.email,
        });
    } catch (error) {
        console.error('Error sending forgot password OTP:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const verifyPasswordResetOTP = async (req, res) => {
    const { otp } = req.body;

    try {
        if (!otp || otp === '') {
            return res.status(400).json({ message: 'OTP is required' });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.otpPurpose !== 'password-reset') {
            return res.status(400).json({ message: 'No password reset verification is pending' });
        }

        if (!user.otp || !user.otpExpiration || user.otpExpiration < Date.now()) {
            return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
        }

        if (user.otp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        return res.status(200).json({
            message: 'OTP verified successfully. You can now set a new password.',
        });
    } catch (error) {
        console.error('Error verifying password reset OTP:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const verifyForgotPasswordOTP = async (req, res) => {
    const { email, otp } = req.body;

    try {
        if (!email || !email.trim()) {
            return res.status(400).json({ message: 'Email is required' });
        }

        if (!otp || otp === '') {
            return res.status(400).json({ message: 'OTP is required' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.otpPurpose !== 'password-reset') {
            return res.status(400).json({ message: 'No password reset verification is pending' });
        }

        if (!user.otp || !user.otpExpiration || user.otpExpiration < Date.now()) {
            return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
        }

        if (user.otp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        return res.status(200).json({
            message: 'OTP verified successfully. You can now set a new password.',
        });
    } catch (error) {
        console.error('Error verifying forgot password OTP:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const resetPassword = async (req, res) => {
    const { otp, newPassword, confirmPassword } = req.body;

    try {
        if (!otp || otp === '') {
            return res.status(400).json({ message: 'OTP is required' });
        }

        if (!newPassword || !confirmPassword) {
            return res.status(400).json({ message: 'New password and confirmation are required' });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ message: 'New password and confirmation do not match' });
        }

        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            return res.status(400).json({ message: 'Password must be at least 8 characters long and contain both letters and numbers' });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.otpPurpose !== 'password-reset') {
            return res.status(400).json({ message: 'Password reset verification is not active' });
        }

        if (!user.otp || !user.otpExpiration || user.otpExpiration < Date.now()) {
            return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
        }

        if (user.otp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.passwordUpdatedAt = new Date();
        user.otp = null;
        user.otpPurpose = null;
        user.otpExpiration = null;
        await user.save();

        return res.status(200).json({
            message: 'Password updated successfully',
        });
    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const resetForgotPassword = async (req, res) => {
    const { email, otp, newPassword, confirmPassword } = req.body;

    try {
        if (!email || !email.trim()) {
            return res.status(400).json({ message: 'Email is required' });
        }

        if (!otp || otp === '') {
            return res.status(400).json({ message: 'OTP is required' });
        }

        if (!newPassword || !confirmPassword) {
            return res.status(400).json({ message: 'New password and confirmation are required' });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ message: 'New password and confirmation do not match' });
        }

        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            return res.status(400).json({ message: 'Password must be at least 8 characters long and contain both letters and numbers' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.otpPurpose !== 'password-reset') {
            return res.status(400).json({ message: 'Password reset verification is not active' });
        }

        if (!user.otp || !user.otpExpiration || user.otpExpiration < Date.now()) {
            return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
        }

        if (user.otp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.passwordUpdatedAt = new Date();
        user.otp = null;
        user.otpPurpose = null;
        user.otpExpiration = null;
        await user.save();

        return res.status(200).json({
            message: 'Password reset successfully. You can now log in with your new password.',
        });
    } catch (error) {
        console.error('Error resetting forgot password:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const updatePassword = async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    try {
        if (!currentPassword && req.user.password) {
            return res.status(400).json({ message: 'Current password is required' });
        }

        if (!newPassword || !confirmPassword) {
            return res.status(400).json({ message: 'New password and confirmation are required' });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ message: 'New password and confirmation do not match' });
        }

        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            return res.status(400).json({ message: 'Password must be at least 8 characters long and contain both letters and numbers' });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.password) {
            const isValidCurrentPassword = await bcrypt.compare(currentPassword, user.password);
            if (!isValidCurrentPassword) {
                return res.status(400).json({ message: 'Current password is incorrect' });
            }
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.passwordUpdatedAt = new Date();
        await user.save();

        res.status(200).json({
            message: 'Password updated successfully',
        });
    } catch (error) {
        console.error('Error updating password:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const logoutUser = async (req, res) => {
    try {
        res.clearCookie('token');
        res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Error logging out user:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    registerUser,
    verifyOTP,
    resendOTP,
    loginUser,
    googleAuth,
    getMe,
    requestEmailChange,
    verifyEmailChange,
    sendPasswordResetOTP,
    verifyPasswordResetOTP,
    resetPassword,
    sendForgotPasswordOTP,
    verifyForgotPasswordOTP,
    resetForgotPassword,
    updatePassword,
    logoutUser
};