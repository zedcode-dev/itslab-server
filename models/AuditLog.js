// ============================================================================
// MODELS/AUDIT_LOG.JS - Audit Log Model
// ============================================================================

module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define('AuditLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
    },
    action: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    entity_type: {
      type: DataTypes.STRING(50),
    },
    entity_id: {
      type: DataTypes.UUID,
    },
    old_values: {
      type: DataTypes.JSONB,
    },
    new_values: {
      type: DataTypes.JSONB,
    },
    ip_address: {
      type: DataTypes.STRING(45),
    },
    user_agent: {
      type: DataTypes.TEXT,
    },
  }, {
    tableName: 'audit_log',
    updatedAt: false,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['action'] },
      { fields: ['entity_type'] },
    ],
  });

  return AuditLog;
};