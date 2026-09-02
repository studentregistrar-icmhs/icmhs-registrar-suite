import { NextResponse } from "next/server";
import { sql } from "@/lib/deferments/db";
import { mirrorDefermentStatusToCampusTab } from "@/lib/googleSheets";
// updateDefermentStatusInSheet (writes to the "STATUS LOG" tab) is no longer
// called here — as of Sept-Dec 2026 that tab is retired in favour of the
// single status column (CAMPUS_STATUS_MIRROR_COLUMN) on the campus tabs
// themselves, written below. The function still exists in lib/googleSheets.ts
// if you ever need it again.

const ALLOWED_STATUSES = ["pending", "approved", "denied"];

// Registrar-only — protected by middleware.ts (Basic Auth) before this runs.
export async function PATCH(request, context) {
  const { id } = await context.params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const status = body.status;
  const reviewerNotes = body.reviewerNotes ?? "";

  if (!ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  try {
    const rows = await sql`
      UPDATE deferment_requests
      SET status = ${status}, reviewer_notes = ${reviewerNotes}, reviewed_at = now()
      WHERE id = ${id}
      RETURNING *
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }
    try {
      if (status === "approved") {
        const label = `${rows[0].type_of_deferment || "Deferment"} - Approved`;
        await mirrorDefermentStatusToCampusTab(rows[0].campus, rows[0].admission_number, label);
      } else if (status === "denied" || status === "pending") {
        await mirrorDefermentStatusToCampusTab(rows[0].campus, rows[0].admission_number, "");
      }
    } catch (sheetErr) {
      console.error("Google Sheets update failed:", sheetErr);
    }
    return NextResponse.json({ request: rows[0] });
  } catch (err) {
    console.error("Update failed:", err);
    return NextResponse.json({ error: "Could not update request." }, { status: 500 });
  }
}
