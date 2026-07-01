# VisaTrack UK

A community-run timeline tracker for UK Spouse/Partner visa applications,
built on data posted to r/SpouseVisaUk. Users log in and submit their own
application timeline — country, visa type, priority service, and key dates
(application, biometrics, ECO email, RFI, NSF, decision). The site aggregates
submissions into processing-time averages, approval rates, monthly trends, and
per-country line charts.

- `backend/` — PocketBase (Go), single binary, embedded SQLite, custom REST endpoints.
- `frontend/` — Vite + React (plain JavaScript), recharts for data visualisation.

Licensed under the Apache License 2.0. See [LICENSE](LICENSE).

## What it tracks

- Spouse, fiancé(e), unmarried partner, extension, and other visa types
- Standard, priority, and super priority service
- Processing time in UK working days (biometrics to decision, excluding bank holidays)
- Outcomes: approved, rejected, pending
- Per-country 12-month trend charts for decisions and average processing days

## Prerequisites

- Go 1.22+
- Node 20+ and npm

## Running locally

**Backend** — starts PocketBase at `http://127.0.0.1:8090`:

```bash
cd backend
go run . serve
```

On first run, follow the printed URL to create a superuser account, or run:

```bash
go run . superuser upsert you@example.com yourpassword
```

**Frontend** — starts the dev server at `http://localhost:5173`:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

`.env` defaults to `VITE_PB_URL=http://127.0.0.1:8090` which is correct for local dev.

## Custom API endpoints

Both are served by the Go backend alongside the standard PocketBase REST API.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/custom/stats` | Aggregate stats for the dashboard (outcomes, processing times by visa type / priority / country / month). Accepts `?countryPriority=none\|priority\|super_priority` to filter the country table. |
| GET | `/api/custom/country-stats` | Per-country 12-month breakdown of decided applications and average processing days, grouped by visa type and priority. Accepts `?country=NAME`. |
| POST | `/api/custom/claim` | Lets an authenticated user adopt unclaimed application entries that match their `reddit_username`. |

## Project structure

```
backend/
  main.go          — custom endpoints, stats aggregation, reddit_username masking
  holidays.go      — UK bank holiday list (England & Wales) for working-day math
  migrations/      — PocketBase schema migrations (additive only)
  cmd/applesecret/ — tool to regenerate the Apple Sign In client secret

frontend/src/
  pages/           — Dashboard, Applications, Countries, CountryStats, MyApplication, Settings, Login
  components/      — CountryTable, GroupBarChart, MonthlyTable, CountrySelect, StatusBadge
  lib/             — PocketBase client, auth context, processing-day math, labels, formatting
```

## Contributing

Pull requests are welcome. A few things worth knowing before making changes —
see [AGENTS.md](AGENTS.md) for the full list of conventions, particularly
around migrations and processing-time logic.
