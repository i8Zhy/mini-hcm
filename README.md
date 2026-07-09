# Mini HCM — Time Tracking

_A lightweight time-tracking system: Employees punch in/out, the app auto-computes
their daily hours (regular, overtime, night differential, late, undertime), and
admins can review daily/weekly reports and correct daily punch times._

## Live Demo

**https://mini-hcm-28683.web.app**

- **Admin login:** `Admin1@gmail.com` / `admin1234`
- **Employee login:** `emp@gmail.com` / `emp123`

> **Note:** The compute backend runs on Render's free tier, which spins down after ~15 min idle — the **first** punch-out after a period of inactivity may take up to ~50s while the server wakes. Subsequent requests are fast. Also, if the dashboard data ever looks stuck, disable ad/privacy blockers or use an incognito window (aggressive blockers can block Firestore requests).

## Tech Stack

React (Vite) · Node.js + Express (compute backend) · Firebase Authentication · Cloud Firestore

## Features

- Email/password auth with role-based routing (employee vs admin)
- Punch in/out with open-shift detection (can't double-punch)
- Auto-computed daily metrics: regular, overtime, night differential, late, undertime
- Employee dashboard: KPI tiles + recent history
- Admin dashboard: daily & weekly reports, plus punch-time editing that recomputes metrics on save
- Role-based access enforced server-side via Firestore Security Rules

## Running Locally

The app has two parts — the React frontend and the Express compute server. Run both:

```bash
# 1. Compute server (terminal 1)
cd server
npm install
npm start            # serves on http://localhost:3001

# 2. Frontend (terminal 2)
npm install
npm run dev
```

- Firebase config lives in `src/config/firebase.js`.
- The frontend calls the compute server at `http://localhost:3001` by default. To point it at a deployed server, set `VITE_API_URL` in a `.env` file at the project root.

## Data Model

- `users/{uid}` — profile: name, email, role, timezone, schedule
- `attendance/{autoId}` — raw punches: userId, type (in/out), timestamp
- `dailySummary/{uid}_{date}` — computed metrics per employee per day

## How Metrics Are Computed

All time math runs on the **Express backend**, in one pure function — [`server/computeDailyMetrics.js`](server/computeDailyMetrics.js). On punch-out the frontend POSTs the punch times + schedule to `POST /compute`, and the server returns `{ regularHours, overtimeHours, nightDiffHours, lateMinutes, undertimeMinutes, status }`:

- **Regular** — worked time, capped at the scheduled duration
- **Overtime** — only time worked *after* `schedule.end`
- **Night differential** — overlap with the 22:00–06:00 window
- **Late / undertime** — minutes past `schedule.start` / before `schedule.end`

The server pins its timezone to `Asia/Manila` so schedule and night-diff windows are interpreted consistently regardless of where it's hosted. Keeping the function pure (no I/O) made it straightforward to hand-verify against known cases.

## Key Decisions

- Metrics are computed **on punch-out** and stored in `dailySummary` (read-optimized reporting).
- `dailySummary` uses a composite doc ID (`{uid}_{date}`) for direct lookups without queries.
- Access control is enforced by Firestore Security Rules, not just the UI.
- One punch cycle per day is enforced by button gating — the punch button disables after a complete in/out pair, so an employee can't log duplicate cycles.

## Known Limitations

- **Client still writes the summary doc** — metrics are computed server-side (Express), but the frontend writes the returned numbers to Firestore, so a determined user could still write fabricated values directly. Fully closing this needs a Firestore-triggered Cloud Function that writes the summary server-side and locks `dailySummary` to no client writes.

- **Auth & Firestore deletes aren't cascaded** — production would soft-delete (flag inactive) to preserve history.

- **Open shifts aren't auto-summarized** — `computeDailyMetrics` already handles a missing punch-out (returns a `missing_punch_out` status with null hours + late minutes, which the history table renders as "Missing out"), but nothing currently triggers it for open shifts. So a forgotten punch-out — or an overnight shift whose out lands the next day — still leaves that day without a summary doc. A scheduled job that closes/flags open shifts would complete this.

- **Midnight-crossing / night-shift schedules aren't fully modeled** — schedule start/end, overtime, and undertime are computed relative to the punch-in's calendar day, so a shift spanning midnight (or a night-shift schedule) can miscompute overtime. Proper support needs schedule windows that can span two dates.

## Author

Zhiro Javier T. Pineda 