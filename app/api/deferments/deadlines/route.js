import { NextResponse } from "next/server";
import { sql } from "@/lib/deferments/db";
import { SEMESTERS } from "@/lib/deferments/deferment";

const VALID_SEMESTERS = SEMESTERS.map((s) => s.value);

// No dynamic function usage here either — same static-caching trap as
// /api/deferments/requests. Force fresh reads so a registrar-updated
// deadline shows immediately, not after an unpredictable cache delay.
export const dynamic = "force-dynamic";

// Public — the student form needs this to know which semesters are still
// selectable and what to show in the countdown banner. No student data here,
// just intake/deadline configuration. (middleware.ts explicitly allows GET
// on this route through without Basic Auth.)
export async function GET() {
  try {
    const rows = await sql`SELECT semester, year, deadline FROM deferment_deadlines`;
    return NextResponse.json({ deadlines: rows });
  } catch (err) {
    console.error("Deadlines fetch failed:", err);
    return NextResponse.json({ error: "Could not load deadlines." }, { status: 500 });
  }
}

// Registrar-only — sets or updates the deadline for one (semester, year) intake.
// POST requests to this path are gated by middleware.ts (Basic Auth) before
// they ever reach here, so no session check is needed in this handler.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { semester, year, deadline } = body;

  if (!VALID_SEMESTERS.includes(semester)) {
    return NextResponse.json({ error: "Invalid semester." }, { status: 400 });
  }
  if (!year || isNaN(Number(year))) {
    return NextResponse.json({ error: "Invalid year." }, { status: 400 });
  }
  const deadlineDate = new Date(deadline);
  if (isNaN(deadlineDate.getTime())) {
    return NextResponse.json({ error: "Invalid deadline date/time." }, { status: 400 });
  }

  try {
    await sql`
      INSERT INTO deferment_deadlines (semester, year, deadline, updated_at)
      VALUES (${semester}, ${String(year)}, ${deadlineDate.toISOString()}, now())
      ON CONFLICT (semester, year)
      DO UPDATE SET deadline = EXCLUDED.deadline, updated_at = now()
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Deadline save failed:", err);
    return NextResponse.json({ error: "Could not save deadline." }, { status: 500 });
  }
}
