// ============================================================================
// MIDDLEWARE/AUTH.JS - JWT Authentication Middleware
// ============================================================================

const { verifyToken } = require('../config/jwt');
const { User } = require('../models');
const { errorResponse } = require('../utils/responseFormatter');
const logger = require('../utils/logger');

/**
 * Middleware to verify JWT token and attach user to request
 */
const authenticate = async (req, res, next) => {
  try {
    // 1. Get token from header OR cookies
    let token = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return errorResponse(res, 401, 'No token provided. Please login to continue.');
    }

    // 2. Verify token
    const decoded = verifyToken(token);

    // Find user
    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password_hash', 'refresh_token'] },
    });

    if (!user) {
      return errorResponse(res, 401, 'User not found. Token is invalid.');
    }

    if (!user.is_active) {
      return errorResponse(res, 403, 'Account has been deactivated. Please contact support.');
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return errorResponse(res, 401, 'Invalid or expired token. Please login again.');
  }
};

/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (token) {
      const decoded = verifyToken(token);
      const user = await User.findByPk(decoded.id, {
        attributes: { exclude: ['password_hash', 'refresh_token'] },
      });

      if (user && user.is_active) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // Silently fail for optional auth
    next();
  }
};

module.exports = {
  authenticate,
  protect: authenticate, // Alias for convenience
  optionalAuth,
};