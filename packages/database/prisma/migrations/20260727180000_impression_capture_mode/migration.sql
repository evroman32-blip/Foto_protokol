-- Add ImpressionCaptureMode for IMPRESSIONS_OR_SCANS
DO $$ BEGIN
  CREATE TYPE "ImpressionCaptureMode" AS ENUM ('SCAN', 'IMPRESSION');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "StageInstance"
  ADD COLUMN IF NOT EXISTS "impressionCaptureMode" "ImpressionCaptureMode";
