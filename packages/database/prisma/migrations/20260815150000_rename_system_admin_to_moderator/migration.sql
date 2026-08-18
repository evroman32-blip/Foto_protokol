-- Rename site-admin access role to Moderator (job title "Администратор" stays unchanged).
ALTER TYPE "UserRole" RENAME VALUE 'SYSTEM_ADMIN' TO 'MODERATOR';
