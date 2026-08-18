-- Access roles and stage starter (schema only; new enum values cannot be used in the same transaction)
DO $$ BEGIN
  ALTER TYPE "UserRole" ADD VALUE 'EXECUTIVE_DIRECTOR';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "UserRole" ADD VALUE 'CLINIC_MANAGER';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "UserRole" ADD VALUE 'CLINIC_ADMINISTRATOR';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "StageInstance" ADD COLUMN IF NOT EXISTS "startedByUserId" TEXT;
