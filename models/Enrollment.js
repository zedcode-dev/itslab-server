// ============================================================================
// MODELS/ENROLLMENT.JS - Enrollment Model with Auto Statistics
// ============================================================================

module.exports = (sequelize, DataTypes) => {
  const Enrollment = sequelize.define('Enrollment', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    course_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    purchase_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    price_paid: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    payment_status: {
      type: DataTypes.ENUM('pending', 'completed', 'refunded', 'failed'),
      defaultValue: 'completed',
    },
    payment_transaction_id: {
      type: DataTypes.STRING(255),
    },
    completed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    completion_date: {
      type: DataTypes.DATE,
    },
    certificate_url: {
      type: DataTypes.STRING(500),
    },
    certificate_id: {
      type: DataTypes.STRING(100),
    },
    progress_percentage: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
    },
    last_accessed_at: {
      type: DataTypes.DATE,
    },
    payment_notes: {
      type: DataTypes.TEXT,
    },
    metadata: {
      type: DataTypes.JSONB,
    },
  }, {
    tableName: 'enrollments',
    indexes: [
      { fields: ['user_id'] },
      { fields: ['course_id'] },
      { fields: ['user_id', 'course_id'], unique: true },
      { fields: ['payment_status'] },
      { fields: ['completed'] },
    ],
    hooks: {
      // FIX: Update course student count after enrollment
      afterCreate: async (enrollment) => {
        if (enrollment.payment_status === 'completed') {
          const { Course } = sequelize.models;
          const course = await Course.findByPk(enrollment.course_id);
          if (course) {
            await course.updateStudentCount();
          }
        }
      },
      // FIX: Update course student count on status change
      afterUpdate: async (enrollment) => {
        if (enrollment.changed('payment_status')) {
          const { Course } = sequelize.models;
          const course = await Course.findByPk(enrollment.course_id);
          if (course) {
            await course.updateStudentCount();
          }
        }
      },
    },
  });

  // FIX: Instance method to calculate progress
  Enrollment.prototype.calculateProgress = async function () {
    console.log(`[Enrollment] calculateProgress started for enrollment ${this.id}`);
    const { Progress, Lesson, Section } = sequelize.models;

    // Get total lessons
    const totalLessons = await Lesson.count({
      include: [{
        model: Section,
        as: 'section',
        where: { course_id: this.course_id },
        attributes: [],
      }],
    });
    console.log(`[Enrollment] totalLessons: ${totalLessons}`);

    // Get completed lessons
    const completedLessons = await Progress.count({
      where: {
        enrollment_id: this.id,
        completed: true,
      },
    });
    console.log(`[Enrollment] completedLessons: ${completedLessons}`);

    // Calculate percentage
    const percentage = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

    this.progress_percentage = parseFloat(percentage.toFixed(2));
    console.log(`[Enrollment] progress_percentage: ${this.progress_percentage}, completed: ${this.completed}`);

    // Safety check: If already completed, don't revert to false
    if (!this.completed) {
      this.completed = percentage >= 100;
    }

    if (this.completed && !this.completion_date) {
      this.completion_date = new Date();
    }

    console.log(`[Enrollment] Saving enrollment...`);
    await this.save();
    console.log(`[Enrollment] Enrollment saved.`);
    return this.progress_percentage;
  };

  return Enrollment;
};