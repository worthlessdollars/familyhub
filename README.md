# Family Hub

A household coordination app built for a wall-mounted tablet or spare laptop. Tracks daily chores, family schedules, and streaks — all visible on a shared TV dashboard with real-time updates.

## Features

- **TV Dashboard** — 3-column kiosk display showing today's chores, agenda, and streaks. Auto-refreshes at 3 AM for the new day.
- **PIN Login** — Each family member has a 4-digit PIN. No passwords, no email. Kids and parents have different permission levels.
- **Chore Tracking** — Daily chore instances generated automatically. Mark done (with PIN), skip, or reassign. Full audit trail via immutable event log.
- **Streaks** — Current and longest streaks per person per chore, displayed on the dashboard.
- **Agenda** — Shared family calendar. Anyone can add events; parents can edit/delete anything, kids can only modify their own.
- **Real-Time Updates** — Server-Sent Events push changes to the dashboard instantly when chores are completed or events are added.
- **User Management** — Parents can add/edit family members and change PINs from the admin panel.

## Tech Stack

- **Next.js 15** (App Router, React 19)
- **SQLite** via better-sqlite3 + Drizzle ORM
- **Tailwind CSS 4**
- **Vitest** for testing
- **TypeScript**

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment config
cp .env.example .env

# Push database schema
npm run db:push

# Seed with sample data (2 parents, 3 kids, 3 chores)
npm run seed

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Add `?device=tv` for the dashboard view.

### Default Users (after seeding)

| Name    | Role   | PIN  |
|---------|--------|------|
| Parent1 | parent | 1111 |
| Parent2 | parent | 2222 |
| Kid1    | kid    | 3333 |
| Kid2    | kid    | 4444 |
| Kid3    | kid    | 5555 |

Parent names and PINs can be changed from the admin panel at `/admin/users`.

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/login` | PIN-based login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Current user |
| GET | `/api/chores/today` | Today's chore instances |
| POST | `/api/chores/instances/:id/complete` | Mark chore done |
| POST | `/api/chores/instances/:id/skip` | Skip chore |
| POST | `/api/chores/instances/:id/reassign` | Reassign chore |
| GET/POST | `/api/agenda` | List/create agenda items |
| PATCH/DELETE | `/api/agenda/:id` | Edit/delete agenda item |
| GET | `/api/streaks` | All streaks |
| GET/POST | `/api/users` | List/create users |
| PATCH | `/api/users/:id` | Update user |
| GET | `/api/events/stream` | SSE real-time updates |

## macOS Kiosk Setup

For running on a dedicated Mac (e.g. Mac Mini connected to a TV):

```bash
# Production build
npm run build

# Install launch agents
cp scripts/com.familyhub.kiosk.plist ~/Library/LaunchAgents/
cp scripts/com.familyhub.backup.plist ~/Library/LaunchAgents/

# Load them
launchctl load ~/Library/LaunchAgents/com.familyhub.kiosk.plist
launchctl load ~/Library/LaunchAgents/com.familyhub.backup.plist
```

This will:
- Start the app and open Chrome in kiosk mode on login
- Run nightly SQLite backups at 2 AM (14-day retention)

## Running Tests

```bash
# Start the dev server first (tests run against it)
npm run dev

# Run all tests
npm test

# With coverage
npm run test:coverage
```

## Project Structure

```
src/
├── app/
│   ├── api/          # REST API routes
│   ├── dashboard/    # TV kiosk page
│   ├── login/        # PIN login page
│   ├── admin/        # Parent admin pages (users, chores)
│   └── agenda/       # Agenda page
├── components/       # Dashboard panels, SSE provider, PIN overlay
├── db/               # Drizzle schema and DB instance
└── lib/              # Auth, chore engine, streaks, event bus
scripts/              # Seed, kiosk startup, backup, launchd plists
tests/                # Unit, integration, and E2E tests
```

## License

MIT
