// ============================================================================
// CONTROLLERS/AUTH_CONTROLLER.JS - Authentication Controller
// ============================================================================

const { User } = require('../models');
const { generateToken, generateRefreshToken, verifyToken } = require('../config/jwt');
const { hashPassword, comparePassword, generateToken: generateRandomToken } = require('../utils/helpers');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const { sendEmail } = require('../services/emailService');
const logger = require('../utils/logger');

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register new user
 * @access  Public
 */
exports.register = async (req, res, next) => {
  try {
    const { email, password, name, role = 'student' } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return errorResponse(res, 409, 'User with this email already exists');
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Generate email verification token
    const email_verification_token = generateRandomToken();
    const email_verification_expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user
    const user = await User.create({
      email,
      password_hash,
      name,
      role: 'student', // All public signups are students by default
      email_verification_token,
      email_verification_expires,
    });

    // Send verification email (non-blocking - user can resend if this fails)
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${email_verification_token}`;
    try {
      await sendEmail({
        to: email,
        subject: 'Verify Your Email - ITSLab',
        template: 'verify-email',
        data: {
          name,
          verificationUrl,
        },
      });
    } catch (emailError) {
      logger.error('Failed to send verification email during registration:', emailError);
      // Continue with registration - user can request resend via /resend-verification
    }

    // Generate JWT token
    const token = generateToken({ id: user.id, email: user.email, role: user.role });

    logger.info(`New user registered: ${email}`);

    return successResponse(res, 201, 'Registration successful. Please check your email to verify your account.', {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        bio: user.bio,
      },
      token,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user
 * @access  Public
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return errorResponse(res, 401, 'Invalid email or password');
    }

    // Check if account is active
    if (!user.is_active) {
      return errorResponse(res, 403, 'Your account has been deactivated. Please contact support.');
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      return errorResponse(res, 401, 'Invalid email or password');
    }

    // Update last login
    await user.update({ last_login: new Date() });

    // Generate tokens
    const token = generateToken({ id: user.id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken({ id: user.id });

    // Save refresh token
    await user.update({ refresh_token: refreshToken });

    logger.info(`User logged in: ${email}`);

    return successResponse(res, 200, 'Login successful', {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.email_verified,
        profilePicture: user.profile_picture,
        bio: user.bio,
      },
      token,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/auth/verify-email/:token
 * @desc    Verify user email
 * @access  Public
 */
exports.verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;
    logger.info(`Attempting to verify email with token: ${token}`);

    const user = await User.findOne({
      where: {
        email_verification_token: token,
      },
    });

    if (!user) {
      logger.warn(`User not found for token: ${token}`);
      return errorResponse(res, 400, 'Invalid verification link or account already verified.');
    }

    // Check if token expired
    if (user.email_verification_expires && new Date() > user.email_verification_expires) {
      return errorResponse(res, 400, 'Verification link has expired. Please request a new one.');
    }

    // Update user
    await user.update({
      email_verified: true,
      email_verification_token: null,
      email_verification_expires: null,
    });

    logger.info(`Email verified for user: ${user.email}`);

    return successResponse(res, 200, 'Email verified successfully. You can now login.');
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/auth/resend-verification
 * @desc    Resend email verification
 * @access  Public
 */
exports.resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }

    if (user.email_verified) {
      return errorResponse(res, 400, 'Email already verified');
    }

    // Generate new token
    const email_verification_token = generateRandomToken();
    const email_verification_expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await user.update({
      email_verification_token,
      email_verification_expires,
    });

    // Send email
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${email_verification_token}`;
    await sendEmail({
      to: email,
      subject: 'Verify Your Email - ITSLab',
      template: 'verify-email',
      data: {
        name: user.name,
        verificationUrl,
      },
    });

    return successResponse(res, 200, 'Verification email sent successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Send password reset email
 * @access  Public
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) {
      // Don't reveal if user exists
      return successResponse(res, 200, 'If an account with that email exists, a password reset link has been sent.');
    }

    // Generate reset token
    const password_reset_token = generateRandomToken();
    const password_reset_expires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

    await user.update({
      password_reset_token,
      password_reset_expires,
    });

    // Send email
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${password_reset_token}`;
    await sendEmail({
      to: email,
      subject: 'Password Reset Request - ITSLab',
      template: 'reset-password',
      data: {
        name: user.name,
        resetUrl,
      },
    });

    logger.info(`Password reset requested for: ${email}`);

    return successResponse(res, 200, 'If an account with that email exists, a password reset link has been sent.');
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/auth/reset-password/:token
 * @desc    Reset password
 * @access  Public
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const user = await User.findOne({
      where: {
        password_reset_token: token,
      },
    });

    if (!user) {
      return errorResponse(res, 400, 'Invalid or expired reset token');
    }

    // Check if token expired
    if (new Date() > user.password_reset_expires) {
      return errorResponse(res, 400, 'Reset token has expired. Please request a new one.');
    }

    // Hash new password
    const password_hash = await hashPassword(password);

    // Update user
    await user.update({
      password_hash,
      password_reset_token: null,
      password_reset_expires: null,
    });

    logger.info(`Password reset for user: ${user.email}`);

    return successResponse(res, 200, 'Password reset successful. You can now login with your new password.');
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/auth/refresh-token
 * @desc    Refresh access token
 * @access  Public
 */
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return errorResponse(res, 400, 'Refresh token is required');
    }

    // Verify refresh token
    const decoded = verifyToken(refreshToken, true);

    // Find user
    const user = await User.findByPk(decoded.id);
    if (!user || user.refresh_token !== refreshToken) {
      return errorResponse(res, 401, 'Invalid refresh token');
    }

    // Generate new tokens
    const newToken = generateToken({ id: user.id, email: user.email, role: user.role });
    const newRefreshToken = generateRefreshToken({ id: user.id });

    await user.update({ refresh_token: newRefreshToken });

    return successResponse(res, 200, 'Token refreshed successfully', {
      token: newToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    return errorResponse(res, 401, 'Invalid or expired refresh token');
  }
};

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password_hash', 'refresh_token'] },
    });

    return successResponse(res, 200, 'Profile retrieved successfully', { user });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/v1/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, bio } = req.body;
    let profile_picture = req.body.profile_picture;

    const user = await User.findByPk(req.user.id);

    // Handle file upload if present
    const { uploadToLocal, deleteFromLocal } = require('../services/videoService');
    if (req.file) {
      // Delete old picture if exists
      if (user.profile_picture && user.profile_picture.startsWith('/uploads/')) {
        await deleteFromLocal(user.profile_picture).catch(() => { });
      }
      profile_picture = await uploadToLocal(req.file);
    }

    await user.update({
      name: name || user.name,
      bio: bio !== undefined ? bio : user.bio,
      profile_picture: profile_picture !== undefined ? profile_picture : user.profile_picture,
    });

    return successResponse(res, 200, 'Profile updated successfully', {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        bio: user.bio,
        profile_picture: user.profile_picture,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/v1/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findByPk(req.user.id);

    // Verify current password
    const isPasswordValid = await comparePassword(currentPassword, user.password_hash);
    if (!isPasswordValid) {
      return errorResponse(res, 401, 'Current password is incorrect');
    }

    // Hash new password
    const password_hash = await hashPassword(newPassword);

    await user.update({ password_hash });

    logger.info(`Password changed for user: ${user.email}`);

    return successResponse(res, 200, 'Password changed successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user (invalidate refresh token)
 * @access  Private
 */
exports.logout = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    await user.update({ refresh_token: null });

    logger.info(`User logged out: ${user.email}`);

    return successResponse(res, 200, 'Logged out successfully');
  } catch (error) {
    next(error);
  }
};