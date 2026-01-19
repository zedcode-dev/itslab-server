// ============================================================================
// SERVICES/QUEUE_SERVICE.JS - BullMQ Queue Management
// ============================================================================

const { Queue } = require('bullmq');
const IORedis = require('ioredis');
const logger = require('../utils/logger');

// Redis Connection
const redisConnection = new IORedis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    maxRetriesPerRequest: null, // Critical for BullMQ
    lazyConnect: true, // Don't connect immediately on import
    retryStrategy: (times) => {
        // Stop retrying after a few times in dev to avoid log spam, 
        // but keep it high enough for transient issues
        if (times > 10) {
            logger.warn('Redis connection failed repeatedly. Background jobs will be disabled until Redis is started.');
            return null; // Stop retrying
        }
        return Math.min(times * 100, 3000);
    }
});

redisConnection.on('error', (err) => {
    if (err.code === 'ECONNREFUSED') {
        logger.error('Redis server is not running at 127.0.0.1:6379. Please start Redis to enable background video processing.');
    } else {
        logger.error('Redis connection error:', err);
    }
});

// Initialize Video Processing Queue
const videoQueue = new Queue('video-processing', {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
    },
});

/**
 * Add a video processing job to the queue
 * @param {string} lessonId - ID of the lesson
 * @param {string} inputPath - Absolute path to the original MP4
 * @returns {Promise}
 */
const addVideoJob = async (lessonId, inputPath) => {
    try {
        const job = await videoQueue.add('process-hls', {
            lessonId,
            inputPath,
        });
        logger.info(`Video processing job added: ${job.id} for lesson ${lessonId}`);
        return job;
    } catch (error) {
        logger.error('Failed to add video job to queue:', error);
        throw error;
    }
};

module.exports = {
    videoQueue,
    addVideoJob,
    redisConnection,
};
