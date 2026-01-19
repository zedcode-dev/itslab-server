// ============================================================================
// README.md - Setup and Documentation
// ============================================================================
/*
# ITSLab Online Learning Platform - Backend API

## Overview
Enterprise-grade backend API for ITSLab online learning platform. Built with Node.js, Express, PostgreSQL, and JWT authentication.

## Features
- ✅ User authentication (JWT with refresh tokens)
- ✅ Role-based access control (Student, Instructor, Admin)
- ✅ Course management (CRUD operations)
- ✅ Video lesson management
- ✅ Student enrollment and progress tracking
- ✅ Payment processing (Stripe/Paymob integration)
- ✅ Certificate generation
- ✅ Email notifications
- ✅ Analytics and reporting
- ✅ File upload (AWS S3)
- ✅ Rate limiting and security
- ✅ Comprehensive error handling
- ✅ Request validation
- ✅ Logging system

## Prerequisites
- Node.js >= 18.0.0
- PostgreSQL >= 14.0
- npm >= 9.0.0
- AWS account (for S3 storage)
- Stripe account (for payments)

## Installation

### 1. Clone and Install Dependencies
```bash
git clone <repository-url>
cd itslab-backend
npm install
```

### 2. Database Setup
```bash
# Create PostgreSQL database
createdb itslab

# Run migrations
npm run migrate

# (Optional) Seed database with sample data
npm run seed
```

### 3. Environment Configuration
```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### 4. Start Server
```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

## API Documentation

### Base URL
```
http://localhost:5000/api/v1
```

### Authentication Endpoints

#### Register User
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "name": "Ahmed Hassan",
  "email": "ahmed@example.com",
  "password": "SecurePass123!",
  "role": "student"
}

Response 201:
{
  "success": true,
  "message": "Registration successful. Please verify your email.",
  "data": {
    "user": {
      "id": "uuid",
      "name": "Ahmed Hassan",
      "email": "ahmed@example.com",
      "role": "student"
    },
    "token": "jwt_token_here"
  }
}
```

#### Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "ahmed@example.com",
  "password": "SecurePass123!"
}

Response 200:
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "Ahmed Hassan",
      "email": "ahmed@example.com",
      "role": "student",
      "emailVerified": true
    },
    "token": "jwt_token_here",
    "refreshToken": "refresh_token_here"
  }
}
```

#### Verify Email
```http
GET /api/v1/auth/verify-email/:token

Response 200:
{
  "success": true,
  "message": "Email verified successfully"
}
```

#### Forgot Password
```http
POST /api/v1/auth/forgot-password
Content-Type: application/json

{
  "email": "ahmed@example.com"
}

Response 200:
{
  "success": true,
  "message": "Password reset email sent"
}
```

#### Reset Password
```http
POST /api/v1/auth/reset-password/:token
Content-Type: application/json

{
  "password": "NewSecurePass123!"
}

Response 200:
{
  "success": true,
  "message": "Password reset successful"
}
```

### Course Endpoints

#### Get All Published Courses (Public)
```http
GET /api/v1/courses?page=1&limit=10&category=web-development

Response 200:
{
  "success": true,
  "data": {
    "courses": [
      {
        "id": "uuid",
        "title": "Complete Web Development Course",
        "slug": "complete-web-development-course",
        "shortDescription": "Learn web development from scratch",
        "price": 1200,
        "currency": "EGP",
        "thumbnailUrl": "https://cdn.example.com/thumb.jpg",
        "level": "beginner",
        "durationHours": 40,
        "language": "ar",
        "rating": 4.8,
        "totalReviews": 150,
        "totalStudents": 500,
        "instructor": {
          "id": "uuid",
          "name": "Eng. Saleh Khalifa",
          "bio": "ITI Instructor..."
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "totalPages": 5,
      "totalRecords": 50
    }
  }
}
```

#### Get Course Details (Public)
```http
GET /api/v1/courses/:courseId

Response 200:
{
  "success": true,
  "data": {
    "course": {
      "id": "uuid",
      "title": "Complete Web Development Course",
      "slug": "complete-web-development-course",
      "description": "Full course description...",
      "shortDescription": "Brief description",
      "price": 1200,
      "currency": "EGP",
      "thumbnailUrl": "https://...",
      "previewVideoUrl": "https://...",
      "level": "beginner",
      "durationHours": 40,
      "language": "ar",
      "requirements": ["Basic computer skills", "Internet connection"],
      "learningOutcomes": ["Build websites", "Deploy apps"],
      "isPublished": true,
      "rating": 4.8,
      "totalReviews": 150,
      "totalStudents": 500,
      "instructor": {
        "id": "uuid",
        "name": "Eng. Saleh Khalifa",
        "email": "saleh@itslab.online",
        "bio": "Senior ITI Instructor...",
        "profilePicture": "https://..."
      },
      "sections": [
        {
          "id": "uuid",
          "title": "Introduction to Web Development",
          "description": "Get started with basics",
          "order": 1,
          "lessons": [
            {
              "id": "uuid",
              "title": "What is Web Development?",
              "description": "Overview of the field",
              "order": 1,
              "durationMinutes": 15,
              "isPreview": true
            }
          ]
        }
      ],
      "reviews": [
        {
          "id": "uuid",
          "rating": 5,
          "reviewText": "Excellent course!",
          "user": {
            "name": "Ahmed Hassan"
          },
          "createdAt": "2026-01-01T00:00:00Z"
        }
      ]
    }
  }
}
```

#### Get Course Curriculum (Detailed - Enrolled Students Only)
```http
GET /api/v1/courses/:courseId/curriculum
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "data": {
    "sections": [
      {
        "id": "uuid",
        "title": "Introduction",
        "description": "Getting started",
        "order": 1,
        "lessons": [
          {
            "id": "uuid",
            "title": "Welcome Video",
            "description": "Course overview",
            "order": 1,
            "videoUrl": "https://protected-video-url",
            "durationMinutes": 15,
            "isPreview": false,
            "resources": [
              {
                "id": "uuid",
                "title": "Course Slides.pdf",
                "fileUrl": "https://s3...",
                "fileType": "pdf",
                "fileSize": 2048000
              }
            ]
          }
        ]
      }
    ]
  }
}
```

### Student Endpoints (Require Authentication)

#### Get Student Dashboard
```http
GET /api/v1/student/dashboard
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "data": {
    "enrolledCourses": [
      {
        "id": "uuid",
        "course": {
          "id": "uuid",
          "title": "Web Development Course",
          "thumbnailUrl": "https://..."
        },
        "progress": 35.5,
        "lastAccessedLesson": {
          "id": "uuid",
          "title": "JavaScript Basics"
        },
        "enrollmentDate": "2026-01-01T00:00:00Z",
        "completed": false
      }
    ],
    "certificates": [],
    "stats": {
      "totalCoursesEnrolled": 1,
      "completedCourses": 0,
      "totalWatchTimeMinutes": 450
    }
  }
}
```

#### Get Enrolled Course Progress
```http
GET /api/v1/student/courses/:courseId/progress
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "data": {
    "enrollment": {
      "id": "uuid",
      "courseId": "uuid",
      "progress": 45.5,
      "completed": false,
      "enrollmentDate": "2026-01-01T00:00:00Z"
    },
    "lessonProgress": [
      {
        "lessonId": "uuid",
        "lessonTitle": "Introduction to HTML",
        "completed": true,
        "completedAt": "2026-01-02T10:30:00Z",
        "watchTimeSeconds": 900
      }
    ],
    "nextLesson": {
      "id": "uuid",
      "title": "CSS Fundamentals",
      "sectionTitle": "Web Basics"
    }
  }
}
```

#### Mark Lesson as Complete
```http
POST /api/v1/student/lessons/:lessonId/complete
Authorization: Bearer <token>
Content-Type: application/json

{
  "watchTimeSeconds": 900
}

Response 200:
{
  "success": true,
  "message": "Lesson marked as complete",
  "data": {
    "courseProgress": 47.5,
    "certificateGenerated": false
  }
}
```

#### Get Certificate (if course completed)
```http
GET /api/v1/student/courses/:courseId/certificate
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "data": {
    "certificateUrl": "https://s3.../certificates/uuid.pdf",
    "certificateId": "CERT-2026-001234",
    "issuedDate": "2026-01-15T00:00:00Z",
    "studentName": "Ahmed Hassan",
    "courseName": "Web Development Course",
    "instructorName": "Eng. Saleh Khalifa"
  }
}
```

#### Submit Course Review
```http
POST /api/v1/student/courses/:courseId/reviews
Authorization: Bearer <token>
Content-Type: application/json

{
  "rating": 5,
  "reviewText": "Excellent course! Learned so much."
}

Response 201:
{
  "success": true,
  "message": "Review submitted successfully",
  "data": {
    "review": {
      "id": "uuid",
      "rating": 5,
      "reviewText": "Excellent course! Learned so much.",
      "createdAt": "2026-01-15T00:00:00Z"
    }
  }
}
```

### Instructor Endpoints (Require Instructor Role)

#### Get Instructor Dashboard
```http
GET /api/v1/instructor/dashboard
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "data": {
    "stats": {
      "totalStudents": 500,
      "totalRevenue": 600000,
      "totalCourses": 3,
      "averageCompletionRate": 68.5
    },
    "recentEnrollments": [
      {
        "id": "uuid",
        "student": {
          "name": "Ahmed Hassan",
          "email": "ahmed@example.com"
        },
        "course": {
          "title": "Web Development Course"
        },
        "enrollmentDate": "2026-01-15T10:00:00Z"
      }
    ],
    "courses": [
      {
        "id": "uuid",
        "title": "Web Development Course",
        "isPublished": true,
        "totalStudents": 500,
        "revenue": 600000,
        "averageRating": 4.8
      }
    ]
  }
}
```

#### Create New Course
```http
POST /api/v1/instructor/courses
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Advanced JavaScript Course",
  "shortDescription": "Master JavaScript",
  "description": "Full course description...",
  "price": 1500,
  "currency": "EGP",
  "level": "intermediate",
  "language": "ar",
  "requirements": ["Basic JavaScript knowledge"],
  "learningOutcomes": ["Master async programming", "Build complex apps"]
}

Response 201:
{
  "success": true,
  "message": "Course created successfully",
  "data": {
    "course": {
      "id": "uuid",
      "title": "Advanced JavaScript Course",
      "slug": "advanced-javascript-course",
      "isPublished": false
    }
  }
}
```

#### Update Course
```http
PUT /api/v1/instructor/courses/:courseId
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated Course Title",
  "price": 1800
}

Response 200:
{
  "success": true,
  "message": "Course updated successfully"
}
```

#### Add Section to Course
```http
POST /api/v1/instructor/courses/:courseId/sections
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Introduction Module",
  "description": "Getting started with the course",
  "order": 1
}

Response 201:
{
  "success": true,
  "data": {
    "section": {
      "id": "uuid",
      "title": "Introduction Module",
      "order": 1
    }
  }
}
```

#### Add Lesson to Section
```http
POST /api/v1/instructor/sections/:sectionId/lessons
Authorization: Bearer <token>
Content-Type: multipart/form-data

title: "Welcome to the Course"
description: "Course overview"
order: 1
durationMinutes: 15
isPreview: true
video: [file upload]

Response 201:
{
  "success": true,
  "message": "Lesson created successfully",
  "data": {
    "lesson": {
      "id": "uuid",
      "title": "Welcome to the Course",
      "videoUrl": "https://s3.../videos/uuid.mp4",
      "durationMinutes": 15
    }
  }
}
```

#### Publish/Unpublish Course
```http
PATCH /api/v1/instructor/courses/:courseId/publish
Authorization: Bearer <token>
Content-Type: application/json

{
  "isPublished": true
}

Response 200:
{
  "success": true,
  "message": "Course published successfully"
}
```

#### Get Students List for Course
```http
GET /api/v1/instructor/courses/:courseId/students?page=1&limit=20
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "data": {
    "students": [
      {
        "id": "uuid",
        "name": "Ahmed Hassan",
        "email": "ahmed@example.com",
        "enrollmentDate": "2026-01-01T00:00:00Z",
        "progress": 45.5,
        "lastActive": "2026-01-15T10:00:00Z",
        "completed": false
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalPages": 5,
      "totalRecords": 100
    }
  }
}
```

#### Get Course Analytics
```http
GET /api/v1/instructor/courses/:courseId/analytics
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "data": {
    "enrollmentTrend": [
      {
        "date": "2026-01-01",
        "enrollments": 15
      }
    ],
    "completionRate": 68.5,
    "averageProgressPerStudent": 52.3,
    "totalRevenue": 600000,
    "averageRating": 4.8,
    "popularLessons": [
      {
        "lessonId": "uuid",
        "title": "JavaScript Basics",
        "views": 450
      }
    ]
  }
}
```

### Admin Endpoints (Require Admin Role)

#### Get Admin Dashboard
```http
GET /api/v1/admin/dashboard
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "data": {
    "stats": {
      "totalUsers": 1250,
      "totalStudents": 1100,
      "totalInstructors": 5,
      "totalCourses": 8,
      "publishedCourses": 6,
      "totalRevenue": 1500000,
      "totalTransactions": 1200
    },
    "recentActivity": [
      {
        "type": "enrollment",
        "user": "Ahmed Hassan",
        "course": "Web Development",
        "timestamp": "2026-01-15T10:00:00Z"
      }
    ]
  }
}
```

#### Get All Users
```http
GET /api/v1/admin/users?page=1&limit=20&role=student&search=ahmed
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid",
        "name": "Ahmed Hassan",
        "email": "ahmed@example.com",
        "role": "student",
        "emailVerified": true,
        "isActive": true,
        "createdAt": "2026-01-01T00:00:00Z",
        "lastLogin": "2026-01-15T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalPages": 10,
      "totalRecords": 200
    }
  }
}
```

#### Update User
```http
PUT /api/v1/admin/
not completed