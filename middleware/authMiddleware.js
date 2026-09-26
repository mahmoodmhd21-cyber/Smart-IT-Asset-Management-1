const jwt = require('jsonwebtoken');
const User = require('../models/User');

const { secret, algorithms } = require('../config/auth');

/**
 * Authentication middleware
 * Verifies JWT tokens and populates req.user for protected routes.
 */
exports.protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization token required.' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Authorization token required.' });
    }

    const decoded = jwt.verify(token, secret, { algorithms });
    const user = await User.findById(decoded.userId).select('-password');
    // Read current account state on every request; JWT role claims are not authority.
    if (!user || user.isActive === false || decoded.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({ message: 'Session is no longer valid. Please log in again.' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    return res.status(401).json({ message: 'Not authorized. Token failed.' });
  }
};

exports.authorize = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Authentication required.' });
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'You do not have permission for this action.' });
  }
  next();
};
