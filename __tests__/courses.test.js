// ============================================================================
// __tests__/courses.test.js - Course API Tests Example
// ============================================================================

const request = require('supertest');
const app = require('../server');
const { User, Course, sequelize } = require('../models');

describe('Courses API', () => {
    let instructorToken;
    let instructorId;
    let courseId;

    beforeAll(async () => {
        await sequelize.sync({ force: true });

        // Create instructor
        const instructor = await User.create({
            email: 'instructor@example.com',
            password_hash: 'Instructor@123',
            name: 'Test Instructor',
            role: 'instructor',
            email_verified: true,
        });
        instructorId = instructor.id;

        // Login to get token
        const loginResponse = await request(app)
            .post('/api/v1/auth/login')
            .send({
                email: 'instructor@example.com',
                password: 'Instructor@123',
            });

        instructorToken = loginResponse.body.data.token;
    });

    afterAll(async () => {
        await sequelize.close();
    });

    describe('POST /api/v1/instructor/courses', () => {
        it('should create a new course', async () => {
            const response = await request(app)
                .post('/api/v1/instructor/courses')
                .set('Authorization', `Bearer ${instructorToken}`)
                .send({
                    title: 'Test Course',
                    shortDescription: 'A test course',
                    description: 'This is a detailed description of the test course that meets the minimum length requirement.',
                    price: 100,
                    currency: 'EGP',
                    level: 'beginner',
                    language: 'ar',
                    requirements: ['Basic computer skills'],
                    learningOutcomes: ['Learn testing', 'Understand APIs'],
                })
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.course.title).toBe('Test Course');
            expect(response.body.data.course.slug).toBeDefined();

            courseId = response.body.data.course.id;
        });

        it('should fail without authentication', async () => {
            const response = await request(app)
                .post('/api/v1/instructor/courses')
                .send({
                    title: 'Unauthorized Course',
                    description: 'This should fail',
                })
                .expect(401);

            expect(response.body.success).toBe(false);
        });

        it('should fail with invalid data', async () => {
            const response = await request(app)
                .post('/api/v1/instructor/courses')
                .set('Authorization', `Bearer ${instructorToken}`)
                .send({
                    title: 'Bad', // Too short
                    description: 'Too short', // Too short
                    price: -100, // Negative
                })
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /api/v1/courses', () => {
        it('should get all published courses', async () => {
            // Publish the course first
            const { Course } = require('../models');
            await Course.update(
                { is_published: true, published_at: new Date() },
                { where: { id: courseId } }
            );

            const response = await request(app)
                .get('/api/v1/courses')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.courses).toBeInstanceOf(Array);
            expect(response.body.data.pagination).toBeDefined();
        });

        it('should filter courses by level', async () => {
            const response = await request(app)
                .get('/api/v1/courses?level=beginner')
                .expect(200);

            expect(response.body.success).toBe(true);
            response.body.data.courses.forEach(course => {
                expect(course.level).toBe('beginner');
            });
        });

        it('should search courses by title', async () => {
            const response = await request(app)
                .get('/api/v1/courses?search=Test')
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });
});
