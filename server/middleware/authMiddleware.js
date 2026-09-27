const jwt = require('jsonwebtoken');
const User = require('../models/User');

const getRequestToken = (req) => {
  const authorization = req.headers.authorization;
  const bearerToken = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null;

  return req.cookies?.token || bearerToken;
};

const protect = async (req, res, next) => {
  const token = getRequestToken(req);

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    console.error('JWT Protection Error:', error.message);
    return res.status(401).json({ message: 'Not authorized, token failed or expired' });
  }

  try {
    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      return res.status(401).json({ message: 'User not found or account removed' });
    }

    return next();
  } catch (error) {
    console.error('Error loading authenticated user:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { protect };
