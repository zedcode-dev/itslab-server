// ============================================================================
// CONFIG/EMAIL.JS - Email Configuration
// ============================================================================

module.exports = {
  service: process.env.EMAIL_SERVICE || 'smtp',
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  },
  from: {
    email: process.env.EMAIL_FROM || 'noreply@itslab.online',
    name: process.env.EMAIL_FROM_NAME || 'ITSLab',
  },
  // SendGrid configuration (alternative)
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY,
  },
  // Mailgun configuration (alternative)
  mailgun: {
    apiKey: process.env.MAILGUN_API_KEY,
    domain: process.env.MAILGUN_DOMAIN,
  },
};
