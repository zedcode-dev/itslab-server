// ============================================================================
// CONTROLLERS/INSTRUCTOR_CONTROLLER.JS - Instructor Dashboard & Course Mgmt
// ============================================================================

const path = require('path');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');
const { Course, Enrollment, User, Section, Lesson } = require('../models');
const { Op } = require('sequelize');
const { generateUniqueSlug } = require('../utils/helpers');
const { uploadToLocal, processToHLS, deleteFromLocal } = require('../services/videoService');
const { successResponse, errorResponse, paginationMeta } = require('../utils/responseFormatter');
const { sanitizeContent } = require('../utils/sanitization');
const analyticsService = require('../services/analyticsService');
const { addVideoJob } = require('../services/queueService');

/**
 * Helper to find course ensuring ownership or admin role
 */
const findCourseForManagement = async (courseId, user) => {
  const where = user.role === 'admin' ? { id: courseId } : { id: courseId, instructor_id: user.id };
  return await Course.findOne({ where });
};

/**
 * @route   GET /api/v1/instructor/dashboard
 * @desc    Get instructor dashboard
 * @access  Private (Instructor)
 */
exports.getDashboard = async (req, res, next) => {
  try {
    const instructorId = req.user.id;

    // Get instructor courses
    const courses = await Course.findAll({
      where: { instructor_id: instructorId },
      attributes: [
        'id',
        'title',
        'slug',
        'is_published',
        'total_students',
        'average_rating',
      ],
    });

    // Calculate total revenue
    const revenueResult = await Enrollment.findOne({
      attributes: [
        [sequelize.fn('SUM', sequelize.col('price_paid')), 'totalRevenue'],
      ],
      include: [
        {
          model: Course,
          as: 'course',
          where: { instructor_id: instructorId },
          attributes: [],
        },
      ],
      where: { payment_status: 'completed' },
      raw: true,
    });

    // Get recent enrollments
    const recentEnrollments = await Enrollment.findAll({
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['name', 'email'],
        },
        {
          model: Course,
          as: 'course',
          where: { instructor_id: instructorId },
          attributes: ['title'],
        },
      ],
      where: { payment_status: 'completed' },
      order: [['purchase_date', 'DESC']],
      limit: 10,
    });

    // Optimized completion rate calculation using aggregation
    const completionStats = await Enrollment.findAll({
      attributes: [
        'course_id',
        [sequelize.fn('COUNT', sequelize.col('Enrollment.id')), 'total'],
        [sequelize.literal("COUNT(CASE WHEN completed = true THEN 1 END)"), 'completedCount']
      ],
      include: [{
        model: Course,
        as: 'course',
        where: { instructor_id: instructorId },
        attributes: []
      }],
      where: { payment_status: 'completed' },
      group: ['course_id'],
      raw: true
    });

    const averageCompletionRate = completionStats.length > 0
      ? completionStats.reduce((sum, s) => sum + (parseInt(s.completedCount) / parseInt(s.total) * 100), 0) / completionStats.length
      : 0;

    const stats = {
      totalStudents: courses.reduce((sum, c) => sum + c.total_students, 0),
      totalRevenue: parseFloat(revenueResult?.totalRevenue || 0),
      totalCourses: courses.length,
      averageCompletionRate: parseFloat(averageCompletionRate.toFixed(2)),
    };

    return successResponse(res, 200, 'Dashboard data retrieved successfully', {
      stats,
      recentEnrollments: recentEnrollments.map(e => ({
        id: e.id,
        student: {
          name: e.user.name,
          email: e.user.email,
        },
        course: {
          title: e.course.title,
        },
        enrollmentDate: e.purchase_date,
      })),
      courses: courses.map(c => ({
        id: c.id,
        title: c.title,
        slug: c.slug,
        isPublished: c.is_published,
        totalStudents: c.total_students,
        averageRating: parseFloat(c.average_rating),
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/instructor/courses
 * @desc    Get all courses for instructor
 * @access  Private (Instructor)
 */
exports.getCourses = async (req, res, next) => {
  try {
    const instructorId = req.user.id;
    const { page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = { instructor_id: instructorId };
    if (search) {
      whereClause.title = { [Op.iLike]: `%${search}%` };
    }

    const { count, rows: courses } = await Course.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']],
    });

    return successResponse(res, 200, 'Courses retrieved successfully', {
      courses,
      pagination: paginationMeta(page, limit, count),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/instructor/courses
 * @desc    Create new course
 * @access  Private (Instructor)
 */
exports.createCourse = async (req, res, next) => {
  try {
    const {
      title,
      shortDescription,
      description,
      price,
      currency = 'EGP',
      level,
      language = 'ar',
      requirements = [],
      learningOutcomes = [],
      durationHours = 0,
    } = req.body;

    const instructorId = req.user.id;
    logger.info('Create Course Multipart Body:', req.body);
    logger.info('Create Course Multipart Files:', req.files);

    // Handle files
    let thumbnailUrl = null;
    let previewVideoUrl = null;

    if (req.files) {
      if (req.files.thumbnail) {
        thumbnailUrl = await uploadToLocal(req.files.thumbnail[0]);
      }
      if (req.files.previewVideo) {
        previewVideoUrl = await uploadToLocal(req.files.previewVideo[0]);
      }
    }

    // Generate unique slug
    const slug = await generateUniqueSlug(title, Course, 'slug');

    // Secure HTML Sanitization
    const sanitizedDescription = sanitizeContent(description);

    // Create course
    const course = await Course.create({
      instructor_id: instructorId,
      title,
      slug,
      short_description: shortDescription,
      description: sanitizedDescription,
      price: parseFloat(price) || 0,
      currency,
      level,
      language,
      requirements: Array.isArray(requirements) ? requirements : JSON.parse(requirements || '[]'),
      learning_outcomes: Array.isArray(learningOutcomes) ? learningOutcomes : JSON.parse(learningOutcomes || '[]'),
      thumbnail_url: thumbnailUrl,
      preview_video_url: previewVideoUrl,
      duration_hours: parseInt(durationHours) || 0,
      is_published: false,
    });

    logger.info(`Course created: ${course.id} by instructor ${instructorId}`);

    return successResponse(res, 201, 'Course created successfully', {
      course: {
        id: course.id,
        title: course.title,
        slug: course.slug,
        isPublished: course.is_published,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/v1/instructor/courses/:courseId
 * @desc    Update course
 * @access  Private (Instructor)
 */
exports.updateCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    logger.info('Update Course Multipart Body:', req.body);
    logger.info('Update Course Multipart Files:', req.files);
    const course = await findCourseForManagement(courseId, req.user);

    if (!course) {
      return errorResponse(res, 404, 'Course not found or unauthorized');
    }

    // Update allowed fields
    const allowedFields = [
      'title',
      'short_description',
      'description',
      'price',
      'level',
      'requirements',
      'learning_outcomes',
      'duration_hours',
    ];

    // Map camelCase to snake_case if necessary
    if (req.body.durationHours !== undefined && req.body.duration_hours === undefined) {
      req.body.duration_hours = req.body.durationHours;
    }
    if (req.body.shortDescription !== undefined && req.body.short_description === undefined) {
      req.body.short_description = req.body.shortDescription;
    }
    if (req.body.learningOutcomes !== undefined && req.body.learning_outcomes === undefined) {
      req.body.learning_outcomes = req.body.learningOutcomes;
    }

    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        let value = req.body[field];
        // Handle array fields if they come as strings
        if ((field === 'requirements' || field === 'learning_outcomes') && typeof value === 'string') {
          try { value = JSON.parse(value); } catch (e) { value = [value]; }
        }
        // Secure HTML Sanitization
        if (field === 'description' && value) {
          value = sanitizeContent(value);
        }
        updates[field] = value;
      }
    });

    // Handle files
    if (req.files) {

      if (req.files.thumbnail) {
        logger.info('Updating thumbnail...');
        // Delete old one if exists
        if (course.thumbnail_url && course.thumbnail_url.startsWith('/uploads/')) {
          await deleteFromLocal(course.thumbnail_url).catch(() => { });
        }
        updates.thumbnail_url = await uploadToLocal(req.files.thumbnail[0]);
        logger.info('New thumbnail URL:', updates.thumbnail_url);
      }

      if (req.files.previewVideo) {
        // Delete old one if exists
        if (course.preview_video_url && course.preview_video_url.startsWith('/uploads/')) {
          await deleteFromLocal(course.preview_video_url).catch(() => { });
        }
        updates.preview_video_url = await uploadToLocal(req.files.previewVideo[0]);
      }
    }

    // Update slug if title changed
    if (req.body.title && req.body.title !== course.title) {
      updates.slug = await generateUniqueSlug(req.body.title, Course, 'slug');
    }

    await course.update(updates);

    logger.info(`Course updated: ${courseId}`);

    return successResponse(res, 200, 'Course updated successfully', {
      course: {
        id: course.id,
        thumbnail_url: course.thumbnail_url,
        preview_video_url: course.preview_video_url
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/instructor/courses/:courseId/sections
 * @desc    Add section to course
 * @access  Private (Instructor)
 */
exports.addSection = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { title, description, orderIndex } = req.body;

    // Verify course access
    const course = await findCourseForManagement(courseId, req.user);

    if (!course) {
      return errorResponse(res, 404, 'Course not found or unauthorized');
    }

    // Auto-calculate orderIndex if not provided
    let finalOrderIndex = orderIndex;
    if (finalOrderIndex === undefined || finalOrderIndex === null) {
      const lastSection = await Section.findOne({
        where: { course_id: courseId },
        order: [['order_index', 'DESC']]
      });
      finalOrderIndex = (lastSection?.order_index || 0) + 1;
    }

    const section = await Section.create({
      course_id: courseId,
      title,
      description,
      order_index: finalOrderIndex,
    });

    return successResponse(res, 201, 'Section created successfully', {
      section: {
        id: section.id,
        title: section.title,
        orderIndex: section.order_index,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/instructor/sections/:sectionId/lessons
 * @desc    Add lesson to section
 * @access  Private (Instructor)
 */
exports.addLesson = async (req, res, next) => {
  try {
    const { sectionId } = req.params;
    const { title, description, orderIndex, durationMinutes, isPreview = false, lessonType = 'video', content } = req.body;
    const instructorId = req.user.id;

    // Validation: Video lesson requires file
    if (lessonType === 'video' && !req.file) {
      return errorResponse(res, 400, 'Video file is required for video lessons');
    }

    // Validation: Text lesson requires content
    if (lessonType === 'text' && (!content || content.trim() === '')) {
      return errorResponse(res, 400, 'Content is required for text lessons');
    }

    // Verify section ownership
    const section = await Section.findOne({
      where: { id: sectionId },
      include: [
        {
          model: Course,
          as: 'course',
          where: req.user.role === 'admin' ? {} : { instructor_id: req.user.id },
          attributes: ['id'],
        },
      ],
    });

    if (!section) {
      return errorResponse(res, 404, 'Section not found or unauthorized');
    }

    // Handle video upload
    let videoUrl = null;
    if (req.file) {
      // 1. Save original MP4 locally
      const originalPath = await uploadToLocal(req.file);
      const absoluteInputPath = path.join(process.cwd(), 'public', originalPath);

      // 2. Set interim URL (it will be updated after processing)
      videoUrl = originalPath;

      // 3. Trigger HLS processing in background (Async)
      // We create the lesson first to get the ID
      const lesson = await Lesson.create({
        section_id: sectionId,
        title,
        description,
        lesson_type: lessonType,
        content: lessonType === 'text' ? sanitizeContent(content) : null,
        video_url: videoUrl, // Temporarily the MP4
        video_duration_minutes: durationMinutes || 0,
        order_index: orderIndex,
        is_preview: isPreview === 'true' || isPreview === true,
      });

      // Background process: Enqueue HLS conversion job
      await addVideoJob(lesson.id, absoluteInputPath);

      // Update course duration
      const course = await Course.findByPk(section.course.id);
      if (course) await course.calculateDuration();

      return successResponse(res, 201, 'Lesson created and processing started', {
        lesson: {
          id: lesson.id,
          title: lesson.title,
          videoUrl: lesson.video_url,
          processing: true
        },
      });
    }

    // If no video (Text Lesson or fallback)
    const lesson = await Lesson.create({
      section_id: sectionId,
      title,
      description,
      lesson_type: lessonType,
      content: lessonType === 'text' ? sanitizeContent(content) : null,
      video_url: null,
      video_duration_minutes: durationMinutes || 0,
      order_index: orderIndex,
      is_preview: isPreview === 'true' || isPreview === true,
    });

    // Update course duration
    const course = await Course.findByPk(section.course.id);
    if (course) await course.calculateDuration();

    return successResponse(res, 201, 'Lesson created successfully', {
      lesson: {
        id: lesson.id,
        title: lesson.title,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/instructor/courses/:courseId/publish
 * @desc    Publish/unpublish course
 * @access  Private (Instructor)
 */
exports.togglePublish = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { isPublished } = req.body;

    const course = await findCourseForManagement(courseId, req.user);

    if (!course) {
      return errorResponse(res, 404, 'Course not found or unauthorized');
    }

    await course.update({
      is_published: isPublished,
      published_at: isPublished ? new Date() : null,
    });

    logger.info(`Course ${courseId} ${isPublished ? 'published' : 'unpublished'}`);

    return successResponse(res, 200, `Course ${isPublished ? 'published' : 'unpublished'} successfully`);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/instructor/courses/:courseId/students
 * @desc    Get students enrolled in course
 * @access  Private (Instructor)
 */
exports.getCourseStudents = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Verify course access
    const course = await findCourseForManagement(courseId, req.user);

    if (!course) {
      return errorResponse(res, 404, 'Course not found or unauthorized');
    }

    const { count, rows: enrollments } = await Enrollment.findAndCountAll({
      where: { course_id: courseId, payment_status: 'completed' },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email'],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['purchase_date', 'DESC']],
    });

    const students = enrollments.map(e => ({
      id: e.user.id,
      name: e.user.name,
      email: e.user.email,
      enrollmentDate: e.purchase_date,
      progress: parseFloat(e.progress_percentage),
      lastActive: e.last_accessed_at,
      completed: e.completed,
    }));

    return successResponse(res, 200, 'Students retrieved successfully', {
      students,
      pagination: paginationMeta(page, limit, count),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/instructor/students
 * @desc    Get all students enrolled in any of the instructor's courses
 * @access  Private (Instructor)
 */
exports.getInstructorStudents = async (req, res, next) => {
  try {
    const instructorId = req.user.id;
    const { page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {
      payment_status: 'completed',
    };

    const { count, rows: enrollments } = await Enrollment.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'profile_picture'],
          where: search ? {
            [Op.or]: [
              { name: { [Op.iLike]: `%${search}%` } },
              { email: { [Op.iLike]: `%${search}%` } }
            ]
          } : {}
        },
        {
          model: Course,
          as: 'course',
          where: { instructor_id: instructorId },
          attributes: ['id', 'title']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['purchase_date', 'DESC']],
    });

    return successResponse(res, 200, 'All students retrieved successfully', {
      students: enrollments,
      pagination: paginationMeta(page, limit, count),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/v1/instructor/sections/:sectionId
 * @desc    Update section
 */
exports.updateSection = async (req, res, next) => {
  try {
    const { sectionId } = req.params;
    const { title, description } = req.body;

    const section = await Section.findOne({
      where: { id: sectionId },
      include: [{
        model: Course,
        as: 'course',
        where: req.user.role === 'admin' ? {} : { instructor_id: req.user.id }
      }],
    });

    if (!section) return errorResponse(res, 404, 'Section not found or unauthorized');

    await section.update({ title, description });
    return successResponse(res, 200, 'Section updated successfully');
  } catch (error) { next(error); }
};

/**
 * @route   DELETE /api/v1/instructor/sections/:sectionId
 * @desc    Delete section
 */
exports.deleteSection = async (req, res, next) => {
  try {
    const { sectionId } = req.params;
    const section = await Section.findOne({
      where: { id: sectionId },
      include: [
        {
          model: Course,
          as: 'course',
          where: req.user.role === 'admin' ? {} : { instructor_id: req.user.id }
        },
        {
          model: Lesson,
          as: 'lessons'
        }
      ],
    });

    if (!section) return errorResponse(res, 404, 'Section not found or unauthorized');

    // Cleanup lesson videos
    if (section.lessons) {
      for (const lesson of section.lessons) {
        if (lesson.video_url && lesson.video_url.startsWith('/uploads/')) {
          try {
            await deleteFromLocal(lesson.video_url);
          } catch (err) {
            logger.error(`Failed to delete video for lesson ${lesson.id} during section deletion`, err);
          }
        }
      }
    }

    await section.destroy();
    return successResponse(res, 200, 'Section deleted successfully');
  } catch (error) { next(error); }
};

/**
 * @route   PUT /api/v1/instructor/lessons/:lessonId
 * @desc    Update lesson
 */
exports.updateLesson = async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    const { title, description, durationMinutes, isPreview, lessonType, content } = req.body;

    const lesson = await Lesson.findOne({
      where: { id: lessonId },
      include: [
        {
          model: Section,
          as: 'section',
          include: [{
            model: Course,
            as: 'course',
            where: req.user.role === 'admin' ? {} : { instructor_id: req.user.id }
          }],
        },
      ],
    });

    if (!lesson) return errorResponse(res, 404, 'Lesson not found or unauthorized');

    const updates = {
      title,
      description,
      video_duration_minutes: durationMinutes,
      is_preview: isPreview === 'true' || isPreview === true,
      lesson_type: lessonType || lesson.lesson_type,
      content: lessonType === 'text' ? content : (lessonType === 'video' ? null : lesson.content),
    };

    // Validation for update
    const finalType = updates.lesson_type;
    if (finalType === 'video' && !req.file && !lesson.video_url) {
      return errorResponse(res, 400, 'Video lesson requires a video file');
    }
    if (finalType === 'text' && (!updates.content || updates.content.trim() === '')) {
      return errorResponse(res, 400, 'Text content is required for text lessons');
    }

    if (req.file) {
      if (lesson.video_url && lesson.video_url.startsWith('/uploads/')) {
        const { deleteFromLocal } = require('../services/videoService');
        await deleteFromLocal(lesson.video_url);
      }
      const originalPath = await uploadToLocal(req.file);
      const absoluteInputPath = path.join(process.cwd(), 'public', originalPath);
      updates.video_url = originalPath;

      // Update basic fields first
      await lesson.update(updates);

      // Trigger background HLS conversion job
      await addVideoJob(lesson.id, absoluteInputPath);

      // Update course duration
      const course = await Course.findByPk(lesson.section.course.id);
      if (course) await course.calculateDuration();

      return successResponse(res, 200, 'Lesson updated and video processing started');
    }

    await lesson.update(updates);

    // Update course duration if duration changed
    if (updates.video_duration_minutes !== undefined) {
      const course = await Course.findByPk(lesson.section.course.id);
      if (course) await course.calculateDuration();
    }

    return successResponse(res, 200, 'Lesson updated successfully');
  } catch (error) { next(error); }
};

/**
 * @route   DELETE /api/v1/instructor/lessons/:lessonId
 * @desc    Delete lesson
 */
exports.deleteLesson = async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    const lesson = await Lesson.findOne({
      where: { id: lessonId },
      include: [
        {
          model: Section,
          as: 'section',
          include: [{
            model: Course,
            as: 'course',
            where: req.user.role === 'admin' ? {} : { instructor_id: req.user.id }
          }],
        },
      ],
    });

    if (!lesson) return errorResponse(res, 404, 'Lesson not found or unauthorized');

    if (lesson.video_url && lesson.video_url.startsWith('/uploads/')) {
      const { deleteFromLocal } = require('../services/videoService');
      await deleteFromLocal(lesson.video_url);
    }

    const courseId = lesson.section.course.id;
    await lesson.destroy();

    // Update course duration after deletion
    const course = await Course.findByPk(courseId);
    if (course) await course.calculateDuration();

    return successResponse(res, 200, 'Lesson deleted successfully');
  } catch (error) { next(error); }
};

/**
 * @route   DELETE /api/v1/instructor/courses/:courseId
 * @desc    Delete course and all its content/media
 */
exports.deleteCourse = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { courseId } = req.params;
    const instructorId = req.user.id;

    // 1. Find the course with security check
    const course = await Course.findOne({
      where: req.user.role === 'admin' ? { id: courseId } : { id: courseId, instructor_id: instructorId },
      include: [
        {
          model: Section,
          as: 'sections',
          include: [{ model: Lesson, as: 'lessons' }]
        }
      ]
    });

    if (!course) {
      await transaction.rollback();
      return errorResponse(res, 404, 'Course not found or unauthorized');
    }

    // 2. Collect all media to delete
    const filesToDelete = [];
    if (course.thumbnail_url) filesToDelete.push(course.thumbnail_url);
    if (course.preview_video_url) filesToDelete.push(course.preview_video_url);

    if (course.sections) {
      for (const section of course.sections) {
        if (section.lessons) {
          for (const lesson of section.lessons) {
            if (lesson.video_url) filesToDelete.push(lesson.video_url);
          }
        }
      }
    }

    // 3. Delete from Database (CASCADE will handle Sections and Lessons)
    await course.destroy({ transaction });

    // 4. Cleanup files from disk (after DB success)
    for (const fileUrl of filesToDelete) {
      try {
        await deleteFromLocal(fileUrl);
      } catch (err) {
        logger.error(`Failed to delete file during course deletion: ${fileUrl}`, err);
      }
    }

    await transaction.commit();
    logger.info(`Course ${courseId} and all media deleted by user ${req.user.id}`);

    return successResponse(res, 200, 'Course and all associated data deleted successfully');
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/instructor/courses/:courseId/sections/reorder
 * @desc    Reorder sections
 */
exports.reorderSections = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { courseId } = req.params;
    const { sectionIds } = req.body;

    const course = await findCourseForManagement(courseId, req.user);

    if (!course) {
      await transaction.rollback();
      return errorResponse(res, 404, 'Course not found or unauthorized');
    }

    // First set all to negative to avoid unique constraint collision
    for (let i = 0; i < sectionIds.length; i++) {
      await Section.update({ order_index: -(i + 1) }, { where: { id: sectionIds[i], course_id: courseId }, transaction });
    }

    // Then set to final values
    for (let i = 0; i < sectionIds.length; i++) {
      await Section.update({ order_index: i + 1 }, { where: { id: sectionIds[i], course_id: courseId }, transaction });
    }

    await transaction.commit();
    return successResponse(res, 200, 'Sections reordered successfully');
  } catch (error) { await transaction.rollback(); next(error); }
};

/**
 * @route   PATCH /api/v1/instructor/sections/:sectionId/lessons/reorder
 * @desc    Reorder lessons
 */
exports.reorderLessons = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { sectionId } = req.params;
    const { lessonIds } = req.body;

    const section = await Section.findOne({
      where: { id: sectionId },
      include: [{
        model: Course,
        as: 'course',
        where: req.user.role === 'admin' ? {} : { instructor_id: req.user.id }
      }],
    });

    if (!section) {
      await transaction.rollback();
      return errorResponse(res, 404, 'Section not found or unauthorized');
    }

    // First set all to negative to avoid unique constraint collision
    for (let i = 0; i < lessonIds.length; i++) {
      await Lesson.update({ order_index: -(i + 1) }, { where: { id: lessonIds[i], section_id: sectionId }, transaction });
    }

    // Then set to final positive values
    for (let i = 0; i < lessonIds.length; i++) {
      await Lesson.update({ order_index: i + 1 }, { where: { id: lessonIds[i], section_id: sectionId }, transaction });
    }

    await transaction.commit();
    return successResponse(res, 200, 'Lessons reordered successfully');
  } catch (error) { await transaction.rollback(); next(error); }
};

/**
 * @route   GET /api/v1/instructor/courses/:courseId/analytics
 * @desc    Get detailed analytics for a course
 */
exports.getCourseAnalytics = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const instructorId = req.user.id;

    // Verify course ownership
    const course = await findCourseForManagement(courseId, req.user);

    if (!course) {
      return errorResponse(res, 404, 'Course not found or unauthorized');
    }

    const enrollmentTrend = await analyticsService.getEnrollmentTrend(courseId);
    const popularLessons = await analyticsService.getPopularLessons(courseId);

    // Calculate metrics
    const totalEnrollments = await Enrollment.count({
      where: { course_id: courseId, payment_status: 'completed' },
    });

    const completedEnrollments = await Enrollment.count({
      where: { course_id: courseId, completed: true },
    });

    const completionRate = totalEnrollments > 0
      ? (completedEnrollments / totalEnrollments) * 100
      : 0;

    const avgProgress = await Enrollment.findOne({
      attributes: [[sequelize.fn('AVG', sequelize.col('progress_percentage')), 'avgProgress']],
      where: { course_id: courseId, payment_status: 'completed' },
      raw: true,
    });

    const totalRevenue = await Enrollment.sum('price_paid', {
      where: { course_id: courseId, payment_status: 'completed' },
    });

    return successResponse(res, 200, 'Analytics retrieved successfully', {
      enrollmentTrend,
      completionRate: parseFloat(completionRate.toFixed(2)),
      averageProgressPerStudent: parseFloat((avgProgress?.avgProgress || 0).toFixed(2)),
      totalRevenue: parseFloat(totalRevenue || 0),
      averageRating: parseFloat(course.average_rating),
      popularLessons,
    });
  } catch (error) {
    next(error);
  }
};

// --- Moved Helpers to analyticsService.js ---
