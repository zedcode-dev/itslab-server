// ============================================================================
// MIDDLEWARE/VALIDATION.JS - Input Validation Middleware
// ============================================================================

const { body, param, query, validationResult } = require('express-validator');
const { errorResponse } = require('../utils/responseFormatter');
const logger = require('../utils/logger');

/**
 * Validation result handler
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(err => ({
      field: err.param || err.path,
      message: err.msg,
      value: err.value
    }));

    // Use proper logging instead of console.log
    logger.debug('Validation failed', {
      path: req.originalUrl,
      errors: formattedErrors
    });

    return errorResponse(res, 400, 'Validation failed', formattedErrors);
  }

  next();
};

// ============================================================================
// Validation Rules
// ============================================================================

const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).+$/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character'),
  body('name')
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage('Name must be between 2 and 255 characters'),
  body('role')
    .optional()
    .isIn(['student', 'instructor'])
    .withMessage('Role must be either student or instructor'),
  validate,
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  validate,
];

const courseCreateValidation = [
  body('title')
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Title must be between 5 and 500 characters'),
  body('shortDescription')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Short description must not exceed 500 characters'),
  body('description')
    .trim()
    .isLength({ min: 50 })
    .withMessage('Description must be at least 50 characters long'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('level')
    .isIn(['beginner', 'intermediate', 'advanced'])
    .withMessage('Level must be beginner, intermediate, or advanced'),
  body('language')
    .optional()
    .isLength({ min: 2, max: 10 })
    .withMessage('Language code must be 2-10 characters'),
  validate,
];

const sectionValidation = [
  body('title')
    .trim()
    .isLength({ min: 3, max: 500 })
    .withMessage('Section title must be between 3 and 500 characters'),
  body('description')
    .optional()
    .trim(),
  body('orderIndex')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Order must be a positive integer'),
  validate,
];

const lessonValidation = [
  body('title')
    .trim()
    .isLength({ min: 3, max: 500 })
    .withMessage('Lesson title must be between 3 and 500 characters'),
  body('description')
    .optional()
    .trim(),
  body('orderIndex')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Order must be a positive integer'),
  body('durationMinutes')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Duration must be a positive integer'),
  body('isPreview')
    .optional()
    .isBoolean()
    .withMessage('isPreview must be a boolean'),
  body('external_url')
    .optional()
    .isURL()
    .withMessage('External URL must be a valid URL'),
  validate,
];

const reviewValidation = [
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('review_text')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Review text must not exceed 2000 characters'),
  validate,
];

const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  validate,
];

module.exports = {
  validate,
  registerValidation,
  loginValidation,
  courseCreateValidation,
  sectionValidation,
  lessonValidation,
  reviewValidation,
  paginationValidation,
};
