# Repository Guidelines

## Mission & Scope
- **Primary goal:** Student Task Scheduler helps learners orchestrate coursework, projects, and study sessions with calendar-aware automations and AI-assisted scheduling. Keep documentation and code changes focused on that outcome.
- This `AGENTS.md` governs the entire repository. Follow any nested `AGENTS.md` files for more granular rules if they exist.

## Project Structure
- `src/app`: Next.js 14 routes/pages (server and client components).
- `src/server`: tRPC routers, authentication, and database utilities.
- `prisma/`: Prisma schema (`schema.prisma`) plus generated client.
- `public/`: Static assets.
- Tests: Unit tests live alongside source files as `*.test.ts(x)` or under `tests/`; Playwright specs live in `e2e/`.

## Test-First Development Workflow
1. **Design the test.** Start every feature or bug fix by adding or updating a failing unit/e2e test that captures the desired behaviour. Never ship functionality without a matching test.
2. **Run focused suites.** Use `CI=true npm test` for unit tests and `npm run e2e` for Playwright specs. Execute only the suites that cover your change to keep cycles fast.
3. **Implement to green.** Modify production code until the new/updated tests pass, then run `npm run lint` and `npm run build` for type-check coverage.
4. **Document intent.** Update README or relevant docs when the behaviour visible to users changes.
5. **Keep the sandbox clean.** Run tests outside the browser sandbox to avoid crashes.

## Build & Tooling Commands
- Install dependencies: `npm install`
- Prisma prep: `npx prisma generate` then `npx prisma db push`
- Local dev server: `npm run dev`
- Linting: `npm run lint`
- Unit tests: `CI=true npm test`
- E2E tests: `npm run e2e`
- Production build: `npm run build` then `npm start`
- Docker workflow: `docker compose build --no-cache && docker compose up -d && docker compose exec web npx prisma db push`

### Docker Dev (Hot Reload + Watchers)
- Start the dev stack with file sync and watchers:
  - `docker compose -f docker-compose.yml -f docker-compose.dev.yml up --watch`
  - or simply `make dev`
- Automatic behaviours while watching:
  - App code (TS/TSX/CSS) hot-reloads through Next.js.
  - Prisma schema changes auto-run `prisma generate` + `prisma db push`.
  - Config/env changes (`next.config.mjs`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, `.env`) restart the dev server.
  - Dependency updates (`package.json`, `package-lock.json`) trigger an image rebuild and container restart.
- Prefer this file-sync setup over bind mounts when working from iCloud/Dropbox/OneDrive to avoid filesystem errors.

## Coding Style & Naming
- Language: TypeScript; provide explicit types at module boundaries.
- Indentation: 2 spaces. Order imports by external libraries first, then internal modules.
- React components and tRPC routers use `PascalCase`; utilities and functions use `camelCase`.
- Follow Next.js routing conventions for folder names.
- ESLint enforces the baseline—run `npm run lint` and resolve warnings before committing.
- Avoid redundant generics on APIs that already provide types (e.g., `redis.keys` returns `string[]`).

## Commit & Pull Request Expectations
- Commits: Use clear, imperative subjects (e.g., "feat: add task calendar"). Keep diffs focused.
- PRs: Include a summary, rationale, linked issues, and screenshots/GIFs for UI changes. Document schema or environment impacts explicitly.
- Checklist before review: `npm run lint`, `CI=true npm test`, `npm run build`, and relevant `npm run e2e` suites.

## Security & Configuration
- Environment variables to set in `.env`: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GITHUB_ID`, `GITHUB_SECRET`, `REDIS_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- Never commit secrets. Regenerate Prisma client (`npx prisma generate`) after schema updates.

## Contributor Tips
- Start by syncing dependencies and environment variables.
- Prioritize typed, tRPC-first changes that keep the scheduling experience reliable.
- Keep PRs small and incremental; surface any follow-up work clearly in documentation.

## AI & Scheduling Features
- Any AI helper should leverage the most convenient, high-performance agentic structure available for the chosen language.
- Stats page charts adapt to light/dark themes using `next-themes`; maintain parallel palettes and update tests alongside visual changes.
- Visual regression snapshots live in `src/app/stats/page.test.tsx` and must cover light and dark modes.
