-- AlterTable: desired tooth shade on JAW_RELATION
ALTER TABLE "StageInstance" ADD COLUMN IF NOT EXISTS "desiredToothShade" TEXT;

-- CreateTable: implant type dictionary
CREATE TABLE IF NOT EXISTS "ImplantType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL,
    "brand" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImplantType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ImplantType_code_key" ON "ImplantType"("code");

-- AlterTable: link surgical implant records to ImplantType
ALTER TABLE "SurgicalImplantRecord" ADD COLUMN IF NOT EXISTS "implantTypeId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SurgicalImplantRecord_implantTypeId_fkey'
  ) THEN
    ALTER TABLE "SurgicalImplantRecord"
      ADD CONSTRAINT "SurgicalImplantRecord_implantTypeId_fkey"
      FOREIGN KEY ("implantTypeId") REFERENCES "ImplantType"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
