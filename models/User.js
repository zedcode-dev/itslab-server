// ============================================================================
// MODELS/USER.JS - User Model with Auto Password Hashing
// ============================================================================

const { hashPassword } = require('../utils/helpers');

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('student', 'instructor', 'admin'),
      allowNull: false,
      defaultValue: 'student',
    },
    profile_picture: {
      type: DataTypes.STRING(500),
    },
    bio: {
      type: DataTypes.TEXT,
    },
    email_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    email_verification_token: {
      type: DataTypes.STRING(255),
    },
    email_verification_expires: {
      type: DataTypes.DATE,
    },
    password_reset_token: {
      type: DataTypes.STRING(255),
    },
    password_reset_expires: {
      type: DataTypes.DATE,
    },
    refresh_token: {
      type: DataTypes.TEXT,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    last_login: {
      type: DataTypes.DATE,
    },
  }, {
    tableName: 'users',
    indexes: [
      { fields: ['email'] },
      { fields: ['role'] },
      { fields: ['email_verification_token'] },
      { fields: ['password_reset_token'] },
    ],
    hooks: {
      // FIX: Auto-hash password before create
      beforeCreate: async (user) => {
        if (user.password_hash && !user.password_hash.startsWith('$2a$')) {
          user.password_hash = await hashPassword(user.password_hash);
        }
      },
      // FIX: Auto-hash password before update if changed
      beforeUpdate: async (user) => {
        if (user.changed('password_hash') && !user.password_hash.startsWith('$2a$')) {
          user.password_hash = await hashPassword(user.password_hash);
        }
      },
    },
  });

  // Instance method to update statistics
  User.prototype.updateLastLogin = async function () {
    this.last_login = new Date();
    await this.save();
  };

  return User;
};
