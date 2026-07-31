# Демо-выкладка на Timeweb Cloud

Цель: дать коллегам ссылку для согласования UI/сценариев (не боевая клиника).

## Что уже подготовлено в репозитории

| Файл | Назначение |
|------|------------|
| `docker-compose.demo.yml` | Postgres, Redis, MinIO, API, Worker, Web, Nginx |
| `.env.demo.example` | Шаблон секретов и URL |
| `infra/nginx/demo.conf` | Прокси `/` → web, `/api/` → API, `/storage/` → MinIO |
| `infra/scripts/deploy-timeweb-demo.sh` | Скрипт запуска на Ubuntu |
| `infra/scripts/prepare-demo-env.ps1` | Генерация `.env.demo` на Windows |

## Что делаете вы (обязательно)

### 1. Создайте сервер в Timeweb

1. Зайдите на https://timeweb.cloud/
2. Создайте **Cloud-сервер**:
   - регион: **Москва**
   - ОС: **Ubuntu 24.04**
   - тариф: **Cloud MSK 80** (4 vCPU / 8 GB / 80+ GB NVMe) или выше
3. Включите **бэкапы**
4. В firewall откройте порты **22, 80** (и **443**, если будете ставить SSL)
5. Сохраните: **IP**, **root/пароль** или SSH-ключ

### 2. Залейте код на сервер

С вашего ПК (PowerShell), из папки проекта:

```powershell
# Подставьте IP сервера
$SERVER = "X.X.X.X"

# Упаковать проект без node_modules
tar -czf mandarin-demo.tgz `
  --exclude=node_modules --exclude=.next --exclude=dist `
  --exclude=tools/pgsql --exclude=tools/minio-data --exclude=tools/*.exe `
  --exclude=.git .

scp mandarin-demo.tgz root@${SERVER}:/root/
```

Или через Git, если репозиторий на GitHub/GitLab:

```bash
ssh root@X.X.X.X
git clone <URL> /opt/mandarin-pp
```

### 3. На сервере: Docker + запуск

```bash
ssh root@X.X.X.X

# Docker
apt-get update
apt-get install -y docker.io docker-compose-v2 curl
systemctl enable --now docker

# Распаковать (если заливали архив)
mkdir -p /opt/mandarin-pp
tar -xzf /root/mandarin-demo.tgz -C /opt/mandarin-pp
cd /opt/mandarin-pp

# Env
cp .env.demo.example .env.demo
nano .env.demo
# Обязательно замените:
#   PUBLIC_HOST=ВАШ_IP_ИЛИ_ДОМЕН
#   JWT_SECRET / SESSION_SECRET / POSTGRES_PASSWORD / S3_SECRET_ACCESS_KEY
#   WEB_URL / API_URL / CORS_ORIGIN / S3_PUBLIC_ENDPOINT (подставьте тот же хост)

chmod +x infra/scripts/deploy-timeweb-demo.sh infra/docker/api-entrypoint.sh
bash infra/scripts/deploy-timeweb-demo.sh
```

### 4. Отправьте коллегам

- URL: `http://ВАШ_IP`
- Логин: `admin@example.local`
- Пароль: значение `DEMO_PASSWORD` из `.env.demo` (после seed также действует пароль из seed, если не переопределён)

Демо-роли (пароль из seed по умолчанию `ChangeMe123!`, если не меняли логику seed):

| Email | Роль |
|-------|------|
| admin@example.local | SYSTEM_ADMIN |
| surgeon@example.local | SURGEON |
| ortho@example.local | ORTHOPEDIST |

> Если seed использует `DEMO_PASSWORD` из env — будет ваш пароль из `.env.demo`.

### 5. HTTPS (желательно)

Когда будет домен:

```bash
apt-get install -y certbot
certbot certonly --standalone -d your.domain.ru
cp /etc/letsencrypt/live/your.domain.ru/fullchain.pem infra/nginx/certs/
cp /etc/letsencrypt/live/your.domain.ru/privkey.pem infra/nginx/certs/
# Раскомментировать SSL-блок в infra/nginx/demo.conf
# В .env.demo заменить http:// на https://
docker compose -f docker-compose.demo.yml --env-file .env.demo up -d nginx web api
```

## Полезные команды

```bash
cd /opt/mandarin-pp
docker compose -f docker-compose.demo.yml --env-file .env.demo ps
docker compose -f docker-compose.demo.yml --env-file .env.demo logs -f api
docker compose -f docker-compose.demo.yml --env-file .env.demo restart
```

## Важно

- Это **демо-контур**. Не загружайте реальные данные пациентов.
- MinIO console наружу не открыт (только `/storage` для файлов).
- Postgres/Redis снаружи не слушаются.
- После согласования смените пароли или выключите сервер.

## Если что-то упало

1. `docker compose -f docker-compose.demo.yml --env-file .env.demo logs api --tail=200`
2. Проверьте, что в `.env.demo` нет `YOUR_DOMAIN`
3. Проверьте `curl -i http://127.0.0.1/api/v1/health` на сервере
4. Напишите в чат разработчику логи API + IP сервера (без паролей)
