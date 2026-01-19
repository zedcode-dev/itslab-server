// ============================================================================
// ROUTES/INSTRUCTOR.JS - Instructor Routes
// ============================================================================

const express = require('express');
const router = express.Router();
const instructorController = require('../controllers/instructorController');
const quizController = require('../controllers/quizController');
const { authenticate } = require('../middleware/auth');
const { isInstructorOrAdmin } = require('../middleware/roleCheck');
const { courseCreateValidation, sectionValidation, lessonValidation } = require('../middleware/validation');
const { upload } = require('../services/videoService');

// Quiz management routes (for instructors)
router.get('/lesson/:lessonId/quiz', authenticate, isInstructorOrAdmin, quizController.getQuizForInstructor);
router.post('/lesson/:lessonId/quiz', authenticate, isInstructorOrAdmin, quizController.saveQuiz);
router.get('/lesson/:lessonId/quiz/results', authenticate, isInstructorOrAdmin, quizController.getQuizResults);

// All instructor routes require authentication
router.use(authenticate);
router.use(isInstructorOrAdmin);

// Dashboard
router.get('/dashboard', instructorController.getDashboard);

// Course management
router.get('/courses', instructorController.getCourses);
router.post('/courses', upload.fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'previewVideo', maxCount: 1 }
]), courseCreateValidation, instructorController.createCourse);
router.put('/courses/:courseId', upload.fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'previewVideo', maxCount: 1 }
]), instructorController.updateCourse);
router.delete('/courses/:courseId', instructorController.deleteCourse);
router.patch('/courses/:courseId/publish', instructorController.togglePublish);

// Section management
router.post('/courses/:courseId/sections', sectionValidation, instructorController.addSection);
router.put('/sections/:sectionId', sectionValidation, instructorController.updateSection);
router.delete('/sections/:sectionId', instructorController.deleteSection);
router.patch('/courses/:courseId/sections/reorder', instructorController.reorderSections);

// Lesson management
router.post('/sections/:sectionId/lessons', upload.single('video'), lessonValidation, instructorController.addLesson);
router.put('/lessons/:lessonId', upload.single('video'), lessonValidation, instructorController.updateLesson);
router.delete('/lessons/:lessonId', instructorController.deleteLesson);
router.patch('/sections/:sectionId/lessons/reorder', instructorController.reorderLessons);

// Students
router.get('/students', instructorController.getInstructorStudents);
router.get('/courses/:courseId/students', instructorController.getCourseStudents);

// Analytics
router.get('/courses/:courseId/analytics', instructorController.getCourseAnalytics);


module.exports = router;