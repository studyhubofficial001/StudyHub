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

const sendOTPEmail = async (email,name, otp) => {
    const text = `Hello ${name}, your verification OTP code for StudyHub is: ${otp}. It will expire in 10 minutes.`;
    await sendEmail(email, 'StudyHub - Email Verification OTP', text);
}

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
            await sendOTPEmail(email, existingUser.username, otp);
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
            await sendOTPEmail(email, user.username, otp);
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
        await sendOTPEmail(user.email, user.username, otp);
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
    logoutUser
};