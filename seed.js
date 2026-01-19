const { sequelize, User, Course, Enrollment, Section, Lesson, Resource, Review, Transaction, Certificate, Notification, AuditLog, SystemSetting } = require('./models');
const { hashPassword } = require('./utils/helpers');

async function resetAndSeed() {
    try {
        console.log('--- Starting Database Reset ---');

        // Force drop and recreate all tables
        await sequelize.sync({ force: true });
        console.log('✓ Database tables recreated successfully');

        // 1. Create Admin
        const adminPassword = await hashPassword('admin123');
        await User.create({
            name: 'System Admin',
            email: 'admin@itslab.com',
            password_hash: adminPassword,
            role: 'admin',
            is_active: true
        });
        console.log('✓ Admin account created (admin@itslab.com / admin123)');

        // 2. Create Instructor
        const instructorPassword = await hashPassword('instructor123');
        await User.create({
            name: 'Dr. John Smith',
            email: 'instructor@itslab.com',
            password_hash: instructorPassword,
            role: 'instructor',
            is_active: true,
            bio: 'Expert in Computer Science with 15 years of experience.'
        });
        console.log('✓ Instructor account created (instructor@itslab.com / instructor123)');

        // 3. Create Multiple Students
        const studentPassword = await hashPassword('student123');
        const studentEmails = ['student1@itslab.com', 'student2@itslab.com', 'student3@itslab.com'];

        for (const email of studentEmails) {
            const num = email.match(/\d+/)[0];
            await User.create({
                name: `Student User ${num}`,
                email: email,
                password_hash: studentPassword,
                role: 'student',
                is_active: true
            });
        }
        console.log(`✓ ${studentEmails.length} Student accounts created (password: student123)`);

        // 4. Initialize System Settings
        const defaultSettings = [
            { key: 'site_name', value: 'ITSLab Learning Platform' },
            { key: 'maintenance_mode', value: false },
            { key: 'instructor_registration_enabled', value: 'true' },
            { key: 'site_description', value: 'Advanced learning management system' }
        ];
        await SystemSetting.bulkCreate(defaultSettings);
        console.log('✓ System settings initialized');

        console.log('--- Database Reset & Seeding Completed ---');
        process.exit(0);
    } catch (error) {
        console.error('✗ Error during database reset:', error);
        process.exit(1);
    }
}

resetAndSeed();
