# Yandex Cloud

Целевая инфраструктура для production PhotoProtocol.

## Ресурсы

- Managed PostgreSQL
- Managed Redis / Valkey
- Object Storage (S3 API)
- Container Registry
- Serverless Containers / Compute for api, worker, web
- Lockbox for secrets
- Cloud Logging
- AI Studio / Alice AI

## Terraform skeleton

См. `main.tf` и `variables.tf` в этой папке — каркас, не полный prod.

Локальный MVP работает через Docker Compose без Yandex Cloud.
