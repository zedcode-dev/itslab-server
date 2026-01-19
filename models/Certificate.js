// ============================================================================
// MODELS/CERTIFICATE.JS - Certificate Model
// ============================================================================

module.exports = (sequelize, DataTypes) => {
  const Certificate = sequelize.define('Certificate', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    enrollment_id: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    course_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    certificate_id: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    certificate_url: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    issued_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'certificates',
    updatedAt: false,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['course_id'] },
      { fields: ['certificate_id'] },
    ],
  });

  return Certificate;
};