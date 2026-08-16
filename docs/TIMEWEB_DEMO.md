# Выкладка на Timeweb Cloud — 176.98.177.79

Сервис поднимается Docker Compose: Postgres, Redis, MinIO, API, Worker, Web, Nginx.

## Что уже подготовлено в проекте

| Файл | Назначение |
|------|------------|
| `docker-compose.demo.yml` | Весь стек |
| `.env.demo.example` | Шаблон секретов и URL |
| `infra/nginx/demo.conf` | Прокси `/` → web, `/api/v1/` → API |
| `infra/scripts/deploy-timeweb-demo.sh` | Сборка и запуск на Ubuntu |
| `infra/scripts/prepare-demo-env.ps1` | Генерация `.env.demo` на Windows |
| `infra/scripts/pack-for-timeweb.ps1` | Архив без node_modules и portable-инструментов |

Гостевая главная, вход/регистрация и каталоги протокола входят в эту сборку.

## Что нужно сделать вам

### 1. Панель Timeweb

1. Откройте https://timeweb.cloud/ → ваш Cloud-сервер `176.98.177.79`
2. ОС: Ubuntu 22.04/24.04, желательно **от 4 vCPU / 8 GB RAM / 80+ GB NVMe**
3. Включите **бэкапы**
4. В firewall откройте порты:
   - **22** — SSH
   - **80** — сайт
   - **443** — HTTPS (позже)
   - **9000** — MinIO (фото/видео по подписанным ссылкам)
5. Скопируйте **пароль root** (или добавьте свой SSH-ключ в панель)

### 2. С вашего ПК (PowerShell, папка `E:\Foto_protokol`)

Архив и `.env.demo` уже собираются скриптами. Если файлов нет — выполните:

```powershell
cd E:\Foto_protokol
powershell -ExecutionPolicy Bypass -File infra\scripts\prepare-demo-env.ps1 -PublicHost "176.98.177.79" -BootstrapEmail "ВАША_ПОЧТА"
powershell -ExecutionPolicy Bypass -File infra\scripts\pack-for-timeweb.ps1
```

Затем залейте на сервер (пароль root спросит сам):

```powershell
scp mandarin-timeweb-demo.tgz root@176.98.177.79:/root/
scp .env.demo root@176.98.177.79:/root/env.demo
```

**Важно:** если на сервере уже есть `/opt/mandarin-pp/.env.demo` от прошлой выкладки — **не перезаписывайте его**. Иначе сменятся пароль БД и JWT, старые данные перестанут открываться. Заливайте только архив.

### 3. На сервере (первый запуск)

```bash
ssh root@176.98.177.79

apt-get update
apt-get install -y docker.io docker-compose-v2 curl tar
systemctl enable --now docker

mkdir -p /opt/mandarin-pp
tar -xzf /root/mandarin-timeweb-demo.tgz -C /opt/mandarin-pp
cd /opt/mandarin-pp

# только если .env.demo ещё нет:
cp /root/env.demo .env.demo
nano .env.demo
# проверьте PUBLIC_HOST=176.98.177.79
# проверьте BOOTSTRAP_ADMIN_EMAIL и BOOTSTRAP_ADMIN_PASSWORD

chmod +x infra/scripts/deploy-timeweb-demo.sh infra/docker/api-entrypoint.sh
bash infra/scripts/deploy-timeweb-demo.sh
```

Первая сборка образов занимает **10–20 минут**.

### 4. Если сервис на этом IP уже стоял (обновление)

```bash
ssh root@176.98.177.79
cd /opt/mandarin-pp
# сохранить текущий env
cp -a .env.demo /root/env.demo.bak
tar -xzf /root/mandarin-timeweb-demo.tgz -C /opt/mandarin-pp
cp -a /root/env.demo.bak .env.demo
chmod +x infra/scripts/deploy-timeweb-demo.sh infra/docker/api-entrypoint.sh
bash infra/scripts/deploy-timeweb-demo.sh
```

### 5. Проверка

В браузере: http://176.98.177.79

- Главная открывается без входа
- Слева кнопки **Вход** / **Регистрация**
- Вход модератора — почта и пароль из `BOOTSTRAP_ADMIN_*` в `.env.demo`

На сервере:

```bash
cd /opt/mandarin-pp
docker compose -f docker-compose.demo.yml --env-file .env.demo ps
curl -i http://127.0.0.1/api/v1/health
```

### 6. HTTPS (когда будет домен)

```bash
apt-get install -y certbot
# остановить nginx на 80 на время выпуска сертификата
docker compose -f docker-compose.demo.yml --env-file .env.demo stop nginx
certbot certonly --standalone -d your.domain.ru
mkdir -p /opt/mandarin-pp/infra/nginx/certs
cp /etc/letsencrypt/live/your.domain.ru/fullchain.pem /opt/mandarin-pp/infra/nginx/certs/
cp /etc/letsencrypt/live/your.domain.ru/privkey.pem /opt/mandarin-pp/infra/nginx/certs/
# раскомментировать SSL-блок в infra/nginx/demo.conf
# в .env.demo заменить http://176.98.177.79 на https://your.domain.ru
docker compose -f docker-compose.demo.yml --env-file .env.demo up -d nginx web api
```

## Полезные команды

```bash
cd /opt/mandarin-pp
docker compose -f docker-compose.demo.yml --env-file .env.demo ps
docker compose -f docker-compose.demo.yml --env-file .env.demo logs -f api
docker compose -f docker-compose.demo.yml --env-file .env.demo restart
```

## Если что-то упало

1. `docker compose -f docker-compose.demo.yml --env-file .env.demo logs api --tail=200`
2. В `.env.demo` не должно остаться `YOUR_DOMAIN`
3. `curl -i http://127.0.0.1/api/v1/health`
4. Пришлите логи API (без паролей из `.env.demo`)

## Важно

- Это контур клиники на одном VPS. Postgres, Redis и MinIO снаружи кроме порта 9000 не слушаются.
- Демо-логины `*@example.local` отключены.
- Файл `.env.demo` не коммитьте и не пересылайте в открытый чат.
