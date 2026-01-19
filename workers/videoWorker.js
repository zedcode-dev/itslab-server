// ============================================================================
// WORKERS/VIDEO_WORKER.JS - BullMQ Worker for Video Processing
// ============================================================================

const { Worker } = require('bullmq');
const { redisConnection } = require('../services/queueService');
const { processToHLS } = require('../services/videoService');
const { Lesson } = require('../models');
const logger = require('../utils/logger');

const videoWorker = new Worker(
    'video-processing',
    async (job) => {
        const { lessonId, inputPath } = job.data;

        logger.info(`Processing video for lesson: ${lessonId}`);

        try {
            // 1. Perform HLS conversion
            // Note: videoService.processToHLS already deletes the original MP4 on success
            const hlsUrl = await processToHLS(inputPath, lessonId);

            // 2. Update lesson record in DB
            await Lesson.update(
                { video_url: hlsUrl },
                { where: { id: lessonId } }
            );

            logger.info(`Successfully processed video for lesson ${lessonId}. Playlist: ${hlsUrl}`);
            return { success: true, hlsUrl };

        } catch (error) {
            logger.error(`Worker failed for lesson ${lessonId}:`, error);
            throw error; // Re-throw to trigger BullMQ retry
        }
    },
    {
        connection: redisConnection,
        concurrency: 1, // Only 1 video processing at a time to save CPU
    }
);

videoWorker.on('completed', (job) => {
    logger.info(`Job ${job.id} completed successfully`);
});

videoWorker.on('failed', (job, err) => {
    logger.error(`Job ${job.id} failed:`, err);
});

logger.info('Video processing worker initialized');

module.exports = videoWorker;
