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

## Coding Style & Naming Conventions
- Language: TypeScript; prefer explicit types at module boundaries.
- Indentation: 2 spaces; keep imports ordered (libs → internal).
- Components/routers: `PascalCase` for React components; `camelCase` for functions/vars; route folders use Next.js conventions.
- Linting: ESLint enforces rules; run `npm run lint` and fix warnings before PRs.

## Testing Guidelines
- Frameworks: Vitest for unit, Playwright for E2E.
- Naming: `*.test.ts`/`*.test.tsx` for unit; `*.spec.ts` for E2E.
- Scope: Test tRPC procedures, Prisma logic, and critical UI flows.
- Running: Use `npm test` locally and in CI; add/adjust tests with any code change.

## Commit & Pull Request Guidelines
- Commits: Clear, imperative subject (e.g., "feat: add task calendar"). Keep changes focused.
- PRs: Include description, rationale, linked issues, and screenshots for UI changes. Note schema or env impacts.
- Checklist: Run `npm run lint`, `npm test`, and relevant E2E before requesting review.

## Security & Configuration Tips
- Env vars: Configure `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL`, `GITHUB_ID`, `GITHUB_SECRET`, `REDIS_URL`, `NEXTAUTH_SECRET` in `.env`. Never commit secrets.
- Prisma: Re-run `npx prisma generate` after schema changes.

## Contributor Workflow (Agents)
- Start with `npm install` and env setup.
- Validate with `npm run lint` and `npm test` before commits.
- Keep PRs small and incremental; prefer typed, tRPC-first changes.
