# Per-user login — setup guide

Replaces the old shared Basic Auth login and the shared "resolve password"
with individual registrar accounts (username + password), roles, and
optional restriction by campus, department/school, term, and access to the
Deferments module — e.g. an HOD account scoped to just their own school.

## Roles and scoping

| Role   | Can do                                                                 | Scoping available |
|--------|-------------------------------------------------------------------------|---------------|
| admin  | Everything: edits, CSV bulk upload, carry-forward, cohort tagging/backfill, conflict resolution, managing accounts, Deferments | None — always full access on every dimension |
| editor | View + edit individual student statuses (profile edits, resolving Unmarked) | Campus, department/school, term, Deferments — each independently, all optional |
| viewer | Read-only — dashboards, reports, student profiles                      | Same as editor |

The four scoping dimensions are independent and combine with AND — an
account can be restricted on any mix of them, or none. A department scope
of "School of Nursing" plus a term scope of "Sept-Dec 2026" means exactly
that: this account only ever sees Nursing students, and only for that one
term, everywhere in the app (dashboards, search, student profiles, Unmarked
list, exports). Leaving a dimension unset means "no restriction" on that
one — most accounts will only need one or two of the four set.

All scoping is enforced server-side — data is filtered before it's even
assembled into dashboard numbers, not just hidden by the UI. A department-
scoped account's KPIs, department breakdown, and conflict report are
computed purely from their own department's students.

## One-time setup

1. **Run the migrations**, in order, against the same Postgres database
   already set as `DATABASE_URL` (the one the Deferments module uses — no
   new database needed, just new tables/columns in it). Easiest way: paste
   each into the Neon console's SQL editor for that project.
   - `lib/auth/schema.sql` — creates the `registrar_users` table (skip this
     one if you've already run it on a previous setup).
   - `lib/auth/migration_v2_scopes.sql` — adds department scope, term
     scope, and the Deferments-visibility toggle to that table. Safe to run
     even on a table with existing accounts: everyone keeps their current
     access (unrestricted department/term, Deferments visible) until you
     explicitly change it.

2. **Set `SESSION_SECRET`** in Vercel (Project → Settings → Environment
   Variables). This signs every login session — generate one with:
   ```
   openssl rand -base64 32
   ```
   Required — there's no default, and the app refuses to issue sessions
   without it. Skip this if it's already set from a previous setup.

3. **Remove the retired variables** if they're still set: `DASHBOARD_USER`,
   `DASHBOARD_PASSWORD`, `RESOLVE_PASSWORD`. Nothing reads them anymore.

4. **Create the first admin account**, if you don't already have one. This
   can't be done through the app itself (the Manage Accounts page requires
   already being logged in as an admin), so it's a one-off script instead:
   ```
   DATABASE_URL="<your Neon connection string>" npm run create-admin
   ```
   It'll prompt for a username, display name, and password — you type your
   own real password here (not a temp one), so there's no forced reset on
   first login for this one account.

5. **Deploy**, then log in at `/login` with that account.

## Creating an HOD (or any scoped) account

From **Manage accounts** (linked from the home page), **+ Add registrar
account**, then role **Editor** or **Viewer** (Admin has no scoping — pick
one of these two for anyone who should be restricted at all):

- **Campus scope**: Both / Main only / Nakuru only.
- **School / department scope**: a checklist of every school. Leave every
  box unchecked for access to all schools; check just the one(s) this
  person oversees (e.g. an HOD checks only their own school) to restrict
  them to it everywhere in the app.
- **Term scope**: a checklist of every term. Leave unchecked for access to
  every term including future ones added later; check specific terms (e.g.
  just the current semester) to restrict what they can see at all — an
  out-of-scope term never appears as a dashboard card and can't be reached
  by URL either.
- **Can view the Deferments registrar review area**: unchecked by default
  for new non-admin accounts — most HODs won't need it. Check it for anyone
  who should be able to review/approve deferment requests.

Creating the account generates a **temporary password shown once** — relay
it to them however you'd relay any password (in person, a private message
— not somewhere it'll sit around, like a group chat). They log in with it
and are immediately required to set their own password before doing
anything else.

An existing account's access can be changed the same way at any time —
**Edit access** on their row in Manage Accounts, adjust, **Save access**.

**Forgotten password:** there's no self-service reset (no email sending is
set up). Use the "Reset password" button on their row — it generates a
fresh temp password the same way, which you relay to them.

**Someone leaves:** use "Deactivate" rather than deleting — keeps their name
attached to their past edits in the audit trail, just blocks them from
logging in. Reactivate later if needed.

## What changed under the hood

- `middleware.ts` now checks a signed session cookie instead of an HTTP
  Basic Auth header, and attaches the logged-in user's identity — including
  department scope, term scope, and Deferments access — to every request as
  headers (`lib/auth/currentUser.ts` reads these). It also blocks the
  Deferments admin area at the edge for any account without that
  permission, before the page or its API routes even run.
- Every write route (status edits, bulk upload, carry-forward, cohort
  tagging, conflict resolution, Unmarked marking) checks the caller's role,
  campus, department, and term access server-side, not just via hidden
  buttons in the UI.
- Every read route/page filters data to a scoped user's own campus and/or
  department *before* computing dashboard numbers — not a client-side
  filter, a real server-side one.
- A term-scoped account's student profile pages only ever show terms within
  their scope — even a term chronologically earlier that would normally
  show as read-only history is dropped if it's outside their term scope.
- Audit trails ("who marked this student," "who resolved this conflict")
  use the logged-in account's real name automatically, instead of a
  free-typed name field.

## Known loose ends

- A few confirmation modals (carry-forward, conflict resolve, bulk upload)
  still show a leftover "password" or "your name" field from the old
  system. Harmless — the server ignores them now and uses your real login
  instead — but worth a cleanup pass so they don't look like they're still
  doing something.
- The Reports page's trend chart isn't campus- or department-scoped yet.
  It's aggregate counts only (no individual student data), so the risk is
  low, but a scoped account will currently still see combined totals there.
- Static historical term snapshots (pre-2026, read from JSON files) only
  get partial campus/department filtering — individual student records are
  filtered, but the department breakdown and top-line totals still reflect
  the original combined snapshot. These terms have no live edit capability,
  so there's no write-side risk, just a minor read-side inconsistency.
