// ============================================================================
// ROUTES/COURSES.JS - Course Routes
// ============================================================================

const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');
const quizController = require('../controllers/quizController');
const { authenticate, protect, optionalAuth } = require('../middleware/auth');
const { paginationValidation } = require('../middleware/validation');

// Public routes
router.get('/', optionalAuth, paginationValidation, courseController.getAllCourses);
router.get('/:courseId', optionalAuth, courseController.getCourseById);
router.get('/slug/:slug', optionalAuth, courseController.getCourseBySlug);

// Protected routes
router.get('/:courseId/curriculum', authenticate, courseController.getCourseCurriculum);
router.get('/video/:lessonId', optionalAuth, courseController.streamLessonVideo);
router.get('/video/key/:lessonId', optionalAuth, courseController.getLessonVideoKey);
router.get('/video/segment/:lessonId/:segmentName', optionalAuth, courseController.streamHLSSegment);

// Quiz routes (For students) - authenticated
router.get('/lesson/:lessonId/quiz', authenticate, quizController.getQuizForStudent);
router.post('/lesson/:lessonId/quiz/submit', authenticate, quizController.submitQuiz);

module.exports = router;