// ============================================================================
// MODELS/INDEX.JS - Model Registry and Associations
// ============================================================================

const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

// Import all models
const User = require('./User')(sequelize, DataTypes);
const Course = require('./Course')(sequelize, DataTypes);
const Section = require('./Section')(sequelize, DataTypes);
const Lesson = require('./Lesson')(sequelize, DataTypes);
const Resource = require('./Resource')(sequelize, DataTypes);
const Enrollment = require('./Enrollment')(sequelize, DataTypes);
const Progress = require('./Progress')(sequelize, DataTypes);
const Review = require('./Review')(sequelize, DataTypes);
const Transaction = require('./Transaction')(sequelize, DataTypes);
const Certificate = require('./Certificate')(sequelize, DataTypes);
const Notification = require('./Notification')(sequelize, DataTypes);
const AuditLog = require('./AuditLog')(sequelize, DataTypes);
const SystemSetting = require('./SystemSetting')(sequelize, DataTypes);
const Quiz = require('./Quiz')(sequelize, DataTypes);
const QuizQuestion = require('./QuizQuestion')(sequelize, DataTypes);
const QuizOption = require('./QuizOption')(sequelize, DataTypes);
const QuizAttempt = require('./QuizAttempt')(sequelize, DataTypes);

// ============================================================================
// DEFINE ASSOCIATIONS
// ============================================================================

// User associations
User.hasMany(Course, { foreignKey: 'instructor_id', as: 'courses' });
User.hasMany(Enrollment, { foreignKey: 'user_id', as: 'enrollments', onDelete: 'RESTRICT' });
User.hasMany(Review, { foreignKey: 'user_id', as: 'reviews' });
User.hasMany(Transaction, { foreignKey: 'user_id', as: 'transactions', onDelete: 'RESTRICT' });
User.hasMany(Certificate, { foreignKey: 'user_id', as: 'certificates' });
User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });
User.hasMany(AuditLog, { foreignKey: 'user_id', as: 'auditLogs' });

// AuditLog associations
AuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });


// Course associations
Course.belongsTo(User, { foreignKey: 'instructor_id', as: 'instructor' });
Course.hasMany(Section, { foreignKey: 'course_id', as: 'sections' });
Course.hasMany(Enrollment, { foreignKey: 'course_id', as: 'enrollments' });
Course.hasMany(Review, { foreignKey: 'course_id', as: 'reviews' });
Course.hasMany(Transaction, { foreignKey: 'course_id', as: 'transactions' });
Course.hasMany(Certificate, { foreignKey: 'course_id', as: 'certificates' });

// Enrollment associations
Enrollment.belongsTo(User, { foreignKey: 'user_id', as: 'user', onDelete: 'RESTRICT' });
Enrollment.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });
Enrollment.hasMany(Progress, { foreignKey: 'enrollment_id', as: 'progress' });

// Review associations
Review.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Review.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });

// Transaction associations
Transaction.belongsTo(User, { foreignKey: 'user_id', as: 'user', onDelete: 'RESTRICT' });
Transaction.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });

// Certificate associations
Certificate.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Certificate.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });

// Notification associations
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });


// Section associations
Section.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });
Section.hasMany(Lesson, { foreignKey: 'section_id', as: 'lessons' });

// Lesson associations
Lesson.belongsTo(Section, { foreignKey: 'section_id', as: 'section' });
Lesson.hasMany(Resource, { foreignKey: 'lesson_id', as: 'resources' });
Lesson.hasMany(Progress, { foreignKey: 'lesson_id', as: 'progress' });

// Resource associations
Resource.belongsTo(Lesson, { foreignKey: 'lesson_id', as: 'lesson' });

// Progress associations
Progress.belongsTo(Enrollment, { foreignKey: 'enrollment_id', as: 'enrollment' });
Progress.belongsTo(Lesson, { foreignKey: 'lesson_id', as: 'lesson' });

Lesson.hasOne(Quiz, { foreignKey: 'lesson_id', as: 'quiz' });

// Quiz associations
Quiz.belongsTo(Lesson, { foreignKey: 'lesson_id', as: 'lesson' });
Quiz.hasMany(QuizQuestion, { foreignKey: 'quiz_id', as: 'questions' });
Quiz.hasMany(QuizAttempt, { foreignKey: 'quiz_id', as: 'attempts' });

// QuizQuestion associations
QuizQuestion.belongsTo(Quiz, { foreignKey: 'quiz_id', as: 'quiz' });
QuizQuestion.hasMany(QuizOption, { foreignKey: 'question_id', as: 'options' });

// QuizOption associations
QuizOption.belongsTo(QuizQuestion, { foreignKey: 'question_id', as: 'question' });

// QuizAttempt associations
QuizAttempt.belongsTo(Quiz, { foreignKey: 'quiz_id', as: 'quiz' });
QuizAttempt.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Export all models and sequelize instance
module.exports = {
  sequelize,
  User,
  Course,
  Section,
  Lesson,
  Resource,
  Enrollment,
  Progress,
  Review,
  Transaction,
  Certificate,
  Notification,
  AuditLog,
  SystemSetting,
  Quiz,
  QuizQuestion,
  QuizOption,
  QuizAttempt,
};