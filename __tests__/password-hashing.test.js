// ============================================================================
// __tests__/password-hashing.test.js - Password Auto-Hashing Tests
// ============================================================================

require('dotenv').config();
const { User, sequelize } = require('../models');

describe('Password Auto-Hashing', () => {
    beforeAll(async () => {
        await sequelize.sync({ force: true });
    });

    afterAll(async () => {
        await sequelize.close();
    });

    it('should auto-hash password on user creation', async () => {
        const user = await User.create({
            email: 'hash-test@example.com',
            password_hash: 'PlainTextPassword', // Will be auto-hashed
            name: 'Hash Test',
            role: 'student',
        });

        // Password should be hashed (bcrypt hash starts with $2a$ or $2b$)
        expect(user.password_hash).toMatch(/^\$2[ab]\$/);
        expect(user.password_hash).not.toBe('PlainTextPassword');
    });

    it('should auto-hash password on user update', async () => {
        const user = await User.create({
            email: 'hash-update@example.com',
            password_hash: 'OldPassword',
            name: 'Hash Update',
            role: 'student',
        });

        const oldHash = user.password_hash;

        // Update password
        await user.update({ password_hash: 'NewPassword' });

        // Should be different hash
        expect(user.password_hash).toMatch(/^\$2[ab]\$/);
        expect(user.password_hash).not.toBe(oldHash);
        expect(user.password_hash).not.toBe('NewPassword');
    });

    it('should not re-hash already hashed password', async () => {
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash('PreHashedPassword', 12);

        const user = await User.create({
            email: 'pre-hashed@example.com',
            password_hash: hashedPassword,
            name: 'Pre Hashed',
            role: 'student',
        });

        // Should keep the same hash
        expect(user.password_hash).toBe(hashedPassword);
    });
});
