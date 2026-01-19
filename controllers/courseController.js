// ============================================================================
// CONTROLLERS/COURSE_CONTROLLER.JS - Course Controller
// ============================================================================

const fs = require('fs');
const path = require('path');
const { Course, Section, Lesson, Resource, Review, User, Enrollment } = require('../models');
const { Op } = require('sequelize');
const { generateUniqueSlug } = require('../utils/helpers');
const { successResponse, errorResponse, paginationMeta } = require('../utils/responseFormatter');
const logger = require('../utils/logger');

/**
 * @route   GET /api/v1/courses
 * @desc    Get all published courses (with filters)
 * @access  Public
 */
exports.getAllCourses = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      level,
      search,
      minPrice,
      maxPrice,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = req.query;

    const offset = (page - 1) * limit;

    // Build where clause
    const whereClause = { is_published: true };

    if (level) {
      whereClause.level = level;
    }

    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (minPrice || maxPrice) {
      whereClause.price = {};
      if (minPrice) whereClause.price[Op.gte] = parseFloat(minPrice);
      if (maxPrice) whereClause.price[Op.lte] = parseFloat(maxPrice);
    }

    // Fetch courses
    let { count, rows: courses } = await Course.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'instructor',
          attributes: ['id', 'name', 'email', 'bio', 'profile_picture'],
        },
      ],
      order: [[sortBy, sortOrder]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    // If user is logged in, attach enrollment status
    if (req.user) {
      const userId = req.user.id;
      const courseIds = courses.map(c => c.id);

      const enrollments = await Enrollment.findAll({
        where: {
          user_id: userId,
          course_id: { [Op.in]: courseIds },
          payment_status: { [Op.in]: ['completed', 'pending'] }
        },
        attributes: ['course_id', 'progress_percentage', 'completed', 'payment_status']
      });

      const enrollmentMap = enrollments.reduce((acc, e) => {
        acc[e.course_id] = e;
        return acc;
      }, {});

      courses = courses.map(course => {
        const courseJson = course.toJSON();
        const enrollment = enrollmentMap[course.id];
        courseJson.is_enrolled = enrollment ? enrollment.payment_status === 'completed' : false;
        courseJson.enrollment = enrollment;
        courseJson.progress_percentage = enrollment ? parseFloat(enrollment.progress_percentage) : 0;
        courseJson.is_completed = enrollment ? enrollment.completed : false;
        return courseJson;
      });
    }

    return successResponse(res, 200, 'Courses retrieved successfully', {
      courses,
      pagination: paginationMeta(page, limit, count),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/courses/:courseId
 * @desc    Get single course details
 * @access  Public
 */
exports.getCourseById = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const userId = req.user ? req.user.id : null;
    const userRole = req.user ? req.user.role : null;

    const course = await Course.findOne({
      where: { id: courseId },
      include: [
        {
          model: User,
          as: 'instructor',
          attributes: ['id', 'name', 'email', 'bio', 'profile_picture'],
        },
        {
          model: Review,
          as: 'reviews',
          limit: 10,
          order: [['created_at', 'DESC']],
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['name'],
            },
          ],
        },
      ],
    });

    // Check for enrollment if user is authenticated
    let enrollment = null;
    if (req.user) {
      enrollment = await Enrollment.findOne({
        where: {
          user_id: req.user.id,
          course_id: courseId,
          payment_status: { [Op.in]: ['completed', 'pending'] }
        }
      });
    }

    // Authorization check
    const isEnrolled = enrollment ? enrollment.payment_status === 'completed' : false;
    const isAuthorized = (course.instructor_id === userId || userRole === 'admin' || isEnrolled);

    // Published status check
    if (!course.is_published && !isAuthorized) {
      return errorResponse(res, 404, 'Course not found');
    }

    // Fetch sections and lessons (filtered based on authorization)
    const sections = await Section.findAll({
      where: { course_id: courseId },
      attributes: ['id', 'title', 'description', 'order_index'],
      order: [['order_index', 'ASC']],
      include: [
        {
          model: Lesson,
          as: 'lessons',
          attributes: ['id', 'title', 'description', 'order_index', 'video_duration_minutes', 'is_preview', 'lesson_type'],
          where: isAuthorized ? {} : { is_preview: true },
          required: false,
          order: [['order_index', 'ASC']],
        },
      ],
    });

    // Prepare response data
    const courseData = course.toJSON();
    courseData.sections = sections;
    courseData.is_enrolled = isEnrolled;
    courseData.enrollment = enrollment;

    return successResponse(res, 200, 'Course retrieved successfully', { course: courseData });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/courses/:courseId/curriculum
 * @desc    Get full course curriculum (enrolled students only)
 * @access  Private
 */
exports.getCourseCurriculum = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    // Check if user is enrolled
    const enrollment = await Enrollment.findOne({
      where: {
        user_id: userId,
        course_id: courseId,
        payment_status: 'completed',
      },
    });

    if (!enrollment && req.user.role !== 'admin') {
      return errorResponse(res, 403, 'You must be enrolled in this course to access the curriculum');
    }

    const sections = await Section.findAll({
      where: { course_id: courseId },
      include: [
        {
          model: Lesson,
          as: 'lessons',
          include: [
            {
              model: Resource,
              as: 'resources',
            },
          ],
          order: [['order_index', 'ASC']],
        },
      ],
      order: [['order_index', 'ASC']],
    });

    return successResponse(res, 200, 'Curriculum retrieved successfully', { sections });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/courses/slug/:slug
 * @desc    Get course by slug
 * @access  Public
 */
exports.getCourseBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;

    const course = await Course.findOne({
      where: { slug, is_published: true },
      include: [
        {
          model: User,
          as: 'instructor',
          attributes: ['id', 'name', 'email', 'bio', 'profile_picture'],
        },
      ],
    });

    if (!course) {
      return errorResponse(res, 404, 'Course not found');
    }

    return successResponse(res, 200, 'Course retrieved successfully', { course });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/courses/video/:lessonId
 * @desc    Stream protected lesson video (HLS or MP4)
 * @access  Private
 */
exports.streamLessonVideo = async (req, res, next) => {
  try {
    const { lessonId } = req.params;

    // 1. Find lesson
    const lesson = await Lesson.findOne({
      where: { id: lessonId },
      include: [{ model: Section, as: 'section', attributes: ['course_id'] }]
    });

    if (!lesson) {
      logger.error(`Lesson not found for streaming: ${lessonId}`);
      return errorResponse(res, 404, 'Lesson not found');
    }

    const courseId = lesson.section.course_id;
    // 2. Check Enrollment (unless Admin or Preview Lesson)
    const isGuest = !req.user;
    const isAdmin = req.user?.role === 'admin';

    if (!isAdmin && !lesson.is_preview) {
      if (isGuest) {
        return errorResponse(res, 401, 'Authentication required for non-preview content');
      }

      const enrollment = await Enrollment.findOne({
        where: { user_id: req.user.id, course_id: courseId, payment_status: 'completed' },
      });

      if (!enrollment) {
        logger.warn(`Unauthorized streaming attempt: User ${req.user.id} not enrolled in course ${courseId}`);
        return errorResponse(res, 403, 'Unauthorized: Enrollment required');
      }
    }

    // 3. Resolve File Path
    let videoUrl = lesson.video_url;
    if (!videoUrl) {
      logger.error(`Video URL is empty for lesson: ${lessonId}`);
      return errorResponse(res, 404, 'Video not available');
    }

    // Normalize path (Safe for Windows/Linux)
    const relativePath = videoUrl.startsWith('/') ? videoUrl.slice(1) : videoUrl;
    const absolutePath = path.join(process.cwd(), 'public', relativePath);

    logger.info(`Resolved Absolute Path: ${absolutePath}`);

    if (!fs.existsSync(absolutePath)) {
      logger.error(`File NOT FOUND on disk: ${absolutePath}`);
      return errorResponse(res, 404, 'Video file not found on server');
    }

    // 4. Handle HLS Playlist Detection & Patching
    if (videoUrl.endsWith('.m3u8')) {
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Cache-Control', 'no-store');

      // Read the playlist and patch it for our routing structure
      // We need to ensure segments and keys point to the correct prefixed routes
      try {
        let content = fs.readFileSync(absolutePath, 'utf8');

        // 1. Patch encryption key URI
        // Pattern matches URI="any_content" and keeps only our relative proxy route part
        content = content.replace(/URI="([^"]*)"/g, `URI="key/${lessonId}"`);

        // 2. Patch segments
        // We look for lines that don't start with # and likely contain the segment filename
        const lines = content.split(/\r?\n/);
        const patchedLines = lines.map(line => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            // Extract just the filename if it's an absolute URL and trim trailing spaces
            const filename = trimmed.split('/').pop().trim();
            return `segment/${lessonId}/${filename}`;
          }
          return line;
        });

        return res.send(patchedLines.join('\n'));
      } catch (err) {
        logger.error(`Error patching M3U8 for lesson ${lessonId}:`, err);
        // Fallback to direct stream if reading fails
        return fs.createReadStream(absolutePath).pipe(res);
      }
    }

    // 5. Handle MP4/WebM/OGG Streaming (Range Support)
    const stat = fs.statSync(absolutePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // Determine MIME type
    const ext = path.extname(absolutePath).toLowerCase();
    const mimeTypes = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.ogg': 'video/ogg',
    };
    const contentType = mimeTypes[ext] || 'video/mp4';

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(absolutePath, { start, end });

      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Cache-Control': 'no-cache',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Cache-Control': 'no-cache',
      };
      res.writeHead(200, head);
      fs.createReadStream(absolutePath).pipe(res);
    }
  } catch (error) {
    logger.error('Streaming error:', error);
    next(error);
  }
};

/**
 * @route   GET /api/v1/courses/video/key/:lessonId
 * @desc    Get AES-128 key for lesson
 * @access  Private (Session Bound)
 */
exports.getLessonVideoKey = async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    // Note: req.user may be undefined with optionalAuth

    // Verification logic (same as stream)
    const lesson = await Lesson.findOne({
      where: { id: lessonId },
      include: [{ model: Section, as: 'section', attributes: ['course_id'] }]
    });

    if (!lesson) return errorResponse(res, 404, 'Lesson not found');

    const isGuest = !req.user;
    const isAdmin = req.user?.role === 'admin';

    if (!isAdmin && !lesson.is_preview) {
      if (isGuest) return errorResponse(res, 401, 'Authentication required');

      const enrolled = await Enrollment.count({
        where: { user_id: req.user.id, course_id: lesson.section.course_id, payment_status: 'completed' }
      });
      if (!enrolled) return errorResponse(res, 403, 'Enrollment required');
    }

    const { getLessonKey } = require('../services/videoService');
    const key = getLessonKey(lessonId);

    if (!key) return errorResponse(res, 404, 'Encryption key not found');

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.send(key);
  } catch (error) {
    logger.error('Error fetching video key:', error);
    return errorResponse(res, 500, 'Failed to fetch video key');
  }
};

/**
 * @route   GET /api/v1/courses/video/segment/:lessonId/:segmentName
 * @desc    Stream HLS Segment
 * @access  Private
 */
exports.streamHLSSegment = async (req, res, next) => {
  try {
    const { lessonId, segmentName } = req.params;

    // 1. Verify access (must check if it's preview or user is enrolled)
    const lesson = await Lesson.findOne({
      where: { id: lessonId },
      include: [{ model: Section, as: 'section', attributes: ['course_id'] }]
    });

    if (!lesson) return errorResponse(res, 404, 'Lesson not found');

    const isGuest = !req.user;
    const isAdmin = req.user?.role === 'admin';

    if (!isAdmin && !lesson.is_preview) {
      if (isGuest) return errorResponse(res, 401, 'Authentication required');

      const enrolled = await Enrollment.count({
        where: { user_id: req.user.id, course_id: lesson.section.course_id, payment_status: 'completed' }
      });
      if (!enrolled) return errorResponse(res, 403, 'Enrollment required');
    }

    // 2. Stream segment
    const segmentPath = path.join(process.cwd(), 'public/uploads/videos', lessonId, segmentName);

    if (!fs.existsSync(segmentPath)) {
      return errorResponse(res, 404, 'Segment not found');
    }

    res.setHeader('Content-Type', 'video/mp2t');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    fs.createReadStream(segmentPath).pipe(res);
  } catch (error) {
    logger.error('Error streaming HLS segment:', error);
    return errorResponse(res, 500, 'Failed to stream segment');
  }
};