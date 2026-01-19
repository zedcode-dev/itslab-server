// ============================================================================
// UTILS/HELPERS.JS - Utility Helper Functions
// ============================================================================

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

/**
 * Generate random token
 * @param {Number} length - Token length
 * @returns {String} Random hex token
 */
const generateToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Hash password using bcrypt
 * @param {String} password - Plain text password
 * @returns {Promise<String>} Hashed password
 */
const hashPassword = async (password) => {
  const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  return await bcrypt.hash(password, rounds);
};

/**
 * Compare password with hash
 * @param {String} password - Plain text password
 * @param {String} hash - Hashed password
 * @returns {Promise<Boolean>} Match result
 */
const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

/**
 * Generate slug from string
 * @param {String} text - Text to slugify
 * @returns {String} Slugified text
 */
const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

/**
 * Generate unique slug
 * @param {String} text - Text to slugify
 * @param {Object} Model - Sequelize model
 * @param {String} field - Field name for slug
 * @returns {Promise<String>} Unique slug
 */
const generateUniqueSlug = async (text, Model, field = 'slug') => {
  let slug = slugify(text);
  let counter = 1;
  let uniqueSlug = slug;

  while (true) {
    const existing = await Model.findOne({ where: { [field]: uniqueSlug } });
    if (!existing) break;
    uniqueSlug = `${slug}-${counter}`;
    counter++;
  }

  return uniqueSlug;
};

/**
 * Calculate time difference in minutes
 * @param {Date} start - Start date
 * @param {Date} end - End date
 * @returns {Number} Minutes difference
 */
const minutesDifference = (start, end) => {
  return Math.floor((end - start) / 1000 / 60);
};

/**
 * Format currency
 * @param {Number} amount - Amount to format
 * @param {String} currency - Currency code
 * @returns {String} Formatted currency
 */
const formatCurrency = (amount, currency = 'EGP') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

/**
 * Sanitize filename
 * @param {String} filename - Original filename
 * @returns {String} Sanitized filename
 */
const sanitizeFilename = (filename) => {
  return filename.replace(/[^a-z0-9.-]/gi, '_').toLowerCase();
};

module.exports = {
  generateToken,
  hashPassword,
  comparePassword,
  slugify,
  generateUniqueSlug,
  minutesDifference,
  formatCurrency,
  sanitizeFilename,
};

// ============================================================================
// EXAMPLE: Using these utilities in your application
// ============================================================================

/*

// In your controller:
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const { authenticate } = require('../middleware/auth');
const { isStudent } = require('../middleware/roleCheck');
const { hashPassword } = require('../utils/helpers');

// Protected route example:
router.get('/dashboard', 
  authenticate,           // Verify JWT token
  isStudent,             // Check if user is student
  getDashboard           // Controller function
);

// In controller function:
const getDashboard = async (req, res, next) => {
  try {
    const data = await fetchDashboardData(req.user.id);
    return successResponse(res, 200, 'Dashboard data retrieved', data);
  } catch (error) {
    next(error); // Pass to error handler
  }
};

*/