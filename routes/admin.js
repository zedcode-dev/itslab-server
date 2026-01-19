// ============================================================================
// ROUTES/ADMIN.JS - Admin Routes
// ============================================================================

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate } = require('../middleware/auth');
const { checkRole } = require('../middleware/roleCheck');
const { User, Course, Enrollment, sequelize } = require('../models');
const { Op } = require('sequelize');
const { successResponse, paginationMeta } = require('../utils/responseFormatter');

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(checkRole('admin'));

// Dashboard & Analytics
router.get('/dashboard', adminController.getDashboard);
router.get('/stats', adminController.getStats);
router.get('/analytics', adminController.getAnalytics);
router.get('/audit-logs', adminController.getAuditLogs);

// User management
router.get('/users', adminController.getAllUsers);
router.put('/users/:userId', adminController.updateUser);

// Course management (admin can view/edit all courses)
router.get('/courses', adminController.getAllCourses);

// Quiz results (admin can view all quiz results)
const quizController = require('../controllers/quizController');
router.get('/lesson/:lessonId/quiz/results', quizController.getQuizResults);

// Transactions
router.get('/transactions', adminController.getAllTransactions);

// Platform settings
const systemController = require('../controllers/systemController');
router.get('/settings', systemController.getAllSettings);
router.put('/settings', systemController.updateSettings);

module.exports = router;