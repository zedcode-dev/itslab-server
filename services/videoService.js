// ============================================================================
// SERVICES/VIDEO_SERVICE.JS - Video Upload Service
// ============================================================================

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const { sanitizeFilename } = require('../utils/helpers');

// Ensure upload directories exist
const BASE_UPLOAD_DIR = path.join(process.cwd(), 'public/uploads');
const VIDEO_DIR = path.join(BASE_UPLOAD_DIR, 'videos');
const THUMBNAIL_DIR = path.join(BASE_UPLOAD_DIR, 'thumbnails');
const RECEIPT_DIR = path.join(BASE_UPLOAD_DIR, 'receipts');

[BASE_UPLOAD_DIR, VIDEO_DIR, THUMBNAIL_DIR, RECEIPT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure multer for local disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'receipt') {
      cb(null, RECEIPT_DIR);
    } else if (file.mimetype.startsWith('image/')) {
      cb(null, THUMBNAIL_DIR);
    } else {
      cb(null, VIDEO_DIR);
    }
  },
  filename: (req, file, cb) => {
    const filename = `${Date.now()}-${sanitizeFilename(file.originalname)}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'video/mp4', 'video/webm', 'video/ogg',
      'image/jpeg', 'image/png', 'image/webp', 'image/gif'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only videos and images are allowed.'));
    }
  },
});

/**
 * Handle local upload response
 * @param {Object} file - Multer file object
 * @returns {string} Relative URL for storage
 */
async function uploadToLocal(file) {
  const filename = file.filename;
  if (file.fieldname === 'receipt') {
    return `/uploads/receipts/${filename}`;
  }
  if (file.mimetype.startsWith('image/')) {
    return `/uploads/thumbnails/${filename}`;
  }
  return `/uploads/videos/${filename}`;
}

/**
 * Delete file from local storage
 * @param {string} fileUrl - Local file relative URL
 */
async function deleteFromLocal(fileUrl) {
  try {
    if (!fileUrl) return;

    // Normalize and join paths
    const publicDir = path.join(process.cwd(), 'public');
    const filePath = path.join(publicDir, fileUrl);

    // Security check: Ensure the resolved path is inside the public/uploads directory
    const uploadsDir = path.join(publicDir, 'uploads');
    const relative = path.relative(uploadsDir, filePath);

    const isSafe = relative && !relative.startsWith('..') && !path.isAbsolute(relative);

    if (isSafe && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info(`File deleted locally: ${fileUrl}`);
    } else if (!isSafe) {
      logger.warn(`Blocked suspicious file deletion attempt: ${fileUrl}`);
    }
  } catch (error) {
    logger.error('Local file deletion failed:', error);
  }
}


const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
const crypto = require('crypto');
ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Process MP4 to Encrypted HLS
 * @param {string} inputPath - Path to MP4 file
 * @param {string} lessonId - ID of the lesson for naming
 * @returns {Promise<string>} Relative path to m3u8 playlist
 */
async function processToHLS(inputPath, lessonId) {
  return new Promise((resolve, reject) => {
    const outputFolder = path.join(VIDEO_DIR, lessonId);
    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder, { recursive: true });
    }

    const hlsPath = path.join(outputFolder, 'playlist.m3u8');
    const keyFileName = 'enc.key';
    const keyPath = path.join(outputFolder, keyFileName);
    const keyInfoPath = path.join(outputFolder, 'enc.keyinfo');

    // 1. Generate AES-128 Key
    const key = crypto.randomBytes(16);
    const iv = crypto.randomBytes(16).toString('hex');
    fs.writeFileSync(keyPath, key);

    // 2. Create Key Info File for FFmpeg
    // Format:
    // key_uri
    // key_file_path
    // iv (optional)
    const keyUri = `${process.env.BACKEND_URL}/api/v1/courses/video/key/${lessonId}`;
    const keyInfoContent = `${keyUri}\n${keyPath}\n${iv}`;
    fs.writeFileSync(keyInfoPath, keyInfoContent);

    // 3. Run FFmpeg
    ffmpeg(inputPath)
      .outputOptions([
        '-hls_time 10',            // Segment length
        '-hls_list_size 0',         // Include all segments
        '-hls_segment_filename', path.join(outputFolder, 'segment_%03d.ts'),
        `-hls_key_info_file ${keyInfoPath}`,
        '-hls_playlist_type event',
        `-hls_base_url ${process.env.BACKEND_URL}/api/v1/courses/video/segment/${lessonId}/`
      ])
      .output(hlsPath)
      .on('start', (commandLine) => {
        logger.info('FFmpeg started: ' + commandLine);
      })
      .on('progress', (progress) => {
        logger.info(`Processing: ${progress.percent}% done`);
      })
      .on('end', () => {
        logger.info('FFmpeg processing finished');
        // Clean up keyinfo after processing
        if (fs.existsSync(keyInfoPath)) fs.unlinkSync(keyInfoPath);

        // 4. Delete original MP4 after successful conversion
        if (fs.existsSync(inputPath)) {
          fs.unlinkSync(inputPath);
          logger.info(`Original MP4 deleted after HLS conversion: ${inputPath}`);
        }

        resolve(`/uploads/videos/${lessonId}/playlist.m3u8`);
      })
      .on('error', (err) => {
        logger.error('FFmpeg error: ' + err.message);
        reject(err);
      })
      .run();
  });
}

/**
 * Get the encryption key for a lesson
 * @param {string} lessonId - ID of the lesson
 * @returns {Buffer | null} The key buffer
 */
function getLessonKey(lessonId) {
  const keyPath = path.join(VIDEO_DIR, lessonId, 'enc.key');
  if (fs.existsSync(keyPath)) {
    return fs.readFileSync(keyPath);
  }
  return null;
}

module.exports = {
  upload,
  uploadToLocal,
  deleteFromLocal,
  processToHLS,
  getLessonKey,
};
