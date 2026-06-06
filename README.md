# Deadlock Stat Tracker

Monorepo for a hybrid Deadlock stats platform:

- `apps/web` - React + Vite frontend with shareable player pages, filters, upload, and global stats.
- `apps/api` - Fastify backend that ingests match data via `deadlock-api.com`, stores in Postgres, and computes aggregates.
- `packages/shared` - shared types and API client wrappers.

## Quick start

1. Copy `.env.example` to `.env` and fill values.
2. Install dependencies: `corepack pnpm install`
3. Generate Prisma client: `corepack pnpm --filter @deadlock/api prisma:generate`
4. Apply migrations: `corepack pnpm --filter @deadlock/api prisma:migrate`
5. Start all apps: `corepack pnpm dev`

## Scripts

- `corepack pnpm build`
- `corepack pnpm lint`
- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm format`

## Environment variables

Copy `.env.example` and set:

- `DATABASE_URL` - Postgres connection string (Neon/Supabase recommended)
- `DEADLOCK_API_BASE_URL` - defaults to `https://api.deadlock-api.com`
- `DEADLOCK_API_KEY` - optional API key if you use one
- `PORT` - API port (default `4000`)
- `ORIGIN` - frontend origin for CORS
- `VITE_API_URL` - frontend API URL (set in your web host environment)

## Deployment

### Frontend (`apps/web`) on Vercel

- `apps/web/vercel.json` is included.
- Build command: `corepack pnpm --filter @deadlock/web build`
- Set env var: `VITE_API_URL=<your-api-url>`

### Backend (`apps/api`) on Render / Railway / Fly

- `apps/api/Dockerfile` builds and runs the API.
- `render.yaml` is included for Render Blueprint deploys.
- Required env vars in production:
  - `DATABASE_URL`
  - `DEADLOCK_API_BASE_URL`
  - `DEADLOCK_API_KEY` (optional unless required)
  - `ORIGIN` (your web app URL)

### Database

- Use managed Postgres (Neon/Supabase).
- Run migrations during deploy:
  - `corepack pnpm --filter @deadlock/api prisma:migrate`
