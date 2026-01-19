-- Migration: Add video processing status to lessons table
-- Date: 2026-01-19
-- Description: Adds video_processing_status and video_processing_error columns to track video processing state and prevent race conditions

-- Create ENUM type if not exists
DO $$ BEGIN
    CREATE TYPE video_processing_status_enum AS ENUM ('pending', 'processing', 'ready', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add video_processing_status column
ALTER TABLE lessons
ADD COLUMN IF NOT EXISTS video_processing_status video_processing_status_enum DEFAULT 'ready';

-- Add video_processing_error column for storing error messages
ALTER TABLE lessons
ADD COLUMN IF NOT EXISTS video_processing_error TEXT NULL;

-- Add index for filtering by processing status
CREATE INDEX IF NOT EXISTS idx_lessons_video_processing_status ON lessons(video_processing_status);

-- Set existing video lessons to 'ready' (they were already processed)
UPDATE lessons SET video_processing_status = 'ready' WHERE lesson_type = 'video' AND video_processing_status IS NULL;

-- Comment for documentation
COMMENT ON COLUMN lessons.video_processing_status IS 'Tracks the video processing state: pending (uploaded), processing (converting), ready (available), failed (error)';
COMMENT ON COLUMN lessons.video_processing_error IS 'Stores error message if video processing failed';
