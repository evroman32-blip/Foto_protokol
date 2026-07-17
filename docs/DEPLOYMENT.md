# Развёртывание

## Local (Docker Compose)

```bash
cp .env.example .env
docker compose up --build
bash infra/scripts/seed-and-migrate.sh
```

## Production (Yandex Cloud)

См. `infra/yandex-cloud/README.md`

### Компоненты

- Managed PostgreSQL 16
- Managed Redis
- Object Storage (S3-compatible)
- Container Registry
- Lockbox для секретов
- Cloud Logging

### Terraform

```bash
cd infra/yandex-cloud
terraform init
terraform plan -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars
```

### ENV production

- `DATABASE_URL` — из Managed PostgreSQL
- `REDIS_URL` — из Managed Redis
- `S3_*` — Yandex Object Storage
- Secrets — Yandex Lockbox
- `NODE_ENV=production`
- `YANDEX_DATA_LOGGING_ENABLED=false`

## CI (готовность)

```bash
npm ci
npm run typecheck
npm run test
npm run build
```

## Миграции production

```bash
npm run db:migrate:deploy
npm run db:seed  # только staging
```

## Healthchecks

- API: `GET /api/v1/health`
- Web: `GET /`
- Postgres: `pg_isready`
- Redis: `redis-cli ping`
- MinIO: `/minio/health/live`
