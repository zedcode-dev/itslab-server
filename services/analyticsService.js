// ============================================================================
// SERVICES/ANALYTICS_SERVICE.JS - Analytics Service
// ============================================================================

const { Enrollment, Progress, Lesson, Section, sequelize } = require('../models');
const { Op } = require('sequelize');

/**
 * Get enrollment trend data
 * @param {string} courseId - Course ID
 * @param {number} days - Number of days
 * @returns {Array} Enrollment trend
 */
async function getEnrollmentTrend(courseId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const enrollments = await Enrollment.findAll({
    where: {
      course_id: courseId,
      payment_status: 'completed',
      purchase_date: {
        [Op.gte]: startDate,
      },
    },
    attributes: [
      [sequelize.fn('DATE', sequelize.col('purchase_date')), 'date'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
    ],
    group: [sequelize.fn('DATE', sequelize.col('purchase_date'))],
    order: [[sequelize.fn('DATE', sequelize.col('purchase_date')), 'ASC']],
    raw: true,
  });

  return enrollments.map(e => ({
    date: e.date,
    enrollments: parseInt(e.count),
  }));
}

/**
 * Get popular lessons
 * @param {string} courseId - Course ID
 * @returns {Array} Popular lessons
 */
async function getPopularLessons(courseId) {
  const lessons = await Progress.findAll({
    attributes: [
      'lesson_id',
      [sequelize.fn('COUNT', sequelize.col('Progress.id')), 'views'],
    ],
    include: [
      {
        model: Lesson,
        as: 'lesson',
        attributes: ['title'],
        include: [
          {
            model: Section,
            as: 'section',
            where: { course_id: courseId },
            attributes: [],
          },
        ],
      },
    ],
    group: ['Progress.lesson_id', 'lesson.id'],
    order: [[sequelize.fn('COUNT', sequelize.col('Progress.id')), 'DESC']],
    limit: 10,
    raw: true,
  });

  return lessons.map(l => ({
    lessonId: l.lesson_id,
    title: l['lesson.title'],
    views: parseInt(l.views),
  }));
}

/**
 * Get revenue trend data
 * @param {number} days - Number of days
 * @returns {Array} Revenue trend
 */
async function getRevenueTrend(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const revenue = await Enrollment.findAll({
    where: {
      payment_status: 'completed',
      purchase_date: {
        [Op.gte]: startDate,
      },
    },
    attributes: [
      [sequelize.fn('DATE', sequelize.col('purchase_date')), 'date'],
      [sequelize.fn('SUM', sequelize.col('price_paid')), 'amount'],
    ],
    group: [sequelize.fn('DATE', sequelize.col('purchase_date'))],
    order: [[sequelize.fn('DATE', sequelize.col('purchase_date')), 'ASC']],
    raw: true,
  });

  return revenue.map(r => ({
    date: r.date,
    amount: parseFloat(r.amount),
  }));
}

module.exports = {
  getEnrollmentTrend,
  getPopularLessons,
  getRevenueTrend,
};
