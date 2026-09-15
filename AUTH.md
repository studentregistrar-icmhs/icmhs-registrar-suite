# Per-user login — setup guide

Replaces the old shared Basic Auth login and the shared "resolve password"
with individual registrar accounts (username + password), roles, and
optional per-campus restriction.

## Roles

| Role   | Can do                                                                 | Campus scope? |
|--------|-------------------------------------------------------------------------|---------------|
| admin  | Everything: edits, CSV bulk upload, carry-forward, cohort tagging/backfill, conflict resolution, managing accounts | No — always all |
| editor | View + edit individual student statuses (profile edits, resolving Unmarked) | Yes — All / Main only / Nakuru only |
| viewer | Read-only — dashboards, reports, student profiles                      | Yes — All / Main only / Nakuru only |

## One-time setup

1. **Run the migration.** Open `lib/auth/schema.sql` and run it against the
   same Postgres database already set as `DATABASE_URL` (the one the
   Deferments module uses — no new database needed, just a new table in it).
   Easiest way: paste it into the Neon console's SQL editor for that project.

2. **Set `SESSION_SECRET`** in Vercel (Project → Settings → Environment
   Variables). This signs every login session — generate one with:
   ```
   openssl rand -base64 32
   ```
   Required — there's no default, and the app refuses to issue sessions
   without it.

3. **Remove the retired variables** if they're still set: `DASHBOARD_USER`,
   `DASHBOARD_PASSWORD`, `RESOLVE_PASSWORD`. Nothing reads them anymore.

4. **Create the first admin account.** This can't be done through the app
   itself (the Manage Accounts page requires already being logged in as an
   admin), so it's a one-off script instead:
   ```
   DATABASE_URL="<your Neon connection string>" npm run create-admin
   ```
   It'll prompt for a username, display name, and password — you type your
   own real password here (not a temp one), so there's no forced reset on
   first login for this one account.

5. **Deploy**, then log in at `/login` with that account.

## Creating everyone else's accounts

Once you're logged in as admin, go to **Manage accounts** (linked from the
home page). For each registrar:

- Pick a username, their display name, a role, and (if not admin) a campus
  scope.
- Creating the account generates a **temporary password shown once** —
  relay it to them however you'd relay any password (in person, a private
  message — not somewhere it'll sit around, like a group chat).
- They log in with that temp password and are immediately required to set
  their own password before doing anything else.

**Forgotten password:** there's no self-service reset (no email sending is
set up). Use the "Reset password" button on their row in Manage Accounts —
it generates a fresh temp password the same way, which you relay to them.

**Someone leaves:** use "Deactivate" rather than deleting — keeps their name
attached to their past edits in the audit trail, just blocks them from
logging in. Reactivate later if needed.

## What changed under the hood

- `middleware.ts` now checks a signed session cookie instead of an HTTP
  Basic Auth header, and attaches the logged-in user's identity to every
  request as headers (`lib/auth/currentUser.ts` reads these).
- Every write route (status edits, bulk upload, carry-forward, cohort
  tagging, conflict resolution) checks the caller's role server-side, not
  just via hidden buttons in the UI.
- Every read route/page filters data to a campus-scoped user's own campus
  *before* computing dashboard numbers — not a client-side filter, a real
  server-side one, so a Main-only account's KPIs are computed purely from
  Main data.
- Audit trails ("who marked this student," "who resolved this conflict")
  now use the logged-in account's real name automatically, instead of a
  free-typed name field.

## Known loose ends

- A few confirmation modals (carry-forward, conflict resolve, bulk upload)
  still show a leftover "password" or "your name" field from the old
  system. Harmless — the server ignores them now and uses your real login
  instead — but worth a cleanup pass so they don't look like they're still
  doing something.
- The Reports page's trend chart isn't campus-scoped yet. It's aggregate
  counts only (no individual student data), so the risk is low, but a
  Main-only account will currently still see combined Main+Nakuru totals
  there.
- Static historical term snapshots (pre-2026, read from JSON files) only
  get partial campus filtering — individual student records are filtered,
  but the department breakdown and top-line totals still reflect the
  original combined snapshot. These terms have no live edit capability, so
  there's no write-side risk, just a minor read-side inconsistency.
