#!/bin/sh
set -e
echo "[api] prisma migrate deploy..."
npx prisma migrate deploy --schema=/app/packages/database/prisma/schema.prisma

if [ "${RUN_SEED_ON_START:-true}" = "true" ]; then
  echo "[api] seed demo data..."
  npx tsx /app/packages/database/prisma/seed.ts || echo "[api] seed warning (non-fatal)"
fi

# Sync JAW_RELATION positions if script present
if [ -f /app/tools/sync-jaw-relation-requirements.ts ]; then
  echo "[api] sync JAW_RELATION requirements..."
  npx tsx /app/tools/sync-jaw-relation-requirements.ts || echo "[api] JR sync warning (non-fatal)"
fi

echo "[api] starting Nest..."
exec node dist/main.js
