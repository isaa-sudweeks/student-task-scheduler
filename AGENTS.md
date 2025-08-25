# Repository Guidelines

## Project Structure & Module Organization
- `src/app`: Next.js 14 routes/pages (server/client components).
- `src/server`: tRPC routers, auth, and DB utilities.
- `prisma/`: Prisma schema (`schema.prisma`) and generated client.
- `public/`: Static assets.
- Tests: Unit tests live alongside source as `*.test.ts(x)` (or under `tests/`); Playwright specs typically under `e2e/`.

## Build, Test, and Development
- Install: `npm install`
- Prisma: `npx prisma generate` then `npx prisma db push`
- Dev server: `npm run dev`
- Lint: `npm run lint`
- Unit tests (Vitest): `npm test`
- E2E tests (Playwright): `npm run e2e`
- Production: `npm run build` then `npm start`
- Docker: `docker compose build --no-cache && docker compose up -d && docker compose exec web npx prisma db push`

### Docker Dev (Hot Reload + Watchers)
- Start dev stack with file sync and watchers:
  - `docker compose -f docker-compose.yml -f docker-compose.dev.yml up --watch`
  - or simply `make dev`
- Auto behaviors in dev:
  - App code (TS/TSX/CSS) hot-reloads via Next.js.
  - Prisma schema changes auto-run `prisma generate` + `prisma db push`.
  - Config/env changes (`next.config.mjs`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, `.env`) restart the dev server.
  - Dependency changes (`package.json`, `package-lock.json`) trigger an image rebuild and container restart.
- If the repo lives under iCloud/Dropbox/OneDrive, prefer this file-sync setup over bind mounts to avoid filesystem errors.

## Coding Style & Naming Conventions
- Language: TypeScript; prefer explicit types at module boundaries.
- Indentation: 2 spaces; keep imports ordered (libs → internal).
- Components/routers: `PascalCase` for React components; `camelCase` for functions/vars; route folders use Next.js conventions.
- Linting: ESLint enforces rules; run `npm run lint` and fix warnings before PRs.

## Testing Guidelines
- Frameworks: Vitest for unit, Playwright for E2E.
- Compiling: Compile everything as a test to see if there are any errors.
- Naming: `*.test.ts`/`*.test.tsx` for unit; `*.spec.ts` for E2E.
- Scope: Test tRPC procedures, Prisma logic, and critical UI flows.
- Running: Use `npm test` locally and in CI; add/adjust tests with any code change.
- Non-watch mode: Set `CI=true` when running tests from the Codex CLI or CI to disable watch and avoid hangs: `CI=true npm test`.
- Sandbox: Only run tests outside the sandbox; never inside, as it can crash the computer.
- Test-first rule: Always add or update a relevant unit test before implementing a new feature; prefer TDD for changes to routers, Prisma logic, and UI components.
 - Relevance: Run only the tests relevant to your change; avoid unrelated suites.

## Commit & Pull Request Guidelines
- Commits: Clear, imperative subject (e.g., "feat: add task calendar"). Keep changes focused.
- PRs: Include description, rationale, linked issues, and screenshots for UI changes. Note schema or env impacts.
- Checklist: Run `npm run lint`, `npm test`, and relevant E2E before requesting review.

## Security & Configuration Tips
- Env vars: Configure `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GITHUB_ID`, `GITHUB_SECRET`, `REDIS_URL` in `.env`. Never commit secrets.
- Prisma: Re-run `npx prisma generate` after schema changes.

## Contributor Workflow (Agents)
- Start with `npm install` and env setup.
- Validate with `npm run lint` and `npm test` before commits.
- Keep PRs small and incremental; prefer typed, tRPC-first changes.

## Stats
- The stats page adapts charts for light and dark themes using `next-themes`.
- Maintain parallel color palettes for both themes and update tests when modifying visuals.
- Visual regression snapshots live in `src/app/stats/page.test.tsx` and should cover light and dark modes.
