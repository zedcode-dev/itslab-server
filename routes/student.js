// ============================================================================
// ROUTES/STUDENT.JS - Student Routes
// ============================================================================

const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { authenticate } = require('../middleware/auth');
const { checkRole } = require('../middleware/roleCheck');
const { reviewValidation, validate } = require('../middleware/validation');
const { body } = require('express-validator');

// All student routes require authentication
router.use(authenticate);
router.use(checkRole('student'));

// Dashboard
router.get('/dashboard', studentController.getDashboard);

// Course progress
router.get('/courses/:courseId/progress', studentController.getCourseProgress);

// Mark lesson complete
router.post('/lessons/:lessonId/complete', [
  body('watchTimeSeconds').optional().isInt({ min: 0 }),
  validate,
], studentController.markLessonComplete);

// Get all certificates
router.get('/certificates', studentController.getCertificates);

// Get all transactions
router.get('/transactions', studentController.getTransactions);

// Submit review
router.post('/courses/:courseId/reviews', reviewValidation, studentController.submitReview);

// External Exam Callback
router.get('/exams/callback', studentController.handleExamCallback);

module.exports = router;
