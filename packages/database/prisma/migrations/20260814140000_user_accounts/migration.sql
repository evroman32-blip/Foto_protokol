-- User accounts: expert role, requested role, approval status, accent color
DO $$ BEGIN
  ALTER TYPE "UserRole" ADD VALUE 'EXPERT';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "UserAccountStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "requestedRole" "UserRole";
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "accountStatus" "UserAccountStatus" NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "accentColor" TEXT NOT NULL DEFAULT '#e85d04';

UPDATE "User" SET "requestedRole" = "role" WHERE "requestedRole" IS NULL;
