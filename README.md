# ICMHS Registrar Suite

A single Next.js app for the ICMHS Office of the Registrar of Students,
merging what used to be two separate deployments:

- **Dashboard module** (`/`, `/students`, `/terms/*`) — the live student
  population tracker, data-quality tools, and per-student timeline.
- **Deferments module** (`/deferments/apply`, `/deferments/admin`) — the
  student deferment intake form and the Registrar Review panel.

Both modules read/write the same Google Sheet using one shared service
account (`lib/googleSheets.ts`). The Deferments module additionally uses its
own Neon Postgres database for request records and deadline settings.

## Access control

The whole suite is gated by one HTTP Basic Auth password
(`DASHBOARD_PASSWORD` / `DASHBOARD_USER`), enforced at the edge in
`middleware.ts` — **except** the student-facing `/deferments/apply` form and
its two supporting API routes (`lookup-student`, `submit`), which stay public
so students without a registrar password can still apply. Everything else,
including `/deferments/admin`, is behind the gate.

## Environment variables

See `.env.example` for the full list. In short: the Google Sheets vars and
`DASHBOARD_PASSWORD`/`DASHBOARD_USER`/`RESOLVE_PASSWORD` from the old
dashboard app, plus `DATABASE_URL` from the old deferment app. If you're
reusing the same Neon database and Google service account those two apps
already used, copy the values straight across — no database migration is
needed, this is the same schema.

## Deploying (browser-only workflow, no local Node install needed)

1. Extract this zip.
2. Create a new GitHub repository and upload the extracted folder through
   GitHub's web UI (drag-and-drop upload works for this size of project).
3. In Vercel: **Add New → Project**, import that repo.
4. Under **Environment Variables**, add everything listed in `.env.example`.
5. Deploy — Vercel builds in the cloud, so nothing needs to run locally.
6. Once it's live and verified, you can safely decommission the two old
   standalone deployments (icmhsdeferment.vercel.app and the old dashboard
   URL). Consider leaving them up (unlinked) for a couple of weeks first as
   a rollback safety net.

## What changed in the merge

- Deferment's code was ported from Next.js 16 / React 19 down to this
  project's Next.js 14 / React 18, to match the dashboard (the more
  mature, already-tested half of the merge).
- Deferment's own cookie-based login (`REGISTRAR_PASSWORD` +
  `SESSION_SECRET`) was retired in favor of the dashboard's existing
  Basic Auth gate. The public apply form was carved out as an explicit
  exception in `middleware.ts`.
- Deferment's `lib/googleSheets.js` (student lookup, status write-back) was
  merged into the dashboard's existing `lib/googleSheets.ts` rather than
  kept as a second, separate Sheets client.
- All other deferment `lib/` files (`db.js`, `deferment.js`, `excel.js`,
  `pdf.js`, `programmeMapping.js`) moved as-is into `lib/deferments/`.
- Deferment's styling (`app/globals.css`) moved to
  `app/deferments/deferments.css`, scoped under a `.deferments-scope`
  wrapper (via `app/deferments/layout.js`) instead of styling `html,body`
  globally, so it can't bleed into the dashboard's own pages.
