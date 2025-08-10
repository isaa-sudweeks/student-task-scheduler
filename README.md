# Student Task Scheduler (Clean, Docker-friendly)

## Run with Docker
```bash
cp .env.example .env    # optional for local runs
docker compose build --no-cache
docker compose up -d
docker compose exec web npx prisma db push
# open http://localhost:3000/tasks
```

## Local (no Docker)
```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
npm run dev
```

Notes:
- No postinstall hook (avoids prisma generate before schema copy in Docker).
- TypeScript 5.7.x + tRPC 11.4.4 + ESLint 8.57 aligned with Next 14.2.x.
