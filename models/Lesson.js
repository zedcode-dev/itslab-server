// ============================================================================
// MODELS/LESSON.JS - Lesson Model with Video Processing Status
// ============================================================================

module.exports = (sequelize, DataTypes) => {
  const Lesson = sequelize.define('Lesson', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    section_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'sections', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    title: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
    },
    video_url: {
      type: DataTypes.STRING(500),
    },
    video_duration_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    order_index: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    is_preview: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    lesson_type: {
      type: DataTypes.ENUM('video', 'text', 'quiz', 'final_exam'),
      defaultValue: 'video',
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    external_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    // New field: Video processing status to prevent race conditions
    video_processing_status: {
      type: DataTypes.ENUM('pending', 'processing', 'ready', 'failed'),
      defaultValue: 'ready', // Default to ready for text lessons
      allowNull: true,
    },
    video_processing_error: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'lessons',
    indexes: [
      { fields: ['section_id'] },
      { fields: ['section_id', 'order_index'], unique: true },
      { fields: ['is_preview'] },
      { fields: ['video_processing_status'] },
    ],
  });

  // Instance method to check if video is ready
  Lesson.prototype.isVideoReady = function () {
    if (this.lesson_type !== 'video') return true;
    return this.video_processing_status === 'ready';
  };

  return Lesson;
};