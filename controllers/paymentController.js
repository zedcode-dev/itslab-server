// ============================================================================
// CONTROLLERS/PAYMENT_CONTROLLER.JS - Payment Management
// ============================================================================

const { Transaction, Enrollment, Course, User } = require('../models');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const { sendEmail } = require('../services/emailService');
const { logAction } = require('../services/auditService');
const logger = require('../utils/logger');

/**
 * Initiate manual payment request
 */
exports.initiateManualPayment = async (req, res, next) => {
    try {
        const { courseId, paymentMethod, senderInfo } = req.body;
        const userId = req.user.id;

        // Restriction: Admins and Instructors cannot enroll
        if (req.user.role !== 'student') {
            return errorResponse(res, 403, 'Instructors and Admins cannot enroll in courses.');
        }

        // Check if email is verified
        if (!req.user.email_verified && !req.user.emailVerified) { // Check both potential property names
            return errorResponse(res, 403, 'Please verify your email before purchasing courses');
        }

        const course = await Course.findByPk(courseId);
        if (!course || !course.is_published) {
            return errorResponse(res, 404, 'Course not found');
        }

        const isFree = parseFloat(course.price) === 0;

        if (!isFree && !req.file) {
            return errorResponse(res, 400, 'Payment receipt screenshot is required');
        }

        // Check if already enrolled or has pending request
        const existingEnrollment = await Enrollment.findOne({
            where: { user_id: userId, course_id: courseId },
        });

        if (existingEnrollment) {
            if (existingEnrollment.payment_status === 'completed') {
                return errorResponse(res, 400, 'Already enrolled in this course');
            }
            if (existingEnrollment.payment_status === 'pending') {
                return errorResponse(res, 400, 'You already have a pending payment request for this course');
            }
        }

        const receiptUrl = req.file ? `/uploads/receipts/${req.file.filename}` : null;

        // Create enrollment
        const enrollment = await Enrollment.create({
            user_id: userId,
            course_id: courseId,
            price_paid: course.price,
            payment_status: isFree ? 'completed' : 'pending',
            payment_transaction_id: isFree ? 'FREE_ACCESS' : senderInfo,
            purchase_date: new Date(),
            metadata: {
                paymentMethod: isFree ? 'free' : paymentMethod,
                senderInfo: isFree ? 'N/A' : senderInfo,
                receiptUrl,
                requestedAt: new Date(),
                activatedAt: isFree ? new Date() : null
            }
        });

        // Create transaction record
        await Transaction.create({
            user_id: userId,
            course_id: courseId,
            amount: course.price,
            status: isFree ? 'completed' : 'pending',
            payment_method: isFree ? 'free' : paymentMethod,
            provider_transaction_id: isFree ? 'FREE_ACCESS' : senderInfo,
            metadata: { enrollmentId: enrollment.id, receiptUrl, isFree }
        });

        logger.info(`Manual payment initiated: User ${userId} requested course ${courseId} via ${paymentMethod}`);

        return successResponse(res, 201, 'Payment request submitted successfully', {
            enrollmentId: enrollment.id,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: Get all pending enrollments
 */
exports.getPendingEnrollments = async (req, res, next) => {
    try {
        const pending = await Enrollment.findAll({
            where: { payment_status: 'pending' },
            include: [
                { model: User, as: 'user', attributes: ['name', 'email'] },
                { model: Course, as: 'course', attributes: ['title', 'price'] }
            ],
            order: [['purchase_date', 'DESC']]
        });

        return successResponse(res, 200, 'Pending enrollments retrieved', { pending });
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: Approve/Reject enrollment
 */
exports.verifyEnrollment = async (req, res, next) => {
    try {
        const { enrollmentId } = req.params;
        const { status, notes } = req.body; // status: 'completed' or 'failed'

        const enrollment = await Enrollment.findByPk(enrollmentId, {
            include: [
                { model: User, as: 'user' },
                { model: Course, as: 'course' }
            ]
        });

        if (!enrollment) {
            return errorResponse(res, 404, 'Enrollment not found');
        }

        const oldStatus = enrollment.payment_status;

        await enrollment.update({
            payment_status: status,
            payment_notes: notes
        });

        // Update corresponding transaction
        const transaction = await Transaction.findOne({
            where: { user_id: enrollment.user_id, course_id: enrollment.course_id, status: 'pending' }
        });

        if (transaction) {
            await transaction.update({
                status,
                metadata: { ...transaction.metadata, adminNotes: notes }
            });
        }

        // Audit Log
        await logAction({
            userId: req.user.id,
            action: status === 'completed' ? 'PAYMENT_APPROVED' : 'PAYMENT_REJECTED',
            entityType: 'Enrollment',
            entityId: enrollment.id,
            oldValues: { status: oldStatus },
            newValues: { status, notes },
            req
        });

        if (status === 'completed') {
            // Send confirmation email
            await sendEmail({
                to: enrollment.user.email,
                subject: 'Enrollment Confirmed - ITSLab',
                template: 'enrollment-confirmation',
                data: {
                    studentName: enrollment.user.name,
                    courseName: enrollment.course.title,
                    courseUrl: `${process.env.FRONTEND_URL}/courses/${enrollment.course.slug}`,
                },
            }).catch(err => logger.error('Failed to send confirmation email:', err));
        }

        return successResponse(res, 200, `Enrollment ${status}`, { enrollment });
    } catch (error) {
        next(error);
    }
};
