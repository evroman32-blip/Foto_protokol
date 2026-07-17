# Архитектура Mandarin PhotoProtocol

## Обзор

Monorepo TypeScript с разделением на приложения (`apps/`) и общие пакеты (`packages/`).

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   apps/web  │────▶│  apps/api   │────▶│ apps/worker │
│  (Next.js)  │     │  (NestJS)   │     │  (BullMQ)   │
└─────────────┘     └──────┬──────┘     └──────┬──────┘
                           │                    │
              ┌────────────┼────────────────────┤
              ▼            ▼                    ▼
        ┌──────────┐ ┌──────────┐        ┌──────────┐
        │ packages │ │ packages │        │ packages │
        │  domain  │ │ database │        │  file-   │
        │          │ │          │        │processing│
        └──────────┘ └──────────┘        └──────────┘
              │            │
              ▼            ▼
        PostgreSQL      MinIO/S3
              │
            Redis
```

## Модули API (целевая структура)

- `auth` — JWT, RBAC, сессии
- `patients`, `staff`, `branches` — справочники
- `cases` — клинические случаи и участники
- `stages` — этапы, комплектность, закрытие
- `media` — загрузка, назначение, подтверждение
- `radiology` — ОПТГ, КТ, DICOM
- `implants` — реестр, методы, evidence
- `reports` — PDF
- `audit` — журнал действий
- `yandex-ai` — серверный AI gateway
- `stoma1c` — интеграционный слой

## Поток данных загрузки

1. Frontend → presigned URL / chunked upload
2. API создаёт `UploadBatch`, `MediaAsset`
3. Worker: signature validation → Sharp/FFmpeg → derivatives
4. Mock/Yandex AI → suggestions (не засчитываются до confirm)
5. Врач подтверждает → `MediaAssignment.status=CONFIRMED`
6. `StageCompletenessService` пересчитывает комплектность
7. Закрытие этапа → `StageClosure` + audit + PDF

## Единый источник истины

**StageCompletenessService** (`packages/domain`) — единственный источник решения о возможности закрытия этапа. Frontend только отображает результат API.

## Версионирование протокола

Закрытый этап привязан к `ProtocolVersion`. Изменение шаблона не влияет на закрытые случаи.

## Очереди worker

- `media.process.photo`
- `media.process.video`
- `media.process.radiology`
- `report.generate`
- `integration.stoma1c.outbound`

## Зависимости пакетов

```
contracts ← config, domain, database, yandex-ai, stoma1c, ui, testing
domain ← testing
database ← (Prisma, standalone)
```
