require('dotenv').config();
const emailConfig = require('./config/email');

console.log('--- Environment Check ---');
console.log('PWD:', process.cwd());
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('--- Email Config Check ---');
console.log('Raw SMTP_HOST:', process.env.SMTP_HOST);
console.log('Resolved Host:', emailConfig.smtp.host);
console.log('Resolved User:', emailConfig.smtp.auth.user);
console.log('-------------------------');

if (emailConfig.smtp.host === 'smtp.gmail.com' && process.env.SMTP_HOST !== 'smtp.gmail.com') {
    console.log('⚠️  WARNING: Falling back to Gmail default! .env is not being read or SMTP_HOST is missing.');
} else {
    console.log('✅ Config looks consistent with .env (or explicit default)');
}
