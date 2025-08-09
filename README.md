# Student Task Scheduler (Auth + Docker)

Next.js + TypeScript + Tailwind + Prisma + tRPC + NextAuth, with Docker.

## Quick start (local)
```bash
pnpm install
cp .env.example .env
pnpm dlx prisma generate
pnpm db:push
pnpm dev
# open http://localhost:3000/tasks
```

## Auth (NextAuth)
- GitHub OAuth (set `GITHUB_ID`, `GITHUB_SECRET`, callback: `http://localhost:3000/api/auth/callback/github`)
- Dev Login (Credentials) for local testing

## Docker
```bash
docker compose build
docker compose up -d
docker compose exec web npx prisma db push
# open http://localhost:3000/tasks
```

## Notes
- Prisma adapter stores sessions in DB.
- Replace Dev Login in production.
