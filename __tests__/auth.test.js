// ============================================================================
// __tests__/auth.test.js - Authentication Tests Example
// ============================================================================

const request = require('supertest');
const app = require('../server');
const { User, sequelize } = require('../models');

describe('Authentication API', () => {
    // Setup: Clear database before tests
    beforeAll(async () => {
        await sequelize.sync({ force: true });
    });

    // Cleanup: Close database connection
    afterAll(async () => {
        await sequelize.close();
    });

    describe('POST /api/v1/auth/register', () => {
        it('should register a new user successfully', async () => {
            const response = await request(app)
                .post('/api/v1/auth/register')
                .send({
                    email: 'test@example.com',
                    password: 'Test@123456',
                    name: 'Test User',
                    role: 'student',
                })
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.user.email).toBe('test@example.com');
            expect(response.body.data.token).toBeDefined();
        });

        it('should fail with invalid email', async () => {
            const response = await request(app)
                .post('/api/v1/auth/register')
                .send({
                    email: 'invalid-email',
                    password: 'Test@123456',
                    name: 'Test User',
                })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.errors).toBeDefined();
        });

        it('should fail with weak password', async () => {
            const response = await request(app)
                .post('/api/v1/auth/register')
                .send({
                    email: 'test2@example.com',
                    password: 'weak',
                    name: 'Test User',
                })
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        it('should fail with duplicate email', async () => {
            await request(app)
                .post('/api/v1/auth/register')
                .send({
                    email: 'duplicate@example.com',
                    password: 'Test@123456',
                    name: 'First User',
                });

            const response = await request(app)
                .post('/api/v1/auth/register')
                .send({
                    email: 'duplicate@example.com',
                    password: 'Test@123456',
                    name: 'Second User',
                })
                .expect(409);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('already exists');
        });
    });

    describe('POST /api/v1/auth/login', () => {
        beforeAll(async () => {
            // Create test user once for all login tests
            try {
                await User.create({
                    email: 'login@example.com',
                    password_hash: 'Login@123456', // Will be hashed by model hook
                    name: 'Login User',
                    role: 'student',
                    email_verified: true,
                });
            } catch (error) {
                // Ignore if already exists (safe for re-runs or watch mode)
            }
        });

        it('should login successfully with correct credentials', async () => {
            const response = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'login@example.com',
                    password: 'Login@123456',
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.token).toBeDefined();
            expect(response.body.data.refreshToken).toBeDefined();
            expect(response.body.data.user.email).toBe('login@example.com');
        });

        it('should fail with wrong password', async () => {
            const response = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'login@example.com',
                    password: 'WrongPassword',
                })
                .expect(401);

            expect(response.body.success).toBe(false);
        });

        it('should fail with non-existent email', async () => {
            const response = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'nonexistent@example.com',
                    password: 'Test@123456',
                })
                .expect(401);

            expect(response.body.success).toBe(false);
        });
    });
});
