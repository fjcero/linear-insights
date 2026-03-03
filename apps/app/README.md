# Linear Insights – Web app

Vite + React dashboard backed by the same cached report data as the CLI.

## Structure

- `src/components` — reusable UI components and dashboard sections
- `src/lib` — report transformation helpers for charts/tables
- `server/report-api.ts` — Bun API that serves `GET /report` and reads cached data

## Run (recommended)

From repo root:

```bash
bun run app:dev
```

This command starts the report API and the app together.

- Report API starts immediately and returns `503` while the cache sync is in progress
- Once the sync completes the API serves `GET /report` and `GET /report.json`
- The app polls `/report` until it gets a `200` (up to ~60 s); no manual refresh needed for most syncs
- Sync is a force-refresh by default (`LINEAR_INSIGHTS_SYNC_ON_START=1`)

Open the URL shown by Vite (usually http://localhost:5173).

## Current dashboard controls

- Team dropdown in header (`All teams` or a specific team)
- Date range preset dropdown (`All`, `Last 6 months`, `Last 3 months`)

## Environment

- `LINEAR_API_KEY` (required) — set in `.env.local`
- `LINEAR_INSIGHTS_CACHE_DB` (optional) — SQLite path locally; ignored when using Vercel KV on Vercel
- `LINEAR_INSIGHTS_API_PORT` (optional) — default `3001`
- `LINEAR_INSIGHTS_SYNC_ON_START` (optional) — default enabled; set `0` to disable startup refresh

## Other commands

- API only: `bun --filter @linear-insights/app server`
- App only (no API): `bun --filter @linear-insights/app dev`
- Generate static `report.json` then run app: `bun run app:dev:with-report`

## Build

```bash
bun run app:build
```

Output: `apps/app/dist`. Preview with `bun run app:preview`.
