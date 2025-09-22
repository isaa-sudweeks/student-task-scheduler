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

## Environment Variables

Configure these variables in `.env`:

- `DATABASE_URL` – PostgreSQL connection string. Defaults to `postgresql://postgres:postgres@localhost:5432/scheduler` for development.
- `NEXTAUTH_SECRET` – Secret used to encrypt NextAuth JWTs. Defaults to `replace_me` in development; use a strong value in production.
- `NEXTAUTH_URL` – Base URL used for NextAuth callbacks. Defaults to `http://localhost:3000`.
- `GITHUB_ID` – GitHub OAuth app client ID for enabling GitHub sign-in.
- `GITHUB_SECRET` – GitHub OAuth app client secret.
- `REDIS_URL` – Redis connection string for caching. Defaults to `redis://localhost:6379`.
- `GOOGLE_CLIENT_ID` – Google OAuth client ID for Calendar sync.
- `GOOGLE_CLIENT_SECRET` – Google OAuth client secret.

## Google Authentication & Calendar Sync

1. Create a Google Cloud project and enable the Calendar API.
2. Create OAuth credentials for a Web application and set the authorized redirect URI to `http://localhost:3000/api/auth/callback/google`.
3. Copy the credentials into `.env`:

   ```bash
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   ```

4. Start the app and sign in with Google.
5. Open **Settings** and toggle **Google Calendar Sync** to enable or disable synchronization.
6. An iCal feed of scheduled events is available at `/api/trpc/event.ical` and can be consumed by other calendar clients.

## AI Scheduling Suggestions

- Configure an LLM provider under **Settings → Preferences** (OpenAI API key or LM Studio URL). If no model is configured, the scheduler falls back to a deterministic heuristic that still assigns every task.
- Visit `/tasks/schedule-suggestions` to generate a full set of proposed start/end times for unscheduled tasks and accept them in bulk. Suggestions respect your working hour window and task metadata such as due dates and priority.
- The calendar backlog now includes an **AI suggestions** panel so you can generate slots without leaving the calendar view and accept individual recommendations inline.

## Testing

Run linting and the test suites locally:

```bash
npm run lint
CI=true npm test
npm run e2e
```

## Caching

`taskRouter.list` caches query results for 60 seconds using an in-memory store backed by [`@upstash/redis`](https://github.com/upstash/redis). Any mutation that changes tasks (create, update, delete, reorder, etc.) clears the cache so subsequent `list` calls return fresh data. Configure Redis via `REDIS_URL` and `REDIS_TOKEN` or leave them unset to fall back to a local in-memory cache.


## Troubleshooting

Missing Next.js chunk (e.g., Error: Cannot find module './948.js')
- Cause: A stale or partially-synced `.next` directory can leave the dev server referencing a chunk that no longer exists. This is common when the repo is under iCloud/Dropbox/OneDrive or when switching between dev modes.
- Quick fix (local):
  - Stop the dev server.
  - Run `npm run clean` to remove `.next` and caches.
  - Start again with `npm run dev`.
- Docker dev fix:
  - Prefer `make dev` (Compose file sync) which ignores `.next`.
  - If things get wedged, run `make dev-clean` and then `make dev`.
- Cloud-synced folders:
  - Avoid bind mounts when the repo lives under iCloud/Dropbox/OneDrive. Use the provided file-sync compose (`docker-compose.dev.yml`) so `.next` stays inside the container and isn’t synced.

Login loop after Google sign-in
- Cause: Using database sessions with `next-auth/middleware` prevents the middleware from reading the session, causing a redirect loop back to sign-in.
- Fix: We use JWT sessions in NextAuth. Ensure your `.env` has `NEXTAUTH_SECRET` set and `NEXTAUTH_URL` matches how you access the app (e.g., `http://localhost:3000`).
