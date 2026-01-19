// ============================================================================
// MIDDLEWARE/ROLE_CHECK.JS - Role-Based Access Control
// ============================================================================

const { errorResponse } = require('../utils/responseFormatter');

/**
 * Middleware to check if user has required role
 * @param {String|Array} roles - Required role(s)
 */
const checkRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 401, 'Authentication required');
    }

    if (!roles.includes(req.user.role)) {
      return errorResponse(
        res,
        403,
        `Access denied. Required role: ${roles.join(' or ')}`
      );
    }

    next();
  };
};

/**
 * Middleware to check if user is student
 */
const isStudent = checkRole('student');

/**
 * Middleware to check if user is instructor
 */
const isInstructor = checkRole('instructor');

/**
 * Middleware to check if user is admin
 */
const isAdmin = checkRole('admin');

/**
 * Middleware to check if user is instructor or admin
 */
const isInstructorOrAdmin = checkRole('instructor', 'admin');

module.exports = {
  checkRole,
  isStudent,
  isInstructor,
  isAdmin,
  isInstructorOrAdmin,
};
