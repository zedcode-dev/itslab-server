// ============================================================================
// SERVICES/EMAIL_SERVICE.JS - Email Service
// ============================================================================

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const emailConfig = require('../config/email');

// Create reusable transporter
const transporter = nodemailer.createTransport(emailConfig.smtp);

/**
 * Email templates
 */
const templates = {
  'verify-email': (data) => `
    <h1>Welcome to ITSLab, ${data.name}!</h1>
    <p>Please verify your email address by clicking the link below:</p>
    <a href="${data.verificationUrl}" style="background-color: #4CAF50; color: white; padding: 14px 20px; text-decoration: none; display: inline-block;">Verify Email</a>
    <p>This link will expire in 24 hours.</p>
    <p>If you didn't create an account, please ignore this email.</p>
  `,

  'reset-password': (data) => `
    <h1>Password Reset Request</h1>
    <p>Hello ${data.name},</p>
    <p>You requested to reset your password. Click the link below to proceed:</p>
    <a href="${data.resetUrl}" style="background-color: #2196F3; color: white; padding: 14px 20px; text-decoration: none; display: inline-block;">Reset Password</a>
    <p>This link will expire in 1 hour.</p>
    <p>If you didn't request this, please ignore this email.</p>
  `,

  'enrollment-confirmation': (data) => `
    <h1>Enrollment Confirmed!</h1>
    <p>Congratulations ${data.studentName}!</p>
    <p>You have successfully enrolled in <strong>${data.courseName}</strong>.</p>
    <p>Start learning now:</p>
    <a href="${data.courseUrl}" style="background-color: #4CAF50; color: white; padding: 14px 20px; text-decoration: none; display: inline-block;">Go to Course</a>
    <p>Happy learning!</p>
  `,

  'course-completion': (data) => `
    <h1>Congratulations on Completing the Course!</h1>
    <p>Well done, ${data.studentName}!</p>
    <p>You have successfully completed <strong>${data.courseName}</strong>.</p>
    <p>Download your certificate:</p>
    <a href="${data.certificateUrl}" style="background-color: #FF9800; color: white; padding: 14px 20px; text-decoration: none; display: inline-block;">Download Certificate</a>
    <p>Keep learning and growing!</p>
  `,
};

/**
 * Send email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.template - Template name
 * @param {Object} options.data - Template data
 */
async function sendEmail({ to, subject, template, data }) {
  try {
    if (process.env.NODE_ENV === 'test') {
      logger.info(`[TEST MODE] Email suppressed: ${template} to ${to}`);
      return { messageId: 'test-mock-id', response: '250 OK' };
    }

    const html = templates[template] ? templates[template](data) : data.html;

    const mailOptions = {
      from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
      to,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent: ${info.messageId} to ${to}`);
    return info;
  } catch (error) {
    logger.error('Email send failed:', error);
    throw error;
  }
}

module.exports = {
  sendEmail,
};