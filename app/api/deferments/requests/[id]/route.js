import { NextResponse } from "next/server";
import { sql } from "@/lib/deferments/db";
import { updateDefermentStatusInSheet, mirrorDefermentStatusToCampusTab } from "@/lib/googleSheets";

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
        await updateDefermentStatusInSheet(rows[0].admission_number, label);
        await mirrorDefermentStatusToCampusTab(rows[0].campus, rows[0].admission_number, label);
      } else if (status === "denied" || status === "pending") {
        await updateDefermentStatusInSheet(rows[0].admission_number, "");
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
