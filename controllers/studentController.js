// ============================================================================
// CONTROLLERS/STUDENT_CONTROLLER.JS - Student Dashboard & Learning
// ============================================================================

const {
  User,
  Course,
  Enrollment,
  Progress,
  Lesson,
  Section,
  Review,
  Certificate,
  Transaction,
} = require('../models');
const { Op } = require('sequelize');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const { generateCertificate } = require('../services/certificateService');
const logger = require('../utils/logger');

/**
 * @route   GET /api/v1/student/dashboard
 * @desc    Get student dashboard data
 * @access  Private (Student)
 */
exports.getDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get enrolled courses with progress
    const enrollments = await Enrollment.findAll({
      where: { user_id: userId, payment_status: 'completed' },
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'slug', 'thumbnail_url', 'duration_hours'],
        },
      ],
      order: [['last_accessed_at', 'DESC']],
    });

    // Get certificates
    const certificates = await Certificate.findAll({
      where: { user_id: userId },
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['title'],
        },
      ],
    });

    // Calculate stats
    const totalWatchTime = await Progress.sum('watch_time_seconds', {
      include: [{
        model: Enrollment,
        as: 'enrollment',
        where: { user_id: userId },
        attributes: [],
      }],
    });

    const stats = {
      totalCoursesEnrolled: enrollments.length,
      completedCourses: enrollments.filter(e => e.completed).length,
      totalWatchTimeMinutes: Math.floor((totalWatchTime || 0) / 60),
    };

    // Optimized progress retrieval (Fixes N+1 problem)
    const enrollmentIds = enrollments.map(e => e.id);
    const latestProgressRecords = await Progress.findAll({
      where: { enrollment_id: { [Op.in]: enrollmentIds } },
      include: [{ model: Lesson, as: 'lesson', attributes: ['id', 'title'] }],
      order: [['updated_at', 'DESC']],
    });

    // Create a map of latest lesson per enrollment
    const latestLessonMap = latestProgressRecords.reduce((acc, p) => {
      if (!acc[p.enrollment_id]) {
        acc[p.enrollment_id] = p.lesson;
      }
      return acc;
    }, {});

    const enrolledCourses = enrollments.map(enrollment => {
      return {
        id: enrollment.id,
        course: enrollment.course,
        progress: parseFloat(enrollment.progress_percentage),
        lastAccessedLesson: latestLessonMap[enrollment.id] || null,
        enrollmentDate: enrollment.purchase_date || enrollment.created_at,
        completed: enrollment.completed,
      };
    });

    return successResponse(res, 200, 'Dashboard data retrieved successfully', {
      enrolledCourses,
      certificates,
      stats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/student/courses/:courseId/progress
 * @desc    Get course progress details
 * @access  Private (Student)
 */
exports.getCourseProgress = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    // Find enrollment
    const enrollment = await Enrollment.findOne({
      where: {
        user_id: userId,
        course_id: courseId,
        payment_status: 'completed',
      },
    });

    if (!enrollment) {
      return errorResponse(res, 404, 'Enrollment not found');
    }

    // Get lesson progress
    const lessonProgress = await Progress.findAll({
      where: { enrollment_id: enrollment.id },
      include: [
        {
          model: Lesson,
          as: 'lesson',
          attributes: ['id', 'title', 'section_id'],
          include: [
            {
              model: Section,
              as: 'section',
              attributes: ['title'],
            },
          ],
        },
      ],
    });

    // Find next lesson to watch
    const allLessons = await Lesson.findAll({
      include: [
        {
          model: Section,
          as: 'section',
          where: { course_id: courseId },
          attributes: ['id', 'title', 'order_index'],
        },
      ],
      order: [
        [{ model: Section, as: 'section' }, 'order_index', 'ASC'],
        ['order_index', 'ASC'],
      ],
    });

    const completedLessonIds = lessonProgress
      .filter(p => p.completed)
      .map(p => p.lesson_id);

    const nextLesson = allLessons.find(lesson => !completedLessonIds.includes(lesson.id));

    return successResponse(res, 200, 'Course progress retrieved successfully', {
      enrollment: {
        id: enrollment.id,
        courseId: enrollment.course_id,
        progress: parseFloat(enrollment.progress_percentage),
        completed: enrollment.completed,
        enrollmentDate: enrollment.purchase_date,
        completionDate: enrollment.completion_date,
      },
      lessonProgress: lessonProgress.map(p => ({
        lessonId: p.lesson_id,
        lessonTitle: p.lesson.title,
        sectionTitle: p.lesson.section.title,
        completed: p.completed,
        completedAt: p.completed_at,
        watchTimeSeconds: p.watch_time_seconds,
      })),
      nextLesson: nextLesson ? {
        id: nextLesson.id,
        title: nextLesson.title,
        sectionTitle: nextLesson.section.title,
      } : null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/student/lessons/:lessonId/complete
 * @desc    Mark lesson as complete
 * @access  Private (Student)
 */
exports.markLessonComplete = async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    const { watchTimeSeconds = 0 } = req.body;
    const userId = req.user.id;

    // Find lesson
    const lesson = await Lesson.findByPk(lessonId, {
      include: [
        {
          model: Section,
          as: 'section',
          attributes: ['course_id'],
        },
      ],
    });

    if (!lesson) {
      return errorResponse(res, 404, 'Lesson not found');
    }

    // Find enrollment
    const enrollment = await Enrollment.findOne({
      where: {
        user_id: userId,
        course_id: lesson.section.course_id,
        payment_status: 'completed',
      },
    });

    if (!enrollment) {
      return errorResponse(res, 403, 'You are not enrolled in this course');
    }

    // Create or update progress
    logger.info(`[markComplete] Creating/Updating progress for user ${userId}, lesson ${lessonId}`);
    const [progress, created] = await Progress.findOrCreate({
      where: {
        enrollment_id: enrollment.id,
        lesson_id: lessonId,
      },
      defaults: {
        completed: true,
        completed_at: new Date(),
        watch_time_seconds: watchTimeSeconds,
      },
    });
    logger.info(`[markComplete] Progress findOrCreate result: created=${created}, id=${progress.id}`);

    if (!created && !progress.completed) {
      logger.info(`[markComplete] Updating existing progress to completed`);
      await progress.update({
        completed: true,
        completed_at: new Date(),
        watch_time_seconds: watchTimeSeconds,
      });
    }

    // Update enrollment last accessed
    logger.info(`[markComplete] Updating enrollment last_accessed_at`);
    await enrollment.update({ last_accessed_at: new Date() });

    // Recalculate progress using the standardized model method
    logger.info(`[markComplete] Calling enrollment.calculateProgress()`);
    await enrollment.calculateProgress();
    logger.info(`[markComplete] enrollment.calculateProgress() finished`);

    // Check if course is completed and generate certificate
    await enrollment.reload();
    let certificateGenerated = false;

    if (enrollment.completed && !enrollment.certificate_url) {
      try {
        const certificate = await generateCertificate(enrollment.id);
        certificateGenerated = true;
        logger.info(`Certificate generated for enrollment: ${enrollment.id}`);
      } catch (certError) {
        logger.error('Certificate generation failed:', certError);
      }
    }

    return successResponse(res, 200, 'Lesson marked as complete', {
      courseProgress: parseFloat(enrollment.progress_percentage),
      certificateGenerated,
    });
  } catch (error) {
    next(error);
  }
};



/**
 * @route   GET /api/v1/student/courses/:courseId/certificate
 * @desc    Get course certificate
 * @access  Private (Student)
 */
exports.getCertificate = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    const certificate = await Certificate.findOne({
      where: {
        user_id: userId,
        course_id: courseId,
      },
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['title'],
        },
        {
          model: User,
          as: 'user',
          attributes: ['name'],
        },
      ],
    });

    if (!certificate) {
      return errorResponse(res, 404, 'Certificate not found. Complete the course to receive your certificate.');
    }

    return successResponse(res, 200, 'Certificate retrieved successfully', {
      certificateUrl: certificate.certificate_url,
      certificateId: certificate.certificate_id,
      issuedDate: certificate.issued_date,
      studentName: certificate.user.name,
      courseName: certificate.course.title,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/student/courses/:courseId/reviews
 * @desc    Submit course review
 * @access  Private (Student)
 */
exports.submitReview = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { rating, review_text: reviewText } = req.body;
    const userId = req.user.id;

    // Check if enrolled
    const enrollment = await Enrollment.findOne({
      where: {
        user_id: userId,
        course_id: courseId,
        payment_status: 'completed',
      },
    });

    if (!enrollment) {
      return errorResponse(res, 403, 'You must be enrolled in this course to leave a review');
    }

    // Check if already reviewed
    const existingReview = await Review.findOne({
      where: { user_id: userId, course_id: courseId },
    });

    if (existingReview) {
      return errorResponse(res, 400, 'You have already reviewed this course');
    }

    // Create review
    const review = await Review.create({
      user_id: userId,
      course_id: courseId,
      rating,
      review_text: reviewText,
      is_verified_purchase: true,
    });

    logger.info(`Review submitted for course ${courseId} by user ${userId}`);

    return successResponse(res, 201, 'Review submitted successfully', {
      review: {
        id: review.id,
        rating: review.rating,
        reviewText: review.review_text,
        createdAt: review.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/student/certificates
 * @desc    Get all certificates for current student
 * @access  Private (Student)
 */
exports.getCertificates = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const certificates = await Certificate.findAll({
      where: { user_id: userId },
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'slug', 'thumbnail_url'],
        },
      ],
      order: [['issued_date', 'DESC']],
    });

    return successResponse(res, 200, 'Certificates retrieved successfully', { certificates });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/student/transactions
 * @desc    Get all transactions for current student
 * @access  Private (Student)
 */
exports.getTransactions = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const transactions = await Transaction.findAll({
      where: { user_id: userId },
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'slug', 'thumbnail_url'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    return successResponse(res, 200, 'Transactions retrieved successfully', { transactions });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/student/exams/callback
 * @desc    Handle redirect from external exam system
 * @access  Private (Student)
 */
exports.handleExamCallback = async (req, res, next) => {
  try {
    const { lessonId, status } = req.query;
    const userId = req.user.id;

    if (status !== 'passed' && status !== 'completed') {
      return res.redirect(`${process.env.FRONTEND_URL}/student/courses/learn?error=exam_failed`);
    }

    // Find lesson to get course_id
    const lesson = await Lesson.findByPk(lessonId, {
      include: [{ model: Section, as: 'section', attributes: ['course_id'] }]
    });

    if (!lesson) return errorResponse(res, 404, 'Lesson not found');

    // Find enrollment
    const enrollment = await Enrollment.findOne({
      where: { user_id: userId, course_id: lesson.section.course_id, payment_status: 'completed' }
    });

    if (!enrollment) return errorResponse(res, 403, 'Unauthorized');

    // Mark as complete
    const [progress] = await Progress.findOrCreate({
      where: { enrollment_id: enrollment.id, lesson_id: lessonId },
      defaults: { completed: true, completed_at: new Date() }
    });

    if (!progress.completed) {
      await progress.update({ completed: true, completed_at: new Date() });
    }

    // Recalculate progress
    await enrollment.calculateProgress();

    // Redirect student back to course page
    return res.redirect(`${process.env.FRONTEND_URL}/student/courses/${enrollment.course_id}/learn?lessonId=${lessonId}&success=exam_passed`);
  } catch (error) {
    next(error);
  }
};