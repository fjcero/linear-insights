# Vercel Deployment

## Project settings

**Root Directory:** Leave empty or set to `.` (repo root). **Do not** set to `apps/app` — the full monorepo is required so workspace packages (`@linear-insights/*`) resolve correctly.

The build bundles `api/report.ts` into `api/report.js` because the workspace packages export raw TypeScript; Node on Vercel cannot execute `.ts` files at runtime.

## Environment variables

Set these in Vercel → Project Settings → Environment Variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `UPSTASH_REDIS_REST_URL` | Yes | From Upstash → your database → REST API |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | From Upstash (same database) |
| `LINEAR_CLIENT_ID` | Yes | Linear OAuth app |
| `LINEAR_CLIENT_SECRET` | Yes | Linear OAuth app |
| `LINEAR_REDIRECT_URI` | Yes | `https://your-app.vercel.app/auth/callback` |
| `SESSION_SECRET` | Yes | 32+ random chars (`openssl rand -base64 32`) |

## Linear OAuth

Add `https://your-app.vercel.app/auth/callback` to your Linear OAuth app redirect URIs (Settings → API → OAuth Applications).
