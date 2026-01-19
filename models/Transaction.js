// ============================================================================
// MODELS/TRANSACTION.JS - Transaction Model
// ============================================================================

module.exports = (sequelize, DataTypes) => {
  const Transaction = sequelize.define('Transaction', {
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
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: 'EGP',
    },
    status: {
      type: DataTypes.ENUM('pending', 'completed', 'failed', 'refunded'),
      defaultValue: 'pending',
    },
    payment_method: {
      type: DataTypes.STRING(50),
    },
    payment_provider: {
      type: DataTypes.STRING(50),
    },
    transaction_id: {
      type: DataTypes.STRING(255),
      unique: true,
    },
    provider_transaction_id: {
      type: DataTypes.STRING(255),
    },
    metadata: {
      type: DataTypes.JSONB,
    },
    refund_reason: {
      type: DataTypes.TEXT,
    },
    refunded_at: {
      type: DataTypes.DATE,
    },
  }, {
    tableName: 'transactions',
    indexes: [
      { fields: ['user_id'] },
      { fields: ['course_id'] },
      { fields: ['status'] },
      { fields: ['transaction_id'] },
    ],
  });

  return Transaction;
};