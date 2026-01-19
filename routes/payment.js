// ============================================================================
// ROUTES/PAYMENT.JS - Payment Routes
// ============================================================================

const express = require('express');
const router = express.Router();
const { Transaction, Enrollment, Course, User } = require('../models');
const { authenticate } = require('../middleware/auth');
const { isAdmin, isInstructorOrAdmin } = require('../middleware/roleCheck');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const { sendEmail } = require('../services/emailService');
const { upload } = require('../services/videoService');
const logger = require('../utils/logger');

const paymentController = require('../controllers/paymentController');

// Stripe webhook handler (Placeholder)
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  res.sendStatus(200);
});

// Paymob webhook handler (Placeholder)
router.post('/webhook/paymob', async (req, res) => {
  res.sendStatus(200);
});

// Initiate manual payment request
router.post('/initiate-manual', authenticate, upload.single('receipt'), paymentController.initiateManualPayment);

// Admin: Get all pending enrollments
router.get('/admin/pending', authenticate, isInstructorOrAdmin, paymentController.getPendingEnrollments);

// Admin: Approve/Reject enrollment
router.patch('/admin/verify/:enrollmentId', authenticate, isAdmin, paymentController.verifyEnrollment);

module.exports = router;