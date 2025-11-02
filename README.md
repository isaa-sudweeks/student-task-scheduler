# Student Task Scheduler

A Next.js 14 application that helps students orchestrate tasks, projects, and study sessions with calendar-aware automations and AI-assisted planning. The app's mission is to keep learners on track by turning assignments into an actionable schedule.

## Table of Contents
- [Key Features](#key-features)
- [Architecture at a Glance](#architecture-at-a-glance)
- [Quick Start](#quick-start)
  - [Run with Docker](#run-with-docker)
  - [Local Development (without Docker)](#local-development-without-docker)
- [Test-First Development Workflow](#test-first-development-workflow)
- [Quality Gates & Tooling](#quality-gates--tooling)
- [Authentication & Protected Routes](#authentication--protected-routes)
- [Environment Variables](#environment-variables)
- [Google Authentication & Calendar Sync](#google-authentication--calendar-sync)
- [AI Scheduling Suggestions](#ai-scheduling-suggestions)
- [Caching Strategy](#caching-strategy)
- [Troubleshooting](#troubleshooting)

## Key Features
- 📅 **Actionable scheduling:** Convert tasks into a prioritized agenda backed by Google Calendar integration.
- 🤖 **AI assistance:** Generate smart scheduling suggestions or fall back to deterministic heuristics when no LLM is configured.
- 🔒 **Secure access:** NextAuth-powered authentication protects all student data.
- 📊 **Insights dashboard:** Light and dark themed statistics surfaces workload trends and completion streaks.

## Architecture at a Glance
- **Next.js 14** drives the UI with server and client components located in `src/app`.
- **tRPC 11** powers typed API procedures in `src/server` and shares contracts with the frontend.
- **Prisma ORM** (schema in `prisma/schema.prisma`) handles data access to PostgreSQL.
- **Playwright & Vitest** enforce quality through end-to-end and unit tests.

## Quick Start

### Run with Docker
```bash
cp .env.example .env    # optional for local runs
docker compose build --no-cache
docker compose up -d
docker compose exec web npx prisma db push
# open http://localhost:3000/tasks
```

#### Hot Reloading in Containers
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --watch
# or use `make dev`
```
- Next.js runs in development mode with hot module reload.
- Prisma schema edits trigger `prisma generate` and `prisma db push` automatically.
- Config or environment file changes restart the dev server.
- Dependency updates rebuild the `web` image.
- Prefer the file-sync configuration over bind mounts for repos inside iCloud/Dropbox/OneDrive.

### Local Development (without Docker)
```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
npm run dev
```

Notes:
- The repo intentionally omits a `postinstall` hook so Docker builds can copy the schema first.
- Tooling versions align with Next.js 14.2.x: TypeScript 5.7.x, tRPC 11.4.4, ESLint 8.57.

## Test-First Development Workflow
1. **Capture intent in a test.** Before implementing a feature or bug fix, add or update a failing unit (`*.test.ts(x)`) or e2e (`*.spec.ts`) test that describes the desired behaviour.
2. **Run the focused suite.** Execute only the relevant tests to confirm they fail for the right reason.
   ```bash
   CI=true npm test        # Vitest in CI mode (no watch)
   npm run e2e             # Playwright specs
   ```
3. **Implement the code to go green.** Update application logic until the new test passes.
4. **Lock in quality gates.** Finish by running linting and a production build to ensure type safety.
   ```bash
   npm run lint
   npm run build
   ```
5. **Document changes.** Update this README or feature-specific docs whenever behaviour visible to users shifts.

## Quality Gates & Tooling
- **Linting:** `npm run lint`
- **Unit tests:** `CI=true npm test`
- **End-to-end tests:** `npm run e2e`
- **Type checks/build:** `npm run build` followed by `npm start` for production verification.
- **Docker production build:** `docker compose build --no-cache && docker compose up -d && docker compose exec web npx prisma db push`

## Authentication & Protected Routes
The scheduler requires authentication before any core page loads. The following paths (and their nested routes) are protected via middleware and redirect unauthenticated users to the sign-in flow:

- `/` (dashboard)
- `/calendar`
- `/courses`
- `/projects`
- `/settings`
- `/stats`
- `/tasks`

Add new authenticated sections in `src/middleware.ts` to inherit the same protection.

## Environment Variables
Create a `.env` file and configure:

- `DATABASE_URL` – PostgreSQL connection string. Defaults to `postgresql://postgres:postgres@localhost:5432/scheduler`.
- `NEXTAUTH_SECRET` – Secret used to encrypt NextAuth JWTs. Set a strong production value.
- `NEXTAUTH_URL` – Base URL for NextAuth callbacks (e.g., `http://localhost:3000`).
- `GITHUB_ID`, `GITHUB_SECRET` – GitHub OAuth credentials for sign-in.
- `REDIS_URL` – Redis connection string for caching (defaults to `redis://localhost:6379`).
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` – OAuth credentials for Google Calendar sync.

Never commit secrets. Re-run `npx prisma generate` whenever the Prisma schema changes.

## Google Authentication & Calendar Sync
1. Create a Google Cloud project and enable the Calendar API.
2. Configure OAuth credentials with redirect URI `http://localhost:3000/api/auth/callback/google`.
3. Add credentials to `.env`:
   ```bash
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   ```
4. Start the app, sign in with Google, and toggle **Google Calendar Sync** in **Settings**.
5. Retrieve your iCal feed at `/api/trpc/event.ical` for use in other calendar clients.

## AI Scheduling Suggestions
- Configure an LLM provider under **Settings → Preferences** (OpenAI API key or LM Studio URL).
- Without an AI provider, the scheduler falls back to deterministic heuristics that still assign every task.
- Visit `/tasks/schedule-suggestions` to generate batch proposals and accept them in bulk.
- The calendar backlog exposes an **AI suggestions** panel to accept recommendations inline.

## Caching Strategy
`tRPC taskRouter.list` caches results for 60 seconds using an in-memory store backed by [`@upstash/redis`](https://github.com/upstash/redis). Mutations that modify tasks (create, update, delete, reorder, etc.) invalidate the cache to ensure fresh responses. Configure Redis via `REDIS_URL` and `REDIS_TOKEN` or allow the local in-memory fallback.

## Troubleshooting
**Missing Next.js chunk (e.g., `Error: Cannot find module './948.js'`)**
- Stop the dev server.
- Run `npm run clean` to remove `.next` and caches.
- Restart with `npm run dev`.
- For Docker workflows, prefer `make dev`; if issues persist, run `make dev-clean` before restarting.
- Avoid bind mounts when working from cloud-synced directories; the provided file-sync compose setup keeps `.next` inside the container.

**Login loop after Google sign-in**
- Ensure `NEXTAUTH_SECRET` is set.
- Confirm `NEXTAUTH_URL` matches how you access the app (e.g., `http://localhost:3000`).
- We use JWT sessions in NextAuth; database sessions can cause redirect loops when combined with `next-auth/middleware`.
