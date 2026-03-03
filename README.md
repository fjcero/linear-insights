# Linear Insights

Internal tool that reads from the Linear API and surfaces insights for Product, Ops, and Leadership.

## Phase 0: CLI

- **Bun CLI** with a single `insights` command that prints a full report (teams, projects, metrics, health, velocity).
- **Shared client** in `packages/linear-client` (Linear TypeScript SDK); reused later by the TanStack Start app.

### Setup

1. **direnv** (recommended): `direnv allow` in the repo root so `.envrc` loads `.env.local`.
2. Copy env and add your key:
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local: set LINEAR_API_KEY=lin_api_...
   ```
3. Install (Bun):
   ```bash
   bun install
   ```
4. Run:
   ```bash
   bun run cli
   # or: bun run insights
   ```

### CLI usage

```bash
bun run insights   # full insights report (default)
bun run cli -- insights   # same
bun run sync       # fetch and cache data only (no report)
bun run sync -- --force   # force refresh cache, then exit
```

### Optional env

- `LINEAR_API_KEY` — required for sync and insights (and for report API scope). Set in `.env.local`.
- `LINEAR_TEAM_IDS` — comma-separated team IDs to scope active projects (optional).
- **Cache (SQLite):** Report data (teams, projects, issues) is cached in a SQLite DB. Default path: `~/.cache/linear-insights/report.db` (override with `LINEAR_INSIGHTS_CACHE_DB`). Set `LINEAR_INSIGHTS_CACHE=0` to disable. TTLs: teams 1y, projects 1d, issues 1d.
- `LINEAR_INSIGHTS_FORCE_REFRESH=1` — force cache refresh (same as `--force`).
- **Velocity chart:** An HTML bar chart (projects created/closed by month) is written to `linear-insights-velocity.html` in the current directory. Override with `LINEAR_INSIGHTS_CHART_OUTPUT=/path/to/file.html`. Set `LINEAR_INSIGHTS_CHART=nodeplotlib` to also open an interactive Plotly chart in the browser (via nodeplotlib).

### Repo layout (layers)

- **packages/linear-client** — Linear API client (teams, projects, issues, metrics, health, velocity, lifecycle, objectives). No cache.
- **packages/cache** — SQLite cache optimized for report data (get/set teams, projects, issues by scope).
- **packages/report-data** — Data layer: cache-first access + sync orchestration (`syncLinearData`) for teams/projects/issues/timelines.
- **packages/data-sync** — Backward-compatible shim that re-exports sync from `report-data` (deprecated; kept for compatibility).
- **packages/report-build** — Builds `InsightsReportData` from cached teams/projects/issues (used by CLI and app server).
- **apps/cli** — Insights command; uses report-data and report-build. Reusable UI in **apps/cli/src/components**.
- **apps/app** — Web dashboard (Vite + React). UI components live in `apps/app/src/components`; report data helpers in `apps/app/src/lib`.

### Run the app

From repo root: `bun run app:dev`. This starts the report API (syncs cache if needed, serves JSON) and the app; the app opens with the report loaded automatically. See `apps/app/README.md` for details.

### If the CLI hangs or times out

- Each Linear API step has a **30s timeout**; you’ll see e.g. `Fetching teams timed out after 30s` if it doesn’t respond.
- Check: **network** (can you reach `https://api.linear.app`?), **firewall/VPN**, and that **LINEAR_API_KEY** is valid (create one at Linear → Settings → API).

## Later: TanStack Start app

After the CLI phase, the web app will depend on `@linear-insights/linear-client` and expose Product, Ops, and Roadmap views.
