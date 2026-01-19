// ============================================================================
// __tests__/statistics.test.js - Auto Statistics Update Tests
// ============================================================================

require('dotenv').config();
const { User, Course, Enrollment, Section, Lesson, Progress, Review, sequelize } = require('../models');

describe('Auto Statistics Update', () => {
    let course;
    let student;
    let enrollment;

    beforeAll(async () => {
        await sequelize.sync({ force: true });

        // Create instructor and course
        const instructor = await User.create({
            email: 'stats-instructor@example.com',
            password_hash: 'Test@123456',
            name: 'Stats Instructor',
            role: 'instructor',
            email_verified: true,
        });

        course = await Course.create({
            instructor_id: instructor.id,
            title: 'Statistics Test Course',
            slug: 'statistics-test-course',
            description: 'A course to test automatic statistics updates',
            price: 100,
            currency: 'EGP',
            level: 'beginner',
            is_published: true,
        });

        // Create student
        student = await User.create({
            email: 'stats-student@example.com',
            password_hash: 'Test@123456',
            name: 'Stats Student',
            role: 'student',
            email_verified: true,
        });
    });

    afterAll(async () => {
        await sequelize.close();
    });

    describe('Course Rating Auto-Update', () => {
        it('should update course rating when review is created', async () => {
            // Check initial rating
            expect(parseFloat(course.average_rating)).toBe(0);
            expect(course.total_reviews).toBe(0);

            // Create enrollment first
            enrollment = await Enrollment.create({
                user_id: student.id,
                course_id: course.id,
                price_paid: 100,
                payment_status: 'completed',
            });

            // Create review
            await Review.create({
                user_id: student.id,
                course_id: course.id,
                rating: 5,
                review_text: 'Great course!',
                is_verified_purchase: true,
            });

            // Reload course to see updated rating
            await course.reload();

            // Check updated rating
            expect(parseFloat(course.average_rating)).toBe(5);
            expect(course.total_reviews).toBe(1);
        });

        it('should recalculate rating when review is updated', async () => {
            const review = await Review.findOne({
                where: { user_id: student.id, course_id: course.id },
            });

            // Update rating
            await review.update({ rating: 4 });

            // Reload course
            await course.reload();

            // Check updated rating
            expect(parseFloat(course.average_rating)).toBe(4);
        });
    });

    describe('Student Count Auto-Update', () => {
        it('should update student count when enrollment is created', async () => {
            // Check initial count
            await course.reload();
            const initialCount = course.total_students;

            // Create another student
            const newStudent = await User.create({
                email: 'new-student@example.com',
                password_hash: 'Test@123456',
                name: 'New Student',
                role: 'student',
                email_verified: true,
            });

            // Create enrollment
            await Enrollment.create({
                user_id: newStudent.id,
                course_id: course.id,
                price_paid: 100,
                payment_status: 'completed',
            });

            // Reload course
            await course.reload();

            // Check updated count
            expect(course.total_students).toBe(initialCount + 1);
        });
    });

    describe('Progress Auto-Calculation', () => {
        it('should calculate progress when lesson is completed', async () => {
            // Create section and lesson
            const section = await Section.create({
                course_id: course.id,
                title: 'Test Section',
                order_index: 1,
            });

            const lesson1 = await Lesson.create({
                section_id: section.id,
                title: 'Lesson 1',
                order_index: 1,
                video_duration_minutes: 10,
            });

            const lesson2 = await Lesson.create({
                section_id: section.id,
                title: 'Lesson 2',
                order_index: 2,
                video_duration_minutes: 15,
            });

            // Check initial progress
            await enrollment.reload();
            expect(parseFloat(enrollment.progress_percentage)).toBe(0);

            // Complete first lesson
            await Progress.create({
                enrollment_id: enrollment.id,
                lesson_id: lesson1.id,
                completed: true,
                completed_at: new Date(),
            });

            // Reload enrollment
            await enrollment.reload();

            // Should be 50% (1 out of 2 lessons)
            expect(parseFloat(enrollment.progress_percentage)).toBe(50);

            // Complete second lesson
            await Progress.create({
                enrollment_id: enrollment.id,
                lesson_id: lesson2.id,
                completed: true,
                completed_at: new Date(),
            });

            // Reload enrollment
            await enrollment.reload();

            // Should be 100%
            expect(parseFloat(enrollment.progress_percentage)).toBe(100);
            expect(enrollment.completed).toBe(true);
            expect(enrollment.completion_date).toBeDefined();
        });
    });
});
