// ============================================================================
// SERVER.JS - Main Application Entry Point
// ============================================================================

// Trigger restart

require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const logger = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');

// Database connection
const { sequelize } = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const courseRoutes = require('./routes/courses');
const studentRoutes = require('./routes/student');
const instructorRoutes = require('./routes/instructor');
const adminRoutes = require('./routes/admin');
const paymentRoutes = require('./routes/payment');
const systemRoutes = require('./routes/system');
const systemController = require('./controllers/systemController');
const maintenanceMode = require('./middleware/maintenance');

// Initialize Background Workers
require('./workers/videoWorker');

// Initialize Express app
const app = express();

// ============================================================================
// MIDDLEWARE CONFIGURATION
// ============================================================================

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      mediaSrc: ["'self'", "http://localhost:5000", "http://192.168.1.20:5000", "https:"], // Allow local and network IP media
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// CORS configuration - SECURED
const corsOptions = {
  origin: (origin, callback) => {
    // Explicit whitelist - no wildcards in production
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ].filter(Boolean);

    // In development, allow local network IPs
    if (process.env.NODE_ENV === 'development') {
      // allowedOrigins.push('http://192.168.1.20:3000'); // Removed hardcoded IP. Use FRONTEND_URL in .env
    }

    // Allow requests with no origin (like mobile apps or curl requests) or check if origin is allowed
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 2000,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Relaxed limiter for video streaming to prevent interruptions
const videoLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5000, // Very high limit for segments
  message: 'Streaming limit reached, please wait.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply video limiter specifically to video routes BEFORE the global limiter
app.use('/api/v1/courses/video', videoLimiter);
app.use('/api/', limiter);

// Body parsing middleware
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(process.cwd(), 'public/uploads')));

// Request correlation ID for tracing
app.use((req, res, next) => {
  req.id = req.get('X-Request-Id') || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});

// Request logging with correlation ID
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    requestId: req.id,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// ============================================================================
// API ROUTES
// ============================================================================

const API_PREFIX = `/api/${process.env.API_VERSION || 'v1'}`;

// Health check endpoint with dependency verification
app.get(`${API_PREFIX}/health`, async (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    dependencies: {}
  };

  // Check database connection
  try {
    await sequelize.authenticate();
    health.dependencies.database = 'healthy';
  } catch (error) {
    health.dependencies.database = 'unhealthy';
    health.status = 'DEGRADED';
  }

  const statusCode = health.status === 'OK' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Middleware to check for maintenance mode (excluding health check and login)
app.use(maintenanceMode);

// Mount route handlers
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/courses`, courseRoutes);
app.use(`${API_PREFIX}/student`, studentRoutes);
app.use(`${API_PREFIX}/instructor`, instructorRoutes);
app.use(`${API_PREFIX}/admin`, adminRoutes);
app.use(`${API_PREFIX}/payment`, paymentRoutes);
app.use(`${API_PREFIX}/system`, systemRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
  });
});

// Global error handler
app.use(errorHandler);

// ============================================================================
// DATABASE CONNECTION & SERVER STARTUP
// ============================================================================

const PORT = process.env.PORT || 5000;
let server; // FIX: Define server variable properly

// Test database connection and start server
if (require.main === module) {
  sequelize.authenticate()
    .then(() => {
      logger.info('Database connection established successfully');

      // Sync models (use alter in development, migrations in production)
      if (process.env.NODE_ENV === 'development') {
        return sequelize.sync({ alter: { drop: false } });
      }
      return Promise.resolve();
    })
    .then(async () => {
      // Initialize default system settings
      await systemController.initializeDefaultSettings();

      server = app.listen(PORT, () => {
        const currentBackendUrl = process.env.BACKEND_URL || `http://localhost:${PORT}`;
        logger.info(`✓ Server running on port ${PORT}`);
        logger.info(`✓ Environment: ${process.env.NODE_ENV}`);
        logger.info(`✓ API Base URL: ${currentBackendUrl}${API_PREFIX}`);
        logger.info(`✓ Documentation: ${currentBackendUrl}${API_PREFIX}/docs`);
      });
    })
    .catch((error) => {
      logger.error('Unable to connect to database:', error);
      process.exit(1);
    });
} else {
  // Just connect to DB if imported (for tests)
  sequelize.authenticate().catch(err => logger.error('DB Connection Error:', err));
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
      sequelize.close().then(() => {
        logger.info('Database connection closed');
        process.exit(0);
      });
    });
  }
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit in production for unhandled rejections
  if (process.env.NODE_ENV === 'development') {
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

module.exports = app; 
