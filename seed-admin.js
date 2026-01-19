// ============================================================================
// SEED-ADMIN.JS - Database Reset and Admin Seeding Script
// ============================================================================

require('dotenv').config();
const { sequelize, User } = require('./models');
const logger = require('./utils/logger');

async function seed() {
    try {
        console.log('--- Database Reset and Seeding Started ---');

        // 1. Authenticate
        await sequelize.authenticate();
        console.log('✓ Database connection established.');

        // 2. Truncate all tables (using CASCADE for Postgres)
        console.log('... Resetting database (clearing all rows)');
        const tables = [
            'users', 'courses', 'sections', 'lessons', 'resources',
            'enrollments', 'progress', 'reviews', 'transactions',
            'certificates', 'notifications', 'audit_log', 'system_settings'
        ];
        await sequelize.query(`TRUNCATE TABLE ${tables.map(t => `"${t}"`).join(', ')} CASCADE;`);
        console.log('✓ All tables truncated.');

        // 3. Create Admin User
        console.log('... Creating System Administrator');
        await User.create({
            name: 'System Administrator',
            email: 'admin@itslab.online',
            password_hash: '123@Admin', // Will be hashed automatically by beforeCreate hook
            role: 'admin',
            email_verified: true,
            is_active: true
        });

        console.log('✓ Admin user created: admin@itslab.online / 123@Admin');
        console.log('--- Seeding Completed Successfully ---');
        process.exit(0);
    } catch (error) {
        console.error('CRITICAL ERROR during seeding:', error);
        process.exit(1);
    }
}

seed();
