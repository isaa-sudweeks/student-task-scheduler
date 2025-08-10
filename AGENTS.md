# AGENTS

This repository hosts a Next.js 14 application for scheduling student tasks. It uses tRPC for API calls and Prisma with a PostgreSQL database.

## Local Setup

1. Install dependencies: `npm install`.
2. Copy `.env.example` to `.env` and fill in required values.
3. Generate Prisma client and sync the database:
   - `npx prisma generate`
   - `npx prisma db push`
4. Start the development server: `npm run dev`.

## Docker

- `cp .env.example .env` (optional for defaults)
- `docker compose build --no-cache`
- `docker compose up -d`
- `docker compose exec web npx prisma db push`

## Useful Scripts

- `npm run lint` – lint the codebase with ESLint.
- `npm test` – run unit tests with Vitest.
- `npm run e2e` – run Playwright end-to-end tests.
- `npm run build` then `npm start` for production.

## Codebase Overview

- `src/app` – Next.js routes and pages.
- `src/server` – tRPC routers, authentication, and database utilities.
- `prisma/schema.prisma` – Prisma schema.

## Agent Guidelines

- Run `npm run lint` and `npm test` before committing changes.
- Ensure environment variables such as `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL`, `GITHUB_ID`, `GITHUB_SECRET`, `REDIS_URL`, and `NEXTAUTH_SECRET` are configured.
