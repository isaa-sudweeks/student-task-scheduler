#!/bin/sh
set -eu

MODE=${1:-start}

# In dev, ensure deps exist when bind-mount hides image node_modules
if [ "$MODE" = "dev" ]; then
  if [ ! -d node_modules ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
    echo "[entrypoint] Installing dependencies (node_modules missing)"
    if command -v npm >/dev/null 2>&1; then
      npm ci || npm install
    fi
  fi
fi

echo "[entrypoint] Generating Prisma client"
npx prisma generate >/dev/null 2>&1 || true

echo "[entrypoint] Waiting for database and pushing schema"
ATTEMPTS=0
MAX_ATTEMPTS=20
SLEEP_SECS=2

if [ "$MODE" = "dev" ]; then
  until npx prisma db push; do
    ATTEMPTS=$((ATTEMPTS+1))
    if [ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; then
      echo "[entrypoint] Failed to connect to DB after $((ATTEMPTS*SLEEP_SECS))s"
      exit 1
    fi
    echo "[entrypoint] DB not ready yet, retrying ($ATTEMPTS/$MAX_ATTEMPTS)..."
    sleep "$SLEEP_SECS"
  done
else
  until npx prisma db push >/dev/null 2>&1; do
    ATTEMPTS=$((ATTEMPTS+1))
    if [ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; then
      echo "[entrypoint] Failed to connect to DB after $((ATTEMPTS*SLEEP_SECS))s"
      npx prisma db push
      exit 1
    fi
    echo "[entrypoint] DB not ready yet, retrying ($ATTEMPTS/$MAX_ATTEMPTS)..."
    sleep "$SLEEP_SECS"
  done
fi

if [ "$MODE" = "dev" ]; then
  echo "[entrypoint] Starting Next.js in dev mode (hot reload + config/env/schema watchers)"
  exec npm run dev:watch
else
  echo "[entrypoint] Starting Next.js"
  exec npm start
fi
