// ============================================================================
// CONTROLLERS/ADMIN_CONTROLLER.JS - Admin Panel
// ============================================================================

const { User, Course, Enrollment, AuditLog, sequelize } = require('../models');
const { Op } = require('sequelize');
const { successResponse, errorResponse, paginationMeta } = require('../utils/responseFormatter');
const { sanitizeContent } = require('../utils/sanitization');
const logger = require('../utils/logger');

/**
 * @route   GET /api/v1/admin/dashboard
 * @desc    Get admin dashboard
 * @access  Private (Admin)
 */
exports.getAdminDashboard = async (req, res, next) => {
  try {
    // Get total counts
    const totalUsers = await User.count();
    const totalStudents = await User.count({ where: { role: 'student' } });
    const totalInstructors = await User.count({ where: { role: 'instructor' } });
    const totalCourses = await Course.count();
    const publishedCourses = await Course.count({ where: { is_published: true } });

    // Get total revenue
    const revenueResult = await Enrollment.findOne({
      attributes: [[sequelize.fn('SUM', sequelize.col('price_paid')), 'totalRevenue']],
      where: { payment_status: 'completed' },
      raw: true,
    });

    const totalTransactions = await Enrollment.count({ where: { payment_status: 'completed' } });

    const stats = {
      totalUsers,
      totalStudents,
      totalInstructors,
      totalCourses,
      publishedCourses,
      totalRevenue: parseFloat(revenueResult?.totalRevenue || 0),
      totalTransactions,
    };

    // Get recent activity (last 20 enrollments)
    const recentActivity = await Enrollment.findAll({
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['name'],
        },
        {
          model: Course,
          as: 'course',
          attributes: ['title'],
        },
      ],
      where: { payment_status: 'completed' },
      order: [['purchase_date', 'DESC']],
      limit: 20,
    });

    return successResponse(res, 200, 'Admin dashboard data retrieved', {
      stats,
      recentActivity: recentActivity.map(e => ({
        type: 'enrollment',
        user: e.user.name,
        course: e.course.title,
        timestamp: e.purchase_date,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/admin/users
 * @desc    Get all users with filters
 * @access  Private (Admin)
 */
exports.getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (role) {
      whereClause.role = role;
    }
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows: users } = await User.findAndCountAll({
      where: whereClause,
      attributes: { exclude: ['password_hash', 'refresh_token'] },
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']],
    });

    return successResponse(res, 200, 'Users retrieved successfully', {
      users,
      pagination: paginationMeta(page, limit, count),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/v1/admin/users/:userId
 * @desc    Update user (activate/deactivate, change role)
 * @access  Private (Admin)
 */
exports.updateUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { isActive, role, name, email, bio } = req.body;
    logger.debug('Update User Request', { userId, isActive, role, currentAdminId: req.user.id });

    // Safety checks: Prevent self-deactivation or deactivating other admins
    const targetUser = await User.findByPk(userId);
    if (!targetUser) {
      return errorResponse(res, 404, 'User not found');
    }

    if (isActive === false) {
      if (userId === req.user.id) {
        return errorResponse(res, 400, 'You cannot deactivate your own account');
      }
      if (targetUser.role === 'admin') {
        return errorResponse(res, 400, 'Admin accounts cannot be deactivated');
      }
    }

    if (role && role !== targetUser.role && targetUser.role === 'admin') {
      return errorResponse(res, 400, 'Admin roles cannot be changed');
    }

    const updates = {};
    if (isActive !== undefined) updates.is_active = isActive;
    if (role && ['student', 'instructor', 'admin'].includes(role)) {
      updates.role = role;
    }
    if (name) updates.name = name;
    if (email) updates.email = email;
    if (bio !== undefined) updates.bio = bio ? sanitizeContent(bio) : bio;

    const oldValues = {
      isActive: targetUser.is_active,
      role: targetUser.role,
      name: targetUser.name,
      email: targetUser.email,
    };

    await targetUser.update(updates);

    // Audit Log
    const { logAction } = require('../services/auditService');
    await logAction({
      userId: req.user.id,
      action: 'USER_UPDATED',
      entityType: 'User',
      entityId: targetUser.id,
      oldValues,
      newValues: updates,
      req
    });

    logger.info(`User ${userId} updated by admin ${req.user.id}`);

    return successResponse(res, 200, 'User updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/admin/stats
 * @desc    Get aggregate stats for dashboard
 */
exports.getStats = async (req, res, next) => {
  try {
    const totalUsers = await User.count();
    const totalStudents = await User.count({ where: { role: 'student' } });
    const totalCourses = await Course.count();
    const { count: totalEnrollments, rows: enrollments } = await Enrollment.findAndCountAll({
      where: { payment_status: 'completed' },
      attributes: ['price_paid']
    });

    const totalRevenue = enrollments.reduce((sum, e) => sum + parseFloat(e.price_paid || 0), 0);

    return successResponse(res, 200, 'Stats retrieved', {
      totalUsers,
      totalStudents,
      totalCourses,
      totalEnrollments,
      totalRevenue
    });
  } catch (error) { next(error); }
};

/**
 * @route   GET /api/v1/admin/analytics
 * @desc    Get detailed analytics
 */
exports.getAnalytics = async (req, res, next) => {
  try {
    // Placeholder for more complex analytics
    const topCourses = await Course.findAll({
      order: [['total_students', 'DESC']],
      limit: 5,
      attributes: ['id', 'title', 'total_students', 'average_rating']
    });

    return successResponse(res, 200, 'Analytics retrieved', {
      topCourses
    });
  } catch (error) { next(error); }
};

/**
 * @route   GET /api/v1/admin/audit-logs
 * @desc    Get system audit logs
 * @access  Private (Admin)
 */
exports.getAuditLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, action, entityType } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (action) whereClause.action = action;
    if (entityType) whereClause.entity_type = entityType;

    const { count, rows: logs } = await AuditLog.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['name', 'email'],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']],
    });

    return successResponse(res, 200, 'Audit logs retrieved successfully', {
      logs,
      pagination: paginationMeta(page, limit, count),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/admin/courses
 * @desc    Get all courses (Admin)
 */
exports.getAllCourses = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (search) {
      whereClause.title = { [Op.iLike]: `%${search}%` };
    }

    const { count, rows: courses } = await Course.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'instructor',
          attributes: ['name', 'email'],
        },
      ],
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
 * @route   GET /api/v1/admin/transactions
 * @desc    Get all transactions/enrollments (Admin)
 */
exports.getAllTransactions = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, status } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (status && status !== 'all') whereClause.payment_status = status;

    const { count, rows: transactions } = await Enrollment.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['name', 'email'],
        },
        {
          model: Course,
          as: 'course',
          attributes: ['title'],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['purchase_date', 'DESC']],
    });

    return successResponse(res, 200, 'Transactions retrieved successfully', {
      transactions: transactions.map(t => ({
        id: t.id,
        date: t.purchase_date,
        student: t.user,
        course: t.course.title,
        amount: parseFloat(t.price_paid),
        status: t.payment_status,
        payment_transaction_id: t.payment_transaction_id,
        metadata: t.metadata,
        payment_notes: t.payment_notes
      })),
      pagination: paginationMeta(page, limit, count),
    });
  } catch (error) {
    next(error);
  }
};

// Map old method name specifically if needed by routes
exports.getDashboard = exports.getAdminDashboard;

module.exports = exports;