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
- Approving/denying a deferment writes straight to the status column and would
  overwrite Suspended for a student who applies while suspended.
- Cases can't be deleted, only closed — deliberate, for the record.
