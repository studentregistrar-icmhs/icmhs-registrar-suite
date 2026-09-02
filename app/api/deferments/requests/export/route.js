import { NextResponse } from "next/server";
import { sql } from "@/lib/deferments/db";
import { generateRequestsExcel } from "@/lib/deferments/excel";

const VALID_STATUSES = ["pending", "approved", "denied"];

// Registrar-only — protected by middleware.ts (Basic Auth) before this runs.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const status = VALID_STATUSES.includes(statusParam) ? statusParam : null;

  try {
    const rows = status
      ? await sql`SELECT * FROM deferment_requests WHERE status = ${status} ORDER BY submitted_at DESC`
      : await sql`SELECT * FROM deferment_requests ORDER BY submitted_at DESC`;

    const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : "All";
    const buffer = await generateRequestsExcel(rows, label);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="icmhs-deferment-requests-${label.toLowerCase()}.xlsx"`
      }
    });
  } catch (err) {
    console.error("Bulk export failed:", err);
    return NextResponse.json({ error: "Could not generate spreadsheet." }, { status: 500 });
  }
}
