-- Куратор лечения: те же права, что у управляющего клиникой
DO $$ BEGIN
  ALTER TYPE "UserRole" ADD VALUE 'TREATMENT_CURATOR';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
