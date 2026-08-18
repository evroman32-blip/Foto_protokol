UPDATE "StaffMember" SET "position" = 'Управляющий клиникой' WHERE "position" = 'Управляющий филиалом';
UPDATE "StaffMember" SET "position" = 'Администратор клиники' WHERE "position" = 'Администратор';

UPDATE "User" AS u
SET "role" = 'MODERATOR', "requestedRole" = 'MODERATOR'
FROM "StaffMember" AS s
WHERE u."staffMemberId" = s.id
  AND s."position" = 'Генеральный директор'
  AND u."role" <> 'MODERATOR';

UPDATE "User" AS u
SET "role" = 'EXECUTIVE_DIRECTOR', "requestedRole" = COALESCE(u."requestedRole", 'EXECUTIVE_DIRECTOR')
FROM "StaffMember" AS s
WHERE u."staffMemberId" = s.id
  AND s."position" = 'Исполнительный директор'
  AND u."role" NOT IN ('MODERATOR', 'EXECUTIVE_DIRECTOR');

UPDATE "User" AS u
SET "role" = 'CLINIC_MANAGER', "requestedRole" = COALESCE(u."requestedRole", 'CLINIC_MANAGER')
FROM "StaffMember" AS s
WHERE u."staffMemberId" = s.id
  AND s."position" = 'Управляющий клиникой'
  AND u."role" NOT IN ('MODERATOR', 'CLINIC_MANAGER');

UPDATE "User" AS u
SET "role" = 'CLINIC_ADMINISTRATOR', "requestedRole" = COALESCE(u."requestedRole", 'CLINIC_ADMINISTRATOR')
FROM "StaffMember" AS s
WHERE u."staffMemberId" = s.id
  AND s."position" = 'Администратор клиники'
  AND u."role" NOT IN ('MODERATOR', 'CLINIC_ADMINISTRATOR');
