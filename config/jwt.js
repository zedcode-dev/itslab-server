// ============================================================================
// CONFIG/JWT.JS - JWT Configuration (Secured)
// ============================================================================

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

// SECURITY: Require JWT secrets - no fallbacks
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required');
  process.exit(1);
}

// Use separate secrets for access and refresh tokens for better security
const JWT_ACCESS_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';
const JWT_REFRESH_EXPIRE = process.env.JWT_REFRESH_EXPIRE || '30d';

/**
 * Generate JWT access token
 * @param {Object} payload - User data to encode
 * @returns {String} JWT token
 */
const generateToken = (payload) => {
  return jwt.sign(payload, JWT_ACCESS_SECRET, {
    expiresIn: JWT_EXPIRE,
  });
};

/**
 * Generate refresh token (uses different secret)
 * @param {Object} payload - User data to encode
 * @returns {String} Refresh token
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRE,
  });
};

/**
 * Verify JWT access token
 * @param {String} token - JWT token to verify
 * @param {Boolean} isRefreshToken - Whether this is a refresh token
 * @returns {Object} Decoded payload
 */
const verifyToken = (token, isRefreshToken = false) => {
  try {
    const secret = isRefreshToken ? JWT_REFRESH_SECRET : JWT_ACCESS_SECRET;
    return jwt.verify(token, secret);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken,
  JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET,
};