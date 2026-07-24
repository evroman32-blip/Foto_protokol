# Mandarin Strategic Implant PhotoProtocol

Закрытый клинический веб-сервис фото-, видео- и рентгенологического контроля лечения **Strategic Implant® / Corticobasal®**.

## Обзор

Сервис контролирует полноту, структуру, техническое качество, доказуемость и ответственность на каждом этапе клинического маршрута. Система **не заменяет врача** — она блокирует закрытие этапа при неполном комплекте и ведёт неизменяемый аудит.

### MVP — 5 детальных этапов

1. **PRE_OPERATION** — до операции
2. **POSTOP_SURGICAL_RADIOLOGY_CONTROL** — послеоперационный хирургический и рентгенологический контроль
3. **JAW_RELATION** — определение межчелюстных соотношений
4. **FIRST_PROTOTYPE** — примерка первого прототипа
5. **FINAL_FIXATION** — финальная фиксация

Полный промышленный маршрут — 11 этапов (остальные 6 представлены как шаблоны).

## Стек

| Слой | Технологии |
|------|------------|
| Frontend | Next.js, React, TypeScript strict, Tailwind-ready UI |
| Backend API | NestJS, Fastify, REST, OpenAPI/Swagger |
| Worker | BullMQ, Redis, FFmpeg, Sharp |
| БД | PostgreSQL 16, Prisma ORM |
| Storage | MinIO (local) / Yandex Object Storage (prod) |
| AI | Yandex AI Studio / Alice AI (mock по умолчанию) |
| МИС | 1С:Медицина. Стоматология 2.1 (опционально) |

## Быстрый старт (локально)

### Требования

- Node.js ≥ 20
- Docker & Docker Compose
- npm 10+

### Установка

```bash
# Клонировать репозиторий и перейти в каталог
cd Foto_protokol

# Скопировать env (уже есть .env с docker-значениями)
cp .env.example .env

# Установить зависимости
npm install

# Поднять инфраструктуру
docker compose up -d postgres redis minio minio-init

# Миграции и seed
npm run db:generate
npm run db:migrate
npm run db:seed

# Разработка (после реализации apps)
npm run dev
```

### Полный запуск через Docker Compose

```bash
docker compose up --build
```

Сервисы:
- Web: http://localhost:3000
- API: http://localhost:3001
- MinIO Console: http://localhost:9001
- PostgreSQL: localhost:5432
- Redis: localhost:6379

## Переменные окружения

Полный список — в `.env.example`. Ключевые:

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `DATABASE_URL` | PostgreSQL connection string | — |
| `REDIS_URL` | Redis для очередей | — |
| `MIS_PROVIDER` | `none` / `stoma1c` | `none` |
| `STOMA1C_INTEGRATION_ENABLED` | Включить синхронизацию с 1С | `false` |
| `AI_PROVIDER` | `mock` / `yandex` | `mock` |
| `YANDEX_DATA_LOGGING_ENABLED` | Логирование данных Yandex AI | `false` |
| `MAX_SINGLE_FILE_SIZE_MB` | Макс. размер файла | `100` |

## Демо-пользователи

Пароль для всех: **`ChangeMe123!`**

| Email | Роль |
|-------|------|
| admin@example.local | SYSTEM_ADMIN |
| chief@example.local | CHIEF_DOCTOR |
| manager@example.local | ORTHOPEDIC_MANAGER |
| surgeon@example.local | SURGEON |
| ortho@example.local | ORTHOPEDIST |
| tech@example.local | DENTAL_TECHNICIAN |
| auditor@example.local | AUDITOR |

## Миграции и seed

```bash
npm run db:generate    # Prisma Client
npm run db:migrate     # dev-миграции
npm run db:migrate:deploy  # production
npm run db:seed        # демо-данные
npm run db:studio      # Prisma Studio
```

Seed создаёт: 2 филиала, 7 пользователей, протокол v1.0 с 11 этапами, 25 методов имплантации, демо-пациента и клинический случай.

## Тесты

```bash
npm run test           # все пакеты через turbo
npm run typecheck      # TypeScript
npm run lint           # линтер
```

Unit-тесты `StageCompletenessService` — в `packages/domain`.

## Swagger

После запуска API: http://localhost:3001/api/docs

## Режимы работы

### Standalone (MVP, по умолчанию)

```env
MIS_PROVIDER=none
STOMA1C_INTEGRATION_ENABLED=false
AI_PROVIDER=mock
```

Сервис полностью автономен. Отсутствие связи с 1С **не блокирует** закрытие этапа.

### Stoma1c Ready

```env
MIS_PROVIDER=stoma1c
STOMA1C_INTEGRATION_ENABLED=false
```

Можно вручную указать внешний ID 1С. Отсутствие связи — warning, не blocker.

### Stoma1c Integrated

```env
MIS_PROVIDER=stoma1c
STOMA1C_INTEGRATION_ENABLED=true
STOMA1C_API_BASE_URL=https://...
STOMA1C_API_TOKEN=...
```

1С — мастер для пациентов/сотрудников; фотосервис — мастер для медиа и протокола.

### Yandex AI Mock / Real

```env
# Mock (по умолчанию)
AI_PROVIDER=mock
YANDEX_AI_ENABLED=false

# Real (требуются credentials)
AI_PROVIDER=yandex
YANDEX_AI_ENABLED=true
YANDEX_CLOUD_FOLDER_ID=...
YANDEX_AI_MODEL_URI=...
```

**Обязательно:** каждый запрос к Yandex AI содержит `x-data-logging-enabled: false`.

## Хирургический рентгенологический этап

1. Войти как `surgeon@example.local`
2. Открыть случай → этап POSTOP_SURGICAL_RADIOLOGY_CONTROL
3. Загрузить послеоперационное ОПТГ
4. Создать реестр имплантатов, указать метод из справочника
5. Подтвердить рентгенологический комплект
6. Закрыть этап

КТ/КЛКТ и DICOM в протоколе не требуются и недоступны для загрузки.

## Блокировка JAW_RELATION

Этап JAW_RELATION заблокирован до закрытия POSTOP_SURGICAL_RADIOLOGY_CONTROL. При попытке открыть/закрыть показывается:

> Этап межчелюстных соотношений заблокирован: не закрыт послеоперационный хирургический и рентгенологический контроль.

## PDF-отчёты

```bash
POST /api/v1/stages/{stageId}/reports
POST /api/v1/cases/{caseId}/reports
```

## Структура monorepo

```
apps/
  web/          Next.js UI (русские экраны, этапы, surgical-radiology)
  api/          NestJS + Fastify REST API + Swagger
  worker/       BullMQ: media, derivatives, AI, reports, 1C retry
packages/
  database/     Prisma schema, migrations, seed
  domain/       StageCompletenessService (SSOT комплектности)
  contracts/    enums, DTO, AI/Stoma1c интерфейсы
  config/       env schema (zod)
  yandex-ai/    mock + Yandex adapter (x-data-logging-enabled: false)
  stoma1c/      Disabled / Mock / Api gateways
  file-processing/
  ui/ testing/
infra/          docker, yandex-cloud terraform skeleton, scripts
docs/           ARCHITECTURE, SECURITY, CLINICAL_WORKFLOW, …
```

## Результаты тестов (локально)

```
@mandarin/domain     25 passed
@mandarin/yandex-ai   1 passed (header x-data-logging-enabled=false)
@mandarin/api         nest build — OK
```

Полный Docker Compose / e2e требуют установленный Docker Desktop на машине разработки.

## Лицензия

Proprietary — закрытый клинический продукт.
