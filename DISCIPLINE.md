# Student disciplinary cases & suspensions

## One-time setup

1. In Neon's SQL editor, run `db/migration_v4_disciplinary.sql` (safe to re-run).
2. Deploy. Admins get access automatically.
3. For anyone else who should see or record cases: **Admin → Manage Users →** open the
   account → tick *Can view and record student disciplinary cases*. Off by default.
   It is checked against the database on every request, so switching it off takes
   effect immediately (no waiting for the person's session to expire).

## How it works

- Open a student's profile → **Disciplinary** section → **Record case**.
- A case holds: incident date, category, **description**, reported by, hearing date,
  case status (open / hearing / decided / appealed / closed), outcome (warning, final
  warning, suspension, expulsion, no action), decision date, decided by, letter
  reference, notes.
- **Suspension** = start date + either an end date or *indefinite*.
  Saving it sets the student's status for the case's term to **Suspended**.
- A suspension does **not** lapse on its end date. The case shows an
  "ended — reinstate" warning, and the student stays Suspended until you click
  **Reinstate student** (which is logged). Reinstatement sets them to
  **Not Yet Reported**, so they report again with a fresh lecture card.
- **Expulsion** sets the status to **Dropped** (locked, like any Dropped student).
- Changing a suspension's outcome later (e.g. an appeal overturns it) lifts the
  Suspended status. Once reinstated, the outcome and dates are locked.

## The Disciplinary area (`/discipline`)

A separate section like Deferments, with a **Disciplinary** link in the top nav. The link
and the page appear only for accounts with disciplinary access (admins always).

- **List of all cases** with filter chips (All, Active suspensions, Reinstatement due,
  Open cases, Decided, Closed), an outcome filter, a category filter, and search by
  name, admission number or case ref.
- **Click a case** to open that student's disciplinary record: description, edit,
  reinstate, and the letter buttons.
- **Record a case:** enter an admission number, the student is looked up, and the
  case form opens straight away. Recording needs a non-Viewer role.
- **Export list (Excel):** case ref, student, course, campus, category, status, outcome,
  dates. Descriptions and notes are deliberately NOT exported. Each export is logged.
- The same campus / school / course / term limits on an account apply to the list,
  the lookup and the export.
- The student profile page keeps its own Disciplinary section (same permission).

**On the term dashboard:** *Suspended* is a status like any other. It appears in the overview
ledger, the KPI row and the term trend, and clicking it lists the suspended students. There is
no separate disciplinary panel on the dashboard any more.

## Letters (phase 2)

On a suspension case, **Suspension letter (PDF)**; once reinstated, **Reinstatement
letter (PDF)**. Letterhead and crest match the deferment form. Each download is logged.

- The letters state only the *category* of the matter, never the free-text description.
- **Review the wording before first use.** All of it is in one block, `LETTER_TEXT`, at the
  top of `lib/discipline/letters.ts` (conduct during suspension, appeal sentence, cc line).
  I wrote it generically; align it with your Student Code of Conduct and disciplinary policy.
- Letters need the same access as recording a case (not view-only).

## Rules the app enforces

- **Suspended can only be set or cleared through a case.** The status dropdown,
  CSV bulk upload and the Unmarked lists all refuse to write it or overwrite it.
- Only single-column terms (Sept–Dec 2026 onward) can hold Suspended; the old
  Jan–Apr / May–Aug blocks have no column for it and are never written.
- Descriptions are returned by exactly one endpoint (a single student's cases) and
  never appear in lists, search, dashboards or exports — only the *Suspended* status does.
- Campus / school / course scoping applies exactly as it does to status edits.
- The audit log records case opened / updated / reinstated and every view of a
  student's record. Entries carry the case reference and outcome, never the description.

## Known limits (phase 1)

- A suspension that runs into the next term does not carry forward automatically:
  when you add the next term's status column, that student will show Unmarked there
  until you handle it. (A "carry Suspended forward" step is the natural next addition.)
- A deferment approval/denial for a currently Suspended student is now blocked from
  overwriting the status; the request is saved and the reviewer sees a warning.
- Letters have no free-text "grounds" field and no editable body; change wording in code.
- Only suspension and reinstatement letters exist (no warning or expulsion letters yet).
- Cases can't be deleted, only closed — deliberate, for the record.
