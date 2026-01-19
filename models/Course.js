// ============================================================================
// MODELS/COURSE.JS - Course Model with Auto Statistics Update
// ============================================================================

module.exports = (sequelize, DataTypes) => {
  const Course = sequelize.define('Course', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    instructor_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(500),
      allowNull: false,
      unique: true,
    },
    short_description: {
      type: DataTypes.TEXT,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: 'EGP',
    },
    thumbnail_url: {
      type: DataTypes.STRING(500),
    },
    preview_video_url: {
      type: DataTypes.STRING(500),
    },
    level: {
      type: DataTypes.ENUM('beginner', 'intermediate', 'advanced'),
    },
    duration_hours: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    language: {
      type: DataTypes.STRING(10),
      defaultValue: 'ar',
    },
    requirements: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      defaultValue: [],
    },
    learning_outcomes: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      defaultValue: [],
    },
    is_published: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    published_at: {
      type: DataTypes.DATE,
    },
    average_rating: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 0,
    },
    total_reviews: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    total_students: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  }, {
    tableName: 'courses',
    indexes: [
      { fields: ['instructor_id'] },
      { fields: ['slug'] },
      { fields: ['is_published'] },
      { fields: ['level'] },
      { fields: ['average_rating'] },
      { fields: ['total_students'] },
    ],
  });

  // FIX: Instance methods for updating statistics
  Course.prototype.updateAverageRating = async function () {
    const { Review } = sequelize.models;
    const result = await Review.findOne({
      attributes: [
        [sequelize.fn('AVG', sequelize.col('rating')), 'avgRating'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalReviews'],
      ],
      where: { course_id: this.id },
      raw: true,
    });

    this.average_rating = result?.avgRating ? parseFloat(result.avgRating).toFixed(2) : 0;
    this.total_reviews = parseInt(result?.totalReviews) || 0;
    await this.save();
  };

  Course.prototype.updateStudentCount = async function () {
    const { Enrollment } = sequelize.models;
    const count = await Enrollment.count({
      where: {
        course_id: this.id,
        payment_status: 'completed'
      },
    });

    this.total_students = count;
    await this.save();
  };

  Course.prototype.calculateDuration = async function () {
    const { Lesson, Section } = sequelize.models;
    const result = await Lesson.findOne({
      attributes: [
        [sequelize.fn('SUM', sequelize.col('video_duration_minutes')), 'totalMinutes'],
      ],
      include: [{
        model: Section,
        as: 'section',
        where: { course_id: this.id },
        attributes: [],
      }],
      raw: true,
    });

    const totalMinutes = parseInt(result?.totalMinutes) || 0;
    this.duration_hours = Math.ceil(totalMinutes / 60);
    await this.save();
  };

  return Course;
};