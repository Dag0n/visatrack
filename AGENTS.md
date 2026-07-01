# VisaTrack UK

A community-run timeline tracker for UK Spouse/Partner visa applications,
modeled on the data people post in r/SpouseVisaUk. Users submit their own
application timeline; the site aggregates everyone's data into averages,
trends, and country/visa-type breakdowns.

- `backend/` — PocketBase (Go), single binary + embedded SQLite.
- `frontend/` — Vite + React, plain JavaScript (not TypeScript).
- See `README.md` for local dev setup.

## Conventions worth knowing before touching this repo

- **Migrations are additive, never edit one that may have already run.**
  Schema changes live in `backend/migrations/*.go`, each in its own
  timestamped file. If a migration has already been applied anywhere
  (local dev db, the production server), don't edit it — add a new
  migration instead, even for something as small as adding one field.
- **Processing time is anchored on biometrics only, not application
  date.** "Day 1" = the first working day after the biometrics
  appointment, with no fallback. UK bank holidays (England & Wales,
  sourced from gov.uk) are excluded from "working day" math everywhere —
  see `backend/holidays.go` and `frontend/src/lib/{processingDays,
  ukBankHolidays}.js`. Keep both copies in sync if the holiday list or
  working-day logic ever changes.
- **`applications.user` is optional.** This allows seeding entries
  (e.g. transcribed from a Reddit post) before the person behind them has
  an account. `POST /api/custom/claim` lets a signed-in user adopt any
  unclaimed entries (`user = ''`) matching their own `reddit_username`.
  Don't reintroduce a required `user` field without accounting for this.
- **`reddit_username` lives on the `users` collection**, not per
  application — it's set once in Settings and copied onto new
  application records at creation time, not asked again per submission.
- **Anonymous viewers get a masked `reddit_username`.** The
  `OnRecordEnrich` hook in `backend/main.go` rewrites it to `j***h` for
  unauthenticated API requests; any logged-in user (any account) sees
  real values. This is enforced server-side, not just hidden in the UI.
- **Apple Sign In's client secret expires every ≤6 months** and must be
  regenerated from the `.p8` key — see `backend/cmd/applesecret`. Never
  commit a `.p8`/`.pem`/`.key` file (already gitignored, but watch for it
  landing in the repo root during local setup).
- **Cross-compile for the server**: `GOOS=linux GOARCH=amd64 go build`
  (production box is Ubuntu x86_64).
