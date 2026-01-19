// ============================================================================
// MODELS/PROGRESS.JS - Progress Model with Hooks for Auto Updates
// ============================================================================

module.exports = (sequelize, DataTypes) => {
  const Progress = sequelize.define('Progress', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    enrollment_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    lesson_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    completed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    completed_at: {
      type: DataTypes.DATE,
    },
    watch_time_seconds: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  }, {
    tableName: 'progress',
    indexes: [
      { fields: ['enrollment_id'] },
      { fields: ['lesson_id'] },
      { fields: ['enrollment_id', 'lesson_id'], unique: true },
      { fields: ['completed'] },
    ],
    hooks: {
      // FIX: Auto-update enrollment progress when lesson completed
      afterCreate: async (progress) => {
        console.log(`[Progress] afterCreate hook triggered for progress ${progress.id}`);
        const { Enrollment } = sequelize.models;
        const enrollment = await Enrollment.findByPk(progress.enrollment_id);
        if (enrollment) {
          console.log(`[Progress] afterCreate calculating progress for enrollment ${enrollment.id}`);
          await enrollment.calculateProgress();
        }
      },
      // FIX: Auto-update enrollment progress when completion status changes
      afterUpdate: async (progress) => {
        if (progress.changed('completed')) {
          console.log(`[Progress] afterUpdate hook triggered for progress ${progress.id}`);
          const { Enrollment } = sequelize.models;
          const enrollment = await Enrollment.findByPk(progress.enrollment_id);
          if (enrollment) {
            console.log(`[Progress] afterUpdate calculating progress for enrollment ${enrollment.id}`);
            await enrollment.calculateProgress();
          }
        }
      },
      // FIX: Auto-update enrollment progress when progress deleted
      afterDestroy: async (progress) => {
        console.log(`[Progress] afterDestroy hook triggered for progress ${progress.id}`);
        const { Enrollment } = sequelize.models;
        const enrollment = await Enrollment.findByPk(progress.enrollment_id);
        if (enrollment) {
          console.log(`[Progress] afterDestroy calculating progress for enrollment ${enrollment.id}`);
          await enrollment.calculateProgress();
        }
      },
    },
  });

  return Progress;
};