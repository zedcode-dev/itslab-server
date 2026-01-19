// ============================================================================
// DATABASE/SEED.JS - Database Seeding Script
// ============================================================================

require('dotenv').config();
const { User, Course, Section, Lesson } = require('../models');
const { hashPassword } = require('../utils/helpers');
const logger = require('../utils/logger');
const { sequelize } = require('../config/database');

async function seedDatabase() {
  try {
    logger.info('Starting database seeding...');

    // Start transaction
    const transaction = await sequelize.transaction();

    try {
      // Clear existing data (for development only)
      if (process.env.NODE_ENV === 'development') {
        await sequelize.query('TRUNCATE TABLE users, courses, sections, lessons, enrollments, progress, reviews, transactions, certificates CASCADE', { transaction });
        logger.info('✓ Existing data cleared');
      }

      // 1. Create Admin User
      const adminPassword = await hashPassword('Admin@123');
      const admin = await User.create({
        email: 'admin@itslab.online',
        password_hash: adminPassword,
        name: 'System Administrator',
        role: 'admin',
        email_verified: true,
        is_active: true,
      }, { transaction });
      logger.info('✓ Admin user created');

      // 2. Create Instructor User
      const instructorPassword = await hashPassword('Instructor@123');
      const instructor = await User.create({
        email: 'saleh.khalifa@itslab.online',
        password_hash: instructorPassword,
        name: 'Eng. Saleh Khalifa',
        role: 'instructor',
        bio: 'Senior instructor at ITI with 10+ years of experience in web development and software engineering. Passionate about teaching and helping students achieve their goals.',
        email_verified: true,
        is_active: true,
      }, { transaction });
      logger.info('✓ Instructor user created');

      // 3. Create Sample Students
      const studentPassword = await hashPassword('Student@123');
      const students = [];

      const studentData = [
        { name: 'Ahmed Hassan', email: 'ahmed@example.com' },
        { name: 'Fatima Ali', email: 'fatima@example.com' },
        { name: 'Mohamed Khaled', email: 'mohamed@example.com' },
        { name: 'Sara Ibrahim', email: 'sara@example.com' },
        { name: 'Omar Mahmoud', email: 'omar@example.com' },
      ];

      for (const data of studentData) {
        const student = await User.create({
          email: data.email,
          password_hash: studentPassword,
          name: data.name,
          role: 'student',
          email_verified: true,
          is_active: true,
        }, { transaction });
        students.push(student);
      }
      logger.info(`✓ ${students.length} student users created`);

      // 4. Create Sample Course
      const course = await Course.create({
        instructor_id: instructor.id,
        title: 'Complete Web Development Bootcamp 2026',
        slug: 'complete-web-development-bootcamp-2026',
        short_description: 'Learn HTML, CSS, JavaScript, React, Node.js and build real-world projects',
        description: `
          <h2>About This Course</h2>
          <p>This comprehensive course will take you from beginner to professional web developer. You'll learn the latest technologies and best practices used by top companies.</p>
          
          <h3>What You'll Learn</h3>
          <ul>
            <li>HTML5 and CSS3 fundamentals</li>
            <li>Modern JavaScript (ES6+)</li>
            <li>React.js for building user interfaces</li>
            <li>Node.js and Express for backend development</li>
            <li>MongoDB for database management</li>
            <li>Git and GitHub for version control</li>
            <li>Deployment to production servers</li>
          </ul>
          
          <h3>Who This Course Is For</h3>
          <ul>
            <li>Complete beginners who want to learn web development</li>
            <li>Developers looking to upgrade their skills</li>
            <li>Anyone interested in becoming a full-stack developer</li>
          </ul>
        `,
        price: 1200.00,
        currency: 'EGP',
        level: 'beginner',
        duration_hours: 45,
        language: 'ar',
        requirements: [
          'Basic computer skills',
          'A computer with internet connection',
          'Willingness to learn and practice',
          'No prior programming experience required'
        ],
        learning_outcomes: [
          'Build responsive websites using HTML5 and CSS3',
          'Create interactive web applications with JavaScript',
          'Develop single-page applications using React',
          'Build RESTful APIs with Node.js and Express',
          'Work with databases using MongoDB',
          'Deploy applications to production',
          'Use Git for version control',
          'Follow best practices and modern web standards'
        ],
        is_published: true,
        published_at: new Date(),
      }, { transaction });
      logger.info('✓ Sample course created');

      // 5. Create Course Sections
      const sections = [];

      const sectionData = [
        {
          title: 'Introduction to Web Development',
          description: 'Get started with the basics of web development and set up your development environment',
          order_index: 1,
        },
        {
          title: 'HTML5 Fundamentals',
          description: 'Learn the structure of web pages using HTML5',
          order_index: 2,
        },
        {
          title: 'CSS3 Styling',
          description: 'Master CSS3 for styling and layout',
          order_index: 3,
        },
        {
          title: 'JavaScript Programming',
          description: 'Learn JavaScript from basics to advanced concepts',
          order_index: 4,
        },
        {
          title: 'React.js Development',
          description: 'Build modern user interfaces with React',
          order_index: 5,
        },
      ];

      for (const data of sectionData) {
        const section = await Section.create({
          course_id: course.id,
          ...data,
        }, { transaction });
        sections.push(section);
      }
      logger.info(`✓ ${sections.length} sections created`);

      // 6. Create Sample Lessons
      const lessonData = [
        // Section 1 lessons
        { section_idx: 0, title: 'Welcome to the Course', description: 'Course introduction and what you will learn', duration: 10, is_preview: true, order: 1 },
        { section_idx: 0, title: 'Setting Up Your Development Environment', description: 'Install necessary tools and software', duration: 15, is_preview: true, order: 2 },
        { section_idx: 0, title: 'How the Web Works', description: 'Understanding clients, servers, and HTTP', duration: 20, is_preview: false, order: 3 },

        // Section 2 lessons
        { section_idx: 1, title: 'HTML Basics', description: 'Introduction to HTML tags and structure', duration: 25, is_preview: false, order: 1 },
        { section_idx: 1, title: 'Working with Text and Links', description: 'Formatting text and creating hyperlinks', duration: 20, is_preview: false, order: 2 },
        { section_idx: 1, title: 'Images and Multimedia', description: 'Adding images, videos, and audio', duration: 18, is_preview: false, order: 3 },
        { section_idx: 1, title: 'Forms and Input', description: 'Creating interactive forms', duration: 22, is_preview: false, order: 4 },

        // Section 3 lessons
        { section_idx: 2, title: 'CSS Selectors and Properties', description: 'Understanding how to style HTML elements', duration: 25, is_preview: false, order: 1 },
        { section_idx: 2, title: 'Box Model and Layout', description: 'Mastering CSS box model', duration: 30, is_preview: false, order: 2 },
        { section_idx: 2, title: 'Flexbox Layout', description: 'Creating flexible layouts with Flexbox', duration: 28, is_preview: false, order: 3 },
        { section_idx: 2, title: 'CSS Grid', description: 'Building complex layouts with Grid', duration: 32, is_preview: false, order: 4 },
        { section_idx: 2, title: 'Responsive Design', description: 'Making websites work on all devices', duration: 35, is_preview: false, order: 5 },

        // Section 4 lessons
        { section_idx: 3, title: 'JavaScript Basics', description: 'Variables, data types, and operators', duration: 30, is_preview: false, order: 1 },
        { section_idx: 3, title: 'Control Flow', description: 'Conditions and loops', duration: 28, is_preview: false, order: 2 },
        { section_idx: 3, title: 'Functions', description: 'Creating and using functions', duration: 25, is_preview: false, order: 3 },
        { section_idx: 3, title: 'DOM Manipulation', description: 'Working with the Document Object Model', duration: 35, is_preview: false, order: 4 },
        { section_idx: 3, title: 'Events and Event Handling', description: 'Making pages interactive', duration: 30, is_preview: false, order: 5 },

        // Section 5 lessons
        { section_idx: 4, title: 'Introduction to React', description: 'What is React and why use it', duration: 20, is_preview: false, order: 1 },
        { section_idx: 4, title: 'React Components', description: 'Creating reusable components', duration: 32, is_preview: false, order: 2 },
        { section_idx: 4, title: 'State and Props', description: 'Managing component data', duration: 35, is_preview: false, order: 3 },
        { section_idx: 4, title: 'React Hooks', description: 'useState, useEffect, and more', duration: 40, is_preview: false, order: 4 },
        { section_idx: 4, title: 'Building a Complete React App', description: 'Putting it all together', duration: 50, is_preview: false, order: 5 },
      ];

      let lessonCount = 0;
      for (const data of lessonData) {
        await Lesson.create({
          section_id: sections[data.section_idx].id,
          title: data.title,
          description: data.description,
          video_duration_minutes: data.duration,
          is_preview: data.is_preview,
          order_index: data.order,
          video_url: `https://example.com/videos/sample-${lessonCount++}.mp4`, // Placeholder
        }, { transaction });
      }
      logger.info(`✓ ${lessonData.length} lessons created`);

      // Commit transaction
      await transaction.commit();

      logger.info('');
      logger.info('='.repeat(60));
      logger.info('✓ Database seeding completed successfully!');
      logger.info('='.repeat(60));
      logger.info('');
      logger.info('Default Accounts Created:');
      logger.info('');
      logger.info('Admin:');
      logger.info('  Email: admin@itslab.online');
      logger.info('  Password: Admin@123');
      logger.info('');
      logger.info('Instructor:');
      logger.info('  Email: saleh.khalifa@itslab.online');
      logger.info('  Password: Instructor@123');
      logger.info('');
      logger.info('Students (5 accounts):');
      logger.info('  Email: ahmed@example.com (and others)');
      logger.info('  Password: Student@123');
      logger.info('');
      logger.info('Sample Course: Complete Web Development Bootcamp 2026');
      logger.info(`  - ${sections.length} sections`);
      logger.info(`  - ${lessonData.length} lessons`);
      logger.info('='.repeat(60));

      process.exit(0);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    logger.error('Seeding failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;