# Student Task Scheduler (Clean, Docker-friendly)

## Run with Docker
```bash
cp .env.example .env    # optional for local runs
docker compose build --no-cache
docker compose up -d
docker compose exec web npx prisma db push
# open http://localhost:3000/tasks
```

### Docker Dev (Hot Reload)
For rapid iteration without rebuilds on code changes:
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --watch
```
- Runs Next.js in development mode with HMR.
- Uses Docker Compose file sync (not bind mounts), which avoids iCloud/Network drive issues.
- Auto behaviors:
  - App code (TS/TSX/CSS): hot-reloads instantly via Next.js.
  - Prisma schema (`prisma/schema.prisma`): auto `prisma generate` + `prisma db push`, then server continues.
  - Config/env (`next.config.mjs`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, `.env`): dev server auto-restarts.
  - Dependencies (`package.json`/`package-lock.json`): Compose watch triggers an image rebuild + container restart.
- Manual rebuild if needed:
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml build web
```

Tip: In Docker Desktop, you can also toggle “Enable Watch” for the `web` service. If you prefer bind mounts instead of file sync, move the repo out of iCloud/Dropbox/OneDrive paths, then revert to a bind mount `.:/app` in `docker-compose.dev.yml`.

Shortcut
- Use `make dev` as a one-liner wrapper for the compose watch command.

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

## Problems
- Drag reordering does not persist: Dragging tasks to a new order updates the UI briefly, but the order does not stay after refresh.
