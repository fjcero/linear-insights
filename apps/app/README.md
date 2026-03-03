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

- Report API serves `GET /report` and `GET /report.json`
- On startup it refreshes data from Linear (force refresh by default)
- App loads report automatically (no file picker needed in normal flow)

Open the URL shown by Vite (usually http://localhost:5173).

## Current dashboard controls

- Team dropdown in header (`All teams` or a specific team)
- Date range preset dropdown (`All`, `Last 6 months`, `Last 3 months`)

## Environment

- `LINEAR_API_KEY` (required) — set in `.env.local`
- `LINEAR_INSIGHTS_CACHE_DB` (optional) — default `~/.cache/linear-insights/report.db`
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
