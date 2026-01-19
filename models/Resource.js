// ============================================================================
// MODELS/RESOURCE.JS - Resource Model
// ============================================================================

module.exports = (sequelize, DataTypes) => {
  const Resource = sequelize.define('Resource', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    lesson_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    file_url: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    file_type: {
      type: DataTypes.STRING(50),
    },
    file_size: {
      type: DataTypes.BIGINT,
    },
  }, {
    tableName: 'resources',
    updatedAt: false,
    indexes: [
      { fields: ['lesson_id'] },
    ],
  });

  return Resource;
};