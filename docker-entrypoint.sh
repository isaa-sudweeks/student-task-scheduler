#!/bin/sh
set -eu

echo "[entrypoint] Generating Prisma client"
npx prisma generate >/dev/null 2>&1 || true

echo "[entrypoint] Waiting for database and pushing schema"
ATTEMPTS=0
MAX_ATTEMPTS=20
SLEEP_SECS=2

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

echo "[entrypoint] Starting Next.js"
exec npm start

