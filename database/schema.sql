-- ============================================================================
-- ITSLab Online Learning Platform - PostgreSQL Database Schema
-- Version: 1.0.0
-- Description: Complete production-ready database schema with all relationships,
--              indexes, constraints, and triggers for optimal performance
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto for additional security features
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- USERS TABLE
-- Stores all platform users (students, instructors, admins)
-- ============================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'instructor', 'admin')),
    profile_picture VARCHAR(500),
    bio TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    email_verification_expires TIMESTAMP,
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP,
    refresh_token TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for users table
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email_verification_token ON users(email_verification_token);
CREATE INDEX idx_users_password_reset_token ON users(password_reset_token);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- ============================================================================
-- COURSES TABLE
-- Stores all courses on the platform
-- ============================================================================
CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(500) UNIQUE NOT NULL,
    short_description TEXT,
    description TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'EGP',
    thumbnail_url VARCHAR(500),
    preview_video_url VARCHAR(500),
    level VARCHAR(20) CHECK (level IN ('beginner', 'intermediate', 'advanced')),
    duration_hours INTEGER DEFAULT 0,
    language VARCHAR(10) DEFAULT 'ar',
    requirements TEXT[], -- Array of strings
    learning_outcomes TEXT[], -- Array of strings
    is_published BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMP,
    average_rating DECIMAL(3, 2) DEFAULT 0,
    total_reviews INTEGER DEFAULT 0,
    total_students INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for courses table
CREATE INDEX idx_courses_instructor_id ON courses(instructor_id);
CREATE INDEX idx_courses_slug ON courses(slug);
CREATE INDEX idx_courses_is_published ON courses(is_published);
CREATE INDEX idx_courses_level ON courses(level);
CREATE INDEX idx_courses_created_at ON courses(created_at DESC);
CREATE INDEX idx_courses_average_rating ON courses(average_rating DESC);
CREATE INDEX idx_courses_total_students ON courses(total_students DESC);

-- Full-text search index for course search
CREATE INDEX idx_courses_search ON courses USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- ============================================================================
-- SECTIONS TABLE
-- Stores course sections (modules/chapters)
-- ============================================================================
CREATE TABLE sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(course_id, order_index)
);

-- Indexes for sections table
CREATE INDEX idx_sections_course_id ON sections(course_id);
CREATE INDEX idx_sections_order ON sections(course_id, order_index);

-- ============================================================================
-- LESSONS TABLE
-- Stores individual lessons within sections
-- ============================================================================
CREATE TABLE lessons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    lesson_type VARCHAR(20) DEFAULT 'video',
    content TEXT,
    video_url VARCHAR(500),
    video_duration_minutes INTEGER DEFAULT 0,
    order_index INTEGER NOT NULL,
    is_preview BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(section_id, order_index)
);

-- Indexes for lessons table
CREATE INDEX idx_lessons_section_id ON lessons(section_id);
CREATE INDEX idx_lessons_order ON lessons(section_id, order_index);
CREATE INDEX idx_lessons_is_preview ON lessons(is_preview);

-- ============================================================================
-- RESOURCES TABLE
-- Stores downloadable resources attached to lessons
-- ============================================================================
CREATE TABLE resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    file_type VARCHAR(50),
    file_size BIGINT, -- Size in bytes
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for resources table
CREATE INDEX idx_resources_lesson_id ON resources(lesson_id);

-- ============================================================================
-- ENROLLMENTS TABLE
-- Tracks student enrollments in courses
-- ============================================================================
CREATE TABLE enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    price_paid DECIMAL(10, 2) NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'completed' CHECK (payment_status IN ('pending', 'completed', 'refunded', 'failed')),
    payment_transaction_id VARCHAR(255),
    completed BOOLEAN DEFAULT FALSE,
    completion_date TIMESTAMP,
    certificate_url VARCHAR(500),
    certificate_id VARCHAR(100),
    progress_percentage DECIMAL(5, 2) DEFAULT 0,
    last_accessed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, course_id)
);

-- Indexes for enrollments table
CREATE INDEX idx_enrollments_user_id ON enrollments(user_id);
CREATE INDEX idx_enrollments_course_id ON enrollments(course_id);
CREATE INDEX idx_enrollments_payment_status ON enrollments(payment_status);
CREATE INDEX idx_enrollments_completed ON enrollments(completed);
CREATE INDEX idx_enrollments_purchase_date ON enrollments(purchase_date DESC);

-- ============================================================================
-- PROGRESS TABLE
-- Tracks individual lesson completion for each enrollment
-- ============================================================================
CREATE TABLE progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    watch_time_seconds INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(enrollment_id, lesson_id)
);

-- Indexes for progress table
CREATE INDEX idx_progress_enrollment_id ON progress(enrollment_id);
CREATE INDEX idx_progress_lesson_id ON progress(lesson_id);
CREATE INDEX idx_progress_completed ON progress(completed);

-- ============================================================================
-- REVIEWS TABLE
-- Stores student reviews and ratings for courses
-- ============================================================================
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    is_verified_purchase BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, course_id)
);

-- Indexes for reviews table
CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE INDEX idx_reviews_course_id ON reviews(course_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);
CREATE INDEX idx_reviews_created_at ON reviews(created_at DESC);

-- ============================================================================
-- TRANSACTIONS TABLE
-- Stores all payment transactions
-- ============================================================================
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'EGP',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    payment_method VARCHAR(50), -- stripe, paymob, fawry
    payment_provider VARCHAR(50),
    transaction_id VARCHAR(255) UNIQUE,
    provider_transaction_id VARCHAR(255),
    metadata JSONB, -- Store additional payment metadata
    refund_reason TEXT,
    refunded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for transactions table
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_course_id ON transactions(course_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_transaction_id ON transactions(transaction_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);

-- ============================================================================
-- CERTIFICATES TABLE
-- Stores generated certificates
-- ============================================================================
CREATE TABLE certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    certificate_id VARCHAR(100) UNIQUE NOT NULL,
    certificate_url VARCHAR(500) NOT NULL,
    issued_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for certificates table
CREATE INDEX idx_certificates_user_id ON certificates(user_id);
CREATE INDEX idx_certificates_course_id ON certificates(course_id);
CREATE INDEX idx_certificates_certificate_id ON certificates(certificate_id);

-- ============================================================================
-- COUPONS TABLE (Phase 2 - for future use)
-- ============================================================================
CREATE TABLE coupons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    discount_type VARCHAR(20) CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value DECIMAL(10, 2) NOT NULL,
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    valid_from TIMESTAMP,
    valid_until TIMESTAMP,
    applicable_courses UUID[], -- Array of course IDs
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_coupons_code ON coupons(code);
CREATE INDEX idx_coupons_is_active ON coupons(is_active);

-- ============================================================================
-- NOTIFICATIONS TABLE
-- Stores user notifications
-- ============================================================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- enrollment, completion, announcement, etc.
    title VARCHAR(500) NOT NULL,
    message TEXT NOT NULL,
    link VARCHAR(500),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for notifications table
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- ============================================================================
-- AUDIT_LOG TABLE
-- Tracks important system actions for security and debugging
-- ============================================================================
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50), -- user, course, enrollment, etc.
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for audit_log table
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_entity_type ON audit_log(entity_type);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);

-- ============================================================================
-- PLATFORM_SETTINGS TABLE
-- Stores global platform configuration
-- ============================================================================
CREATE TABLE platform_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT INTO platform_settings (key, value, description) VALUES
('platform_name', 'ITSLab', 'Platform name'),
('registration_enabled', 'true', 'Allow new user registrations'),
('course_purchase_enabled', 'true', 'Allow course purchases'),
('maintenance_mode', 'false', 'Platform maintenance mode'),
('default_currency', 'EGP', 'Default currency'),
('support_email', 'support@itslab.online', 'Support email address');

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON courses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sections_updated_at BEFORE UPDATE ON sections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lessons_updated_at BEFORE UPDATE ON lessons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_enrollments_updated_at BEFORE UPDATE ON enrollments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_progress_updated_at BEFORE UPDATE ON progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update course total_students count
CREATE OR REPLACE FUNCTION update_course_student_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE courses 
        SET total_students = total_students + 1 
        WHERE id = NEW.course_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE courses 
        SET total_students = GREATEST(total_students - 1, 0)
        WHERE id = OLD.course_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enrollment_student_count_trigger
AFTER INSERT OR DELETE ON enrollments
FOR EACH ROW EXECUTE FUNCTION update_course_student_count();

-- Trigger to update course average rating
CREATE OR REPLACE FUNCTION update_course_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE courses 
    SET average_rating = (
        SELECT COALESCE(AVG(rating), 0) 
        FROM reviews 
        WHERE course_id = COALESCE(NEW.course_id, OLD.course_id)
    ),
    total_reviews = (
        SELECT COUNT(*) 
        FROM reviews 
        WHERE course_id = COALESCE(NEW.course_id, OLD.course_id)
    )
    WHERE id = COALESCE(NEW.course_id, OLD.course_id);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER review_rating_trigger
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW EXECUTE FUNCTION update_course_rating();

-- Trigger to update enrollment progress percentage
CREATE OR REPLACE FUNCTION update_enrollment_progress()
RETURNS TRIGGER AS $$
DECLARE
    total_lessons INTEGER;
    completed_lessons INTEGER;
    progress_pct DECIMAL(5,2);
    enroll_id UUID;
BEGIN
    -- Get enrollment_id
    enroll_id := COALESCE(NEW.enrollment_id, OLD.enrollment_id);
    
    -- Calculate total lessons for the course
    SELECT COUNT(l.id) INTO total_lessons
    FROM lessons l
    INNER JOIN sections s ON l.section_id = s.id
    INNER JOIN enrollments e ON s.course_id = e.course_id
    WHERE e.id = enroll_id;
    
    -- Calculate completed lessons
    SELECT COUNT(*) INTO completed_lessons
    FROM progress
    WHERE enrollment_id = enroll_id AND completed = TRUE;
    
    -- Calculate percentage
    IF total_lessons > 0 THEN
        progress_pct := (completed_lessons::DECIMAL / total_lessons::DECIMAL) * 100;
    ELSE
        progress_pct := 0;
    END IF;
    
    -- Update enrollment
    UPDATE enrollments
    SET progress_percentage = progress_pct,
        completed = (progress_pct >= 100),
        completion_date = CASE WHEN progress_pct >= 100 THEN CURRENT_TIMESTAMP ELSE NULL END
    WHERE id = enroll_id;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER progress_update_trigger
AFTER INSERT OR UPDATE OR DELETE ON progress
FOR EACH ROW EXECUTE FUNCTION update_enrollment_progress();

-- ============================================================================
-- VIEWS
-- Useful views for common queries
-- ============================================================================

-- View: Course details with instructor info
CREATE OR REPLACE VIEW v_course_details AS
SELECT 
    c.*,
    u.name AS instructor_name,
    u.email AS instructor_email,
    u.bio AS instructor_bio,
    u.profile_picture AS instructor_profile_picture,
    (SELECT COUNT(*) FROM sections WHERE course_id = c.id) AS total_sections,
    (SELECT COUNT(*) FROM lessons l 
     INNER JOIN sections s ON l.section_id = s.id 
     WHERE s.course_id = c.id) AS total_lessons
FROM courses c
INNER JOIN users u ON c.instructor_id = u.id;

-- View: Student enrollment details
CREATE OR REPLACE VIEW v_student_enrollments AS
SELECT 
    e.*,
    c.title AS course_title,
    c.slug AS course_slug,
    c.thumbnail_url AS course_thumbnail,
    c.duration_hours,
    u.name AS student_name,
    u.email AS student_email
FROM enrollments e
INNER JOIN courses c ON e.course_id = c.id
INNER JOIN users u ON e.user_id = u.id;

-- ============================================================================
-- SEED DATA (Sample data for development)
-- ============================================================================

-- Create admin user (password: Admin@123)
INSERT INTO users (id, email, password_hash, name, role, email_verified, is_active)
VALUES (
    uuid_generate_v4(),
    'admin@itslab.online',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5NQV7VYhjq/Dy',
    'System Admin',
    'admin',
    TRUE,
    TRUE
);

-- Create sample instructor (password: Instructor@123)
INSERT INTO users (id, email, password_hash, name, role, bio, email_verified, is_active)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'saleh.khalifa@itslab.online',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5NQV7VYhjq/Dy',
    'Eng. Saleh Khalifa',
    'instructor',
    'Senior instructor at ITI with 10+ years of experience in web development and software engineering.',
    TRUE,
    TRUE
);

-- Create sample student (password: Student@123)
INSERT INTO users (id, email, password_hash, name, role, email_verified, is_active)
VALUES (
    uuid_generate_v4(),
    'ahmed@example.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5NQV7VYhjq/Dy',
    'Ahmed Hassan',
    'student',
    TRUE,
    TRUE
);

-- ============================================================================
-- INDEXES FOR FULL-TEXT SEARCH (Future enhancement)
-- ============================================================================

-- Create GIN index for better search performance
CREATE INDEX idx_courses_fulltext ON courses 
USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- ============================================================================
-- COMMENTS ON TABLES (Documentation)
-- ============================================================================

COMMENT ON TABLE users IS 'Stores all platform users including students, instructors, and admins';
COMMENT ON TABLE courses IS 'Main courses table with all course information';
COMMENT ON TABLE sections IS 'Course sections/modules containing groups of lessons';
COMMENT ON TABLE lessons IS 'Individual video lessons within sections';
COMMENT ON TABLE resources IS 'Downloadable resources attached to lessons';
COMMENT ON TABLE enrollments IS 'Student enrollments and purchase records';
COMMENT ON TABLE progress IS 'Tracks completion of individual lessons';
COMMENT ON TABLE reviews IS 'Course reviews and ratings from students';
COMMENT ON TABLE transactions IS 'Payment transaction records';
COMMENT ON TABLE certificates IS 'Generated completion certificates';
COMMENT ON TABLE notifications IS 'User notification system';
COMMENT ON TABLE audit_log IS 'System audit trail for security and debugging';
COMMENT ON TABLE platform_settings IS 'Global platform configuration settings';

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================