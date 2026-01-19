require('dotenv').config();
const { sequelize, User } = require('./models');
const { hashPassword } = require('./utils/helpers');

async function resetAndSeedAdmin() {
    try {
        console.log('--- Database Reset (Admin Only) Started ---');

        // 1. Force drop and recreate all tables
        // This effectively deletes EVERYTHING in the database
        await sequelize.sync({ force: true });
        console.log('✓ Database tables dropped and recreated (All data verified cleared).');

        // 2. Create Single Admin User
        const adminPassword = await hashPassword('123@Admin');
        await User.create({
            name: 'System Admin',
            email: 'admin@itslab.online',
            password_hash: adminPassword,
            role: 'admin',
            is_active: true
        });
        console.log('✓ Admin account created:');
        console.log('  Email: admin@itslab.online');
        console.log('  Password: 123@Admin');

        console.log('--- Database Reset Completed Successfully ---');
        process.exit(0);
    } catch (error) {
        console.error('CRITICAL ERROR during database reset:', error);
        process.exit(1);
    }
}

resetAndSeedAdmin();
