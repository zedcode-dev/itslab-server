// ============================================================================
// SERVICES/EMAIL_SERVICE.JS - Email Service
// ============================================================================

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const emailConfig = require('../config/email');

// Create reusable transporter
const transporter = nodemailer.createTransport(emailConfig.smtp);

/**
 * Base email wrapper for consistent styling
 */
/**
 * Base email wrapper for consistent simple styling
 */
const baseTemplate = (content, preheader = '') => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ITSLab</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #ffffff; color: #000000; }
    .container { max-width: 580px; margin: 0 auto; padding: 40px 20px; }
    .header { padding-bottom: 30px; border-bottom: 1px solid #eaeaea; }
    .logo { font-size: 24px; font-weight: 700; color: #000000; text-decoration: none; letter-spacing: -0.5px; }
    .content { padding: 40px 0; }
    .greeting { font-size: 20px; font-weight: 600; margin: 0 0 20px 0; color: #000000; }
    .text { font-size: 15px; line-height: 1.6; color: #333333; margin: 0 0 20px 0; }
    .btn { display: inline-block; padding: 14px 28px; background-color: #000000; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 500; border-radius: 6px; margin-top: 10px; }
    .btn:hover { background-color: #333333; }
    .footer { padding-top: 30px; border-top: 1px solid #eaeaea; text-align: center; }
    .footer-text { font-size: 12px; color: #888888; margin: 0 0 5px 0; }
    .highlight { background-color: #f9f9f9; padding: 15px; border-radius: 6px; border: 1px solid #eaeaea; margin: 20px 0; }
    .highlight-text { font-weight: 600; margin: 0; font-size: 15px; }
    .preheader { display: none; max-height: 0; overflow: hidden; }
  </style>
</head>
<body>
  <div class="preheader">${preheader}</div>
  <div class="container">
    <div class="header">
      <div class="logo">ITSLab</div>
    </div>
    ${content}
    <div class="footer">
      <p class="footer-text">© ${new Date().getFullYear()} ITSLab. All rights reserved.</p>
      <p class="footer-text">This is an automated message, please do not reply directly.</p>
    </div>
  </div>
</body>
</html>`;

/**
 * Email templates
 */
const templates = {
  'verify-email': (data) => baseTemplate(`
    <div class="content">
      <h1 class="greeting">Welcome to ITSLab, ${data.name}</h1>
      <p class="text">Thank you for creating an account. To enable all features, please verify your email address.</p>
      <div style="margin: 30px 0;">
        <a href="${data.verificationUrl}" class="btn">Verify Email Address</a>
      </div>
      <p class="text" style="color: #666; font-size: 13px;">This link will remain valid for 24 hours. If you did not create an account, you can ignore this email.</p>
    </div>
  `, 'Please verify your email address'),

  'reset-password': (data) => baseTemplate(`
    <div class="content">
      <h1 class="greeting">Reset Your Password</h1>
      <p class="text">Hello ${data.name}, we received a request to change your password.</p>
      <div style="margin: 30px 0;">
        <a href="${data.resetUrl}" class="btn">Reset Password</a>
      </div>
      <p class="text" style="color: #666; font-size: 13px;">This link expires in 1 hour. If you did not request this change, your account is secure and no action is needed.</p>
    </div>
  `, 'Reset your password'),

  'enrollment-confirmation': (data) => baseTemplate(`
    <div class="content">
      <h1 class="greeting">Enrollment Confirmed</h1>
      <p class="text">Hello ${data.studentName},</p>
      <p class="text">You have successfully been enrolled in the following course:</p>
      <div class="highlight">
        <p class="highlight-text">${data.courseName}</p>
      </div>
      <div style="margin: 30px 0;">
        <a href="${data.courseUrl}" class="btn">Go to Course</a>
      </div>
    </div>
  `, 'Enrollment confirmation'),

  'course-completion': (data) => baseTemplate(`
    <div class="content">
      <h1 class="greeting">Course Completed</h1>
      <p class="text">Congratulations ${data.studentName},</p>
      <p class="text">You have successfully completed <strong>${data.courseName}</strong>.</p>
      <p class="text">Your certificate of completion is now available.</p>
      <div style="margin: 30px 0;">
        <a href="${data.certificateUrl}" class="btn">Download Certificate</a>
      </div>
    </div>
  `, 'Your certificate is ready'),
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