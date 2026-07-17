# Безопасность

## Принципы медицинских данных

- Персональные данные пациентов хранятся только в PostgreSQL и audit (redacted)
- Оригиналы медиа неизменяемы; доступ через signed URLs
- Публичных URL для файлов нет
- AuditEvent — append-only, без update/delete через API

## RBAC и доступ

Роли: SYSTEM_ADMIN, CHIEF_DOCTOR, ORTHOPEDIC_MANAGER, SURGEON, ORTHOPEDIST, CONSULTING_DOCTOR, DENTAL_TECHNICIAN, ASSISTANT, RADIOLOGY_OPERATOR, AUDITOR.

- Branch-level access control
- Server-side permission checks на каждом endpoint
- Закрытие этапа — только primary CaseParticipant с ownerRole

## AI — минимизация данных

Перед вызовом Yandex AI:

- Удаление EXIF
- Не передаются: ФИО, дата рождения, телефон, номер карты, stoma1c ID, branch name
- Замена имени файла, random request token
- Логирование только redacted payload
- **Обязательный заголовок:** `x-data-logging-enabled: false`

## Хранение секретов

- `.env` только для local dev
- Production: Yandex Lockbox или аналог
- JWT_SECRET, SESSION_SECRET, S3 keys, API tokens — вне репозитория

## Аутентификация

- bcrypt для паролей (cost factor 10)
- Secure cookies, CSRF где применимо
- Rate limiting на auth endpoints
- Деактивация аккаунта, инвалидация сессий

## Файлы

- File signature validation до обработки
- Архитектура готова к virus-scan
- SHA-256 для deduplication

## Аудит

Логируются: login, просмотр пациента/случая, upload, AI request/result, assignment, confirm, close, reopen, sync 1C, integration errors.
