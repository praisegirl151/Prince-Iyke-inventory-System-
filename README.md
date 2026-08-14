# Prince Iyke Inventory System

Offline-first inventory and sales application built as a pnpm/Turborepo workspace.

## Applications

- `apps/web`: Next.js client. Business data is cached in IndexedDB through Dexie and mutations are queued while offline.
- `apps/backend`: TypeScript/Express API using Prisma and Neon PostgreSQL.

## Local setup

Install dependencies:

```sh
pnpm install
```

Copy the environment templates:

```sh
cp apps/backend/.env.example apps/backend/.env
cp apps/web/.env.example apps/web/.env.local
```

In `apps/backend/.env`, set `DATABASE_URL` to the pooled Neon URL whose hostname contains `-pooler`. Set `DIRECT_URL` to the direct Neon URL without `-pooler`. Both URLs must include `sslmode=require`. Generate separate random secrets of at least 32 characters for the JWT variables.

Apply the checked-in database migration and start both applications:

```sh
pnpm --filter backend prisma:deploy
pnpm dev
```

The web app runs at `http://localhost:3000`; the API defaults to `http://localhost:4000`.

## Create the first owner

Owner registration is intentionally an API operation so an uninitialized deployment cannot expose an unrestricted setup screen indefinitely:

```sh
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@example.com","password":"replace-this-password","name":"Owner","shopName":"Prince Iyke"}'
```

Afterward, sign in through the web app. The owner can create individual staff accounts from Settings. Staff receive a temporary password and must replace it on first login.

## Offline synchronization

Product edits, sales, debt payments, and settings changes are written to IndexedDB before the UI reports success. The sync engine retries them on startup, reconnection, focus, manual request, and a foreground timer. Operation UUIDs make retries idempotent.

Completed sales are retained when devices reconnect concurrently. Negative stock creates an owner reconciliation alert. Stale product or settings edits appear in the reconciliation panel instead of silently overwriting another device.

Existing `sp_*` localStorage data is copied into IndexedDB once. On the first owner login, the app previews the record counts and asks before uploading the snapshot. Legacy keys are removed only after the server confirms the import.

## Verification

```sh
pnpm lint
pnpm check-types
pnpm --filter backend test
pnpm build
```

Do not commit `.env` files or Neon credentials.

## Deployment

This workspace is prepared for deployment with the Next.js frontend hosted on Vercel and the Express backend hosted on Render.

### 1. Deploy the Backend (`apps/backend`) on Render

Create a new **Web Service** on Render pointing to your repository:
- **Build Command**: `pnpm install && pnpm --filter backend build`
- **Start Command**: `pnpm --filter backend start`
- **Environment**: `Node`
- **Environment Variables**:
  - `DATABASE_URL`: Connection pooled Neon URL containing `-pooler` and `sslmode=require`.
  - `DIRECT_URL`: Direct Neon URL without `-pooler` (with `sslmode=require`).
  - `JWT_ACCESS_SECRET`: Secure random JWT access token secret (at least 32 characters).
  - `JWT_REFRESH_SECRET`: Another secure random JWT refresh token secret (at least 32 characters).
  - `WEB_ORIGIN`: The URL of your Vercel frontend deployment (e.g. `https://your-app.vercel.app`).
  - `NODE_ENV`: `production`

### 2. Deploy the Frontend (`apps/web`) on Vercel

Create a new Project on Vercel pointing to your repository:
- **Framework Preset**: Next.js
- **Root Directory**: `apps/web`
- **Build Command**: Leave as default (Next.js preset)
- **Environment Variables**:
  - `NEXT_PUBLIC_API_URL`: The URL of your Render backend deployment (including `/api/v1`, e.g. `https://your-backend.onrender.com/api/v1`).

### 3. Database Migrations

Before or during your backend deployment, run the Prisma database migrations against your production database:
```sh
pnpm --filter backend prisma:deploy
```
