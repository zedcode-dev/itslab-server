// ============================================================================
// MODELS/SECTION.JS - Section Model
// ============================================================================

module.exports = (sequelize, DataTypes) => {
  const Section = sequelize.define('Section', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    course_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'courses', key: 'id' },
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
    order_index: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  }, {
    tableName: 'sections',
    indexes: [
      { fields: ['course_id'] },
      { fields: ['course_id', 'order_index'], unique: true },
    ],
  });

  return Section;
};